/**
 * SKYDASH BANK — Routes Transactions
 * GET /api/transactions              — Historique paginé
 * GET /api/transactions/:id          — Détail d'une transaction
 * GET /api/transactions/pending      — Opérations en attente
 * GET /api/transactions/export       — Export CSV (RGPD Art. 20)
 */
'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { audit } = require('../utils/logger');

router.use(authenticate);

// ── Données de démonstration ──────────────────────────────────────────────────
const DEMO_TRANSACTIONS = [
  { id: 'TXN-001', type: 'credit', categorie: 'salaire',        montant: 3845.00, devise: 'EUR', libelle: 'Virement ACME Corp — Salaire Mars 2026',        date: '2026-03-10T08:00:00Z', statut: 'completed', compteSrc: null,      compteDest: 'CPT-001', reference: 'REF240310001' },
  { id: 'TXN-002', type: 'credit', categorie: 'virement',       montant: 1000.00, devise: 'EUR', libelle: 'Virement entrant — Remboursement J. Moreau',    date: '2026-03-10T10:15:00Z', statut: 'completed', compteSrc: null,      compteDest: 'CPT-001', reference: 'REF240310002' },
  { id: 'TXN-003', type: 'credit', categorie: 'epargne',        montant: 3000.00, devise: 'EUR', libelle: 'Virement Livret A → Compte courant',           date: '2026-03-08T14:00:00Z', statut: 'completed', compteSrc: 'CPT-002', compteDest: 'CPT-001', reference: 'REF240308001' },
  { id: 'TXN-004', type: 'debit',  categorie: 'loyer',          montant: 900.00,  devise: 'EUR', libelle: 'Virement loyer — Immobilière du Centre',       date: '2026-03-05T07:30:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240305001' },
  { id: 'TXN-005', type: 'debit',  categorie: 'alimentation',   montant: 127.43,  devise: 'EUR', libelle: 'CB CARREFOUR CITY PARIS',                      date: '2026-03-12T18:22:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240312001' },
  { id: 'TXN-006', type: 'debit',  categorie: 'transport',      montant: 84.90,   devise: 'EUR', libelle: 'RATP — Abonnement Navigo mensuel',             date: '2026-03-01T06:00:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240301001' },
  { id: 'TXN-007', type: 'debit',  categorie: 'services',       montant: 19.99,   devise: 'EUR', libelle: 'NETFLIX France — Abonnement Premium',         date: '2026-03-08T00:05:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240308002' },
  { id: 'TXN-008', type: 'debit',  categorie: 'services',       montant: 9.99,    devise: 'EUR', libelle: 'SPOTIFY — Abonnement mensuel',                 date: '2026-03-08T00:10:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240308003' },
  { id: 'TXN-009', type: 'debit',  categorie: 'sante',          montant: 55.00,   devise: 'EUR', libelle: 'Dr MARTIN Cabinet médical',                   date: '2026-03-07T16:40:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240307001' },
  { id: 'TXN-010', type: 'debit',  categorie: 'loisirs',        montant: 68.50,   devise: 'EUR', libelle: 'FNAC — Livres et multimédia',                  date: '2026-03-06T14:10:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240306001' },
  { id: 'TXN-011', type: 'debit',  categorie: 'alimentation',   montant: 93.12,   devise: 'EUR', libelle: 'CB MONOPRIX OPERA PARIS',                      date: '2026-03-04T19:55:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240304001' },
  { id: 'TXN-012', type: 'debit',  categorie: 'energie',        montant: 78.40,   devise: 'EUR', libelle: 'EDF — Facture électricité',                    date: '2026-03-03T09:00:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240303001' },
  { id: 'TXN-013', type: 'debit',  categorie: 'telecom',        montant: 29.99,   devise: 'EUR', libelle: 'Orange — Forfait mobile',                      date: '2026-03-02T00:10:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240302001' },
  { id: 'TXN-014', type: 'debit',  categorie: 'epargne',        montant: 200.00,  devise: 'EUR', libelle: 'Virement automatique vers Livret A',           date: '2026-03-01T07:00:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: 'CPT-002', reference: 'REF240301002' },
  { id: 'TXN-015', type: 'debit',  categorie: 'alimentation',   montant: 212.87,  devise: 'EUR', libelle: 'CB LECLERC — Courses hebdomadaires',           date: '2026-02-28T11:30:00Z', statut: 'completed', compteSrc: 'CPT-001', compteDest: null,      reference: 'REF240228001' },
];

const DEMO_PENDING = [
  { id: 'PEND-001', type: 'prelevement', libelle: 'EDF — Facture énergie',         montant: 78.40,  devise: 'EUR', datePrevu: '2026-03-14', statut: 'scheduled' },
  { id: 'PEND-002', type: 'prelevement', libelle: 'Orange — Forfait mobile',        montant: 29.99,  devise: 'EUR', datePrevu: '2026-03-15', statut: 'scheduled' },
  { id: 'PEND-003', type: 'prelevement', libelle: 'Assurance habitation AXA',       montant: 42.50,  devise: 'EUR', datePrevu: '2026-03-15', statut: 'scheduled' },
  { id: 'PEND-004', type: 'virement',   libelle: 'Loyer — Immobilière du Centre',  montant: 900.00, devise: 'EUR', datePrevu: '2026-03-16', statut: 'scheduled' },
  { id: 'PEND-005', type: 'virement',   libelle: 'Virement auto Livret A',         montant: 200.00, devise: 'EUR', datePrevu: '2026-04-01', statut: 'scheduled' },
  { id: 'PEND-006', type: 'prelevement', libelle: 'Spotify — Abonnement',           montant: 9.99,   devise: 'EUR', datePrevu: '2026-03-18', statut: 'scheduled' },
  { id: 'PEND-007', type: 'prelevement', libelle: 'Netflix Premium',                montant: 19.99,  devise: 'EUR', datePrevu: '2026-03-18', statut: 'scheduled' },
  { id: 'PEND-008', type: 'cheque',     libelle: 'Chèque n°7823421 — Plombier',   montant: 320.00, devise: 'EUR', datePrevu: '2026-03-17', statut: 'pending' },
];

/**
 * GET /api/transactions
 * Historique des transactions — paginé, filtrable
 * Query: page, limit, compte, categorie, dateDebut, dateFin, type
 */
router.get('/', (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit    = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const compte   = req.query.compte || null;
  const categorie = req.query.categorie || null;
  const type     = req.query.type || null;

  let data = [...DEMO_TRANSACTIONS];

  if (compte)    data = data.filter(t => t.compteSrc === compte || t.compteDest === compte);
  if (categorie) data = data.filter(t => t.categorie === categorie);
  if (type)      data = data.filter(t => t.type === type);

  const total  = data.length;
  const offset = (page - 1) * limit;
  const paged  = data.slice(offset, offset + limit);

  audit('TRANSACTIONS_ACCESSED', { userId: req.user.id, count: paged.length, ip: req.ip });

  res.json({
    success: true,
    data: paged,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/transactions/pending
 * Opérations en attente / programmées
 */
router.get('/pending', (req, res) => {
  audit('PENDING_TRANSACTIONS_ACCESSED', { userId: req.user.id, ip: req.ip });

  res.json({
    success: true,
    data: DEMO_PENDING,
    meta: {
      count: DEMO_PENDING.length,
      montantTotal: DEMO_PENDING.reduce((s, p) => s + p.montant, 0),
      currency: 'EUR',
    },
  });
});

/**
 * GET /api/transactions/export
 * Export CSV des transactions (RGPD Art. 20 — portabilité des données)
 */
router.get('/export', (req, res) => {
  audit('TRANSACTIONS_EXPORTED', { userId: req.user.id, ip: req.ip, format: 'csv' });

  const headers = ['id', 'date', 'type', 'libelle', 'montant', 'devise', 'statut', 'reference'];
  const rows = DEMO_TRANSACTIONS.map(t =>
    headers.map(h => JSON.stringify(t[h] ?? '')).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions_skydash.csv"');
  res.send('\uFEFF' + csv); // BOM UTF-8 pour Excel
});

/**
 * GET /api/transactions/:id
 * Détail d'une transaction
 */
router.get('/:id', (req, res) => {
  const txn = DEMO_TRANSACTIONS.find(t => t.id === req.params.id)
           || DEMO_PENDING.find(t => t.id === req.params.id);

  if (!txn) {
    return res.status(404).json({
      success: false,
      error: 'Transaction introuvable.',
      code: 'TRANSACTION_NOT_FOUND',
    });
  }

  audit('TRANSACTION_DETAIL_ACCESSED', { userId: req.user.id, transactionId: req.params.id, ip: req.ip });

  res.json({ success: true, data: txn });
});

module.exports = router;
