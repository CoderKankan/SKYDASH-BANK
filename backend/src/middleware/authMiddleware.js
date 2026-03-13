/**
 * SKYDASH BANK — Middleware d'authentification JWT
 * Validation de token, RBAC, vérification de session
 */
'use strict';

const { verifyAccessToken } = require('../utils/tokenUtils');
const { findById } = require('../models/userStore');
const { audit } = require('../utils/logger');

/**
 * Vérifie le JWT dans le header Authorization
 * Format attendu: "Bearer <token>"
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token d\'authentification requis.',
      code: 'UNAUTHORIZED',
    });
  }

  const token = authHeader.slice(7); // Retire "Bearer "

  try {
    const payload = verifyAccessToken(token);

    // Vérification que l'utilisateur existe toujours et est actif
    const user = findById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Session invalide ou compte désactivé.',
        code: 'SESSION_INVALID',
      });
    }

    // Vérification que le token n'est pas antérieur à un changement de mot de passe
    if (user.passwordChangedAt) {
      const pwdChangedAt = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (payload.iat < pwdChangedAt) {
        return res.status(401).json({
          success: false,
          error: 'Token révoqué suite à un changement de mot de passe.',
          code: 'TOKEN_REVOKED',
        });
      }
    }

    // Attache l'utilisateur à la requête
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      mfaEnabled: user.mfaEnabled,
    };
    req.tokenPayload = payload;

    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';

    audit('TOKEN_VALIDATION_FAILED', {
      error: err.name,
      ip: req.ip,
      path: req.path,
    });

    return res.status(401).json({
      success: false,
      error: isExpired
        ? 'Session expirée. Veuillez vous reconnecter.'
        : 'Token invalide.',
      code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }
};

/**
 * Contrôle d'accès basé sur les rôles (RBAC)
 * Usage: authorize('admin', 'agent')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise.',
        code: 'UNAUTHORIZED',
      });
    }

    if (!roles.includes(req.user.role)) {
      audit('UNAUTHORIZED_ACCESS_ATTEMPT', {
        userId: req.user.id,
        email: req.user.email,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        error: 'Vous n\'avez pas les permissions nécessaires.',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};

/**
 * Vérifie que l'utilisateur accède uniquement à ses propres ressources
 * Prévention IDOR (Insecure Direct Object Reference — OWASP A01)
 */
const ownResourceOnly = (req, res, next) => {
  const requestedId = req.params.userId || req.params.id;

  if (req.user.role === 'admin') return next(); // Admin peut tout voir

  if (requestedId && requestedId !== req.user.id) {
    audit('IDOR_ATTEMPT', {
      userId: req.user.id,
      requestedId,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      success: false,
      error: 'Accès refusé à cette ressource.',
      code: 'FORBIDDEN',
    });
  }

  next();
};

module.exports = { authenticate, authorize, ownResourceOnly };
