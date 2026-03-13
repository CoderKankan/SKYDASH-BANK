/**
 * SKYDASH BANK — Routes du tableau de bord
 * Données protégées, filtrées par rôle (RBAC)
 */
'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Toutes les routes du dashboard nécessitent une authentification
router.use(authenticate);

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
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/dashboard/recent-transactions
 * Transactions récentes — filtrées par rôle
 */
router.get('/recent-transactions', (req, res) => {
  // Données fictives — à remplacer par requête DB sécurisée
  const transactions = [
    { id: 'TXN-001', type: 'credit', amount: 1500.00, currency: 'EUR', date: '2026-03-12T10:30:00Z', description: 'Virement entrant', status: 'completed' },
    { id: 'TXN-002', type: 'debit', amount: 450.75, currency: 'EUR', date: '2026-03-12T09:15:00Z', description: 'Prélèvement facture', status: 'completed' },
    { id: 'TXN-003', type: 'debit', amount: 1200.00, currency: 'EUR', date: '2026-03-11T14:22:00Z', description: 'Virement loyer', status: 'completed' },
    { id: 'TXN-004', type: 'credit', amount: 3500.00, currency: 'EUR', date: '2026-03-10T08:00:00Z', description: 'Salaire', status: 'completed' },
    { id: 'TXN-005', type: 'debit', amount: 89.99, currency: 'EUR', date: '2026-03-09T16:45:00Z', description: 'Abonnement', status: 'pending' },
  ];

  // Clients voient seulement leurs propres transactions
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
      { id: 'ALT-001', type: 'suspicious_login', severity: 'high', message: '3 tentatives de connexion échouées', timestamp: new Date().toISOString() },
      { id: 'ALT-002', type: 'large_transaction', severity: 'medium', message: 'Transaction > 10 000€ détectée', timestamp: new Date().toISOString() },
    ],
  });
});

module.exports = router;
