/**
 * SKYDASH BANK — Middleware de sécurité
 * Headers HTTP, CORS, Rate Limiting
 * Conformité OWASP, PCI-DSS Req. 6.4, CIS Controls
 */
'use strict';

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { logger } = require('../utils/logger');

/**
 * Configuration Helmet — Headers HTTP de sécurité
 * Protège contre XSS, clickjacking, MIME sniffing, etc.
 */
const helmetMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // 'unsafe-inline' pour Bootstrap (à restreindre via nonce en prod)
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],             // Anti-clickjacking
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  // HTTP Strict Transport Security (HTTPS forcé — 1 an)
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  // Empêche le MIME sniffing
  noSniff: true,
  // Protection XSS navigateurs anciens
  xssFilter: true,
  // Politique de referrer stricte
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Désactive X-Powered-By (masquage de stack)
  hidePoweredBy: true,
  // Politique d'origine croisée
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  // Permissions navigateur
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
    },
  },
});

/**
 * Configuration CORS — Origine stricte
 */
const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (ex: Postman en dev)
    if (!origin && !config.isProd) return callback(null, true);

    if (config.security.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ message: 'Requête CORS rejetée', origin });
      callback(new Error('CORS_NOT_ALLOWED'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  credentials: true,               // Autorise les cookies cross-origin
  maxAge: 86400,                   // Cache preflight 24h
  optionsSuccessStatus: 200,
});

/**
 * Rate Limiter global — Limite les abus
 * PCI-DSS Req. 6.3.2
 */
const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de requêtes. Veuillez réessayer dans quelques minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: 'Rate limit global atteint',
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json(options.message);
  },
});

/**
 * Rate Limiter strict pour les endpoints d'authentification
 * PCI-DSS Req. 8.3.4 — Max 6 tentatives avant verrouillage
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // Fenêtre de 15 minutes
  max: config.rateLimit.authMax,   // 5 tentatives max par IP
  skipSuccessfulRequests: true,    // Ne compte pas les succès
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de tentatives de connexion. Compte temporairement bloqué.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: 'Rate limit auth atteint',
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.headers['user-agent'],
    });
    res.status(429).json(options.message);
  },
});

/**
 * Middleware d'ID de requête — Traçabilité
 */
const requestId = (req, res, next) => {
  const { v4: uuidv4 } = require('uuid');
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Suppression des champs sensibles des réponses d'erreur
 */
const sanitizeErrors = (err, req, res, next) => {
  // Log complet de l'erreur côté serveur
  logger.error({
    message: err.message,
    stack: config.env !== 'production' ? err.stack : undefined,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Réponse client minimale (pas de stack trace en prod)
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: config.isProd && status === 500
      ? 'Une erreur interne est survenue.'
      : err.message,
    code: err.code || 'INTERNAL_ERROR',
    requestId: req.requestId,
  });
};

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  globalRateLimiter,
  authRateLimiter,
  requestId,
  sanitizeErrors,
};
