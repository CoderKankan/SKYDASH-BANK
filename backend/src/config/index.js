/**
 * SKYDASH BANK — Configuration centralisée
 * Toutes les variables d'env sont validées au démarrage
 */
'use strict';

require('dotenv').config();

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Variable d'environnement requise manquante: ${key}`);
  return val;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  isProd: process.env.NODE_ENV === 'production',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-64-chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-in-prod',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  },

  security: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()),
    sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 15,
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS, 10) || 5,
    lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES, 10) || 30,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 5,
  },

  mfa: {
    issuer: process.env.MFA_ISSUER || 'SkyDash Bank',
    required: process.env.MFA_REQUIRED !== 'false',
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  db: {
    type: process.env.DB_TYPE || 'sqlite',
    path: process.env.DB_PATH || './data/skydash_bank.db',
    url: process.env.DATABASE_URL,
  },
};

module.exports = config;
