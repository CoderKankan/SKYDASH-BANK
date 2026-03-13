/**
 * SKYDASH BANK — Routes Virements
 * GET  /api/virements              — Historique des virements
 * POST /api/virements/sepa         — Initier un virement SEPA
 * POST /api/virements/interne      — Virement entre comptes propres
 * POST /api/virements/international — Virement SWIFT international
 * GET  /api/virements/:id          — Détail d'un virement
 * DEL  /api/virements/:id          — Annuler un virement programmé
 */
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { audit, logger } = require('../utils/logger');

router.use(authenticate);

// ── Validation ──────────────────────────────────────────────────────────────
const ibanRule = body('iban')
  .trim()
  .notEmpty().withMessage('IBAN requis.')
  .matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,}$/).withMessage('Format IBAN invalide.');

const montantRule = body('montant')
  .isFloat({ min: 0.01, max: 100000 }).withMessage('Montant invalide (0,01 € – 100 000 €).');

const motifRule = body('motif')
  .trim()
  .isLength({ min: 1, max: 140 }).withMessage('Motif requis (max 140 caractères).');

// ── Données de démonstration ──────────────────────────────────────────────────
const DEMO_VIREMENTS = [
  { id: 'VIR-001', type: 'sepa',    libelle: 'Loyer — Immobilière du Centre', montant: 900.00,  statut: 'completed', createdAt: '2026-03-05T07:30:00Z', executedAt: '2026-03-05T08:00:00Z' },
  { id: 'VIR-002', type: 'interne', libelle: 'Alimentation épargne Livret A', montant: 200.00,  statut: 'completed', createdAt: '2026-03-01T07:00:00Z', executedAt: '2026-03-01T07:00:00Z' },
  { id: 'VIR-003', type: 'sepa',    libelle: 'Remboursement ami — P. Durand', montant: 150.00,  statut: 'completed', createdAt: '2026-02-20T14:00:00Z', executedAt: '2026-02-20T14:15:00Z' },
  { id: 'VIR-004', type: 'sepa',    libelle: 'Cotisation club sportif',       montant: 45.00,   statut: 'scheduled', createdAt: '2026-03-12T09:00:00Z', executedAt: null, datePrevu: '2026-03-20' },
  { id: 'VIR-005', type: 'interne', libelle: 'Virement auto PEL',            montant: 150.00,  statut: 'scheduled', createdAt: '2026-03-01T08:00:00Z', executedAt: null, datePrevu: '2026-04-01' },
];

/**
 * GET /api/virements
 */
router.get('/', (req, res) => {
  audit('TRANSFERS_ACCESSED', { userId: req.user.id, ip: req.ip });
  res.json({
    success: true,
    data: DEMO_VIREMENTS,
    meta: { count: DEMO_VIREMENTS.length, generatedAt: new Date().toISOString() },
  });
});

/**
 * POST /api/virements/sepa
 * Virement SEPA standard (zone euro)
 */
router.post('/sepa', [ibanRule, montantRule, motifRule], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Données invalides.',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
      code: 'VALIDATION_ERROR',
    });
  }

  const { iban, montant, motif, nomBeneficiaire, dateExecution } = req.body;

  // Contrôle TRACFIN — transaction > 1000€ logguée
  if (parseFloat(montant) >= 1000) {
    audit('TRANSFER_TRACFIN_THRESHOLD', {
      userId: req.user.id,
      montant,
      iban: iban.slice(0, 4) + '****' + iban.slice(-4),
      ip: req.ip,
    });
  }

  const virement = {
    id: 'VIR-' + Date.now(),
    type: 'sepa',
    iban,
    montant: parseFloat(montant),
    motif,
    nomBeneficiaire,
    statut: dateExecution ? 'scheduled' : 'processing',
    datePrevu: dateExecution || null,
    createdAt: new Date().toISOString(),
    requestId: req.id,
  };

  audit('TRANSFER_SEPA_INITIATED', {
    userId: req.user.id,
    virementId: virement.id,
    montant: virement.montant,
    ip: req.ip,
  });

  logger.info({ message: 'Virement SEPA initié', virementId: virement.id, userId: req.user.id });

  res.status(201).json({
    success: true,
    message: dateExecution
      ? `Virement programmé pour le ${dateExecution}.`
      : 'Virement en cours de traitement. Délai : 1-2 jours ouvrés.',
    data: virement,
  });
});

/**
 * POST /api/virements/interne
 * Virement entre deux comptes de l'utilisateur (instantané)
 */
router.post('/interne', [
  body('compteSource').notEmpty().withMessage('Compte source requis.'),
  body('compteDest').notEmpty().withMessage('Compte destination requis.'),
  montantRule,
  motifRule,
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Données invalides.',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
      code: 'VALIDATION_ERROR',
    });
  }

  const { compteSource, compteDest, montant, motif } = req.body;

  if (compteSource === compteDest) {
    return res.status(400).json({
      success: false,
      error: 'Les comptes source et destination doivent être différents.',
      code: 'SAME_ACCOUNT',
    });
  }

  const virement = {
    id: 'VIR-' + Date.now(),
    type: 'interne',
    compteSource,
    compteDest,
    montant: parseFloat(montant),
    motif,
    statut: 'completed',
    createdAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
  };

  audit('TRANSFER_INTERNAL_EXECUTED', {
    userId: req.user.id,
    virementId: virement.id,
    montant: virement.montant,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'Virement interne effectué immédiatement.',
    data: virement,
  });
});

/**
 * POST /api/virements/international
 * Virement SWIFT international
 */
router.post('/international', [
  body('nomBeneficiaire').trim().notEmpty().withMessage('Nom bénéficiaire requis.'),
  body('iban').trim().notEmpty().withMessage('IBAN requis.'),
  body('bicSwift').trim().matches(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/).withMessage('BIC/SWIFT invalide.'),
  montantRule,
  body('devise').isIn(['EUR','USD','GBP','CHF','CAD']).withMessage('Devise non supportée.'),
  motifRule,
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Données invalides.',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
      code: 'VALIDATION_ERROR',
    });
  }

  const { nomBeneficiaire, iban, bicSwift, montant, devise, motif, pays } = req.body;

  // Tous les virements internationaux → audit TRACFIN/ACPR obligatoire
  audit('TRANSFER_INTERNATIONAL_INITIATED', {
    userId: req.user.id,
    montant,
    devise,
    pays,
    bic: bicSwift,
    ip: req.ip,
  });

  const virement = {
    id: 'VIR-SWIFT-' + Date.now(),
    type: 'international',
    nomBeneficiaire,
    iban,
    bicSwift,
    montant: parseFloat(montant),
    devise,
    motif,
    pays,
    fraisSWIFT: 15.00,
    statut: 'processing',
    delaiEstime: '3-5 jours ouvrés',
    createdAt: new Date().toISOString(),
  };

  res.status(201).json({
    success: true,
    message: 'Virement international soumis. Délai estimé : 3–5 jours ouvrés.',
    data: virement,
  });
});

/**
 * DELETE /api/virements/:id
 * Annule un virement programmé (uniquement si statut = scheduled)
 */
router.delete('/:id', (req, res) => {
  const virement = DEMO_VIREMENTS.find(v => v.id === req.params.id);

  if (!virement) {
    return res.status(404).json({
      success: false,
      error: 'Virement introuvable.',
      code: 'TRANSFER_NOT_FOUND',
    });
  }

  if (virement.statut !== 'scheduled') {
    return res.status(409).json({
      success: false,
      error: 'Seuls les virements programmés peuvent être annulés.',
      code: 'TRANSFER_CANNOT_CANCEL',
    });
  }

  audit('TRANSFER_CANCELLED', {
    userId: req.user.id,
    virementId: req.params.id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Virement annulé avec succès.',
    data: { id: req.params.id, statut: 'cancelled' },
  });
});

/**
 * GET /api/virements/:id
 */
router.get('/:id', (req, res) => {
  const virement = DEMO_VIREMENTS.find(v => v.id === req.params.id);
  if (!virement) {
    return res.status(404).json({ success: false, error: 'Virement introuvable.', code: 'TRANSFER_NOT_FOUND' });
  }
  res.json({ success: true, data: virement });
});

module.exports = router;
