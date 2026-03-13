/**
 * SKYDASH BANK — Routes Bénéficiaires
 * GET    /api/beneficiaires        — Liste des bénéficiaires
 * GET    /api/beneficiaires/:id    — Détail d'un bénéficiaire
 * POST   /api/beneficiaires        — Ajouter un bénéficiaire (DSP2 SCA)
 * PATCH  /api/beneficiaires/:id    — Modifier un bénéficiaire
 * DELETE /api/beneficiaires/:id    — Supprimer un bénéficiaire
 */
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { audit } = require('../utils/logger');

router.use(authenticate);

// ── Données de démonstration ──────────────────────────────────────────────────
const DEMO_BENEFICIAIRES = [
  { id: 'BEN-001', nom: 'Pierre Durand',    banque: 'Crédit Agricole', iban: 'FR76 1820 6004 0301 5026 5700 157', bic: 'AGRIFRPP882', ajouteLe: '2024-01-15', derniereOperation: '2026-02-20', montantDerniereOp: 150.00, actif: true },
  { id: 'BEN-002', nom: 'Sophie Martin',    banque: 'BNP Paribas',     iban: 'FR76 3000 4001 0300 0100 0215 43',  bic: 'BNPAFRPPXXX', ajouteLe: '2023-06-10', derniereOperation: '2026-01-05', montantDerniereOp: 50.00,  actif: true },
  { id: 'BEN-003', nom: 'Cabinet Dr Faure', banque: 'Société Générale',iban: 'FR76 3003 0300 0500 5089 4200 096', bic: 'SOGEFRPP',    ajouteLe: '2022-09-22', derniereOperation: '2026-03-07', montantDerniereOp: 55.00,  actif: true },
  { id: 'BEN-004', nom: 'Landlord SCI',     banque: 'LCL',             iban: 'FR76 3002 1001 0000 1234 5678 901', bic: 'CRLYFRPP',    ajouteLe: '2021-03-15', derniereOperation: '2026-03-05', montantDerniereOp: 900.00, actif: true },
  { id: 'BEN-005', nom: 'Antoine Bernard',  banque: 'Boursorama',      iban: 'FR76 4061 9100 0100 0155 5328 001', bic: 'BOUSFRPPXXX', ajouteLe: '2025-11-01', derniereOperation: null,          montantDerniereOp: null,   actif: true },
  { id: 'BEN-006', nom: 'Clara Lefebvre',   banque: 'Hello Bank',      iban: 'FR76 3000 4001 0600 0098 7654 321', bic: 'BNPAFRPPXXX', ajouteLe: '2025-12-08', derniereOperation: null,          montantDerniereOp: null,   actif: false },
];

// ── Validation ──────────────────────────────────────────────────────────────
const beneficiaireRules = [
  body('nom')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Nom requis (2–100 caractères).'),
  body('iban')
    .trim()
    .matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9 ]{4,}$/).withMessage('IBAN invalide.'),
  body('bic')
    .optional()
    .matches(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/).withMessage('BIC invalide.'),
  body('banque')
    .optional()
    .trim()
    .isLength({ max: 80 }),
];

/**
 * GET /api/beneficiaires
 */
router.get('/', (req, res) => {
  audit('BENEFICIARIES_ACCESSED', { userId: req.user.id, ip: req.ip });

  const actifFilter = req.query.actif;
  let data = [...DEMO_BENEFICIAIRES];

  if (actifFilter !== undefined) {
    data = data.filter(b => b.actif === (actifFilter !== 'false'));
  }

  res.json({
    success: true,
    data,
    meta: { count: data.length, generatedAt: new Date().toISOString() },
  });
});

/**
 * GET /api/beneficiaires/:id
 */
router.get('/:id', (req, res) => {
  const ben = DEMO_BENEFICIAIRES.find(b => b.id === req.params.id);
  if (!ben) {
    return res.status(404).json({ success: false, error: 'Bénéficiaire introuvable.', code: 'BENEFICIARY_NOT_FOUND' });
  }
  res.json({ success: true, data: ben });
});

/**
 * POST /api/beneficiaires
 * Ajout d'un bénéficiaire — nécessite SCA DSP2 (vérifiée via header X-SCA-Token)
 */
router.post('/', beneficiaireRules, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Données invalides.',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
      code: 'VALIDATION_ERROR',
    });
  }

  // DSP2 — vérification SCA simulée (en prod: vérifier OTP/biométrie)
  const scaToken = req.headers['x-sca-token'];
  if (!scaToken) {
    return res.status(403).json({
      success: false,
      error: 'Authentification forte (DSP2 SCA) requise pour ajouter un bénéficiaire.',
      code: 'SCA_REQUIRED',
      scaChallenge: 'otp_sms',
    });
  }

  const { nom, iban, bic, banque } = req.body;

  // Détection de doublons IBAN
  const ibanNorm = iban.replace(/\s/g, '').toUpperCase();
  const existant = DEMO_BENEFICIAIRES.find(b => b.iban.replace(/\s/g, '') === ibanNorm);
  if (existant) {
    return res.status(409).json({
      success: false,
      error: 'Un bénéficiaire avec cet IBAN existe déjà.',
      code: 'BENEFICIARY_DUPLICATE',
    });
  }

  const beneficiaire = {
    id: 'BEN-' + String(DEMO_BENEFICIAIRES.length + 1).padStart(3, '0'),
    nom: nom.trim(),
    banque: banque?.trim() || null,
    iban: ibanNorm,
    bic: bic?.toUpperCase() || null,
    ajouteLe: new Date().toISOString().split('T')[0],
    derniereOperation: null,
    montantDerniereOp: null,
    actif: true,
  };

  DEMO_BENEFICIAIRES.push(beneficiaire);

  audit('BENEFICIARY_ADDED', {
    userId: req.user.id,
    beneficiaryId: beneficiaire.id,
    iban: ibanNorm.slice(0, 4) + '****' + ibanNorm.slice(-4),
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'Bénéficiaire ajouté avec succès.',
    data: beneficiaire,
  });
});

/**
 * PATCH /api/beneficiaires/:id
 * Modification d'un bénéficiaire (alias uniquement — pas l'IBAN)
 */
router.patch('/:id', [
  body('nom').optional().trim().isLength({ min: 2, max: 100 }),
  body('banque').optional().trim().isLength({ max: 80 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, error: 'Données invalides.', details: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }

  const ben = DEMO_BENEFICIAIRES.find(b => b.id === req.params.id);
  if (!ben) return res.status(404).json({ success: false, error: 'Bénéficiaire introuvable.', code: 'BENEFICIARY_NOT_FOUND' });

  if (req.body.nom)    ben.nom    = req.body.nom.trim();
  if (req.body.banque) ben.banque = req.body.banque.trim();

  audit('BENEFICIARY_UPDATED', { userId: req.user.id, beneficiaryId: req.params.id, ip: req.ip });

  res.json({ success: true, message: 'Bénéficiaire modifié.', data: ben });
});

/**
 * DELETE /api/beneficiaires/:id
 * Suppression (soft delete — désactivation)
 */
router.delete('/:id', (req, res) => {
  const ben = DEMO_BENEFICIAIRES.find(b => b.id === req.params.id);
  if (!ben) return res.status(404).json({ success: false, error: 'Bénéficiaire introuvable.', code: 'BENEFICIARY_NOT_FOUND' });

  ben.actif = false;

  audit('BENEFICIARY_DELETED', { userId: req.user.id, beneficiaryId: req.params.id, ip: req.ip });

  res.json({ success: true, message: 'Bénéficiaire supprimé.', data: { id: ben.id, actif: false } });
});

module.exports = router;
