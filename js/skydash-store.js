/**
 * SKYDASH BANK — Store d'état global (sessionStorage)
 * ─────────────────────────────────────────────────────
 * Partage les données entre toutes les pages (comptes, transactions, cartes…)
 * Données NON sensibles uniquement (pas de token, pas de MDP)
 * ─────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var STORE_KEY = 'sb_store_v2';

  /* ── Données initiales de démonstration ────────────────────────────── */
  var DEMO = {
    version: 2,
    updatedAt: new Date().toISOString(),

    comptes: [
      { id: 'CPT-001', label: 'Compte Courant',  type: 'courant',   iban: 'FR76 3000 4001 0300 0100 0947 89', solde: 12483.75, soldeDisponible: 12483.75, devise: 'EUR', statut: 'actif', couleur: '#4B49AC' },
      { id: 'CPT-002', label: 'Livret A',         type: 'livret_a',  iban: 'FR76 3000 4001 0300 0200 7832 01', solde: 10250.00, soldeDisponible: 10250.00, devise: 'EUR', statut: 'actif', couleur: '#1bcfb4', taux: 3.0 },
      { id: 'CPT-003', label: 'PEL',              type: 'pel',       iban: 'FR76 3000 4001 0300 0300 1122 33', solde: 13580.00, soldeDisponible: 0,         devise: 'EUR', statut: 'actif', couleur: '#f3a84b', taux: 2.25 },
    ],

    transactions: [
      { id:'TXN-001', type:'credit', categorie:'salaire',       libelle:'Virement ACME Corp — Salaire Mars 2026',        montant:3845.00, date:'2026-03-10T08:00:00Z', statut:'completed', compteId:'CPT-001', ref:'SAL-202603-001' },
      { id:'TXN-002', type:'credit', categorie:'virement',      libelle:'Remboursement J. Moreau',                       montant:1000.00, date:'2026-03-10T10:15:00Z', statut:'completed', compteId:'CPT-001', ref:'VIR-202603-002' },
      { id:'TXN-003', type:'credit', categorie:'epargne',       libelle:'Virement Livret A → Courant',                  montant:3000.00, date:'2026-03-08T14:00:00Z', statut:'completed', compteId:'CPT-001', ref:'INT-202603-003' },
      { id:'TXN-004', type:'debit',  categorie:'loyer',         libelle:'Virement loyer — Immobilière du Centre',        montant:900.00,  date:'2026-03-05T07:30:00Z', statut:'completed', compteId:'CPT-001', ref:'VIR-202603-004' },
      { id:'TXN-005', type:'debit',  categorie:'alimentation',  libelle:'CB CARREFOUR CITY PARIS',                       montant:127.43,  date:'2026-03-12T18:22:00Z', statut:'completed', compteId:'CPT-001', ref:'CB-202603-005'  },
      { id:'TXN-006', type:'debit',  categorie:'transport',     libelle:'RATP — Navigo mensuel',                         montant:84.90,   date:'2026-03-01T06:00:00Z', statut:'completed', compteId:'CPT-001', ref:'CB-202603-006'  },
      { id:'TXN-007', type:'debit',  categorie:'services',      libelle:'NETFLIX France — Premium',                      montant:19.99,   date:'2026-03-08T00:05:00Z', statut:'completed', compteId:'CPT-001', ref:'PREL-202603-007'},
      { id:'TXN-008', type:'debit',  categorie:'services',      libelle:'SPOTIFY — Abonnement',                          montant:9.99,    date:'2026-03-08T00:10:00Z', statut:'completed', compteId:'CPT-001', ref:'PREL-202603-008'},
      { id:'TXN-009', type:'debit',  categorie:'sante',         libelle:'Dr MARTIN — Consultation',                      montant:55.00,   date:'2026-03-07T16:40:00Z', statut:'completed', compteId:'CPT-001', ref:'CB-202603-009'  },
      { id:'TXN-010', type:'debit',  categorie:'loisirs',       libelle:'FNAC — Livres et multimédia',                   montant:68.50,   date:'2026-03-06T14:10:00Z', statut:'completed', compteId:'CPT-001', ref:'CB-202603-010'  },
      { id:'TXN-011', type:'debit',  categorie:'alimentation',  libelle:'CB MONOPRIX OPERA',                              montant:93.12,   date:'2026-03-04T19:55:00Z', statut:'completed', compteId:'CPT-001', ref:'CB-202603-011'  },
      { id:'TXN-012', type:'debit',  categorie:'energie',       libelle:'EDF — Facture électricité',                     montant:78.40,   date:'2026-03-03T09:00:00Z', statut:'completed', compteId:'CPT-001', ref:'PREL-202603-012'},
      { id:'TXN-013', type:'debit',  categorie:'telecom',       libelle:'Orange — Forfait mobile',                       montant:29.99,   date:'2026-03-02T00:10:00Z', statut:'completed', compteId:'CPT-001', ref:'PREL-202603-013'},
      { id:'TXN-014', type:'debit',  categorie:'epargne',       libelle:'Virement auto → Livret A',                      montant:200.00,  date:'2026-03-01T07:00:00Z', statut:'completed', compteId:'CPT-001', ref:'INT-202603-014' },
      { id:'TXN-015', type:'debit',  categorie:'alimentation',  libelle:'CB LECLERC — Courses',                          montant:212.87,  date:'2026-02-28T11:30:00Z', statut:'completed', compteId:'CPT-001', ref:'CB-202602-015'  },
      { id:'TXN-016', type:'credit', categorie:'salaire',       libelle:'Virement ACME Corp — Salaire Fév. 2026',        montant:3845.00, date:'2026-02-10T08:00:00Z', statut:'completed', compteId:'CPT-001', ref:'SAL-202602-016' },
      { id:'TXN-017', type:'debit',  categorie:'loyer',         libelle:'Virement loyer — Immobilière du Centre',        montant:900.00,  date:'2026-02-05T07:30:00Z', statut:'completed', compteId:'CPT-001', ref:'VIR-202602-017' },
      { id:'TXN-018', type:'debit',  categorie:'alimentation',  libelle:'CB FRANPRIX',                                   montant:64.20,   date:'2026-02-14T12:00:00Z', statut:'completed', compteId:'CPT-001', ref:'CB-202602-018'  },
    ],

    operationsEnAttente: [
      { id:'PEND-001', type:'prelevement', libelle:'EDF Énergie',          montant:78.40,  datePrevu:'2026-03-14', statut:'scheduled', compteId:'CPT-001' },
      { id:'PEND-002', type:'prelevement', libelle:'Orange Mobile',         montant:29.99,  datePrevu:'2026-03-15', statut:'scheduled', compteId:'CPT-001' },
      { id:'PEND-003', type:'prelevement', libelle:'Assurance AXA',         montant:42.50,  datePrevu:'2026-03-15', statut:'scheduled', compteId:'CPT-001' },
      { id:'PEND-004', type:'virement',   libelle:'Loyer Mars 2026',        montant:900.00, datePrevu:'2026-03-16', statut:'scheduled', compteId:'CPT-001' },
      { id:'PEND-005', type:'virement',   libelle:'Épargne auto Livret A',  montant:200.00, datePrevu:'2026-04-01', statut:'scheduled', compteId:'CPT-001' },
      { id:'PEND-006', type:'prelevement', libelle:'Spotify',               montant:9.99,   datePrevu:'2026-03-18', statut:'scheduled', compteId:'CPT-001' },
      { id:'PEND-007', type:'prelevement', libelle:'Netflix Premium',       montant:19.99,  datePrevu:'2026-03-18', statut:'scheduled', compteId:'CPT-001' },
      { id:'PEND-008', type:'cheque',     libelle:'Chèque n°7823421',       montant:320.00, datePrevu:'2026-03-17', statut:'pending',   compteId:'CPT-001' },
    ],

    cartes: [
      { id:'CRT-001', reseau:'Visa',       label:'Visa Premier',         pan:'4521', statut:'active', compteId:'CPT-001', plafondMensuel:5000, utilise:1436.91 },
      { id:'CRT-002', reseau:'Mastercard', label:'Mastercard Classic',   pan:'8834', statut:'active', compteId:'CPT-001', plafondMensuel:3000, utilise:487.50  },
    ],

    beneficiaires: [
      { id:'BEN-001', nom:'Pierre Durand',    banque:'Crédit Agricole', iban:'FR76 1820 6004 0301 5026 5700 157', actif:true, derniereMontant:150.00,  derniereDate:'2026-02-20' },
      { id:'BEN-002', nom:'Sophie Martin',    banque:'BNP Paribas',     iban:'FR76 3000 4001 0300 0100 0215 43',  actif:true, derniereMontant:50.00,   derniereDate:'2026-01-05' },
      { id:'BEN-003', nom:'Cabinet Dr Faure', banque:'Société Générale',iban:'FR76 3003 0300 0500 5089 4200 096', actif:true, derniereMontant:55.00,   derniereDate:'2026-03-07' },
      { id:'BEN-004', nom:'SCI Les Pins',     banque:'LCL',             iban:'FR76 3002 1001 0000 1234 5678 901', actif:true, derniereMontant:900.00,  derniereDate:'2026-03-05' },
      { id:'BEN-005', nom:'Antoine Bernard',  banque:'Boursorama',      iban:'FR76 4061 9100 0100 0155 5328 001', actif:true, derniereMontant:null,    derniereDate:null         },
      { id:'BEN-006', nom:'Clara Lefebvre',   banque:'Hello Bank',      iban:'FR76 3000 4001 0600 0098 7654 321', actif:false,derniereMontant:null,    derniereDate:null         },
    ],

    notifications: [
      { id:'NOT-001', titre:'Connexion inhabituelle', msg:'Nouvel appareil détecté (Chrome / Windows)', type:'alerte', date:'2026-03-12', lue:false },
      { id:'NOT-002', titre:'Salaire reçu',           msg:'+3 845,00 € — ACME Corp',                   type:'credit', date:'2026-03-10', lue:false },
      { id:'NOT-003', titre:'Carte expirante',        msg:'Visa Premier — expiration dans 3 mois',      type:'info',   date:'2026-03-10', lue:true  },
    ],
  };

  /* ── Chargement / sauvegarde sessionStorage ──────────────────────── */
  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.version !== DEMO.version) return null;
      return data;
    } catch (e) { return null; }
  }

  function save(data) {
    try {
      data.updatedAt = new Date().toISOString();
      sessionStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  /* Initialisation au premier accès */
  var _data = load() || JSON.parse(JSON.stringify(DEMO));

  /* ── API publique du store ──────────────────────────────────────────── */
  var store = {

    /* ── Comptes ─────────────────────────────────────────────────────── */
    getComptes: function () { return _data.comptes.slice(); },

    getCompte: function (id) {
      return _data.comptes.find(function (c) { return c.id === id; }) || null;
    },

    getSoldeGlobal: function () {
      return _data.comptes.reduce(function (s, c) { return s + c.solde; }, 0);
    },

    /** Débite un compte et crée une transaction */
    debit: function (compteId, montant, libelle, categorie, ref) {
      var compte = _data.comptes.find(function (c) { return c.id === compteId; });
      if (!compte) return false;
      if (compte.soldeDisponible < montant) return false;

      compte.solde            -= montant;
      compte.soldeDisponible  -= montant;

      var txn = {
        id: 'TXN-' + Date.now(),
        type: 'debit',
        categorie: categorie || 'virement',
        libelle: libelle || 'Virement',
        montant: montant,
        date: new Date().toISOString(),
        statut: 'completed',
        compteId: compteId,
        ref: ref || ('VIR-' + Date.now()),
      };
      _data.transactions.unshift(txn);

      save(_data);
      store._dispatch('sb:transaction', txn);
      store._dispatch('sb:balance', { compteId: compteId, solde: compte.solde });
      return txn;
    },

    /** Crédite un compte */
    credit: function (compteId, montant, libelle, categorie, ref) {
      var compte = _data.comptes.find(function (c) { return c.id === compteId; });
      if (!compte) return false;

      compte.solde            += montant;
      compte.soldeDisponible  += montant;

      var txn = {
        id: 'TXN-' + Date.now(),
        type: 'credit',
        categorie: categorie || 'virement',
        libelle: libelle || 'Virement reçu',
        montant: montant,
        date: new Date().toISOString(),
        statut: 'completed',
        compteId: compteId,
        ref: ref || ('VIR-' + Date.now()),
      };
      _data.transactions.unshift(txn);

      save(_data);
      store._dispatch('sb:transaction', txn);
      store._dispatch('sb:balance', { compteId: compteId, solde: compte.solde });
      return txn;
    },

    /* ── Transactions ─────────────────────────────────────────────────── */
    getTransactions: function (opts) {
      var txns = _data.transactions.slice();
      opts = opts || {};
      if (opts.compteId)   txns = txns.filter(function (t) { return t.compteId === opts.compteId; });
      if (opts.type)       txns = txns.filter(function (t) { return t.type === opts.type; });
      if (opts.categorie)  txns = txns.filter(function (t) { return t.categorie === opts.categorie; });
      if (opts.search)     txns = txns.filter(function (t) { return t.libelle.toLowerCase().indexOf(opts.search.toLowerCase()) !== -1; });
      // Tri décroissant par date
      txns.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      var limit = opts.limit || txns.length;
      return txns.slice(0, limit);
    },

    getOperationsEnAttente: function () { return _data.operationsEnAttente.slice(); },

    annulerOperation: function (id) {
      var idx = _data.operationsEnAttente.findIndex(function (o) { return o.id === id; });
      if (idx === -1) return false;
      if (_data.operationsEnAttente[idx].statut !== 'scheduled') return false;
      _data.operationsEnAttente[idx].statut = 'cancelled';
      save(_data);
      store._dispatch('sb:pending_cancelled', { id: id });
      return true;
    },

    /* ── Cartes ─────────────────────────────────────────────────────── */
    getCartes: function () { return _data.cartes.slice(); },

    getCarte: function (id) {
      return _data.cartes.find(function (c) { return c.id === id; }) || null;
    },

    bloquerCarte: function (id) {
      var carte = _data.cartes.find(function (c) { return c.id === id; });
      if (!carte) return false;
      carte.statut = 'blocked';
      save(_data);
      store._dispatch('sb:card_blocked', { id: id });
      return true;
    },

    debloquerCarte: function (id) {
      var carte = _data.cartes.find(function (c) { return c.id === id; });
      if (!carte) return false;
      carte.statut = 'active';
      save(_data);
      store._dispatch('sb:card_unblocked', { id: id });
      return true;
    },

    /* ── Bénéficiaires ──────────────────────────────────────────────── */
    getBeneficiaires: function (actifSeulement) {
      var list = _data.beneficiaires.slice();
      if (actifSeulement !== false) list = list.filter(function (b) { return b.actif; });
      return list;
    },

    ajouterBeneficiaire: function (ben) {
      ben.id = 'BEN-' + Date.now();
      ben.actif = true;
      ben.ajouteLe = new Date().toISOString().split('T')[0];
      _data.beneficiaires.push(ben);
      save(_data);
      store._dispatch('sb:beneficiary_added', ben);
      return ben;
    },

    supprimerBeneficiaire: function (id) {
      var ben = _data.beneficiaires.find(function (b) { return b.id === id; });
      if (!ben) return false;
      ben.actif = false;
      save(_data);
      store._dispatch('sb:beneficiary_removed', { id: id });
      return true;
    },

    /* ── Notifications ──────────────────────────────────────────────── */
    getNotifications: function () { return _data.notifications.slice(); },

    getNonLues: function () {
      return _data.notifications.filter(function (n) { return !n.lue; }).length;
    },

    marquerLue: function (id) {
      var n = _data.notifications.find(function (n) { return n.id === id; });
      if (n) { n.lue = true; save(_data); }
    },

    ajouterNotification: function (notif) {
      notif.id = 'NOT-' + Date.now();
      notif.date = new Date().toISOString().split('T')[0];
      notif.lue = false;
      _data.notifications.unshift(notif);
      save(_data);
      store._dispatch('sb:notification', notif);
    },

    /* ── Reset (logout) ─────────────────────────────────────────────── */
    reset: function () {
      sessionStorage.removeItem(STORE_KEY);
      _data = JSON.parse(JSON.stringify(DEMO));
    },

    /* ── Événements personnalisés ────────────────────────────────────── */
    _dispatch: function (eventName, detail) {
      try {
        var evt = new CustomEvent(eventName, { detail: detail, bubbles: true });
        document.dispatchEvent(evt);
      } catch (e) {}
    },

    on: function (eventName, handler) {
      document.addEventListener(eventName, function (e) { handler(e.detail); });
    },
  };

  global.SkyStore = store;

}(window));
