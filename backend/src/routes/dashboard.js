/**
 * SKYDASH BANK — Routes du tableau de bord
 * Données protégées, filtrées par rôle (RBAC)
 */
'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { audit } = require('../utils/logger');

// Toutes les routes du dashboard nécessitent une authentification
router.use(authenticate);

/**
 * GET /api/dashboard/summary
 * Résumé complet du tableau de bord utilisateur
 */
router.get('/summary', (req, res) => {
  audit('DASHBOARD_ACCESSED', { userId: req.user.id, ip: req.ip });

  res.json({
    success: true,
    data: {
      user: {
        prenom: req.user.firstName || 'Jean',
        role: req.user.role,
        derniereCo: '2026-03-12T18:42:00Z',
        securityScore: 87,
      },
      soldeGlobal: 12483.75,
      comptes: [
        { id: 'CPT-001', label: 'Compte Courant', solde: 12483.75, iban: 'FR76 3000 4001 0300 0100 0947 89', type: 'courant' },
        { id: 'CPT-002', label: 'Livret A',       solde: 10250.00, iban: null, type: 'livret_a', tauxAnnuel: 3.0 },
        { id: 'CPT-003', label: 'PEL',            solde: 13580.00, iban: null, type: 'pel', tauxAnnuel: 2.25 },
      ],
      kpis: {
        revenus:    { montant: 7845.00, variationPct: 12, periode: 'mars_2026' },
        depenses:   { montant: 2198.00, variationPct: -5, periode: 'mars_2026' },
        enAttente:  { montant: 2438.00, nombre: 8 },
        epargneTotal: 23830.00,
      },
      dernieresTransactions: [
        { id: 'TXN-005', type: 'debit',  libelle: 'CB CARREFOUR CITY PARIS',              montant: 127.43, date: '2026-03-12T18:22:00Z', categorie: 'alimentation' },
        { id: 'TXN-001', type: 'credit', libelle: 'Virement ACME Corp — Salaire Mars 2026', montant: 3845.00, date: '2026-03-10T08:00:00Z', categorie: 'salaire' },
        { id: 'TXN-004', type: 'debit',  libelle: 'Virement loyer — Immobilière du Centre', montant: 900.00,  date: '2026-03-05T07:30:00Z', categorie: 'loyer' },
        { id: 'TXN-006', type: 'debit',  libelle: 'RATP — Navigo mensuel',                 montant: 84.90,   date: '2026-03-01T06:00:00Z', categorie: 'transport' },
        { id: 'TXN-007', type: 'debit',  libelle: 'NETFLIX France',                        montant: 19.99,   date: '2026-03-08T00:05:00Z', categorie: 'services' },
        { id: 'TXN-002', type: 'credit', libelle: 'Remboursement J. Moreau',               montant: 1000.00, date: '2026-03-10T10:15:00Z', categorie: 'virement' },
      ],
      fluxMensuels: {
        labels:   ['Oct 2025','Nov 2025','Déc 2025','Jan 2026','Fév 2026','Mars 2026'],
        revenus:  [6900, 7100, 8200, 7000, 6980, 7845],
        depenses: [2400, 2600, 3100, 2200, 2310, 2198],
      },
      carteCredit: {
        label: 'Mastercard *8834',
        soldeUtilise: 487.50,
        plafond: 3000.00,
        pctUtilise: 16.25,
      },
      prochainsPrelevements: [
        { libelle: 'EDF',                 montant: 78.40,  date: '2026-03-14' },
        { libelle: 'Orange',              montant: 29.99,  date: '2026-03-15' },
        { libelle: 'Assurance AXA',       montant: 42.50,  date: '2026-03-15' },
        { libelle: 'Loyer',               montant: 900.00, date: '2026-03-16' },
        { libelle: 'Netflix',             montant: 19.99,  date: '2026-03-18' },
        { libelle: 'Spotify',             montant: 9.99,   date: '2026-03-18' },
      ],
      alertes: [
        { id: 'ALT-001', type: 'securite',  message: 'Connexion depuis un nouvel appareil (Windows, Chrome, Paris)',  severity: 'warning', date: '2026-03-12T18:42:00Z', lue: false },
        { id: 'ALT-002', type: 'carte',     message: 'Votre Visa Premier expire dans 3 mois (Mars 2028)',            severity: 'info',    date: '2026-03-10T09:00:00Z', lue: false },
        { id: 'ALT-003', type: 'credit',    message: 'Salaire reçu : +3 845,00 € — ACME Corp',                      severity: 'success', date: '2026-03-10T08:00:00Z', lue: true  },
        { id: 'ALT-004', type: 'epargne',   message: 'Conseil : versez 100 € de plus/mois pour atteindre votre objectif', severity: 'info', date: '2026-03-09T12:00:00Z', lue: true },
      ],
      notifications: {
        nonLues: 2,
        items: [
          { id: 'NOT-001', titre: 'Connexion suspecte', message: 'Nouvel appareil détecté. Ce n\'était pas vous ?', date: '2026-03-12', type: 'alerte', lue: false },
          { id: 'NOT-002', titre: 'Salaire reçu',       message: '+3 845,00 € — ACME Corp',                        date: '2026-03-10', type: 'credit', lue: false },
          { id: 'NOT-003', titre: 'Carte expirante',    message: 'Visa Premier — expiration dans 3 mois',          date: '2026-03-10', type: 'info',   lue: true  },
        ],
      },
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/dashboard/stats
 * Statistiques générales — Admin & Agent uniquement
 */
router.get('/stats', authorize('admin', 'agent'), (req, res) => {
  res.json({
    success: true,
    data: {
      totalClients: 1247,
      activeAccounts: 1189,
      pendingTransactions: 34,
      totalVolume: 2847563.45,
      currency: 'EUR',
      period: 'current_month',
      repartitionComptes: {
        courant: 1189,
        livret_a: 834,
        pel: 312,
        ldds: 198,
      },
      kpisMois: {
        nouveauxClients: 23,
        virements: 4521,
        transactionsCB: 18743,
        chiffreAffaires: 12483920.00,
      },
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/dashboard/recent-transactions
 * Transactions récentes — filtrées par rôle
 */
router.get('/recent-transactions', (req, res) => {
  const transactions = [
    { id: 'TXN-001', type: 'credit', amount: 3845.00, currency: 'EUR', date: '2026-03-10T08:00:00Z', description: 'Salaire ACME Corp', status: 'completed', categorie: 'salaire' },
    { id: 'TXN-002', type: 'credit', amount: 1000.00, currency: 'EUR', date: '2026-03-10T10:15:00Z', description: 'Remboursement J. Moreau', status: 'completed', categorie: 'virement' },
    { id: 'TXN-003', type: 'debit',  amount: 900.00,  currency: 'EUR', date: '2026-03-05T07:30:00Z', description: 'Loyer Immobilière du Centre', status: 'completed', categorie: 'loyer' },
    { id: 'TXN-004', type: 'debit',  amount: 127.43,  currency: 'EUR', date: '2026-03-12T18:22:00Z', description: 'CB CARREFOUR CITY PARIS', status: 'completed', categorie: 'alimentation' },
    { id: 'TXN-005', type: 'debit',  amount: 89.99,   currency: 'EUR', date: '2026-03-08T00:05:00Z', description: 'Netflix + Spotify', status: 'completed', categorie: 'services' },
  ];

  res.json({
    success: true,
    data: transactions,
    meta: {
      userId: req.user.id,
      role: req.user.role,
      count: transactions.length,
    },
  });
});

/**
 * GET /api/dashboard/alerts
 * Alertes de sécurité — Admin uniquement
 */
router.get('/alerts', authorize('admin'), (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'ALT-001', type: 'suspicious_login',  severity: 'high',   message: '3 tentatives de connexion échouées depuis 185.220.101.x', timestamp: new Date().toISOString() },
      { id: 'ALT-002', type: 'large_transaction',  severity: 'medium', message: 'Transaction > 10 000€ détectée — en attente validation TRACFIN', timestamp: new Date().toISOString() },
      { id: 'ALT-003', type: 'new_beneficiary',    severity: 'low',    message: '5 nouveaux bénéficiaires ajoutés aujourd\'hui', timestamp: new Date().toISOString() },
    ],
  });
});

/**
 * PATCH /api/dashboard/notifications/:id/read
 * Marquer une notification comme lue
 */
router.patch('/notifications/:id/read', (req, res) => {
  audit('NOTIFICATION_READ', { userId: req.user.id, notificationId: req.params.id, ip: req.ip });
  res.json({ success: true, message: 'Notification marquée comme lue.' });
});

module.exports = router;
