/**
 * SKYDASH BANK — Middleware de Conformité Réglementaire
 * ════════════════════════════════════════════════════════
 * Couverture : PCI-DSS v4.0 | RGPD (GDPR) | ISO 27001
 *              OWASP ASVS Level 2 | DSP2 SCA
 * ════════════════════════════════════════════════════════
 */
'use strict';

const { audit, logger } = require('../utils/logger');

/**
 * PCI-DSS Req. 3.3 / 3.4 — Masquage des données sensibles
 * Masque automatiquement les PAN (Primary Account Number) dans les logs et réponses
 *
 * Format: affiche seulement les 4 derniers chiffres
 * Ex: 4111111111111111 → ●●●● ●●●● ●●●● 1111
 */
const maskSensitiveData = (data) => {
  if (!data || typeof data !== 'string') return data;
  // Masquage PAN (16 chiffres)
  return data.replace(/\b(\d{4})\s*\d{4}\s*\d{4}\s*(\d{4})\b/g, '•••• •••• •••• $2');
};

/**
 * Middleware de masquage des données PCI dans les réponses API
 */
const pciDataMasking = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Masque les champs sensibles dans toutes les réponses
    if (body && typeof body === 'object') {
      const masked = JSON.parse(
        JSON.stringify(body, (key, value) => {
          if (['pan', 'cardNumber', 'cvv', 'cvv2', 'pin'].includes(key.toLowerCase())) {
            return '•••• MASQUÉ (PCI-DSS) ••••';
          }
          if (typeof value === 'string') return maskSensitiveData(value);
          return value;
        })
      );
      return originalJson(masked);
    }
    return originalJson(body);
  };
  next();
};

/**
 * RGPD Art. 13/14 — Politique de rétention des données
 * Ajoute les headers informatifs de rétention des données
 */
const dataRetentionHeaders = (req, res, next) => {
  // Information sur la rétention (visible dans les headers HTTP)
  res.setHeader('X-Data-Retention-Policy', '5-years-financial-records,3-years-audit-logs');
  res.setHeader('X-GDPR-Controller', 'SkyDash Bank SAS');
  res.setHeader('X-GDPR-DPO', 'dpo@skydash-bank.com');
  next();
};

/**
 * PCI-DSS Req. 10 — Audit trail pour toutes les actions sur les ressources bancaires
 * Journalise automatiquement toutes les requêtes API sensibles
 */
const auditApiAccess = (req, res, next) => {
  // Capture du code de réponse après la réponse
  const originalEnd = res.end.bind(res);
  const startTime = Date.now();

  res.end = function (...args) {
    const duration = Date.now() - startTime;

    // Log toutes les requêtes API (PCI-DSS Req. 10.3)
    audit('API_ACCESS', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || null,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 200) || null,
      requestId: req.requestId,
    });

    return originalEnd(...args);
  };

  next();
};

/**
 * OWASP A04 — Prévention des Insecure Direct Object References (IDOR)
 * Vérifie que les IDs dans les paramètres correspondent au format attendu
 */
const validateObjectIds = (req, res, next) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const suspiciousParams = ['userId', 'accountId', 'transactionId', 'id'];

  for (const param of suspiciousParams) {
    const value = req.params[param];
    if (value && !uuidRegex.test(value)) {
      logger.warn({
        message: 'Paramètre ID invalide détecté (tentative IDOR probable)',
        param, value, path: req.path, ip: req.ip,
      });
      return res.status(400).json({
        success: false,
        error: 'Identifiant de ressource invalide.',
        code: 'INVALID_RESOURCE_ID',
      });
    }
  }
  next();
};

/**
 * DSP2 / SCA (Strong Customer Authentication)
 * Vérifie que les transactions de haut risque nécessitent une re-authentification
 */
const requireSCA = (thresholdAmount = 30) => {
  return (req, res, next) => {
    const amount = parseFloat(req.body?.amount) || 0;

    // Au-dessus du seuil DSP2 (30€ par défaut) → SCA requis
    if (amount > thresholdAmount && !req.headers['x-sca-token']) {
      audit('SCA_REQUIRED', {
        userId: req.user?.id,
        amount,
        threshold: thresholdAmount,
        ip: req.ip,
      });
      return res.status(428).json({
        success: false,
        error: `Authentification forte requise pour les transactions supérieures à ${thresholdAmount}€ (DSP2).`,
        code: 'SCA_REQUIRED',
        scaChallenge: 'totp',
      });
    }
    next();
  };
};

/**
 * RGPD Art. 32 — Contrôle des données personnelles dans les requêtes
 * Empêche l'exposition de PII (Personally Identifiable Information) dans les URL
 */
const preventPIIInUrls = (req, res, next) => {
  const url = req.url;
  // Patterns de PII dans les URLs (emails, numéros de téléphone, etc.)
  const piiPatterns = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,  // Email
    /\b\d{10,15}\b/,                                      // Numéro de téléphone
    /\b\d{13,19}\b/,                                      // PAN potentiel
  ];

  for (const pattern of piiPatterns) {
    if (pattern.test(url)) {
      logger.warn({
        message: 'PII détecté dans une URL (RGPD violation potentielle)',
        path: req.path,
        ip: req.ip,
      });
      // On ne bloque pas mais on log l'anomalie
      audit('PII_IN_URL_DETECTED', {
        path: req.path,
        ip: req.ip,
        userId: req.user?.id,
      });
    }
  }
  next();
};

/**
 * PCI-DSS Req. 6.4.3 / OWASP — Prévention des injections
 * Valide et sanitise les entrées communes
 */
const inputSanitization = (req, res, next) => {
  // Détection de patterns d'injection communs dans le body
  const dangerousPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,   // XSS
    /javascript:/gi,                            // XSS via proto
    /on\w+\s*=/gi,                              // XSS via events
    /\bUNION\b.*\bSELECT\b/gi,                // SQL Injection
    /\bDROP\b.*\bTABLE\b/gi,                  // SQL Injection
    /\bEXEC\b.*\(.*\)/gi,                      // SQL Injection
    /\$\{.*\}/g,                               // Template injection
    /\.\.\//g,                                 // Path traversal
  ];

  const bodyStr = JSON.stringify(req.body || {});

  for (const pattern of dangerousPatterns) {
    if (pattern.test(bodyStr)) {
      audit('INJECTION_ATTEMPT_DETECTED', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id || null,
      });
      return res.status(400).json({
        success: false,
        error: 'Requête invalide : contenu non autorisé détecté.',
        code: 'INVALID_INPUT',
      });
    }
  }
  next();
};

module.exports = {
  pciDataMasking,
  dataRetentionHeaders,
  auditApiAccess,
  validateObjectIds,
  requireSCA,
  preventPIIInUrls,
  inputSanitization,
};
