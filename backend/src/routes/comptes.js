/**
 * SKYDASH BANK — Routes Comptes bancaires
 * GET /api/comptes        — Liste des comptes de l'utilisateur
 * GET /api/comptes/:id    — Détail d'un compte
 * GET /api/comptes/:id/solde — Solde en temps réel
 */
'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { audit } = require('../utils/logger');

// Toutes les routes requièrent une authentification
router.use(authenticate);

// ── Données de démonstration ──────────────────────────────────────────────────
const DEMO_COMPTES = [
  {
    id: 'CPT-001',
    type: 'courant',
    label: 'Compte Courant',
    iban: 'FR76 3000 4001 0300 0100 0947 89',
    bic: 'BNPAFRPPXXX',
    solde: 12483.75,
    soldeDisponible: 12483.75,
    decouvertAutorise: 1500.00,
    currency: 'EUR',
    ouvertLe: '2019-03-15',
    statut: 'actif',
    dernierMouvementAt: '2026-03-12T10:30:00Z',
  },
  {
    id: 'CPT-002',
    type: 'livret_a',
    label: 'Livret A',
    iban: 'FR76 3000 4001 0300 0200 7832 01',
    bic: 'BNPAFRPPXXX',
    solde: 10250.00,
    soldeDisponible: 10250.00,
    decouvertAutorise: 0,
    tauxInteret: 3.0,
    plafond: 22950.00,
    currency: 'EUR',
    ouvertLe: '2019-03-15',
    statut: 'actif',
    dernierMouvementAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'CPT-003',
    type: 'pel',
    label: 'PEL',
    iban: 'FR76 3000 4001 0300 0300 1122 33',
    bic: 'BNPAFRPPXXX',
    solde: 13580.00,
    soldeDisponible: 0,   // PEL : fonds bloqués
    decouvertAutorise: 0,
    tauxInteret: 2.25,
    plafond: 61200.00,
    dateFin: '2029-03-15',
    currency: 'EUR',
    ouvertLe: '2019-03-15',
    statut: 'actif',
    dernierMouvementAt: '2026-03-01T08:00:00Z',
  },
];

/**
 * GET /api/comptes
 * Retourne tous les comptes de l'utilisateur connecté
 */
router.get('/', (req, res) => {
  audit('ACCOUNTS_ACCESSED', { userId: req.user.id, ip: req.ip });

  res.json({
    success: true,
    data: DEMO_COMPTES,
    meta: {
      count: DEMO_COMPTES.length,
      soldeGlobal: DEMO_COMPTES.reduce((s, c) => s + c.solde, 0),
      currency: 'EUR',
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/comptes/:id
 * Détail d'un compte spécifique
 */
router.get('/:id', (req, res) => {
  const compte = DEMO_COMPTES.find(c => c.id === req.params.id);
  if (!compte) {
    return res.status(404).json({
      success: false,
      error: 'Compte introuvable.',
      code: 'ACCOUNT_NOT_FOUND',
    });
  }

  audit('ACCOUNT_DETAIL_ACCESSED', { userId: req.user.id, accountId: req.params.id, ip: req.ip });

  res.json({ success: true, data: compte });
});

/**
 * GET /api/comptes/:id/solde
 * Solde disponible en temps réel (PCI-DSS — accès loggé)
 */
router.get('/:id/solde', (req, res) => {
  const compte = DEMO_COMPTES.find(c => c.id === req.params.id);
  if (!compte) {
    return res.status(404).json({
      success: false,
      error: 'Compte introuvable.',
      code: 'ACCOUNT_NOT_FOUND',
    });
  }

  audit('BALANCE_ACCESSED', { userId: req.user.id, accountId: req.params.id, ip: req.ip });

  res.json({
    success: true,
    data: {
      accountId: compte.id,
      solde: compte.solde,
      soldeDisponible: compte.soldeDisponible,
      currency: compte.currency,
      updatedAt: new Date().toISOString(),
    },
  });
});

module.exports = router;
