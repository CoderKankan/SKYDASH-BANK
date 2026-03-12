/**
 * SKYDASH BANK — Contrôleur d'authentification
 * Gestion : Inscription, Connexion, Refresh, Déconnexion, MFA
 * Conformité PCI-DSS Req. 8, OWASP ASVS, DSP2 SCA
 */
'use strict';

const { validationResult } = require('express-validator');
const speakeasy = require('speakeasy');
const { createUser, verifyPassword, findById, updateMfaSecret, sanitizeUser } = require('../models/userStore');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} = require('../utils/tokenUtils');
const { audit, logger } = require('../utils/logger');
const config = require('../config');

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 */
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Données invalides.',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
      code: 'VALIDATION_ERROR',
    });
  }

  const { email, password, firstName, lastName } = req.body;

  try {
    const user = await createUser({ email, password, firstName, lastName });

    audit('USER_REGISTERED', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
      data: { userId: user.id },
    });
  } catch (err) {
    if (err.message === 'EMAIL_ALREADY_EXISTS') {
      // Réponse identique pour éviter l'énumération d'emails
      return res.status(201).json({
        success: true,
        message: 'Si cet email n\'est pas déjà enregistré, un compte a été créé.',
      });
    }
    throw err;
  }
};

/**
 * POST /api/auth/login
 * Première étape : vérification email/password
 * Retourne un token de session temporaire si MFA est requis
 */
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Email ou mot de passe invalide.',
      code: 'VALIDATION_ERROR',
    });
  }

  const { email, password } = req.body;

  try {
    const user = await verifyPassword(email, password, req.ip);

    if (!user) {
      audit('LOGIN_FAILED', {
        email,
        reason: 'INVALID_CREDENTIALS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Délai de réponse constant (anti timing attack)
      await new Promise(r => setTimeout(r, 300));

      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Si MFA activé → étape 2 requise
    if (user.mfaEnabled) {
      const tempToken = generateAccessToken({
        userId: user.id,
        role: 'mfa_pending',   // Rôle temporaire jusqu'à validation MFA
        email: user.email,
      });

      audit('LOGIN_MFA_REQUIRED', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      return res.status(200).json({
        success: true,
        mfaRequired: true,
        tempToken,
        message: 'Veuillez saisir votre code d\'authentification à deux facteurs.',
      });
    }

    // Connexion directe (MFA non activé)
    return issueTokens(res, user, req);

  } catch (err) {
    if (err.message === 'ACCOUNT_LOCKED') {
      audit('LOGIN_ACCOUNT_LOCKED', {
        email,
        ip: req.ip,
      });
      return res.status(423).json({
        success: false,
        error: 'Compte temporairement verrouillé suite à trop de tentatives. Réessayez dans 30 minutes.',
        code: 'ACCOUNT_LOCKED',
      });
    }
    throw err;
  }
};

/**
 * POST /api/auth/mfa/verify
 * Deuxième étape MFA — Vérification du code TOTP
 */
const verifyMfa = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Code MFA invalide.',
      code: 'VALIDATION_ERROR',
    });
  }

  const { code } = req.body;
  const user = findById(req.user.id);

  if (!user || !user.mfaSecret) {
    return res.status(400).json({
      success: false,
      error: 'MFA non configuré.',
      code: 'MFA_NOT_CONFIGURED',
    });
  }

  const isValid = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: code,
    window: 1,    // ±30 secondes de tolérance
  });

  if (!isValid) {
    audit('MFA_VERIFICATION_FAILED', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
    });
    return res.status(401).json({
      success: false,
      error: 'Code MFA incorrect ou expiré.',
      code: 'MFA_INVALID',
    });
  }

  audit('MFA_VERIFICATION_SUCCESS', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
  });

  return issueTokens(res, user, req);
};

/**
 * POST /api/auth/mfa/setup
 * Configure MFA pour un utilisateur (génère un secret TOTP)
 */
const setupMfa = (req, res) => {
  const user = findById(req.user.id);

  const secret = speakeasy.generateSecret({
    name: `${config.mfa.issuer} (${user.email})`,
    issuer: config.mfa.issuer,
    length: 32,
  });

  // Stocke le secret sans activer MFA (activation après vérification)
  updateMfaSecret(user.id, secret.base32, false);

  audit('MFA_SETUP_INITIATED', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      // QR code à générer côté frontend avec qrcode.js
    },
  });
};

/**
 * POST /api/auth/mfa/confirm
 * Confirme l'activation du MFA après scan du QR code
 */
const confirmMfa = (req, res) => {
  const { code } = req.body;
  const user = findById(req.user.id);

  if (!user?.mfaSecret) {
    return res.status(400).json({
      success: false,
      error: 'MFA non initialisé. Appelez /api/auth/mfa/setup d\'abord.',
      code: 'MFA_NOT_INITIALIZED',
    });
  }

  const isValid = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: code,
    window: 1,
  });

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Code MFA incorrect. Configuration annulée.',
      code: 'MFA_CONFIRM_FAILED',
    });
  }

  updateMfaSecret(user.id, user.mfaSecret, true);

  audit('MFA_ACTIVATED', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Authentification à deux facteurs activée avec succès.',
  });
};

/**
 * POST /api/auth/refresh
 * Renouvelle l'access token via le refresh token (stocké en cookie HttpOnly)
 */
const refresh = (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token manquant.',
      code: 'REFRESH_TOKEN_MISSING',
    });
  }

  const userId = verifyRefreshToken(refreshToken);
  if (!userId) {
    res.clearCookie('refreshToken');
    return res.status(401).json({
      success: false,
      error: 'Refresh token invalide ou expiré.',
      code: 'REFRESH_TOKEN_INVALID',
    });
  }

  const user = findById(userId);
  if (!user || !user.isActive) {
    revokeRefreshToken(refreshToken);
    res.clearCookie('refreshToken');
    return res.status(401).json({
      success: false,
      error: 'Session invalide.',
      code: 'SESSION_INVALID',
    });
  }

  // Rotation du refresh token (prévention du vol de token)
  revokeRefreshToken(refreshToken);
  const newRefreshToken = generateRefreshToken(userId);
  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });

  res.json({
    success: true,
    data: { accessToken },
  });
};

/**
 * POST /api/auth/logout
 * Déconnexion — Révocation du refresh token
 */
const logout = (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }

  audit('USER_LOGOUT', {
    userId: req.user?.id,
    email: req.user?.email,
    ip: req.ip,
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'Strict',
    path: '/api/auth/refresh',
  });

  res.json({
    success: true,
    message: 'Déconnexion réussie.',
  });
};

/**
 * POST /api/auth/logout-all
 * Déconnexion de toutes les sessions (vol de compte)
 */
const logoutAll = (req, res) => {
  revokeAllUserTokens(req.user.id);
  res.clearCookie('refreshToken');

  audit('USER_LOGOUT_ALL_SESSIONS', {
    userId: req.user.id,
    email: req.user.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Toutes vos sessions ont été fermées.',
  });
};

/**
 * GET /api/auth/me
 * Retourne le profil de l'utilisateur connecté
 */
const getMe = (req, res) => {
  const user = findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'Utilisateur non trouvé.',
      code: 'NOT_FOUND',
    });
  }

  res.json({
    success: true,
    data: sanitizeUser(user),
  });
};

// ── Helpers privés ──────────────────────────────────────────────────────────

/**
 * Génère et envoie les tokens d'authentification
 */
const issueTokens = (res, user, req) => {
  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  const refreshToken = generateRefreshToken(user.id);

  // Refresh token en cookie HttpOnly (inaccessible depuis JavaScript)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 jours
    path: '/api/auth/refresh',
  });

  audit('LOGIN_SUCCESS', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.json({
    success: true,
    message: 'Connexion réussie.',
    data: {
      accessToken,
      user: sanitizeUser(user),
      expiresIn: config.jwt.expiresIn,
    },
  });
};

module.exports = {
  register,
  login,
  verifyMfa,
  setupMfa,
  confirmMfa,
  refresh,
  logout,
  logoutAll,
  getMe,
};
