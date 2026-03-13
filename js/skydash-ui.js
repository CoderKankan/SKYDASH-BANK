/**
 * SKYDASH BANK — UI Helpers globaux
 * ─────────────────────────────────────────────────────
 * Toast notifications, formatage, timer de session, navbar live
 * ─────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  /* ── Formatage ──────────────────────────────────────────────────────── */
  var fmt = {
    montant: function (v, sign) {
      var s = Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
      if (sign === '+') return '+' + s;
      if (sign === '-') return '−' + s;
      return s;
    },
    date: function (iso) {
      var d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    heure: function (iso) {
      var d = new Date(iso);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    },
    dateHeure: function (iso) {
      return fmt.date(iso) + ' à ' + fmt.heure(iso);
    },
  };

  /* ── Toast notifications ────────────────────────────────────────────── */
  var TOAST_TYPES = {
    success: { icon: 'ti-check-box',  color: '#1bcfb4', bg: '#f0fff9' },
    error:   { icon: 'ti-close',      color: '#fe7c96', bg: '#fff5f7' },
    warning: { icon: 'ti-alert',      color: '#f3a84b', bg: '#fffcf0' },
    info:    { icon: 'ti-info-alt',   color: '#4B49AC', bg: '#f4f4fc' },
  };

  function ensureContainer() {
    var c = document.getElementById('sb-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'sb-toast-container';
      c.style.cssText = [
        'position:fixed', 'top:72px', 'right:20px', 'z-index:9999',
        'display:flex', 'flex-direction:column', 'gap:10px',
        'pointer-events:none', 'max-width:360px', 'width:100%',
      ].join(';');
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(type, title, message, duration) {
    duration = duration || 4500;
    var cfg = TOAST_TYPES[type] || TOAST_TYPES.info;
    var container = ensureContainer();

    var el = document.createElement('div');
    el.style.cssText = [
      'background:' + cfg.bg,
      'border-left:4px solid ' + cfg.color,
      'border-radius:10px',
      'padding:14px 16px',
      'box-shadow:0 4px 18px rgba(0,0,0,.12)',
      'display:flex', 'align-items:flex-start', 'gap:12px',
      'pointer-events:all',
      'animation:sbSlideIn .25s ease',
      'opacity:1',
      'transition:opacity .3s ease',
      'cursor:pointer',
    ].join(';');

    el.innerHTML = [
      '<i class="' + cfg.icon + '" style="font-size:1.2rem;color:' + cfg.color + ';flex-shrink:0;margin-top:2px;"></i>',
      '<div style="flex:1;min-width:0;">',
        title ? '<div style="font-weight:700;font-size:.85rem;color:#2d2d2d;margin-bottom:2px;">' + title + '</div>' : '',
        message ? '<div style="font-size:.82rem;color:#495057;line-height:1.4;">' + message + '</div>' : '',
      '</div>',
      '<button type="button" style="background:none;border:none;cursor:pointer;color:#adb5bd;font-size:1rem;padding:0;line-height:1;margin-top:2px;pointer-events:all;" aria-label="Fermer">&#x2715;</button>',
    ].join('');

    // Injection du style d'animation si absent
    if (!document.getElementById('sb-toast-style')) {
      var s = document.createElement('style');
      s.id = 'sb-toast-style';
      s.textContent = '@keyframes sbSlideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}';
      document.head.appendChild(s);
    }

    var btn = el.querySelector('button');
    btn.addEventListener('click', function () { dismiss(el); });
    el.addEventListener('click', function () { dismiss(el); });

    container.appendChild(el);

    var timer = setTimeout(function () { dismiss(el); }, duration);

    function dismiss(node) {
      clearTimeout(timer);
      node.style.opacity = '0';
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 300);
    }

    return el;
  }

  /* ── Mise à jour navbar (solde + badge notifs) ───────────────────────── */
  function refreshNavbar() {
    if (typeof SkyStore === 'undefined') return;

    /* Badge notifications non lues */
    var badge = document.querySelector('.sb-notif-badge');
    var nonLues = SkyStore.getNonLues();
    if (badge) {
      badge.textContent = nonLues;
      badge.style.display = nonLues > 0 ? 'inline-flex' : 'none';
    }
  }

  /* ── Timer de session (inactivité 15 min) ───────────────────────────── */
  var SESSION_TIMEOUT = 15 * 60; // secondes
  var _sessionTimer   = null;
  var _warningTimer   = null;
  var _remaining      = SESSION_TIMEOUT;
  var _timerEl        = null;

  function startSessionTimer() {
    _remaining = SESSION_TIMEOUT;
    clearInterval(_sessionTimer);
    clearTimeout(_warningTimer);

    // Afficher le timer dans la navbar si l'élément existe
    _timerEl = document.getElementById('sb-session-timer');

    _sessionTimer = setInterval(function () {
      _remaining -= 1;

      if (_timerEl) {
        var m = Math.floor(_remaining / 60);
        var s = _remaining % 60;
        _timerEl.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        _timerEl.style.color = _remaining <= 120 ? '#fe7c96' : '';
      }

      if (_remaining === 120) {
        toast('warning', 'Session expire bientôt', 'Votre session expirera dans 2 minutes. Cliquez pour continuer.', 8000);
      }

      if (_remaining <= 0) {
        clearInterval(_sessionTimer);
        toast('error', 'Session expirée', 'Vous avez été déconnecté pour inactivité.', 5000);
        setTimeout(function () {
          var depth = window.location.pathname.split('/').length - 1;
          var prefix = depth > 2 ? '../../' : '';
          window.location.href = prefix + 'pages/samples/login.html';
        }, 2000);
      }
    }, 1000);

    // Réinitialiser sur toute interaction
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(function (evt) {
      document.addEventListener(evt, resetTimer, { passive: true });
    });
  }

  function resetTimer() {
    _remaining = SESSION_TIMEOUT;
    if (_timerEl) { _timerEl.style.color = ''; }
  }

  /* ── Chargement du store dans les selects de comptes ─────────────────── */
  function populateCompteSelects() {
    if (typeof SkyStore === 'undefined') return;
    var selects = document.querySelectorAll('.sb-compte-select');
    if (!selects.length) return;

    var comptes = SkyStore.getComptes().filter(function (c) { return c.statut === 'actif'; });

    selects.forEach(function (sel) {
      var filterType = sel.dataset.filter || '';
      var currentVal = sel.value;

      // Vider les options dynamiques (garder la première placeholder)
      while (sel.options.length > 1) sel.remove(1);

      comptes.forEach(function (c) {
        if (filterType && c.type !== filterType) return;
        var opt = document.createElement('option');
        opt.value = c.id;
        opt.setAttribute('data-solde', c.solde);
        opt.setAttribute('data-iban', c.iban);
        opt.textContent = c.label + ' — ' + c.iban.slice(-9) + ' — ' + fmt.montant(c.solde);
        sel.appendChild(opt);
      });

      if (currentVal) sel.value = currentVal;
    });
  }

  /* ── Init automatique au chargement ────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    refreshNavbar();
    populateCompteSelects();

    // Timer de session si l'utilisateur semble connecté (présence du sidebar)
    if (document.getElementById('sidebar')) {
      startSessionTimer();
    }

    // Écoute des changements de solde pour mettre à jour la navbar
    if (typeof SkyStore !== 'undefined') {
      SkyStore.on('sb:balance', function () { refreshNavbar(); });
      SkyStore.on('sb:notification', function () { refreshNavbar(); });
    }
  });

  /* ── Export ─────────────────────────────────────────────────────────── */
  global.SkyUI = {
    toast: toast,
    fmt: fmt,
    refreshNavbar: refreshNavbar,
    populateCompteSelects: populateCompteSelects,
    resetSessionTimer: resetTimer,
  };

}(window));
