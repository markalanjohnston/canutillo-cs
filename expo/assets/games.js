/* games.js: shared kiosk code for the CTE Night challenges at CHS (Karel, binary, cipher).
   - The stage: one fixed design size (1180x760 landscape, 820x1140 portrait), scaled to fit any screen.
   - Kiosk use: no zoom, scroll, bounce or text selection; idle reset after 60 s (warning from 45 s);
     "New player" asks for a second tap. Resets change state in JS only: never a reload, never a fetch.
   - Shared pieces: the challenge pills, clues ("Try a clue / ¿Necesitas una pista?"), the solved overlays, confetti.
   - URL switches for screenshots and checks: ?level=1..4, ?set=1..3 (the hardest challenge's puzzle set),
     ?demo=..., ?fast=1 (no animation delays), ?selftest=1 (runs the page's checks, writes PASS/FAIL to the title). */
(function () {
  'use strict';

  const K = window.Kiosk = {};
  const P = new URLSearchParams(location.search);
  K.params = P;
  K.param = (k, d = null) => (P.has(k) ? P.get(k) : d);
  K.num = (k, d) => { const v = parseInt(P.get(k), 10); return Number.isFinite(v) ? v : d; };
  K.selftest = P.get('selftest') === '1';
  K.demo = P.get('demo') || '';
  K.fast = K.selftest || P.get('fast') === '1';
  K.wait = (ms) => new Promise((r) => setTimeout(r, K.fast ? 0 : ms));
  K.sleep = (ms) => new Promise((r) => setTimeout(r, ms));          // real time, even in fast mode
  K.$ = (s, r = document) => r.querySelector(s);
  K.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  K.mod = (a, n) => ((a % n) + n) % n;

  /* English first, Spanish beneath (rule 6). Strings are ours, never typed by a visitor. */
  K.bi = (en, es, cls = '') =>
    `<span class="bi ${cls}"><span class="en">${en}</span><span class="es" lang="es">${es}</span></span>`;

  /* The four level names, the same in every challenge. */
  K.LEVELS = [
    { en: 'Challenge 1', es: 'Reto 1' },
    { en: 'Challenge 2', es: 'Reto 2' },
    { en: 'Challenge 3', es: 'Reto 3' },
    { en: 'The hardest challenge', es: 'El reto más difícil', hardest: true },
  ];
  K.NOT_QUITE = ['Not quite. Try again.', 'Casi. Inténtalo otra vez.'];

  /* ---------- icons (inline SVG, no files to fetch) ---------- */
  const sv = (body, vb = '0 0 24 24', w = 28) =>
    `<span class="ico" aria-hidden="true"><svg width="${w}" height="${w}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg></span>`;
  K.icon = {
    back: sv('<path d="M15 5l-7 7 7 7"/>'),
    next: sv('<path d="M9 5l7 7-7 7"/>'),
    play: sv('<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>'),
    redo: sv('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>'),
    bulb: sv('<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'),
    check: sv('<path d="M4 12.5l5 5L20 6.5"/>'),
    erase: sv('<path d="M20 6H9l-5 6 5 6h11z"/><path d="M12 10l4 4M16 10l-4 4"/>'),
    star: `<span class="ico" aria-hidden="true"><svg width="96" height="96" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="#F08000" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg></span>`,
    trophy: `<span class="ico" aria-hidden="true"><svg width="120" height="120" viewBox="0 0 24 24"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#F08000" stroke="#fff" stroke-width="1.1"/><path d="M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5A3.5 3.5 0 0 1 16.5 10" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M12 13v4M8.5 21h7M9.5 17h5v4h-5z" fill="#F08000" stroke="#fff" stroke-width="1.1"/><path d="M12 4.6l.8 1.7 1.9.2-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.2z" fill="#fff"/></svg></span>`,
    helper: `<span class="ico" aria-hidden="true"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#001080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3.2"/><path d="M3 20c.6-3.6 3-5.6 6-5.6s5.4 2 6 5.6"/><path d="M16 4.5l1.6 1.6L21 2.8" stroke="#F08000" stroke-width="2.4"/><path d="M17.5 10.5c1.9.5 3 2.4 3.4 5"/></svg></span>`,
  };

  /* ---------- the stage ---------- */
  K.DESIGN = { landscape: [1180, 760], portrait: [820, 1140] };
  K.fitStage = function (stage, onOrient) {
    let last = null;
    function fit() {
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const o = vh > vw ? 'portrait' : 'landscape';
      const [W, H] = K.DESIGN[o];
      stage.classList.toggle('portrait', o === 'portrait');
      stage.classList.toggle('landscape', o === 'landscape');
      const s = Math.min(vw / W, vh / H);
      stage.style.transform = `translate(${Math.round((vw - W * s) / 2)}px, ${Math.round((vh - H * s) / 2)}px) scale(${s})`;
      K.scale = s;
      K.orient = o;
      if (o !== last) { last = o; if (onOrient) onOrient(o); }
    }
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 60));
    fit();
    return fit;
  };

  /* ---------- no zoom, scroll, bounce, selection or long-press menus ---------- */
  K.guard = function () {
    const stop = (e) => e.preventDefault();
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, stop, { passive: false }));
    document.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('touchstart', () => {}, { passive: true }); // lets :active styles show on iPad
    document.addEventListener('contextmenu', stop);
    document.addEventListener('dblclick', stop);
    document.addEventListener('selectstart', stop);
    document.addEventListener('dragstart', stop);
    document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
    });
  };

  // an open overlay also dims the strips beside the stage (the stage is letterboxed on most screens)
  const dimSync = () => document.body.classList.toggle('dimmed', !!document.querySelector('.stage .overlay.show'));
  K.show = (el) => { if (el) { el.classList.add('show'); dimSync(); } };
  K.hide = (el) => { if (el) { el.classList.remove('show'); dimSync(); } };
  K.hideOverlays = (root) => { K.$$('.overlay.show', root).forEach((o) => o.classList.remove('show')); dimSync(); };

  /* ---------- kiosk: idle reset and the New player button ---------- */
  K.mount = function (opts) {
    const stage = opts.stage;
    K.stage = stage;
    K.guard();
    K.refit = K.fitStage(stage, opts.onOrient);

    const IDLE = opts.idleMs || 60000;
    const WARN = opts.warnMs || 45000;
    let last = Date.now();

    const ov = document.createElement('div');
    ov.className = 'overlay idle';
    ov.id = 'ov-idle';
    ov.innerHTML = `<div class="panel"><div class="big">${K.bi('Still playing? Tap the screen.', '¿Sigues jugando? Toca la pantalla.')}</div>
      <div class="count">${K.bi('Starting over in <b data-n>15</b> seconds', 'Empezamos de nuevo en <b data-n2>15</b> segundos')}</div></div>`;
    stage.appendChild(ov);
    const nEl = ov.querySelector('[data-n]');
    const nEl2 = ov.querySelector('[data-n2]');

    const poke = () => { last = Date.now(); };
    ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'wheel'].forEach((t) =>
      document.addEventListener(t, poke, { capture: true, passive: true }));
    ov.addEventListener('click', () => { poke(); K.hide(ov); });

    function tick() {
      if ((opts.isHome && opts.isHome()) || (opts.isBusy && opts.isBusy())) { last = Date.now(); K.hide(ov); return; }
      const idle = Date.now() - last;
      if (idle >= IDLE) { K.hide(ov); last = Date.now(); reset('idle'); }
      else if (idle >= WARN) {
        const left = Math.max(1, Math.ceil((IDLE - idle) / 1000));
        nEl.textContent = left; nEl2.textContent = left;
        K.show(ov);
      } else K.hide(ov);
    }
    if (!K.selftest) setInterval(tick, 250);

    function reset(why) {
      K.hideOverlays(stage);
      K.$$('.confetti', stage).forEach((c) => c.remove());
      if (newBtn) revert();
      opts.onReset(why);
    }

    // New player: first tap asks, second tap resets (3 s window), so a stray tap never wipes a turn.
    const newBtn = opts.newButton;
    let tmr = null;
    const NORMAL = K.icon.redo + K.bi('Start over', 'Empezar de nuevo');
    const CONFIRM = K.bi('Tap again to start over', 'Toca otra vez para empezar');
    function revert() { clearTimeout(tmr); tmr = null; newBtn.classList.remove('confirm'); newBtn.innerHTML = NORMAL; }
    if (newBtn) {
      newBtn.innerHTML = NORMAL;
      newBtn.addEventListener('click', () => {
        if (newBtn.classList.contains('confirm')) { revert(); reset('button'); }
        else { newBtn.classList.add('confirm'); newBtn.innerHTML = CONFIRM; tmr = setTimeout(revert, 3000); }
      });
    }

    K.current = {
      reset,
      tick,
      forceIdle(ms) { last = Date.now() - (ms == null ? IDLE : ms); tick(); },
      idleOverlay: ov,
    };
    return K.current;
  };

  /* ---------- the four challenge pills ---------- */
  K.pills = function (ol, current, done) {
    ol.innerHTML = K.LEVELS.map((L, i) => {
      const cls = ['pill', L.hardest ? 'hardest' : '', i === current ? 'current' : '', done[i] ? 'done' : ''].join(' ');
      return `<li class="${cls}"${i === current ? ' aria-current="step"' : ''}><span class="en">${L.en}</span><span class="es" lang="es">${L.es}</span></li>`;
    }).join('');
  };

  /* ---------- clues: each tap shows the next, more helpful one ---------- */
  K.Clues = function (btn, box, onUse) {
    let list = [];
    let n = 0;
    function render() {
      if (n === 0) btn.innerHTML = K.icon.bulb + K.bi('Try a clue', '¿Necesitas una pista?');
      else if (n < list.length) btn.innerHTML = K.icon.bulb + K.bi('Another clue', 'Otra pista');
      else btn.innerHTML = K.icon.bulb + K.bi('No more clues', 'No hay más pistas');
      btn.disabled = n >= list.length;
      if (n === 0) { box.hidden = true; box.innerHTML = ''; return; }
      const c = list[n - 1];
      box.hidden = false;
      box.innerHTML = `<span class="clue-n">${K.bi(`Clue ${n} of ${list.length}`, `Pista ${n} de ${list.length}`)}</span>` +
        `<span class="clue-t"><span class="en"><b class="cn">Clue ${n} of ${list.length}:</b> ${c.en}</span><span class="es" lang="es"><b class="cn">Pista ${n} de ${list.length}:</b> ${c.es}</span></span>`;
      if (c.action) {
        const b = document.createElement('button');
        b.className = 'btn btn-ghost clue-act';
        b.innerHTML = c.action.html;
        b.addEventListener('click', c.action.onClick);
        box.appendChild(b);
      }
    }
    btn.addEventListener('click', () => {
      if (n < list.length) { n++; render(); if (onUse) onUse(n, list[n - 1]); }
    });
    return {
      set(newList) { list = newList; n = 0; render(); },
      showUpTo(k) { n = Math.min(k, list.length); render(); },
      get used() { return n; },
      get count() { return list.length; },
    };
  };

  /* ---------- solved overlays ---------- */
  K.celebrate = function (o) {
    let ov = K.$('#ov-win', K.stage);
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'overlay';
      ov.id = 'ov-win';
      ov.innerHTML = '<div class="panel" role="dialog" aria-live="assertive"></div>';
      K.stage.appendChild(ov);
    }
    const panel = ov.querySelector('.panel');
    panel.className = 'panel' + (o.hardest ? ' hardest' : '');
    panel.innerHTML =
      `<div class="burst">${o.hardest ? K.icon.trophy : K.icon.star}</div>` +
      `<h2>${K.bi(o.title[0], o.title[1])}</h2>` +
      (o.hardest ? `<div class="show-helper">${K.icon.helper}${K.bi('Show a helper.', 'Muéstraselo a un ayudante.')}</div>` : '') +
      (o.sub ? `<div class="sub">${K.bi(o.sub[0], o.sub[1])}</div>` : '') +
      (o.detail ? `<div class="detail">${o.detail}</div>` : '') +
      '<div class="actions"></div>' +
      (o.hardest ? `<div class="ask-line">${K.bi('At course selection next week, ask for <b>Fundamentals of Computer Science</b>.', 'Pide <b>Fundamentals of Computer Science</b> al elegir tus materias.')}</div>` : '');
    const act = panel.querySelector('.actions');
    (o.actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      if (a.id) b.id = a.id;
      b.innerHTML = a.html;
      b.addEventListener('click', a.onClick);
      act.appendChild(b);
    });
    K.show(ov);
    if (!K.fast && !K.demo) K.confetti(K.stage, o.hardest ? 130 : 60);
    return ov;
  };

  K.confetti = function (root, n) {
    const box = document.createElement('div');
    box.className = 'confetti';
    const colors = ['#F08000', '#ffffff', '#ffb54d', '#8fa2ff', '#3bd682'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = (Math.random() * 100).toFixed(1) + '%';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() * 260 - 130).toFixed(0) + 'px');
      p.style.setProperty('--rot', (Math.random() * 900 - 450).toFixed(0) + 'deg');
      p.style.animationDuration = (1.9 + Math.random() * 1.7).toFixed(2) + 's';
      p.style.animationDelay = (Math.random() * 0.45).toFixed(2) + 's';
      box.appendChild(p);
    }
    root.appendChild(box);
    setTimeout(() => box.remove(), 4400);
  };

  /* ---------- feedback line ---------- */
  K.say = function (el, kind, en, es, extraHTML = '') {
    el.className = 'feedback' + (kind ? ' ' + kind : '');
    el.innerHTML = en ? `<span class="en">${en}</span><span class="es" lang="es">${es}</span>${extraHTML}` : '';
  };

  /* ---------- self-test harness (?selftest=1) ---------- */
  K.Test = function (name) {
    const rows = [];
    const t = {
      ok(c, msg) { rows.push({ ok: !!c, msg }); return !!c; },
      eq(a, b, msg) {
        const A = JSON.stringify(a);
        const B = JSON.stringify(b);
        const ok = A === B;
        rows.push({ ok, msg: ok ? `${msg}: ${A}` : `${msg}: got ${A}, expected ${B}` });
        return ok;
      },
      finish(err) {
        if (err) rows.push({ ok: false, msg: 'ERROR ' + ((err && err.stack) || err) });
        const fails = rows.filter((r) => !r.ok);
        document.title = fails.length
          ? `SELFTEST FAIL ${name} (${fails.length} of ${rows.length} failed): ${fails[0].msg}`
          : `SELFTEST PASS ${name} (${rows.length} checks)`;
        const p = document.createElement('div');
        p.id = 'selftest-panel';
        if (fails.length) p.className = 'fail';
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const ordered = fails.concat(rows.filter((r) => r.ok));
        p.innerHTML = `<h3>${esc(document.title)}</h3>` +
          ordered.map((r) => `<div class="r${r.ok ? '' : ' f'}">${r.ok ? 'PASS' : 'FAIL'} ${esc(r.msg)}</div>`).join('');
        document.body.appendChild(p);
        window.__selftest = { pass: !fails.length, rows };
      },
      rows,
    };
    return t;
  };

  /* "Nothing may be fetched after first load": count what the browser fetched by the load event. */
  K.loadCount = null;
  window.addEventListener('load', () => { K.loadCount = performance.getEntriesByType('resource').length; });
  K.fetchedSinceLoad = () => (K.loadCount == null ? 0 : performance.getEntriesByType('resource').length - K.loadCount);

  /* Click a button the way a finger would (the real click handlers run). */
  K.tap = (el) => { if (!el) throw new Error('nothing to tap'); el.click(); };

  /* Keep the screen awake while a game shows (the iPad and the school Mac sit idle between visitors). */
  if ('wakeLock' in navigator) {
    let held = null;
    const ask = () => {
      if (held || document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then((s) => {
        held = s;
        s.addEventListener('release', () => { held = null; });
      }).catch(() => {});
    };
    document.addEventListener('visibilitychange', ask);
    document.addEventListener('click', ask);
    document.addEventListener('keydown', ask);
    ask();
  }
})();
