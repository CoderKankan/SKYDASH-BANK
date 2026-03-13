/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              SKYDASH BANK — Serveur API Sécurisé                ║
 * ║         Conformité: PCI-DSS • RGPD • ISO 27001 • OWASP         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Architecture: Express.js REST API
 * Sécurité: JWT + Refresh Tokens + MFA (TOTP) + Rate Limiting
 * Logging: Winston structuré JSON (audit trail PCI-DSS Req.10)
 */
'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

const config = require('./config');
const { logger, audit } = require('./utils/logger');
const {
  helmetMiddleware,
  corsMiddleware,
  globalRateLimiter,
  requestId,
  sanitizeErrors,
} = require('./middleware/security');

// Routes
const authRoutes         = require('./routes/auth');
const dashboardRoutes    = require('./routes/dashboard');
const comptesRoutes      = require('./routes/comptes');
const transactionsRoutes = require('./routes/transactions');
const virementsRoutes    = require('./routes/virements');
const cartesRoutes       = require('./routes/cartes');
const epargneRoutes      = require('./routes/epargne');
const beneficiairesRoutes = require('./routes/beneficiaires');
const rgpdRoutes         = require('./middleware/rgpd');

// Conformité réglementaire
const {
  pciDataMasking,
  dataRetentionHeaders,
  auditApiAccess,
  validateObjectIds,
  preventPIIInUrls,
  inputSanitization,
} = require('./middleware/compliance');

const app = express();

// ── Middleware de base ──────────────────────────────────────────────────────

// ID de requête unique (traçabilité)
app.use(requestId);

// Headers de sécurité HTTP
app.use(helmetMiddleware);

// CORS sécurisé
app.use(corsMiddleware);

// Compression des réponses
app.use(compression());

// Parse JSON avec limite de taille (prévention DoS)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Parse des cookies (pour refresh token HttpOnly)
app.use(cookieParser());

// Logging HTTP (format combiné pour SIEM, sans données sensibles)
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/api/health',  // Ne logge pas les healthchecks
}));

// Rate limiting global
app.use('/api', globalRateLimiter);

// ── Middleware de conformité réglementaire ──────────────────────────────────
app.use('/api', dataRetentionHeaders);  // RGPD Art.13 — headers informatifs
app.use('/api', auditApiAccess);        // PCI-DSS Req.10 — audit trail
app.use('/api', preventPIIInUrls);      // RGPD Art.32 — PII dans les URLs
app.use('/api', pciDataMasking);        // PCI-DSS Req.3 — masquage PAN
app.use('/api', inputSanitization);     // OWASP A03 — injection prevention
app.use('/api', validateObjectIds);     // OWASP A01 — IDOR prevention

// ── Serveur de fichiers statiques (frontend) ────────────────────────────────

// Sert les fichiers du projet frontend
app.use(express.static(path.join(__dirname, '../../'), {
  dotfiles: 'deny',          // Refuse les fichiers cachés (.env, etc.)
  etag: true,
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    // Cache court pour les HTML (contenu dynamique)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// ── Routes API ──────────────────────────────────────────────────────────────

// Santé du serveur (monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'skydash-bank-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes du dashboard (protégées)
app.use('/api/dashboard', dashboardRoutes);

// Routes bancaires (protégées — JWT requis)
app.use('/api/comptes',       comptesRoutes);
app.use('/api/transactions',  transactionsRoutes);
app.use('/api/virements',     virementsRoutes);
app.use('/api/cartes',        cartesRoutes);
app.use('/api/epargne',       epargneRoutes);
app.use('/api/beneficiaires', beneficiairesRoutes);

// Routes RGPD — Droits des personnes (Art. 15-22)
app.use('/api/rgpd', rgpdRoutes);

// ── Gestion des routes non trouvées ────────────────────────────────────────

app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint non trouvé.',
    code: 'NOT_FOUND',
    path: req.path,
  });
});

// SPA fallback — toutes les routes non-API servent index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});

// ── Middleware de gestion d'erreurs (doit être en dernier) ──────────────────
app.use(sanitizeErrors);

// ── Démarrage du serveur ────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  logger.info({
    message: '🏦 SkyDash Bank API démarrée',
    port: config.port,
    environment: config.env,
    timestamp: new Date().toISOString(),
  });

  audit('SERVER_STARTED', {
    port: config.port,
    environment: config.env,
    nodeVersion: process.version,
  });
});

// ── Arrêt gracieux ──────────────────────────────────────────────────────────

const gracefulShutdown = (signal) => {
  logger.info({ message: `Signal ${signal} reçu. Arrêt gracieux...` });
  server.close(() => {
    logger.info({ message: 'Serveur arrêté proprement.' });
    process.exit(0);
  });

  // Force l'arrêt après 10s si des connexions restent ouvertes
  setTimeout(() => {
    logger.error({ message: 'Arrêt forcé après timeout.' });
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Capture des erreurs non gérées
process.on('uncaughtException', (err) => {
  logger.error({ message: 'Exception non capturée', error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ message: 'Promesse rejetée non gérée', reason: String(reason) });
  process.exit(1);
});

module.exports = app;
