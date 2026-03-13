/**
 * SKYDASH BANK — Routes Cartes bancaires
 * GET  /api/cartes               — Liste des cartes
 * GET  /api/cartes/:id           — Détail d'une carte
 * POST /api/cartes/:id/bloquer   — Bloquer une carte (opposition)
 * POST /api/cartes/:id/debloquer — Débloquer une carte
 * PATCH /api/cartes/:id/limites  — Modifier les plafonds
 * PATCH /api/cartes/:id/options  — Activer/désactiver NFC, 3DS, etc.
 */
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { audit } = require('../utils/logger');

router.use(authenticate);

// ── Données de démonstration ──────────────────────────────────────────────────
const DEMO_CARTES = [
  {
    id: 'CRT-001',
    type: 'visa_premier',
    reseau: 'Visa',
    label: 'Visa Premier',
    numeroPAN: '4521',          // 4 derniers chiffres seulement (PCI-DSS)
    titulaire: 'JEAN DUPONT',
    expiration: '03/28',
    statut: 'active',
    compteAssocie: 'CPT-001',
    plafondPaiementMensuel: 5000.00,
    plafondRetraitMensuel: 1000.00,
    plafondPaiementJour: 1000.00,
    plafondRetraitJour: 300.00,
    soldeUtiliseMois: 1436.91,
    options: { nfc: true, paiementEtranger: true, paiementEnLigne: true, securite3ds: true },
    couleur: 'gradient-primary',
    emis: '2022-03-10',
    derniereUtilisation: '2026-03-12T18:22:00Z',
  },
  {
    id: 'CRT-002',
    type: 'mastercard_classic',
    reseau: 'Mastercard',
    label: 'Mastercard Classic',
    numeroPAN: '8834',
    titulaire: 'JEAN DUPONT',
    expiration: '11/29',
    statut: 'active',
    compteAssocie: 'CPT-001',
    plafondPaiementMensuel: 3000.00,
    plafondRetraitMensuel: 600.00,
    plafondPaiementJour: 500.00,
    plafondRetraitJour: 200.00,
    soldeUtiliseMois: 487.50,
    options: { nfc: true, paiementEtranger: false, paiementEnLigne: true, securite3ds: true },
    couleur: 'gradient-dark',
    emis: '2023-11-22',
    derniereUtilisation: '2026-03-10T14:35:00Z',
  },
];

/**
 * GET /api/cartes
 */
router.get('/', (req, res) => {
  audit('CARDS_ACCESSED', { userId: req.user.id, ip: req.ip });

  // Masque les données sensibles (PCI-DSS)
  const cartes = DEMO_CARTES.map(({ ...c }) => c);

  res.json({
    success: true,
    data: cartes,
    meta: { count: cartes.length, generatedAt: new Date().toISOString() },
  });
});

/**
 * GET /api/cartes/:id
 */
router.get('/:id', (req, res) => {
  const carte = DEMO_CARTES.find(c => c.id === req.params.id);
  if (!carte) {
    return res.status(404).json({ success: false, error: 'Carte introuvable.', code: 'CARD_NOT_FOUND' });
  }

  audit('CARD_DETAIL_ACCESSED', { userId: req.user.id, cardId: req.params.id, ip: req.ip });
  res.json({ success: true, data: carte });
});

/**
 * POST /api/cartes/:id/bloquer
 * Opposition immédiate — irréversible via API (confirmation humaine requise)
 */
router.post('/:id/bloquer', [
  body('motif').isIn(['vol', 'perte', 'fraude', 'precaution']).withMessage('Motif invalide.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Données invalides.',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }

  const carte = DEMO_CARTES.find(c => c.id === req.params.id);
  if (!carte) {
    return res.status(404).json({ success: false, error: 'Carte introuvable.', code: 'CARD_NOT_FOUND' });
  }

  if (carte.statut === 'blocked') {
    return res.status(409).json({ success: false, error: 'La carte est déjà bloquée.', code: 'CARD_ALREADY_BLOCKED' });
  }

  audit('CARD_BLOCKED', {
    userId: req.user.id,
    cardId: req.params.id,
    motif: req.body.motif,
    ip: req.ip,
    severity: 'HIGH',
  });

  carte.statut = 'blocked';

  res.json({
    success: true,
    message: 'Carte bloquée immédiatement. Pour une opposition définitive, appelez le 0 892 705 705.',
    data: { id: carte.id, statut: 'blocked', blockedAt: new Date().toISOString() },
  });
});

/**
 * POST /api/cartes/:id/debloquer
 */
router.post('/:id/debloquer', (req, res) => {
  const carte = DEMO_CARTES.find(c => c.id === req.params.id);
  if (!carte) {
    return res.status(404).json({ success: false, error: 'Carte introuvable.', code: 'CARD_NOT_FOUND' });
  }

  if (carte.statut !== 'blocked') {
    return res.status(409).json({ success: false, error: 'La carte n\'est pas bloquée.', code: 'CARD_NOT_BLOCKED' });
  }

  audit('CARD_UNBLOCKED', { userId: req.user.id, cardId: req.params.id, ip: req.ip });

  carte.statut = 'active';

  res.json({
    success: true,
    message: 'Carte réactivée avec succès.',
    data: { id: carte.id, statut: 'active', unblockedAt: new Date().toISOString() },
  });
});

/**
 * PATCH /api/cartes/:id/limites
 * Modification des plafonds
 */
router.patch('/:id/limites', [
  body('plafondPaiementJour').optional().isFloat({ min: 0, max: 3000 }),
  body('plafondRetraitJour').optional().isFloat({ min: 0, max: 1000 }),
  body('plafondPaiementMensuel').optional().isFloat({ min: 0, max: 10000 }),
  body('plafondRetraitMensuel').optional().isFloat({ min: 0, max: 3000 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, error: 'Plafonds invalides.', details: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }

  const carte = DEMO_CARTES.find(c => c.id === req.params.id);
  if (!carte) return res.status(404).json({ success: false, error: 'Carte introuvable.', code: 'CARD_NOT_FOUND' });

  const champs = ['plafondPaiementJour', 'plafondRetraitJour', 'plafondPaiementMensuel', 'plafondRetraitMensuel'];
  champs.forEach(ch => {
    if (req.body[ch] !== undefined) carte[ch] = parseFloat(req.body[ch]);
  });

  audit('CARD_LIMITS_UPDATED', { userId: req.user.id, cardId: req.params.id, changes: req.body, ip: req.ip });

  res.json({ success: true, message: 'Plafonds mis à jour.', data: carte });
});

/**
 * PATCH /api/cartes/:id/options
 * NFC, paiement étranger, 3DS, etc.
 */
router.patch('/:id/options', [
  body('nfc').optional().isBoolean(),
  body('paiementEtranger').optional().isBoolean(),
  body('paiementEnLigne').optional().isBoolean(),
  body('securite3ds').optional().isBoolean(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, error: 'Options invalides.', details: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }

  const carte = DEMO_CARTES.find(c => c.id === req.params.id);
  if (!carte) return res.status(404).json({ success: false, error: 'Carte introuvable.', code: 'CARD_NOT_FOUND' });

  ['nfc', 'paiementEtranger', 'paiementEnLigne', 'securite3ds'].forEach(opt => {
    if (req.body[opt] !== undefined) carte.options[opt] = req.body[opt] === true || req.body[opt] === 'true';
  });

  audit('CARD_OPTIONS_UPDATED', { userId: req.user.id, cardId: req.params.id, changes: req.body, ip: req.ip });

  res.json({ success: true, message: 'Options mises à jour.', data: carte });
});

module.exports = router;
