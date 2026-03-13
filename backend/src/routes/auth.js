/**
 * SKYDASH BANK — Routes d'authentification
 * Avec validation des entrées (express-validator)
 */
'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  register,
  login,
  verifyMfa,
  setupMfa,
  confirmMfa,
  refresh,
  logout,
  logoutAll,
  getMe,
} = require('../controllers/authController');

const { authenticate, authorize } = require('../middleware/authMiddleware');
const { authRateLimiter } = require('../middleware/security');

// ── Règles de validation ────────────────────────────────────────────────────

const passwordRules = body('password')
  .isLength({ min: 12, max: 128 })
  .withMessage('Le mot de passe doit contenir entre 12 et 128 caractères.')
  .matches(/[A-Z]/)
  .withMessage('Le mot de passe doit contenir au moins une majuscule.')
  .matches(/[a-z]/)
  .withMessage('Le mot de passe doit contenir au moins une minuscule.')
  .matches(/[0-9]/)
  .withMessage('Le mot de passe doit contenir au moins un chiffre.')
  .matches(/[^A-Za-z0-9]/)
  .withMessage('Le mot de passe doit contenir au moins un caractère spécial.');

const emailRules = body('email')
  .isEmail()
  .withMessage('Email invalide.')
  .normalizeEmail()
  .isLength({ max: 254 });

const mfaCodeRules = body('code')
  .isLength({ min: 6, max: 6 })
  .withMessage('Le code MFA doit contenir exactement 6 chiffres.')
  .isNumeric()
  .withMessage('Le code MFA doit être numérique.');

// ── Routes publiques ────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
router.post('/register',
  authRateLimiter,
  [
    emailRules,
    passwordRules,
    body('firstName')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Le prénom doit contenir entre 2 et 50 caractères.')
      .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
      .withMessage('Le prénom contient des caractères non autorisés.'),
    body('lastName')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Le nom doit contenir entre 2 et 50 caractères.')
      .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
      .withMessage('Le nom contient des caractères non autorisés.'),
  ],
  register
);

/**
 * POST /api/auth/login
 */
router.post('/login',
  authRateLimiter,
  [
    emailRules,
    body('password')
      .notEmpty()
      .withMessage('Mot de passe requis.')
      .isLength({ max: 128 }),
  ],
  login
);

/**
 * POST /api/auth/refresh
 * Renouvellement de token (refresh token en cookie)
 */
router.post('/refresh', refresh);

// ── Routes protégées (JWT requis) ───────────────────────────────────────────

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, logout);

/**
 * POST /api/auth/logout-all
 */
router.post('/logout-all', authenticate, logoutAll);

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, getMe);

/**
 * POST /api/auth/mfa/setup
 * Initie la configuration MFA
 */
router.post('/mfa/setup',
  authenticate,
  authorize('client', 'agent', 'admin'),
  setupMfa
);

/**
 * POST /api/auth/mfa/confirm
 * Confirme et active le MFA
 */
router.post('/mfa/confirm',
  authenticate,
  [mfaCodeRules],
  confirmMfa
);

/**
 * POST /api/auth/mfa/verify
 * Vérifie le code MFA (étape 2 de connexion)
 */
router.post('/mfa/verify',
  authenticate,
  [mfaCodeRules],
  verifyMfa
);

module.exports = router;
