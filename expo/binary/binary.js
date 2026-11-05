/* binary.js: "Binary Challenge" for CTE Night at CHS (a self-serve extra; the Karel game is the main station).
   Five bit cards, 16 8 4 2 1, with dots (the CS Unplugged cards). Tap a card: ON shows its dots and value, OFF is dark.
   Challenge 1: make 5 (total shown) · Challenge 2: make 12 (total shown) · Challenge 3: make 22 (total hidden) ·
   The hardest challenge: total hidden, three numbers in a row, then a bonus: why 32 needs a sixth card.
   Clues on every level; a wrong answer only says "Not quite. Try again." */
(function () {
  'use strict';
  const K = window.Kiosk;

  const VALUES = [16, 8, 4, 2, 1];
  const FIXED = [[5], [12], [22]];                              // Challenges 1-3
  const HARDEST = [[27, 19, 30], [23, 28, 13], [29, 14, 25]];   // one set per visitor, in turn
  const SHOWN = [true, true, false, false];                     // is the running total on screen?
  const COLS = { 1: 1, 2: 1, 4: 2, 8: 2, 16: 4, 32: 8 };        // dot layout per card

  const bitsOf = (n, width = 5) => n.toString(2).padStart(width, '0');
  const cardsFor = (n) => VALUES.filter((v) => n & v);

  /* ---------- drawing ---------- */
  function cardHTML(v, cls = '') {
    let dots = '';
    for (let i = 0; i < v; i++) dots += '<i></i>';
    return `<button class="bcard ${cls}" type="button" data-v="${v}" aria-pressed="false" aria-label="Card ${v}">` +
      '<span class="flip"><span class="face off" aria-hidden="true"></span>' +
      `<span class="face on"><span class="dots" style="--c:${COLS[v]}">${dots}</span><span class="val">${v}</span></span></span></button>`;
  }

  const stage = K.$('#stage');
  const el = {
    start: K.$('#start'), play: K.$('#play'), pills: K.$('#pills'), goal: K.$('#goal'), howto: K.$('#howto'),
    total: K.$('#total'), places: K.$('#places'), cards: K.$('#cards'), bits: K.$('#bits'), fb: K.$('#fb'),
    clueBtn: K.$('#btn-clue'), clueBox: K.$('#cluebox'), check: K.$('#btn-check'), newBtn: K.$('#btn-new'),
    startBtn: K.$('#btn-start'), lp: K.$('#lp'), bonus: K.$('#ov-bonus'),
  };
  el.places.innerHTML = VALUES.map((v) => `<span>${v}</span>`).join('');
  el.cards.innerHTML = VALUES.map((v) => cardHTML(v)).join('');
  el.startBtn.innerHTML = K.bi('Start', 'Empezar') + K.icon.play;
  el.check.innerHTML = K.icon.check + K.bi('Check', 'Revisar');
  el.lp.innerHTML = K.LEVELS.map((x) => `<span class="lp${x.hardest ? ' hardest' : ''}"><span class="en">${x.en}</span><span class="es" lang="es">${x.es}</span></span>`).join('');
  const cardEls = K.$$('.bcard', el.cards);

  const S = {
    screen: 'start', level: 0, step: 0, on: [false, false, false, false, false],
    done: [false, false, false, false], set: K.mod(K.num('set', 1) - 1, HARDEST.length), locked: false, token: 0,
  };
  const targets = () => (S.level < 3 ? FIXED[S.level] : HARDEST[S.set]);
  const target = () => targets()[S.step];
  const total = () => VALUES.reduce((t, v, i) => t + (S.on[i] ? v : 0), 0);

  const clues = K.Clues(el.clueBtn, el.clueBox);
  function cluesFor(t) {
    const cards = cardsFor(t);
    const big = cards[0];
    const rest = t - big;
    return [
      { en: `Find the biggest card that is not more than ${t}. Turn it on first.`, es: `Busca la tarjeta más grande que no pase de ${t}. Enciéndela primero.` },
      rest ? { en: `Turn on the ${big} card. Then you still need ${rest} more.`, es: `Enciende la tarjeta ${big}. Luego te faltan ${rest}.` }
        : { en: `The ${big} card alone makes ${t}.`, es: `La tarjeta ${big} sola forma ${t}.` },
      { en: `${t} = ${cards.join(' + ')}. Turn on only those cards.`, es: `${t} = ${cards.join(' + ')}. Enciende solo esas tarjetas.` },
    ];
  }

  const kiosk = K.mount({
    stage,
    newButton: el.newBtn,
    isHome: () => S.screen === 'start',
    isBusy: () => false,
    onReset: () => newPlayer(),
  });

  /* ---------- screens ---------- */
  function showStart() {
    S.screen = 'start';
    S.token++;
    el.play.classList.remove('show');
    el.start.classList.add('show');
    el.newBtn.hidden = true;
    el.pills.style.visibility = 'hidden';
    attract();
  }
  function newPlayer() {
    S.done = [false, false, false, false];
    S.set = (S.set + 1) % HARDEST.length;     // the next visitor gets the next set of hardest numbers
    showStart();
  }
  function startPlay(level) {
    S.screen = 'play';
    S.token++;
    el.start.classList.remove('show');
    el.play.classList.add('show');
    el.newBtn.hidden = false;
    el.pills.style.visibility = '';
    loadLevel(level);
  }
  function loadLevel(level) {
    S.level = level;
    S.step = 0;
    S.locked = false;
    K.pills(el.pills, level, S.done);
    el.check.hidden = SHOWN[level];
    el.total.classList.toggle('hidden', !SHOWN[level]);
    newTarget();
  }
  function newTarget() {
    S.on = [false, false, false, false, false];
    S.locked = false;
    clues.set(cluesFor(target()));
    K.say(el.fb, '');
    render();
  }

  function render() {
    const t = target();
    const tot = total();
    cardEls.forEach((c, i) => {
      c.classList.toggle('on', S.on[i]);
      c.classList.remove('good');
      c.setAttribute('aria-pressed', S.on[i] ? 'true' : 'false');
    });
    el.bits.innerHTML = S.on.map((x) => `<b class="${x ? 'one' : ''}">${x ? 1 : 0}</b>`).join('');
    // the goal
    if (S.level === 3) {
      const chain = targets().map((n, i) => `<span class="c${i < S.step ? ' ok' : i === S.step ? ' now' : ''}">${n}</span>`).join('');
      el.goal.innerHTML = `<span class="lbl">${K.bi('Make these 3 in a row', 'Forma estos tres números, uno tras otro')}</span><span class="chain">${chain}</span>`;
    } else {
      el.goal.innerHTML = `<span class="lbl">${K.bi('Make', 'Forma')}</span><span class="num">${t}</span>`;
    }
    el.goal.classList.toggle('hit', SHOWN[S.level] && tot === t);
    // how to
    const how = [
      ['Tap a card to turn it ON. Make the total 5.', 'Toca una tarjeta para encenderla. Haz que el total sea 5.'],
      ['Turn on the cards that add up to 12.', 'Enciende las tarjetas que suman 12.'],
      ['The total is hidden now. Add in your head, then tap Check.', 'Ahora el total está oculto. Suma en tu mente y toca Revisar.'],
      ['Total hidden. Make each number, then tap Check.', 'Total oculto. Forma cada número y toca Revisar.'],
    ][S.level];
    el.howto.innerHTML = K.bi(how[0], how[1]);
    // the total
    el.total.innerHTML = `<span class="lbl">${SHOWN[S.level] ? K.bi('Total', 'Total') : K.bi('Total', 'oculto')}</span><span class="num">${SHOWN[S.level] ? tot : '?'}</span>`;
  }

  /* ---------- play ---------- */
  cardEls.forEach((c, i) => c.addEventListener('click', () => {
    if (S.screen !== 'play' || S.locked) return;
    S.on[i] = !S.on[i];
    K.say(el.fb, '');
    render();
    if (SHOWN[S.level] && total() === target()) solved();
  }));
  el.check.addEventListener('click', () => {
    if (S.locked) return;
    if (total() === target()) solved();
    else {
      K.say(el.fb, 'bad', K.NOT_QUITE[0], K.NOT_QUITE[1]);
      el.cards.classList.remove('shake');
      void el.cards.offsetWidth;
      el.cards.classList.add('shake');
    }
  });

  async function solved() {
    S.locked = true;
    const t = target();
    cardEls.forEach((c, i) => { if (S.on[i]) c.classList.add('good'); });
    const my = S.token;
    if (S.level === 3 && S.step < targets().length - 1) {
      K.say(el.fb, 'good', `&#10003; ${t} = ${bitsOf(t)}`, `${t} en binario es ${bitsOf(t)}`);
      await K.wait(1100);
      if (my !== S.token) return;
      S.step++;
      newTarget();
      return;
    }
    await K.wait(700);
    if (my !== S.token) return;
    S.done[S.level] = true;
    K.pills(el.pills, S.level, S.done);
    celebrate();
  }

  function celebrate() {
    if (S.level === 3) {
      const list = targets().map((n) => `${n} = <code>${bitsOf(n)}</code>`).join(' &nbsp;·&nbsp; ');
      K.celebrate({
        hardest: true,
        title: ['You did the hardest challenge!', '¡Superaste el reto más difícil!'],
        detail: `<div class="code-line" style="font-size:28px">${list}</div>`,
        actions: [
          { id: 'btn-bonus', cls: 'btn-big', html: K.bi('Bonus: why does 32 need a sixth card?', 'Extra: ¿por qué el 32 necesita una sexta tarjeta?') + K.icon.next, onClick: () => openBonus() },
          { id: 'btn-again', cls: 'btn-ghost', html: K.icon.redo + K.bi('Start over', 'Empezar de nuevo'), onClick: () => kiosk.reset('button') },
        ],
      });
      return;
    }
    const t = target();
    const n = S.level + 1;
    const next = K.LEVELS[S.level + 1];
    K.celebrate({
      title: [`Challenge ${n} solved!`, `¡Reto ${n} resuelto!`],
      sub: ["You got it. That was the first step. This class is hard, that's the point, and you just showed you can do it.", '¡Lo lograste! Ese fue el primer paso. Esta clase es difícil, esa es la idea, y acabas de demostrar que puedes.'],
      detail: `<div style="font-size:44px;font-weight:900">${t} = <code style="color:#ff9e30;letter-spacing:3px">${bitsOf(t)}</code></div>` +
        K.bi(`In binary, ${t} is ${bitsOf(t)}: ${cardsFor(t).join(' + ')}.`, `En binario, ${t} es ${bitsOf(t)}: ${cardsFor(t).join(' + ')}.`),
      actions: [{
        id: 'btn-nextlevel', cls: 'btn-big', html: K.bi(`Next: ${next.en}`, `Siguiente: ${next.es}`) + K.icon.next,
        onClick: () => { K.hideOverlays(stage); loadLevel(S.level + 1); },
      }],
    });
  }

  /* ---------- the bonus: 31 is the most five cards can make ---------- */
  const B = { six: false };
  function openBonus() {
    K.hideOverlays(stage);
    B.six = false;
    const row = K.$('#b-cards');
    row.innerHTML = `<div class="slot6 hide">${cardHTML(32, 'on c32')}</div>` + VALUES.map((v) => cardHTML(v, 'on')).join('');
    bonusRender();
    K.show(el.bonus);
  }
  function bonusRender() {
    const bits = K.$('#b-bits');
    const on = B.six ? [1, 0, 0, 0, 0, 0] : [0, 1, 1, 1, 1, 1];
    K.$('#b-cards').classList.toggle('five', !B.six);
    bits.classList.toggle('five', !B.six);
    bits.innerHTML = on.map((x, i) => (i === 0 && !B.six) ? '' : `<b class="${x ? 'one' : ''}">${x}</b>`).join('');
    K.$$('#b-cards .bcard').forEach((c, i) => c.classList.toggle('on', !!on[i]));
    K.$('#b-cards .slot6').classList.toggle('hide', !B.six);
    K.$('#b-sum').innerHTML = B.six
      ? '<code>100000</code> = 32'
      : '16 + 8 + 4 + 2 + 1 = 31 &nbsp; <code>11111</code>';
    K.$('#b-why').innerHTML = B.six
      ? K.bi('A sixth card is worth double the 16: 32. Each new card doubles: 1, 2, 4, 8, 16, 32.', 'Una sexta tarjeta vale el doble que la 16: 32. Cada tarjeta nueva vale el doble: 1, 2, 4, 8, 16, 32.')
      : K.bi('All five cards ON make 31. That is the most five cards can make, so 32 needs one more card.', 'Las cinco tarjetas encendidas suman 31. Es lo más que pueden formar, así que el 32 necesita una tarjeta más.');
    const act = K.$('#b-actions');
    act.innerHTML = '';
    const add = (id, cls, html, f) => { const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'btn ' + cls; b.innerHTML = html; b.addEventListener('click', f); act.appendChild(b); };
    if (!B.six) add('btn-six', 'btn-big', K.bi('Add a sixth card', 'Agrega una sexta tarjeta') + K.icon.next, () => { B.six = true; bonusRender(); });
    add('btn-again2', 'btn-ghost', K.icon.redo + K.bi('Start over', 'Empezar de nuevo'), () => kiosk.reset('button'));
  }

  /* ---------- the start screen's counting cards ---------- */
  const aCards = K.$('#a-cards');
  const aBits = K.$('#a-bits');
  const aRead = K.$('#a-read');
  aCards.innerHTML = VALUES.map((v) => cardHTML(v)).join('');
  async function attract() {
    const my = S.token;
    const seq = [1, 2, 3, 5, 8, 13, 21, 31, 0];
    for (let k = 0; ; k = (k + 1) % seq.length) {
      if (my !== S.token || S.screen !== 'start') return;
      const n = seq[k];
      K.$$('.bcard', aCards).forEach((c, i) => c.classList.toggle('on', !!(n & VALUES[i])));
      aBits.innerHTML = bitsOf(n).split('').map((b) => `<b class="${b === '1' ? 'one' : ''}">${b}</b>`).join('');
      aRead.innerHTML = `<code>${bitsOf(n)}</code> = ${n}`;
      await K.sleep(1500);
    }
  }

  el.startBtn.addEventListener('click', () => startPlay(0));

  /* ---------- ?level / ?demo for screenshots, ?selftest for the checks ---------- */
  function setCards(n) { S.on = VALUES.map((v) => !!(n & v)); render(); }
  function boot() {
    if (K.selftest) { selftest(); return; }
    const lv = K.num('level', K.demo ? 4 : 0);   // ?demo=solved alone shows the hardest challenge solved
    const d = K.demo;
    if (lv >= 1 && lv <= 4) {
      startPlay(lv - 1);
      for (let i = 0; i < lv - 1; i++) S.done[i] = true;
      K.pills(el.pills, lv - 1, S.done);
      const step = K.num('step', 1) - 1;
      if (S.level === 3 && step > 0) { S.step = Math.min(step, 2); newTarget(); }
      if (d === 'solved' || d === 'bonus' || d === 'bonus6') {
        if (S.level === 3) S.step = targets().length - 1;
        setCards(target());
        S.done[S.level] = true;
        K.pills(el.pills, S.level, S.done);
        celebrate();
        if (d !== 'solved' && S.level === 3) { openBonus(); if (d === 'bonus6') { B.six = true; bonusRender(); } }
      } else if (d === 'wrong') {
        setCards(target() - 1);
        if (!SHOWN[S.level]) K.tap(el.check);
      } else if (d === 'clue') {
        setCards(cardsFor(target())[0]);
        clues.showUpTo(K.num('clue', 2));
      } else if (d === 'partial') {
        setCards(cardsFor(target())[0]);
      }
    } else showStart();
  }

  async function selftest() {
    const T = K.Test('binary');
    try {
      // 1. Every target can be made with the five cards, and the card values are 16 8 4 2 1
      T.eq(VALUES, [16, 8, 4, 2, 1], 'the five cards are 16 8 4 2 1');
      T.eq(VALUES.reduce((a, b) => a + b, 0), 31, 'all five ON make 31 (so 32 needs a sixth card)');
      const all = FIXED.flat().concat(HARDEST.flat());
      all.forEach((t) => {
        const c = cardsFor(t);
        T.ok(t >= 1 && t <= 31 && c.reduce((a, b) => a + b, 0) === t && parseInt(bitsOf(t), 2) === t, `${t} = ${c.join(' + ')} = ${bitsOf(t)} (reachable)`);
      });
      T.eq(FIXED, [[5], [12], [22]], 'Challenges 1-3 ask for 5, 12 and 22');
      HARDEST.forEach((set, i) => T.ok(set.length === 3 && new Set(set).size === 3 && set.every((t) => cardsFor(t).length >= 3), `hardest set ${i + 1} (${set.join(', ')}): three different numbers, each needs 3+ cards`));

      // 2. Through the screen, the way a visitor does it
      const tapV = (v) => K.tap(K.$(`#cards .bcard[data-v="${v}"]`));
      const winShown = () => K.$('#ov-win') && K.$('#ov-win').classList.contains('show');
      const waitWin = async () => { for (let i = 0; i < 300 && !winShown(); i++) await K.sleep(10); };
      K.tap(el.startBtn);
      T.ok(el.play.classList.contains('show'), 'Start opens Challenge 1');
      T.ok(/Try a clue/.test(el.clueBtn.textContent) && /Necesitas una pista/.test(el.clueBtn.textContent), '"Try a clue / ¿Necesitas una pista?" is there');
      for (let c = 0; c < 3; c++) K.tap(el.clueBtn);
      T.ok(/5 = 4 \+ 1/.test(el.clueBox.textContent), 'clue 3 of Challenge 1 spells out 5 = 4 + 1');
      // Challenge 1 and 2: the total is shown and the level clears on its own
      for (const [lv, t] of [[0, 5], [1, 12]]) {
        T.ok(!el.total.classList.contains('hidden') && el.check.hidden, `challenge ${lv + 1}: total shown, no Check needed`);
        tapV(16);
        T.eq(+K.$('.num', el.total).textContent, 16, `challenge ${lv + 1}: the running total updates (16)`);
        tapV(16);
        cardsFor(t).forEach(tapV);
        T.eq(K.$$('#bits b').map((b) => b.textContent).join(''), bitsOf(t), `challenge ${lv + 1}: the 1s and 0s read ${bitsOf(t)}`);
        await waitWin();
        T.ok(winShown() && K.$('#ov-win').textContent.includes(`Challenge ${lv + 1} solved!`) && K.$('#ov-win').textContent.includes(`¡Reto ${lv + 1} resuelto!`), `challenge ${lv + 1}: making ${t} clears it`);
        K.tap(K.$('#btn-nextlevel'));
      }
      // Challenge 3: total hidden, a wrong answer first
      T.ok(el.total.classList.contains('hidden') && K.$('.num', el.total).textContent === '?' && !el.check.hidden, 'challenge 3: total hidden, Check shown');
      tapV(16); tapV(4);
      K.tap(el.check);
      T.ok(/Not quite\. Try again\./.test(el.fb.textContent) && /Casi\. Inténtalo otra vez\./.test(el.fb.textContent) && !winShown(), 'challenge 3: 20 is "Not quite. Try again." and the level goes on');
      tapV(2);
      K.tap(el.check);
      await waitWin();
      T.ok(winShown(), 'challenge 3: 22 = 16 + 4 + 2 clears it on the second try');
      K.tap(K.$('#btn-nextlevel'));
      // The hardest: three in a row
      const set = HARDEST[S.set];
      T.ok(K.$$('.chain .c', el.goal).map((x) => +x.textContent.replace(/\D/g, '')).join() === set.join(), `hardest: the chain shows ${set.join(', ')}`);
      for (let i = 0; i < set.length; i++) {
        if (i === 1) {   // one miss along the way: still the same number
          tapV(1); K.tap(el.check);
          T.ok(/Not quite/.test(el.fb.textContent) && S.step === 1, 'hardest: a miss keeps the same number');
          tapV(1);
        }
        cardsFor(set[i]).forEach(tapV);
        K.tap(el.check);
        if (i < set.length - 1) { for (let w = 0; w < 200 && S.step === i; w++) await K.sleep(10); T.eq(S.step, i + 1, `hardest: ${set[i]} done, on to the next`); }
      }
      await waitWin();
      const ov = K.$('#ov-win');
      T.ok(winShown() && ov.textContent.includes('You did the hardest challenge!') && ov.textContent.includes('¡Superaste el reto más difícil!') &&
        ov.textContent.includes('Show a helper.') && ov.textContent.includes('Muéstraselo a un ayudante.'), 'hardest: the hardest-challenge words, both languages');
      K.tap(K.$('#btn-bonus'));
      T.ok(el.bonus.classList.contains('show') && /16 \+ 8 \+ 4 \+ 2 \+ 1 = 31/.test(K.$('#b-sum').textContent), 'bonus: five cards make at most 31');
      K.tap(K.$('#btn-six'));
      T.ok(/100000 = 32/.test(K.$('#b-sum').textContent) && !K.$('#b-cards .slot6').classList.contains('hide'), 'bonus: the sixth card makes 32 = 100000');
      T.ok(!/boss|nivel jefe|prize|premio/i.test(document.body.textContent), 'no game-talk level names and no prize named anywhere on the page');

      // 3. New player and the idle reset, in JS only
      const before = S.set;
      K.tap(K.$('#btn-again2'));
      T.ok(el.start.classList.contains('show') && !el.bonus.classList.contains('show'), 'New player (on the bonus) starts over');
      T.eq(S.set, (before + 1) % HARDEST.length, 'the next player gets the next set of hardest numbers');
      K.tap(el.startBtn);
      K.tap(el.newBtn);
      T.ok(el.play.classList.contains('show'), 'one tap on New player only asks');
      K.tap(el.newBtn);
      T.ok(el.start.classList.contains('show'), 'a second tap starts over');
      K.tap(el.startBtn);
      kiosk.forceIdle(46000);
      T.ok(kiosk.idleOverlay.classList.contains('show'), 'idle 45 s: "Still playing?" shows');
      kiosk.forceIdle(61000);
      T.ok(el.start.classList.contains('show'), 'idle 60 s: back to the start screen');
      T.eq(K.fetchedSinceLoad(), 0, 'nothing was fetched after the first load');
      T.finish();
    } catch (e) {
      T.finish(e);
    }
  }

  boot();
})();
