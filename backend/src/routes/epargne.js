/**
 * SKYDASH BANK — Routes Épargne
 * GET  /api/epargne                   — Liste des produits d'épargne
 * GET  /api/epargne/:id               — Détail d'un produit
 * GET  /api/epargne/simulateur        — Simulateur de rendement
 * POST /api/epargne/:id/versement     — Effectuer un versement
 */
'use strict';

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { audit } = require('../utils/logger');

router.use(authenticate);

// ── Produits d'épargne disponibles ──────────────────────────────────────────
const PRODUITS_EPARGNE = [
  {
    id: 'SAV-001',
    type: 'livret_a',
    label: 'Livret A',
    tauxAnnuel: 3.0,
    plafond: 22950.00,
    solde: 10250.00,
    soldeDisponible: 10250.00,
    fiscalite: 'exonere',
    garantiEtat: true,
    disponibilite: 'immediate',
    description: 'Livret réglementé, taux garanti par l\'État, exonéré d\'impôts et de prélèvements sociaux.',
    compteAssocie: 'CPT-002',
    statut: 'actif',
    ouvertLe: '2019-03-15',
    interetsPerçusAnnee: 307.50,
    prochainCreditInterets: '2027-01-01',
  },
  {
    id: 'SAV-002',
    type: 'ldds',
    label: 'LDDS',
    tauxAnnuel: 3.0,
    plafond: 12000.00,
    solde: 0,
    soldeDisponible: 0,
    fiscalite: 'exonere',
    garantiEtat: true,
    disponibilite: 'immediate',
    description: 'Livret de Développement Durable et Solidaire — même avantages que le Livret A.',
    compteAssocie: null,
    statut: 'disponible',
  },
  {
    id: 'SAV-003',
    type: 'pel',
    label: 'PEL',
    tauxAnnuel: 2.25,
    plafond: 61200.00,
    solde: 13580.00,
    soldeDisponible: 0,
    versementMinimumMensuel: 45.00,
    fiscalite: 'soumis_ps',
    garantiEtat: false,
    disponibilite: 'bloque',
    description: 'Plan d\'Épargne Logement — fonds bloqués, permet d\'obtenir un prêt immobilier à taux préférentiel.',
    compteAssocie: 'CPT-003',
    statut: 'actif',
    ouvertLe: '2019-03-15',
    dateCloture: '2029-03-15',
    interetsPerçusAnnee: 305.55,
    droitPret: 'acquis',
  },
  {
    id: 'SAV-004',
    type: 'csl',
    label: 'Compte sur Livret',
    tauxAnnuel: 1.5,
    plafond: null,
    solde: 0,
    soldeDisponible: 0,
    fiscalite: 'soumis_ir',
    garantiEtat: false,
    disponibilite: 'immediate',
    description: 'Compte sur Livret à taux libre — flexible, sans plafond réglementaire.',
    compteAssocie: null,
    statut: 'disponible',
  },
];

/**
 * GET /api/epargne
 */
router.get('/', (req, res) => {
  audit('SAVINGS_ACCESSED', { userId: req.user.id, ip: req.ip });

  const actifs   = PRODUITS_EPARGNE.filter(p => p.statut === 'actif');
  const totalEpargne = actifs.reduce((s, p) => s + p.solde, 0);

  res.json({
    success: true,
    data: PRODUITS_EPARGNE,
    meta: {
      totalEpargne,
      produitActifs: actifs.length,
      currency: 'EUR',
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/epargne/simulateur
 * Calcul de rendement côté serveur
 * Query: capital, versement, duree (mois), taux
 */
router.get('/simulateur', [
  query('capital').isFloat({ min: 0, max: 1000000 }).withMessage('Capital invalide.'),
  query('taux').isFloat({ min: 0, max: 20 }).withMessage('Taux invalide.'),
  query('duree').isInt({ min: 1, max: 360 }).withMessage('Durée invalide (1–360 mois).'),
  query('versement').optional().isFloat({ min: 0, max: 10000 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Paramètres invalides.',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }

  const capital    = parseFloat(req.query.capital);
  const taux       = parseFloat(req.query.taux) / 100 / 12;  // taux mensuel
  const duree      = parseInt(req.query.duree, 10);
  const versement  = parseFloat(req.query.versement || 0);

  // Calcul des intérêts composés avec versements périodiques
  const projections = [];
  let solde = capital;

  for (let m = 1; m <= duree; m++) {
    solde = solde * (1 + taux) + versement;
    if (m % 12 === 0 || m === duree) {
      projections.push({
        mois: m,
        annee: Math.ceil(m / 12),
        solde: Math.round(solde * 100) / 100,
      });
    }
  }

  const capitalFinal    = Math.round(solde * 100) / 100;
  const versementsTotal = capital + versement * duree;
  const interets        = Math.round((capitalFinal - versementsTotal) * 100) / 100;

  res.json({
    success: true,
    data: {
      capital,
      taux: parseFloat(req.query.taux),
      duree,
      versementMensuel: versement,
      capitalFinal,
      versementsTotal: Math.round(versementsTotal * 100) / 100,
      interetsGagnes: interets,
      projections,
    },
  });
});

/**
 * GET /api/epargne/:id
 */
router.get('/:id', (req, res) => {
  const produit = PRODUITS_EPARGNE.find(p => p.id === req.params.id);
  if (!produit) {
    return res.status(404).json({ success: false, error: 'Produit introuvable.', code: 'SAVINGS_NOT_FOUND' });
  }
  res.json({ success: true, data: produit });
});

/**
 * POST /api/epargne/:id/versement
 * Versement sur un produit d'épargne
 */
router.post('/:id/versement', [
  body('montant').isFloat({ min: 10, max: 10000 }).withMessage('Montant invalide (10€ – 10 000€).'),
  body('compteSource').notEmpty().withMessage('Compte source requis.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, error: 'Données invalides.', details: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }

  const produit = PRODUITS_EPARGNE.find(p => p.id === req.params.id);
  if (!produit) return res.status(404).json({ success: false, error: 'Produit introuvable.', code: 'SAVINGS_NOT_FOUND' });

  if (produit.statut === 'disponible') {
    return res.status(400).json({ success: false, error: 'Ce produit n\'est pas encore ouvert.', code: 'SAVINGS_NOT_OPEN' });
  }

  const montant = parseFloat(req.body.montant);

  if (produit.plafond && produit.solde + montant > produit.plafond) {
    return res.status(400).json({
      success: false,
      error: `Versement impossible : dépasserait le plafond de ${produit.plafond.toLocaleString('fr-FR')} €.`,
      code: 'SAVINGS_CEILING_EXCEEDED',
    });
  }

  audit('SAVINGS_DEPOSIT', {
    userId: req.user.id,
    savingsId: req.params.id,
    montant,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    message: `Versement de ${montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} effectué.`,
    data: {
      savingsId: req.params.id,
      montant,
      nouveauSolde: produit.solde + montant,
      executedAt: new Date().toISOString(),
    },
  });
});

module.exports = router;
