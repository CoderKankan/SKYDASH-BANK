/**
 * SKYDASH BANK — Middleware RGPD
 * ════════════════════════════════════════
 * Gestion des droits des personnes (Art. 15-22 RGPD)
 * Consentement, portabilité, droit à l'oubli
 * ════════════════════════════════════════
 */
'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('./authMiddleware');
const { findById, sanitizeUser } = require('../models/userStore');
const { audit } = require('../utils/logger');

/**
 * GET /api/rgpd/data-export
 * Art. 20 RGPD — Droit à la portabilité des données
 * Exporte toutes les données personnelles de l'utilisateur
 */
router.get('/data-export', authenticate, (req, res) => {
  const user = findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé.' });

  audit('RGPD_DATA_EXPORT', {
    userId: req.user.id,
    email: req.user.email,
    ip: req.ip,
  });

  const exportData = {
    exportDate: new Date().toISOString(),
    requestedBy: user.email,
    legalBasis: 'RGPD Article 20 — Droit à la portabilité',
    dataController: {
      name: 'SkyDash Bank SAS',
      contact: 'dpo@skydash-bank.com',
      address: 'Paris, France',
    },
    personalData: {
      identity: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      accountInfo: {
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        mfaEnabled: user.mfaEnabled,
      },
      preferences: {
        marketingConsent: user.marketingConsent || false,
      },
    },
    retentionPolicy: {
      financialData: '5 ans (obligation légale)',
      auditLogs: '3 ans (PCI-DSS)',
      personalData: 'Durée du contrat + 5 ans',
    },
  };

  res.setHeader('Content-Disposition', `attachment; filename="skydash-data-export-${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(exportData);
});

/**
 * GET /api/rgpd/consents
 * Art. 7 RGPD — Consultation des consentements
 */
router.get('/consents', authenticate, (req, res) => {
  const user = findById(req.user.id);
  res.json({
    success: true,
    data: {
      userId: req.user.id,
      consents: {
        termsOfService: { granted: true, date: user?.createdAt },
        privacyPolicy: { granted: true, date: user?.createdAt },
        marketingEmails: { granted: user?.marketingConsent || false, date: user?.createdAt },
      },
    },
  });
});

/**
 * PATCH /api/rgpd/consents
 * Art. 7 RGPD — Mise à jour des consentements
 */
router.patch('/consents', authenticate, (req, res) => {
  const { marketing } = req.body;
  const user = findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé.' });

  if (typeof marketing === 'boolean') {
    user.marketingConsent = marketing;
    user.updatedAt = new Date().toISOString();

    audit('RGPD_CONSENT_UPDATED', {
      userId: req.user.id,
      marketing,
      ip: req.ip,
    });
  }

  res.json({
    success: true,
    message: 'Vos préférences ont été mises à jour.',
  });
});

/**
 * DELETE /api/rgpd/account
 * Art. 17 RGPD — Droit à l'effacement ("droit à l'oubli")
 * Processus d'anonymisation irréversible
 */
router.delete('/account', authenticate, (req, res) => {
  const { confirmation } = req.body;

  if (confirmation !== 'SUPPRIMER MON COMPTE') {
    return res.status(400).json({
      success: false,
      error: 'Pour confirmer la suppression, écrivez exactement : SUPPRIMER MON COMPTE',
      code: 'CONFIRMATION_REQUIRED',
    });
  }

  const user = findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé.' });

  audit('RGPD_ACCOUNT_DELETION_REQUESTED', {
    userId: req.user.id,
    email: req.user.email,
    ip: req.ip,
    note: 'Anonymisation programmée — conservation des logs financiers 5 ans',
  });

  // Anonymisation des données personnelles (conservation des logs financiers obligatoire)
  user.firstName = 'ANONYME';
  user.lastName = 'ANONYME';
  user.email = `deleted-${user.id}@deleted.invalid`;
  user.isActive = false;
  user.deletedAt = new Date().toISOString();
  user.deletionReason = 'RGPD_RIGHT_TO_ERASURE';
  user.mfaSecret = null;
  user.passwordHash = 'DELETED';

  res.json({
    success: true,
    message: 'Votre compte a été anonymisé conformément au RGPD Art. 17. Vos données financières sont conservées pendant la durée légale obligatoire (5 ans) puis supprimées définitivement.',
    deletedAt: user.deletedAt,
  });
});

/**
 * GET /api/rgpd/privacy-info
 * Art. 13 RGPD — Information sur le traitement
 */
router.get('/privacy-info', (req, res) => {
  res.json({
    success: true,
    data: {
      controller: {
        name: 'SkyDash Bank SAS',
        address: 'Paris, France',
        contact: 'contact@skydash-bank.com',
        dpo: 'dpo@skydash-bank.com',
      },
      purposes: [
        { purpose: 'Gestion du compte bancaire', basis: 'Contrat (Art. 6.1.b)', retention: '5 ans après clôture' },
        { purpose: 'Prévention de la fraude', basis: 'Intérêt légitime (Art. 6.1.f)', retention: '3 ans' },
        { purpose: 'Obligations légales', basis: 'Obligation légale (Art. 6.1.c)', retention: '10 ans' },
        { purpose: 'Marketing (optionnel)', basis: 'Consentement (Art. 6.1.a)', retention: 'Jusqu\'au retrait du consentement' },
      ],
      rights: [
        'Droit d\'accès (Art. 15)',
        'Droit de rectification (Art. 16)',
        'Droit à l\'effacement (Art. 17)',
        'Droit à la limitation (Art. 18)',
        'Droit à la portabilité (Art. 20)',
        'Droit d\'opposition (Art. 21)',
      ],
      supervisoryAuthority: {
        name: 'CNIL',
        url: 'https://www.cnil.fr',
        contact: '3 place de Fontenoy, 75007 Paris',
      },
    },
  });
});

module.exports = router;
