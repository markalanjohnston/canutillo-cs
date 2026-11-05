/* cipher.js: "Crack the Code" for CTE Night at CHS (a self-serve extra; the Karel game is the main station).
   A Caesar cipher: every letter of the message moved the same number of steps. The decoder strip shows each coded
   letter (top) over its real letter (bottom); the arrows change the shift. Tap a key to write its bottom letter.
   Challenge 1: shift 1 (told) · Challenge 2: shift 3 (told) · Challenge 3: secret shift · The hardest challenge:
   a sentence, secret shift. Every coded message is computed here from the plain message and the shift.
   No message uses the word "hard" on its own. Clues on every level; a wrong answer only says "Not quite". */
(function () {
  'use strict';
  const K = window.Kiosk;

  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const enc = (s, k) => s.replace(/[A-Z]/g, (c) => A[K.mod(A.indexOf(c) + k, 26)]);
  const dec = (s, k) => enc(s, -k);

  const FIXED = [
    { plain: 'START HERE', shift: 1, told: true, es: 'Empieza aquí.' },
    { plain: 'YOU BELONG HERE', shift: 3, told: true, es: 'Este es tu lugar.' },
    { plain: 'WHY NOT YOU', shift: 5, told: false, es: '¿Por qué no tú?' },
  ];
  const HARDEST = [   // one per visitor, in turn
    { plain: 'THINK LIKE A COMPUTER', shift: 11, told: false, es: 'Piensa como una computadora.' },
    { plain: 'NO EXPERIENCE NEEDED', shift: 9, told: false, es: 'No se necesita experiencia.' },
    { plain: 'GRIT REQUIRED', shift: 15, told: false, es: 'Hay que echarle ganas.' },
  ];

  const stage = K.$('#stage');
  const el = {
    start: K.$('#start'), play: K.$('#play'), pills: K.$('#pills'), howto: K.$('#howto'), msg: K.$('#msg'),
    strip: K.$('#strip'), shiftval: K.$('#shiftval'), left: K.$('#btn-left'), right: K.$('#btn-right'),
    del: K.$('#btn-del'), clear: K.$('#btn-clear'), fb: K.$('#fb'), clueBtn: K.$('#btn-clue'), clueBox: K.$('#cluebox'),
    newBtn: K.$('#btn-new'), startBtn: K.$('#btn-start'), lp: K.$('#lp'),
  };
  el.startBtn.innerHTML = K.bi('Start', 'Empezar') + K.icon.play;
  el.del.innerHTML = K.icon.erase + K.bi('Delete', 'Borrar');
  el.clear.innerHTML = K.icon.redo + K.bi('Clear all', 'Borrar todo');
  el.lp.innerHTML = K.LEVELS.map((x) => `<span class="lp${x.hardest ? ' hardest' : ''}"><span class="en">${x.en}</span><span class="es" lang="es">${x.es}</span></span>`).join('');
  el.strip.innerHTML = A.split('').map((c) =>
    `<button class="key" type="button" data-c="${c}" aria-label="Coded ${c}"><span class="kc">${c}</span><span class="ka">&darr;</span><span class="kr"></span></button>`).join('');
  const keys = K.$$('.key', el.strip);

  const S = {
    screen: 'start', level: 0, done: [false, false, false, false], set: K.mod(K.num('set', 1) - 1, HARDEST.length),
    shift: 0, letters: [], answer: [], cursor: 0, locked: false, wrong: new Set(), token: 0,
  };
  const puzzle = () => (S.level < 3 ? FIXED[S.level] : HARDEST[S.set]);

  const clues = K.Clues(el.clueBtn, el.clueBox);
  function cluesFor(p) {
    const code = enc(p.plain, p.shift);
    const first = p.plain.split(' ')[0];
    if (p.told) {
      return [
        { en: `First set the shift to ${p.shift} with the right arrow. Then find each coded letter on the top row: the real letter is under it.`,
          es: `Primero pon el desplazamiento en ${p.shift} con la flecha derecha. Luego busca cada letra cifrada arriba: la real está abajo.` },
        { en: `The first word is ${first}.`, es: `La primera palabra es ${first}.` },
        { en: `The whole message: ${p.plain}.`, es: `El mensaje completo: ${p.plain}.` },
      ];
    }
    return [
      { en: 'Tap the arrows to try a shift. Look at the first coded word on the strip. Does it turn into a real word?',
        es: 'Toca las flechas para probar un desplazamiento. Busca la primera palabra en la tira. ¿Se vuelve una palabra real?' },
      { en: `The coded letter ${code[0]} is really ${p.plain[0]}.`, es: `La letra cifrada ${code[0]} en realidad es ${p.plain[0]}.` },
      { en: `The shift is ${p.shift}.`, es: `El desplazamiento es ${p.shift}.` },
      { en: `The first word is ${first}.`, es: `La primera palabra es ${first}.` },
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
    S.set = (S.set + 1) % HARDEST.length;
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
    const p = puzzle();
    S.shift = 0;
    S.locked = false;
    S.wrong = new Set();
    const code = enc(p.plain, p.shift);
    S.letters = [];
    p.plain.split('').forEach((ch, i) => { if (ch !== ' ') S.letters.push({ plain: ch, code: code[i], pos: i }); });
    S.answer = S.letters.map(() => '');
    S.cursor = 0;
    K.pills(el.pills, level, S.done);
    // the message, word by word
    let html = '';
    let n = 0;
    p.plain.split(' ').forEach((w) => {
      html += '<div class="word">';
      for (let j = 0; j < w.length; j++, n++) {
        html += `<div class="lc"><span class="ct" data-i="${n}">${S.letters[n].code}</span><button class="slot" type="button" data-i="${n}" aria-label="Letter ${n + 1}"></button></div>`;
      }
      html += '</div>';
    });
    el.msg.innerHTML = html;
    el.msg.classList.toggle('long', S.letters.length > 16);   // long sentences: one line in landscape, two in portrait
    const how = [
      ['Every letter moved 1 step forward. Set the shift to 1, then tap each coded letter on the strip.', 'Cada letra avanzó 1 lugar. Pon el desplazamiento en 1 y toca cada letra cifrada en la tira.'],
      ['Every letter moved 3 steps forward. Set the shift to 3 and decode.', 'Cada letra avanzó 3 lugares. Pon el desplazamiento en 3 y descifra.'],
      ['The shift is a secret now. Find it, then decode.', 'Ahora el desplazamiento es secreto. Encuéntralo y descifra.'],
      ['A whole sentence with a secret shift. Crack it!', 'Una frase completa con desplazamiento secreto. ¡Descífrala!'],
    ][level];
    el.howto.innerHTML = K.bi(how[0], how[1], 'q');
    clues.set(cluesFor(p));
    K.say(el.fb, '');
    render();
  }

  function render(slid) {
    keys.forEach((k) => { k.querySelector('.kr').textContent = dec(k.dataset.c, S.shift); });
    if (slid) { el.strip.classList.remove('slide'); void el.strip.offsetWidth; el.strip.classList.add('slide'); }
    el.shiftval.innerHTML = `<span class="en">Shift</span><span class="es" lang="es">Desplazamiento</span><b id="shift-n">${S.shift}</b>`;
    K.$$('.slot', el.msg).forEach((b, i) => {
      b.textContent = S.answer[i];
      b.classList.toggle('active', i === S.cursor && !S.locked);
      b.classList.toggle('bad', S.wrong.has(i));
    });
    K.$$('.ct', el.msg).forEach((c, i) => c.classList.toggle('now', i === S.cursor && !S.locked));
    const cur = S.letters[S.cursor];
    keys.forEach((k) => k.classList.toggle('hint', S.level === 0 && !S.locked && !!cur && k.dataset.c === cur.code));
  }

  /* ---------- input ---------- */
  function write(letter) {
    if (S.screen !== 'play' || S.locked) return;
    S.answer[S.cursor] = letter;
    S.wrong.delete(S.cursor);
    K.say(el.fb, '');
    // after a wrong check, go to the next red letter; otherwise to the next empty box; else the next box
    let nxt = -1;
    const look = (want) => {
      for (let i = 1; i <= S.answer.length; i++) {
        const j = (S.cursor + i) % S.answer.length;
        if (want(j)) return j;
      }
      return -1;
    };
    if (S.wrong.size) nxt = look((j) => S.wrong.has(j));
    if (nxt === -1) nxt = look((j) => !S.answer[j]);
    S.cursor = nxt === -1 ? Math.min(S.cursor + 1, S.answer.length - 1) : nxt;
    render();
    if (S.answer.every((x) => x) && !S.wrong.size) check();   // while fixing red letters, check after the last one
  }
  function erase() {
    if (S.screen !== 'play' || S.locked) return;
    if (!S.answer[S.cursor] && S.cursor > 0) S.cursor--;
    S.answer[S.cursor] = '';
    S.wrong.delete(S.cursor);
    render();
  }
  function setShift(k) {
    if (S.screen !== 'play' || S.locked) return;
    S.shift = K.mod(k, 26);
    render(true);
  }
  keys.forEach((k) => k.addEventListener('click', () => write(dec(k.dataset.c, S.shift))));
  el.msg.addEventListener('click', (e) => {
    const b = e.target.closest('.slot');
    if (!b || S.locked) return;
    S.cursor = +b.dataset.i;
    render();
  });
  el.left.addEventListener('click', () => setShift(S.shift - 1));
  el.right.addEventListener('click', () => setShift(S.shift + 1));
  el.del.addEventListener('click', erase);
  el.clear.addEventListener('click', () => {
    if (S.locked) return;
    S.answer = S.answer.map(() => '');
    S.wrong = new Set();
    S.cursor = 0;
    K.say(el.fb, '');
    render();
  });
  document.addEventListener('keydown', (e) => {          // the iPad's keyboard and the Macs work too
    if (S.screen !== 'play' || document.querySelector('.overlay.show') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); write(e.key.toUpperCase()); }
    else if (e.key === 'Backspace') { e.preventDefault(); erase(); }
    else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement && document.activeElement.classList.contains('key')) e.preventDefault();
    else if (e.key === 'ArrowRight') { e.preventDefault(); setShift(S.shift + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setShift(S.shift - 1); }
  });

  function check() {
    S.wrong = new Set();
    S.letters.forEach((l, i) => { if (S.answer[i] !== l.plain) S.wrong.add(i); });
    if (!S.wrong.size) { solved(); return; }
    S.cursor = Math.min(...S.wrong);
    K.say(el.fb, 'bad', K.NOT_QUITE[0], K.NOT_QUITE[1],
      ` <span class="marks"><span class="m no">${K.bi('Fix the red letters.', 'Corrige las letras rojas.', 'row')}</span></span>`);
    render();
    el.msg.classList.remove('shake');
    void el.msg.offsetWidth;
    el.msg.classList.add('shake');
  }

  async function solved() {
    S.locked = true;
    render();
    K.$$('.slot', el.msg).forEach((b) => b.classList.add('good'));
    const my = S.token;
    await K.wait(800);
    if (my !== S.token) return;
    S.done[S.level] = true;
    K.pills(el.pills, S.level, S.done);
    celebrate();
  }

  function celebrate() {
    const p = puzzle();
    const code = enc(p.plain, p.shift);
    const detail = `<div style="font:800 26px/1.2 var(--mono);color:#ff9e30;letter-spacing:2px">${code}</div>` +
      `<div style="font:900 40px/1.2 var(--mono);letter-spacing:2px;margin:4px 0 6px">${p.plain}</div>` +
      `<div style="font-size:24px;font-weight:700;color:var(--es)" lang="es">${p.es}</div>` +
      `<div style="margin-top:8px;font-size:19px;color:var(--muted)">${K.bi(`Shift ${p.shift}`, `Desplazamiento ${p.shift}`, 'row')}</div>`;
    if (S.level === 3) {
      K.celebrate({
        hardest: true,
        title: ['You did the hardest challenge!', '¡Superaste el reto más difícil!'],
        detail,
        actions: [{ id: 'btn-again', cls: 'btn-ghost', html: K.icon.redo + K.bi('Start over', 'Empezar de nuevo'), onClick: () => kiosk.reset('button') }],
      });
      return;
    }
    const n = S.level + 1;
    const next = K.LEVELS[S.level + 1];
    K.celebrate({
      title: [`Challenge ${n} solved!`, `¡Reto ${n} resuelto!`],
      sub: ["You got it. That was the first step. This class is hard, that's the point, and you just showed you can do it.", '¡Lo lograste! Ese fue el primer paso. Esta clase es difícil, esa es la idea, y acabas de demostrar que puedes.'],
      detail,
      actions: [{
        id: 'btn-nextlevel', cls: 'btn-big', html: K.bi(`Next: ${next.en}`, `Siguiente: ${next.es}`) + K.icon.next,
        onClick: () => { K.hideOverlays(stage); loadLevel(S.level + 1); },
      }],
    });
  }

  /* ---------- the start screen: a coded title cracks itself ---------- */
  const aBox = K.$('#attract');
  const aCap = K.$('#attract-cap');
  async function attract() {
    const my = S.token;
    const plain = 'CRACK THE CODE';
    for (let round = 0; ; round++) {
      const k = [3, 7, 1, 11, 5][round % 5];
      const code = enc(plain, k);
      aBox.innerHTML = code.split('').map((c) => (c === ' ' ? '<span class="sp"></span>' : `<span>${c}</span>`)).join('');
      aCap.innerHTML = K.bi(`Shift ${k}`, `Desplazamiento ${k}`, 'row');
      const spans = K.$$('span', aBox);
      await K.sleep(1400);
      for (let i = 0; i < plain.length; i++) {
        if (my !== S.token || S.screen !== 'start') return;
        if (plain[i] === ' ') continue;
        spans[i].textContent = plain[i];
        spans[i].classList.add('ok');
        await K.sleep(170);
      }
      await K.sleep(2200);
      if (my !== S.token || S.screen !== 'start') return;
    }
  }

  el.startBtn.addEventListener('click', () => startPlay(0));

  /* ---------- ?level / ?demo for screenshots, ?selftest for the checks ---------- */
  function fill(upTo, useShift) {
    const p = puzzle();
    S.shift = useShift == null ? p.shift : useShift;
    S.letters.forEach((l, i) => { if (i < upTo) S.answer[i] = dec(l.code, S.shift); });
    S.cursor = Math.min(upTo, S.letters.length - 1);
    render();
  }
  function boot() {
    if (K.selftest) { selftest(); return; }
    const lv = K.num('level', K.demo ? 4 : 0);   // ?demo=solved alone shows the hardest challenge solved
    const d = K.demo;
    if (lv >= 1 && lv <= 4) {
      startPlay(lv - 1);
      for (let i = 0; i < lv - 1; i++) S.done[i] = true;
      K.pills(el.pills, lv - 1, S.done);
      if (d === 'partial') fill(Math.ceil(S.letters.length / 2));
      else if (d === 'solved') { fill(S.letters.length); check(); }
      else if (d === 'wrong') { fill(S.letters.length - 1, K.mod(puzzle().shift - 1, 26)); write(dec(S.letters[S.letters.length - 1].code, S.shift)); }
      else if (d === 'clue') { fill(2); clues.showUpTo(K.num('clue', 2)); }
    } else showStart();
  }

  async function selftest() {
    const T = K.Test('cipher');
    try {
      // 1. Every message: computed from plain + shift, decodes back, and stays on-message
      const all = FIXED.concat(HARDEST);
      all.forEach((p) => {
        const c = enc(p.plain, p.shift);
        T.ok(/^[A-Z ]+$/.test(p.plain) && p.shift >= 1 && p.shift <= 25, `${p.plain}: capital letters, shift ${p.shift} in 1-25`);
        T.eq(dec(c, p.shift), p.plain, `${p.plain} -> ${c} -> back again (round trip)`);
        T.ok(c !== p.plain && c.split(' ').every((w, i) => w.length === p.plain.split(' ')[i].length), `${p.plain}: the coded text is different and keeps the word lengths`);
        const fits = [];
        for (let k = 1; k < 26; k++) if (dec(c, k) === p.plain) fits.push(k);
        T.eq(fits, [p.shift], `${p.plain}: exactly one shift cracks it`);
        T.ok(!/\bHARD\b/.test(p.plain), `${p.plain}: no "hard" on its own`);
      });
      T.eq([FIXED[0].shift, FIXED[1].shift, FIXED[0].told, FIXED[1].told, FIXED[2].told], [1, 3, true, true, false], 'Challenge 1 tells shift 1, Challenge 2 tells shift 3, Challenge 3 keeps it secret');
      T.ok(HARDEST.every((p) => !p.told && p.plain.includes(' ')), 'the hardest challenge: a sentence with a secret shift');

      // 2. Through the screen, the way a visitor does it
      const winShown = () => K.$('#ov-win') && K.$('#ov-win').classList.contains('show');
      const waitWin = async () => { for (let i = 0; i < 300 && !winShown(); i++) await K.sleep(10); };
      const shiftTo = (k) => { while (S.shift !== k) K.tap(K.mod(k - S.shift, 26) <= 13 ? el.right : el.left); };
      const tapKeys = () => S.letters.forEach((l) => K.tap(K.$(`.key[data-c="${l.code}"]`)));
      K.tap(el.startBtn);
      T.ok(el.play.classList.contains('show'), 'Start opens Challenge 1');
      T.ok(/Try a clue/.test(el.clueBtn.textContent) && /Necesitas una pista/.test(el.clueBtn.textContent), '"Try a clue / ¿Necesitas una pista?" is there');
      T.eq(K.$$('.ct', el.msg).map((x) => x.textContent).join(''), enc(FIXED[0].plain, 1).replace(/ /g, ''), 'Challenge 1 shows the computed coded text TUBSU IFSF');
      T.ok(K.$(`.key[data-c="${S.letters[0].code}"]`).classList.contains('hint'), 'Challenge 1 lights the key for the current letter');
      // Challenge 1 by the physical keyboard
      FIXED[0].plain.replace(/ /g, '').split('').forEach((ch) => document.dispatchEvent(new KeyboardEvent('keydown', { key: ch.toLowerCase(), bubbles: true })));
      await waitWin();
      T.ok(winShown() && K.$('#ov-win').textContent.includes('Challenge 1 solved!') && K.$('#ov-win').textContent.includes('Empieza aquí.'), 'challenge 1: typing START HERE on a keyboard clears it, with the Spanish');
      K.tap(K.$('#btn-nextlevel'));
      // Challenge 2 by the strip
      shiftTo(3);
      T.eq(+K.$('#shift-n').textContent, 3, 'challenge 2: the arrows set the shift to 3');
      T.eq(K.$('.key[data-c="D"] .kr').textContent, 'A', 'challenge 2: at shift 3 the strip turns D into A');
      tapKeys();
      await waitWin();
      T.ok(winShown() && K.$('#ov-win').textContent.includes('YOU BELONG HERE'), 'challenge 2: tapping each coded letter on the strip clears it');
      K.tap(K.$('#btn-nextlevel'));
      // Challenge 3: a wrong try at shift 0 first
      tapKeys();
      T.ok(/Not quite\. Try again\./.test(el.fb.textContent) && /Casi\. Inténtalo otra vez\./.test(el.fb.textContent) && !winShown(), 'challenge 3: the wrong shift gives "Not quite. Try again." and the level goes on');
      T.eq(K.$$('.slot.bad', el.msg).length, S.letters.length, 'challenge 3: the wrong letters turn red');
      for (let c = 0; c < 3; c++) K.tap(el.clueBtn);
      T.ok(/The shift is 5\./.test(el.clueBox.textContent) && /El desplazamiento es 5\./.test(el.clueBox.textContent), 'challenge 3: clue 3 tells the shift, both languages');
      shiftTo(5);
      K.tap(K.$(`.key[data-c="${S.letters[0].code}"]`));
      T.eq(S.cursor, 1, 'challenge 3: after fixing a red letter, the cursor goes to the next red one');
      T.ok(K.$$('.slot.bad', el.msg).length === S.letters.length - 1 && /Not quite/.test(el.fb.textContent) === false, 'challenge 3: fixing one red letter clears its red and does not re-check yet');
      K.tap(el.clear);
      tapKeys();
      await waitWin();
      T.ok(winShown() && K.$('#ov-win').textContent.includes('WHY NOT YOU'), 'challenge 3: cleared on the second try (after clues)');
      K.tap(K.$('#btn-nextlevel'));
      // The hardest, every sentence in the rotation
      for (let set = 0; set < HARDEST.length; set++) {
        if (set > 0) { K.hideOverlays(stage); S.set = set; loadLevel(3); }
        const p = HARDEST[S.set];
        T.eq(K.$$('.ct', el.msg).map((x) => x.textContent).join(''), enc(p.plain, p.shift).replace(/ /g, ''), `hardest ${set + 1}: shows the computed coded text ${enc(p.plain, p.shift)}`);
        shiftTo(p.shift);
        tapKeys();
        await waitWin();
        const ov = K.$('#ov-win');
        T.ok(winShown() && ov.textContent.includes('You did the hardest challenge!') && ov.textContent.includes('¡Superaste el reto más difícil!') &&
          ov.textContent.includes('Show a helper.') && ov.textContent.includes('Muéstraselo a un ayudante.') && ov.textContent.includes(p.plain), `hardest ${set + 1}: ${p.plain} cracked; the hardest-challenge words, both languages`);
      }
      T.ok(!/boss|nivel jefe|prize|premio/i.test(document.body.textContent), 'no game-talk level names and no prize named anywhere on the page');

      // 3. Delete, New player and the idle reset (JS only)
      K.hideOverlays(stage);
      loadLevel(1);
      K.tap(keys[0]); K.tap(keys[1]);
      K.tap(el.del);
      T.eq(S.answer.filter((x) => x).length, 1, 'Delete removes the last letter');
      const before = S.set;
      K.tap(el.newBtn);
      T.ok(el.play.classList.contains('show'), 'one tap on New player only asks');
      K.tap(el.newBtn);
      T.ok(el.start.classList.contains('show'), 'a second tap starts over');
      T.eq(S.set, (before + 1) % HARDEST.length, 'the next player gets the next hardest sentence');
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
