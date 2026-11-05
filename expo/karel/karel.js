/* karel.js: "What will Karel do?", the main device station for CTE Night at CHS.

   Karel exactly as the class writes it on CodeHS:
   - every program lives in function start() { ... }; CodeHS runs start() for you;
   - built in: move(), turnLeft(), putBall(), takeBall(); no turnRight() unless the code defines it;
   - loops are for (let i = 0; i < 3; i++) { ... };
   - crashes: move() into a wall or edge, and takeBall() on an empty corner; putBall() never crashes;
   - streets are rows and avenues are columns, both from 1 at the bottom-left; Karel starts at street 1,
     avenue 1, facing East unless the puzzle shows otherwise.

   Every answer the game accepts is computed by the interpreter below from the exact program text on the
   screen; nothing is typed in by hand. With ?selftest=1 the page also runs that same text as real
   JavaScript and checks that both agree. */
(function () {
  'use strict';
  const K = window.Kiosk;

  /* ======================================================================================
     The language: a small CodeHS JavaScript Karel (tokenizer, parser, step-by-step runner)
     ====================================================================================== */
  const KL = (function () {
    const DIRS = ['E', 'N', 'W', 'S'];                 // index + 1 = one turnLeft()
    const VEC = [[0, 1], [1, 0], [0, -1], [-1, 0]];    // [street change, avenue change]
    const KEYWORDS = new Set(['function', 'for', 'let', 'var', 'const', 'if', 'else', 'while', 'return']);
    const BUILTIN = ['move', 'turnLeft', 'putBall', 'takeBall'];
    const CONDS = ['frontIsClear', 'frontIsBlocked', 'leftIsClear', 'leftIsBlocked', 'rightIsClear', 'rightIsBlocked',
      'ballsPresent', 'noBallsPresent', 'facingNorth', 'facingSouth', 'facingEast', 'facingWest',
      'notFacingNorth', 'notFacingSouth', 'notFacingEast', 'notFacingWest'];

    function KarelError(msg, line) { const e = new Error(msg); e.karel = true; e.line = line; return e; }

    function tokenize(src) {
      const out = [];
      let i = 0;
      let line = 1;
      const n = src.length;
      while (i < n) {
        const c = src[i];
        if (c === '\n') { line++; i++; continue; }
        if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') {
          i += 2;
          while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
          if (i >= n) throw KarelError('A comment never ends', line);
          i += 2;
          continue;
        }
        if (/[A-Za-z_$]/.test(c)) {
          let j = i + 1;
          while (j < n && /[\w$]/.test(src[j])) j++;
          out.push({ t: 'id', v: src.slice(i, j), line });
          i = j;
          continue;
        }
        if (/[0-9]/.test(c)) {
          let j = i + 1;
          while (j < n && /[0-9]/.test(src[j])) j++;
          out.push({ t: 'num', v: Number(src.slice(i, j)), line });
          i = j;
          continue;
        }
        const two = src.substr(i, 2);
        if (two === '++' || two === '<=') { out.push({ t: 'op', v: two, line }); i += 2; continue; }
        if ('{}();<=!'.includes(c)) { out.push({ t: 'op', v: c, line }); i++; continue; }
        throw KarelError(`Karel does not know "${c}"`, line);
      }
      out.push({ t: 'eof', v: '', line });
      return out;
    }

    function parse(src) {
      const T = tokenize(src);
      let p = 0;
      const peek = () => T[p];
      const next = () => T[p++];
      const want = (v) => {
        const t = next();
        if (t.v !== v) throw KarelError(`Expected "${v}" but found "${t.v || 'the end'}"`, t.line);
        return t;
      };
      const funcs = {};
      const top = [];

      function block() {
        want('{');
        const list = [];
        while (peek().v !== '}') {
          if (peek().t === 'eof') throw KarelError('Missing a closing }', peek().line);
          list.push(statement());
        }
        list.end = next().line;
        return list;
      }
      function cond() {
        let neg = false;
        while (peek().v === '!') { next(); neg = !neg; }
        const id = next();
        if (id.t !== 'id') throw KarelError('Expected a question like frontIsClear()', id.line);
        want('(');
        want(')');
        return { name: id.v, neg, line: id.line };
      }
      function statement() {
        const t = peek();
        if (t.v === 'for') {
          next();
          want('(');
          const decl = next();
          if (decl.v !== 'let' && decl.v !== 'var') throw KarelError('Write a loop as for (let i = 0; i < 3; i++)', decl.line);
          const v = next();
          want('=');
          const from = next();
          if (from.t !== 'num') throw KarelError('The loop needs a starting number', from.line);
          want(';');
          const v2 = next();
          if (v2.v !== v.v) throw KarelError(`Expected ${v.v}`, v2.line);
          const cmp = next();
          if (cmp.v !== '<' && cmp.v !== '<=') throw KarelError('Expected < or <=', cmp.line);
          const to = next();
          if (to.t !== 'num') throw KarelError('The loop needs an ending number', to.line);
          want(';');
          const v3 = next();
          if (v3.v !== v.v) throw KarelError(`Expected ${v.v}++`, v3.line);
          want('++');
          want(')');
          const body = block();
          const count = Math.max(0, (cmp.v === '<' ? to.v : to.v + 1) - from.v);
          return { k: 'for', line: t.line, varName: v.v, decl: decl.v, from: from.v, cmp: cmp.v, to: to.v, count, body };
        }
        if (t.v === 'if') {
          next();
          want('(');
          const c = cond();
          want(')');
          const then = block();
          let els = null;
          if (peek().v === 'else') { next(); els = peek().v === 'if' ? [statement()] : block(); }
          return { k: 'if', line: t.line, cond: c, then, els };
        }
        if (t.v === 'while') {
          next();
          want('(');
          const c = cond();
          want(')');
          return { k: 'while', line: t.line, cond: c, body: block() };
        }
        if (t.t === 'id' && !KEYWORDS.has(t.v)) {
          next();
          want('(');
          want(')');
          want(';');
          return { k: 'call', line: t.line, name: t.v };
        }
        throw KarelError(`Karel does not understand "${t.v}" here`, t.line);
      }

      while (peek().t !== 'eof') {
        if (peek().v === 'function') {
          const kw = next();
          const name = next();
          if (name.t !== 'id' || KEYWORDS.has(name.v)) throw KarelError('A function needs a name', name.line);
          want('(');
          want(')');
          const body = block();
          if (funcs[name.v]) throw KarelError(`function ${name.v}() is written twice`, kw.line);
          funcs[name.v] = { name: name.v, line: kw.line, end: body.end, body };
        } else top.push(statement());
      }
      return { funcs, top };
    }

    function makeConds(st, blocked, here) {
      return {
        frontIsClear: () => !blocked(st.d), frontIsBlocked: () => blocked(st.d),
        leftIsClear: () => !blocked((st.d + 1) % 4), leftIsBlocked: () => blocked((st.d + 1) % 4),
        rightIsClear: () => !blocked((st.d + 3) % 4), rightIsBlocked: () => blocked((st.d + 3) % 4),
        ballsPresent: () => !!st.balls[here()], noBallsPresent: () => !st.balls[here()],
        facingNorth: () => st.d === 1, facingSouth: () => st.d === 3, facingEast: () => st.d === 0, facingWest: () => st.d === 2,
        notFacingNorth: () => st.d !== 1, notFacingSouth: () => st.d !== 3, notFacingEast: () => st.d !== 0, notFacingWest: () => st.d !== 2,
      };
    }

    function startState(world) {
      return {
        s: world.karel.street,
        a: world.karel.avenue,
        d: DIRS.indexOf(world.karel.dir || 'E'),
        balls: Object.assign({}, world.balls || {}),
      };
    }

    /* Runs the program and records every step (for the animation and the line highlight). */
    function run(src, world, opts = {}) {
      const prog = typeof src === 'string' ? parse(src) : src;
      const H = world.streets;
      const W = world.avenues;
      const st = startState(world);
      const trace = [];
      const counts = { move: 0, turnLeft: 0, putBall: 0, takeBall: 0, turnRight: 0, turnAround: 0 };
      const LIMIT = opts.limit || 20000;
      const STOP = { stop: true };
      let crash = null;
      let error = null;
      const here = () => st.s + ',' + st.a;
      const snap = () => ({ s: st.s, a: st.a, d: st.d, balls: Object.assign({}, st.balls) });
      const emit = (ev) => {
        ev.state = snap();
        trace.push(ev);
        if (trace.length > LIMIT) { error = { msg: 'Karel ran too long', line: ev.line }; throw STOP; }
      };
      const blocked = (d) => {
        const s = st.s + VEC[d][0];
        const a = st.a + VEC[d][1];
        return s < 1 || s > H || a < 1 || a > W;
      };
      const prims = {
        move(line) {
          if (blocked(st.d)) { crash = { line, cmd: 'move' }; emit({ line, kind: 'crash', cmd: 'move' }); throw STOP; }
          st.s += VEC[st.d][0];
          st.a += VEC[st.d][1];
          counts.move++;
          emit({ line, kind: 'prim', cmd: 'move' });
        },
        turnLeft(line) { st.d = (st.d + 1) % 4; counts.turnLeft++; emit({ line, kind: 'prim', cmd: 'turnLeft' }); },
        putBall(line) {
          st.balls[here()] = (st.balls[here()] || 0) + 1;
          counts.putBall++;
          emit({ line, kind: 'prim', cmd: 'putBall' });
        },
        takeBall(line) {
          if (!st.balls[here()]) { crash = { line, cmd: 'takeBall' }; emit({ line, kind: 'crash', cmd: 'takeBall' }); throw STOP; }
          const k = here();
          st.balls[k] -= 1;
          if (st.balls[k] === 0) delete st.balls[k];
          counts.takeBall++;
          emit({ line, kind: 'prim', cmd: 'takeBall' });
        },
      };
      if (opts.superKarel) {   // only for checking the class's worked examples; the puzzles use plain Karel
        prims.turnRight = (line) => { st.d = (st.d + 3) % 4; counts.turnRight++; emit({ line, kind: 'prim', cmd: 'turnRight' }); };
        prims.turnAround = (line) => { st.d = (st.d + 2) % 4; counts.turnAround++; emit({ line, kind: 'prim', cmd: 'turnAround' }); };
      }
      const conds = makeConds(st, blocked, here);
      function ask(c) {
        const f = conds[c.name];
        if (!f) throw KarelError(`${c.name} is not defined`, c.line);
        const v = f();
        return c.neg ? !v : v;
      }
      function call(name, line, depth) {
        if (Object.prototype.hasOwnProperty.call(prims, name)) { prims[name](line); return; }
        const f = prog.funcs[name];
        if (!f) throw KarelError(`${name} is not defined`, line);
        if (depth > 60) throw KarelError('Too many functions inside functions', line);
        emit({ line, kind: 'call', name, def: f.line });
        exec(f.body, depth + 1);
        emit({ line: f.end, kind: 'return', name, from: line });
      }
      function exec(list, depth) {
        for (const s of list) {
          if (s.k === 'call') call(s.name, s.line, depth);
          else if (s.k === 'for') {
            let i = s.from;
            let time = 0;
            while (s.cmp === '<' ? i < s.to : i <= s.to) {
              time++;
              emit({ line: s.line, kind: 'loop', i, time, count: s.count });
              exec(s.body, depth);
              i++;
            }
            emit({ line: s.line, kind: 'loopdone', i, count: s.count });
          } else if (s.k === 'if') {
            const v = ask(s.cond);
            emit({ line: s.line, kind: 'cond', value: v, cond: s.cond.name });
            if (v) exec(s.then, depth); else if (s.els) exec(s.els, depth);
          } else if (s.k === 'while') {
            for (;;) {
              const v = ask(s.cond);
              emit({ line: s.line, kind: 'cond', value: v, cond: s.cond.name });
              if (!v) break;
              exec(s.body, depth);
            }
          }
        }
      }
      try {
        exec(prog.top, 0);
        if (!prog.funcs.start) throw KarelError('There is no function start()', 1);
        call('start', prog.funcs.start.line, 0);
      } catch (e) {
        if (e === STOP) { /* crash or step limit: already recorded */ }
        else if (e && e.karel) error = { msg: e.message, line: e.line };
        else throw e;
      }
      return { prog, trace, final: snap(), crash, error, counts };
    }

    /* The same program, unchanged, run as real JavaScript (the self-test's second opinion). */
    function runAsJS(src, world, opts = {}) {
      const H = world.streets;
      const W = world.avenues;
      const st = startState(world);
      const CRASH = new Error('crash');
      let crashed = false;
      const here = () => st.s + ',' + st.a;
      const blocked = (d) => {
        const s = st.s + VEC[d][0];
        const a = st.a + VEC[d][1];
        return s < 1 || s > H || a < 1 || a > W;
      };
      const api = Object.assign({
        move() { if (blocked(st.d)) { crashed = true; throw CRASH; } st.s += VEC[st.d][0]; st.a += VEC[st.d][1]; },
        turnLeft() { st.d = (st.d + 1) % 4; },
        putBall() { st.balls[here()] = (st.balls[here()] || 0) + 1; },
        takeBall() {
          if (!st.balls[here()]) { crashed = true; throw CRASH; }
          const k = here();
          st.balls[k] -= 1;
          if (st.balls[k] === 0) delete st.balls[k];
        },
      }, makeConds(st, blocked, here));
      if (opts.superKarel) {
        api.turnRight = () => { st.d = (st.d + 3) % 4; };
        api.turnAround = () => { st.d = (st.d + 2) % 4; };
      }
      const names = Object.keys(api);
      let error = null;
      try {
        const fn = new Function(...names, '"use strict";\n' + src + '\n;start();');
        fn(...names.map((n) => api[n]));
      } catch (e) {
        if (e !== CRASH) error = String((e && e.message) || e);
      }
      return { s: st.s, a: st.a, d: st.d, balls: st.balls, crashed, error };
    }

    return { DIRS, VEC, BUILTIN, CONDS, KEYWORDS, tokenize, parse, run, runAsJS, startState };
  })();
  window.KarelLang = KL;

  /* ======================================================================================
     Words
     ====================================================================================== */
  const DIR_EN = ['East', 'North', 'West', 'South'];
  const DIR_ES = ['Este', 'Norte', 'Oeste', 'Sur'];
  const where = (s, a, d) => ({
    en: `Row ${s}, Column ${a}` + (d == null ? '' : `, facing ${DIR_EN[d]}`),
    es: `fila ${s}, columna ${a}` + (d == null ? '' : `, mirando al ${DIR_ES[d]}`),
  });
  const GLOSS = {     // English meaning (when the name alone doesn't say it) and the Spanish gloss
    start: ['starts here', 'aquí empieza'],
    move: ['', 'avanzar'],
    turnLeft: ['', 'girar a la izquierda'],
    putBall: ['', 'poner pelota'],
    takeBall: ['', 'recoger pelota'],
    turnRight: ['three turnLeft()', 'girar a la derecha'],
  };
  const COMPUTERS = ['Computers do exactly what you type, not what you had in mind.',
    'Las computadoras hacen exactamente lo que escribes, no lo que tenías en mente.'];

  /* ======================================================================================
     The puzzles. Answers are never written here: the interpreter computes them.
     ====================================================================================== */
  const L = (...a) => a.join('\n');
  const world = (n, balls = {}) => ({ streets: n, avenues: n, karel: { street: 1, avenue: 1, dir: 'E' }, balls });
  const TURN_RIGHT = ['', 'function turnRight() {', '    turnLeft();', '    turnLeft();', '    turnLeft();', '}'];

  const PUZZLES = [
    [{
      id: 'c1', world: world(5), ask: { dir: false, balls: false }, fresh: 'move',
      code: L('function start() {', '    move();', '    move();', '    move();', '}'),
    }],
    [{
      id: 'c2', world: world(5), ask: { dir: true, balls: false }, fresh: 'turnLeft',
      code: L('function start() {', '    move();', '    move();', '    turnLeft();', '    move();', '    turnLeft();', '    move();', '}'),
    }],
    [{
      id: 'c3', world: world(5), ask: { dir: true, balls: false }, fresh: 'turnRight',
      code: L('function start() {', '    move();', '    turnLeft();', '    move();', '    turnRight();', '    turnRight();', '    move();', '    move();', '}', ...TURN_RIGHT),
    }],
    [
      {
        id: 'frame', world: world(4), ask: { dir: true, balls: true }, fresh: 'for',
        code: L('function start() {', '    for (let i = 0; i < 4; i++) {', '        putBall();', '        move();', '        putBall();', '        move();', '        putBall();', '        move();', '        turnLeft();', '    }', '}'),
      },
      {
        id: 'cleanup', world: world(4, { '1,1': 1, '1,3': 1, '3,3': 1, '3,1': 1 }), ask: { dir: true, balls: true }, fresh: 'for',
        code: L('function start() {', '    for (let i = 0; i < 4; i++) {', '        move();', '        move();', '        takeBall();', '        turnLeft();', '    }', '}'),
      },
      {
        id: 'stairs', world: world(4), ask: { dir: true, balls: true }, fresh: 'for',
        code: L('function start() {', '    for (let i = 0; i < 3; i++) {', '        putBall();', '        move();', '        turnLeft();', '        move();', '        turnRight();', '    }', '}', ...TURN_RIGHT),
      },
    ],
  ];
  // the little demo on the start screen (it only runs; nothing is asked)
  const ATTRACT = { world: world(4), code: PUZZLES[3][0].code };

  function solve(puz) {
    const res = KL.run(puz.code, puz.world);
    return {
      res,
      crash: !!res.crash,
      s: res.final.s,
      a: res.final.a,
      d: res.final.d,
      balls: res.final.balls,
      ballKeys: Object.keys(res.final.balls).filter((k) => res.final.balls[k] > 0).sort(),
    };
  }

  /* What the program uses, read from the parsed program (so the glossary can't drift from the code). */
  function analyze(prog) {
    const used = [];
    const loops = [];
    const seen = new Set();
    const note = (n) => { if (!seen.has(n)) { seen.add(n); used.push(n); } };
    function walk(list, inLoop) {
      for (const s of list) {
        if (s.k === 'call') {
          note(s.name);
          if (inLoop) inLoop.calls[s.name] = (inLoop.calls[s.name] || 0) + 1;
          if (prog.funcs[s.name] && !walk.inside.has(s.name)) {
            walk.inside.add(s.name);
            walk(prog.funcs[s.name].body, null);
            walk.inside.delete(s.name);
          }
        } else if (s.k === 'for') {
          const info = { line: s.line, count: s.count, calls: {}, order: [] };
          loops.push(info);
          walk(s.body, info);
          s.body.forEach((b) => { if (b.k === 'call' && !info.order.includes(b.name)) info.order.push(b.name); });
        } else if (s.k === 'if') { walk(s.then, inLoop); if (s.els) walk(s.els, inLoop); }
        else if (s.k === 'while') walk(s.body, inLoop);
      }
    }
    walk.inside = new Set();
    walk(prog.funcs.start.body, null);
    const userFns = Object.keys(prog.funcs).filter((n) => n !== 'start');
    return { used, loops, userFns };
  }

  /* Clues: each one helps more than the one before. All of them are computed from the program. */
  function cluesFor(puz, sol) {
    const prog = sol.res.prog;
    const info = analyze(prog);
    const list = [];
    list.push({
      en: 'Use your finger: follow <code>start()</code> one line at a time.',
      es: 'Usa el dedo: sigue <code>start()</code> una línea a la vez.',
    });
    // 2: the one idea that matters most in this code
    if (info.loops.length) {
      const lp = info.loops[0];
      const each = lp.order.map((n) => `${lp.calls[n]} <code>${n}()</code>`).join(', ');
      list.push({
        en: `The loop does the lines in { } ${lp.count} times. Each time: ${each}.`,
        es: `El loop hace ${lp.count} veces lo que está en { }. Cada vez: ${each}.`,
      });
    } else if (info.userFns.includes('turnRight') && info.used.includes('turnRight')) {
      list.push({
        en: '<code>turnRight()</code> = three <code>turnLeft()</code> = a right turn: East &rarr; South &rarr; West &rarr; North.',
        es: '<code>turnRight()</code> = tres <code>turnLeft()</code> = vuelta a la derecha: Este &rarr; Sur &rarr; Oeste &rarr; Norte.',
      });
    } else if (info.used.includes('turnLeft')) {
      list.push({
        en: '<code>turnLeft()</code> is a quarter turn left: East &rarr; North &rarr; West &rarr; South.',
        es: '<code>turnLeft()</code> gira un cuarto a la izquierda: Este &rarr; Norte &rarr; Oeste &rarr; Sur.',
      });
    } else {
      list.push({
        en: 'Each <code>move()</code> goes one square the way Karel faces. Count them.',
        es: 'Cada <code>move()</code> avanza un cuadro hacia donde mira Karel. Cuéntalos.',
      });
    }
    // 3: where Karel is partway through (from a real run)
    list.push(partway(puz, sol, info));
    // 4: watch it run
    list.push({
      en: 'Still not sure? Watch Karel run, then answer.',
      es: '¿Todavía no? Mira a Karel correr y luego responde.',
      action: { html: K.icon.play + K.bi('Watch Karel run', 'Mira a Karel correr'), onClick: () => watchRun() },
    });
    return list;
  }

  function partway(puz, sol, info) {
    const tr = sol.res.trace;
    if (info.loops.length) {
      const ev = tr.find((e) => e.kind === 'loop' && e.time === 2);
      if (ev) {
        const n = Object.values(ev.state.balls).reduce((x, y) => x + y, 0);
        const w = where(ev.state.s, ev.state.a, ev.state.d);
        return {
          en: `After the loop runs once: ${w.en}. Balls on the board: ${n}.`,
          es: `Después de una vuelta: ${w.es}. Pelotas en el tablero: ${n}.`,
        };
      }
    }
    // no loop: run only the first half of start() and say where Karel is
    const prog = sol.res.prog;
    const body = prog.funcs.start.body;
    const k = Math.max(1, Math.ceil(body.length / 2));
    const half = { funcs: Object.assign({}, prog.funcs, { start: Object.assign({}, prog.funcs.start, { body: body.slice(0, k) }) }), top: prog.top };
    const r = KL.run(half, puz.world);
    const line = body[k - 1].line;
    const w = where(r.final.s, r.final.a, r.final.d);
    return {
      en: `After line ${line}, Karel is on ${w.en}.`,
      es: `Después de la línea ${line}, Karel está en la ${w.es}.`,
    };
  }

  /* ======================================================================================
     Drawing
     ====================================================================================== */
  const DOG = '<svg viewBox="-50 -50 100 100" aria-hidden="true">' +
    '<path d="M-30 6 C-40 12 -47 6 -46 -6" fill="none" stroke="#001080" stroke-width="7" stroke-linecap="round"/>' +
    '<g fill="#001080"><ellipse cx="-20" cy="-20" rx="8" ry="6"/><ellipse cx="-20" cy="20" rx="8" ry="6"/><ellipse cx="10" cy="-20" rx="8" ry="6"/><ellipse cx="10" cy="20" rx="8" ry="6"/></g>' +
    '<ellipse cx="-6" cy="0" rx="28" ry="19" fill="#F08000" stroke="#001080" stroke-width="4"/>' +
    '<path d="M-24 -5 H-12 L-7 2 H4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="-24" cy="-5" r="3" fill="#fff"/><circle cx="4" cy="2" r="2.6" fill="#fff"/>' +
    '<ellipse cx="19" cy="-15" rx="10" ry="6" fill="#001080" transform="rotate(-28 19 -15)"/>' +
    '<ellipse cx="19" cy="15" rx="10" ry="6" fill="#001080" transform="rotate(28 19 15)"/>' +
    '<circle cx="25" cy="0" r="15" fill="#F08000" stroke="#001080" stroke-width="4"/>' +
    '<ellipse cx="38" cy="0" rx="9" ry="8" fill="#ffe3c2" stroke="#001080" stroke-width="3"/>' +
    '<circle cx="45" cy="0" r="4.5" fill="#001080"/>' +
    '<circle cx="29" cy="-7" r="3.2" fill="#001080"/><circle cx="29" cy="7" r="3.2" fill="#001080"/>' +
    '</svg>';
  const ARROW = '<span class="ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4M5 11l7-7 7 7"/></svg></span>';
  const BANG = '<span class="ico" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 2l2.2 5.3 5.6-2.1-2.6 5.2 5 2.9-5.7 1.4 1 5.8-4.4-3.8L9 20.6l.4-5.8-5.7-.9 4.7-3.3-2.9-5.1 5.6 1.7z"/></svg></span>';

  /* code with colors; the text itself stays exactly the program */
  function highlight(line, userFns) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let out = '';
    const re = /(\s+)|(\/\/.*$)|([A-Za-z_$][\w$]*)|(\d+)|(\+\+|<=|[{}();<=!])|(.)/g;
    let m;
    while ((m = re.exec(line))) {
      if (m[1]) out += m[1];
      else if (m[2]) out += `<span class="tk-cmt">${esc(m[2])}</span>`;
      else if (m[3]) {
        const w = m[3];
        let cls = 'tk-var';
        if (KL.KEYWORDS.has(w)) cls = 'tk-kw';
        else if (KL.BUILTIN.includes(w)) cls = 'tk-cmd';
        else if (KL.CONDS.includes(w)) cls = 'tk-cnd';
        else if (userFns.includes(w) || w === 'start') cls = 'tk-ufn';
        out += `<span class="${cls}">${w}</span>`;
      } else if (m[4]) out += `<span class="tk-num">${m[4]}</span>`;
      else if (m[5]) out += `<span class="tk-pun">${esc(m[5])}</span>`;
      else out += esc(m[6]);
    }
    return out;
  }

  function CodeView(root) {
    let cur = null;
    return {
      show(src) {
        const userFns = Object.keys(KL.parse(src).funcs);
        root.innerHTML = src.split('\n').map((t, i) =>
          `<div class="cl" data-line="${i + 1}"><span class="ln">${i + 1}</span><span class="ct">${highlight(t, userFns)}</span></div>`).join('');
        cur = null;
      },
      mark(line, crash) {
        if (cur) cur.classList.remove('on', 'crash');
        cur = line ? root.querySelector(`.cl[data-line="${line}"]`) : null;
        if (cur) { cur.classList.add('on'); if (crash) cur.classList.add('crash'); }
      },
      text() { return K.$$('.ct', root).map((e) => e.textContent).join('\n'); },
    };
  }

  function WorldView(root, onCell) {
    let w = null;
    let rot = 0;
    let shownDir = 0;
    let karel;
    let dog;
    let ballsLayer;
    let marksLayer;
    let ghost;
    let bang;
    if (onCell) {
      root.addEventListener('click', (e) => {
        const c = e.target.closest('.cell');
        if (c) onCell(+c.dataset.s, +c.dataset.a);
      });
    }
    const pos = (el, s, a) => { el.style.setProperty('--x', a - 1); el.style.setProperty('--y', w.streets - s); };
    return {
      setup(world) {
        w = world;
        root.style.setProperty('--cols', world.avenues);
        root.style.setProperty('--rows', world.streets);
        let cells = '';
        for (let s = world.streets; s >= 1; s--) {
          for (let a = 1; a <= world.avenues; a++) {
            cells += onCell
              ? `<button class="cell" type="button" data-s="${s}" data-a="${a}" aria-label="Row ${s}, Column ${a}"></button>`
              : `<span class="cell" data-s="${s}" data-a="${a}"></span>`;   // the start screen's demo is not tappable
          }
        }
        const ys = [];
        for (let s = world.streets; s >= 1; s--) ys.push(`<span>${s}</span>`);
        const xs = [];
        for (let a = 1; a <= world.avenues; a++) xs.push(`<span>${a}</span>`);
        root.innerHTML =
          `<div class="ax-yt"><span>Row · Fila</span></div><div class="ax-y">${ys.join('')}</div>` +
          `<div class="board"><div class="cells">${cells}</div><div class="balls"></div><div class="marks"></div>` +
          `<div class="pos ghost"></div><div class="pos karel"><div class="dog">${DOG}</div></div>` +
          `<div class="pos bang"><b>CRASH!<span class="es" lang="es">¡CHOCA!</span></b></div></div>` +
          `<div class="ax-x">${xs.join('')}</div><div class="ax-xt">Column · Columna</div>`;
        karel = root.querySelector('.karel');
        dog = root.querySelector('.dog');
        ballsLayer = root.querySelector('.balls');
        marksLayer = root.querySelector('.marks');
        ghost = root.querySelector('.ghost');
        bang = root.querySelector('.bang');
      },
      place(state, animate) {
        if (!animate) {
          karel.style.transition = 'none';
          dog.style.transition = 'none';
          rot = -90 * state.d;
        } else {
          karel.style.transition = '';
          dog.style.transition = '';
          const diff = K.mod(state.d - shownDir, 4);
          if (diff === 1) rot -= 90; else if (diff === 2) rot -= 180; else if (diff === 3) rot += 90;
        }
        shownDir = state.d;
        pos(karel, state.s, state.a);
        dog.style.transform = `rotate(${rot}deg)`;
        karel.dataset.s = state.s;
        karel.dataset.a = state.a;
        karel.dataset.d = state.d;
        let html = '';
        Object.keys(state.balls).forEach((k) => {
          const n = state.balls[k];
          if (!n) return;
          const [s, a] = k.split(',').map(Number);
          const under = s === state.s && a === state.a;
          html += `<div class="pos bc${under ? ' under' : ''}" data-k="${k}" style="--x:${a - 1};--y:${w.streets - s}"><span class="b">${n > 1 ? n : ''}</span></div>`;
        });
        ballsLayer.innerHTML = html;
        if (!animate) { void karel.offsetWidth; karel.style.transition = ''; dog.style.transition = ''; }
      },
      crash(on) {
        bang.classList.toggle('show', !!on);
        karel.classList.toggle('bump', !!on);
        if (on) pos(bang, +karel.dataset.s, +karel.dataset.a);
      },
      ghost(sq, d, askDir, wrong) {
        if (!sq) { ghost.classList.remove('show'); return; }
        ghost.classList.add('show');
        ghost.classList.toggle('no', !!wrong);
        pos(ghost, sq.s, sq.a);
        const inner = (d == null)
          ? (askDir ? '<span class="q">?</span>' : '')
          : `<span class="gdog" style="transform:rotate(${-90 * d}deg)">${DOG}</span>`;
        ghost.innerHTML = '<span class="ring"></span>' + inner;
      },
      marks(set, mode) {
        let html = '';
        set.forEach((k) => {
          const [s, a] = k.split(',').map(Number);
          html += `<div class="pos bm${mode ? ' ' + mode : ''}" style="--x:${a - 1};--y:${w.streets - s}"><i></i></div>`;
        });
        marksLayer.innerHTML = html;
      },
      lock(on) { root.classList.toggle('locked', !!on); },
      get state() { return { s: +karel.dataset.s, a: +karel.dataset.a, d: +karel.dataset.d }; },
    };
  }

  /* ======================================================================================
     The page
     ====================================================================================== */
  const stage = K.$('#stage');
  const el = {
    start: K.$('#start'), play: K.$('#play'), pills: K.$('#pills'), prompt: K.$('#prompt'),
    code: K.$('#code'), gloss: K.$('#gloss'), rules: K.$('#rules'), ctrl: K.$('#ctrl'),
    clueBtn: K.$('#btn-clue'), clueBox: K.$('#cluebox'), newBtn: K.$('#btn-new'),
    startBtn: K.$('#btn-start'), lp: K.$('#lp'),
  };
  const code = CodeView(el.code);
  const view = WorldView(K.$('#world'), onCell);
  const aCode = CodeView(K.$('#a-code'));
  const aView = WorldView(K.$('#a-world'), null);

  const S = {
    screen: 'start',
    level: 0,
    done: [false, false, false, false],
    set: K.mod(K.num('set', 1) - 1, PUZZLES[3].length),
    step: 'karel',
    pred: null,
    puz: null,
    sol: null,
    busy: false,
    token: 0,
    ff: false,
    wrongShown: null,
  };
  const freshPred = () => ({ square: null, dir: null, crash: false, balls: new Set() });
  const puzzleFor = (lv) => (lv < 3 ? PUZZLES[lv][0] : PUZZLES[3][S.set]);

  const clues = K.Clues(el.clueBtn, el.clueBox);
  el.startBtn.innerHTML = K.bi('Start', 'Empezar') + K.icon.play;
  el.lp.innerHTML = K.LEVELS.map((x) => `<span class="lp${x.hardest ? ' hardest' : ''}"><span class="en">${x.en}</span><span class="es" lang="es">${x.es}</span></span>`).join('');

  const kiosk = K.mount({
    stage,
    newButton: el.newBtn,
    isHome: () => S.screen === 'start',
    isBusy: () => S.busy,
    onReset: () => newPlayer(),
  });

  /* ---------- screens ---------- */
  function showStart() {
    S.screen = 'start';
    S.token++;
    S.busy = false;
    el.play.classList.remove('show');
    el.start.classList.add('show');
    el.newBtn.hidden = true;
    K.pills(el.pills, -1, S.done);
    el.pills.style.visibility = 'hidden';
    attract();
  }

  function newPlayer() {
    S.done = [false, false, false, false];
    S.set = (S.set + 1) % PUZZLES[3].length;   // the next visitor gets the next hardest puzzle
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
    S.token++;
    S.busy = false;
    S.ff = false;
    S.level = level;
    S.puz = puzzleFor(level);
    S.sol = solve(S.puz);
    S.pred = freshPred();
    S.step = S.puz.ask.balls ? 'balls' : 'karel';
    S.wrongShown = null;
    K.pills(el.pills, level, S.done);
    code.show(S.puz.code);
    el.code.classList.toggle('long', S.puz.code.split('\n').length > 12);
    code.mark(null);
    renderGloss();
    view.setup(S.puz.world);
    view.place(KL.startState(S.puz.world), false);
    view.crash(false);
    clues.set(cluesFor(S.puz, S.sol));
    say('');
    renderPrompt();
    renderCtrl();
    sync();
  }

  function renderPrompt() {
    let q;
    if (S.level === 3) {
      q = K.bi('How many balls, where, and does Karel crash?', '¿Cuántas pelotas quedan y dónde? ¿Karel choca?', 'q');
    } else if (!S.puz.ask.dir) {
      q = K.bi('Where does Karel end? Tap the square.', '¿Dónde termina Karel? Toca el cuadro.', 'q');
    } else {
      q = K.bi('Where does Karel end, and which way does it face?', '¿Dónde termina Karel y hacia dónde mira?', 'q');
    }
    el.prompt.innerHTML = q;
  }

  function renderGloss() {
    const info = analyze(S.sol.res.prog);
    const rows = [];
    if (S.level < 2) rows.push(['<span class="tk-kw">function</span> <span class="tk-ufn">start</span>()', GLOSS.start, 'start']);   // explained in the first two
    info.loops.forEach((lp) => rows.push([`<span class="tk-kw">for</span> (... &lt; ${lp.count} ...)`, [`repeat ${lp.count} times`, `repetir ${lp.count} veces`], 'for']));
    info.used.forEach((n) => {
      if (n === 'turnRight' && info.userFns.includes('turnRight')) rows.push(['<span class="tk-ufn">turnRight</span>()', GLOSS.turnRight, 'turnRight']);
      else if (GLOSS[n] && KL.BUILTIN.includes(n)) rows.push([`${n}()`, GLOSS[n], n]);
    });
    const fresh = S.puz.fresh;
    el.gloss.innerHTML = rows.map(([c, g, key]) => {
      const isNew = key === fresh;
      return `<span class="chip${isNew ? ' fresh' : ''}">${isNew ? '<span class="new">NEW · NUEVO</span>' : ''}<code>${c}</code> =` +
        (g[0] ? ` <span class="en">${g[0]}</span> ·` : '') + ` <span class="es" lang="es">${g[1]}</span></span>`;
    }).join('');
    const st = KL.startState(S.puz.world);
    const w = where(st.s, st.a, st.d);
    let r = `<div>Start: ${w.en}. · <span class="es" lang="es">Inicio: ${w.es}.</span></div>`;
    r += '<div><b>Crash:</b> <code>move()</code> into an edge. · <span class="es" lang="es"><b>Choca:</b> <code>move()</code> contra la orilla.</span></div>';
    if (info.used.includes('takeBall')) r += '<div><b>Crash:</b> <code>takeBall()</code> with no ball. · <span class="es" lang="es"><b>Choca:</b> <code>takeBall()</code> sin pelota.</span></div>';
    el.rules.innerHTML = r;
  }

  function renderCtrl() {
    renderPrompt();   // the hardest challenge's step tag follows the step
    const ask = S.puz.ask;
    let h = '';
    if (S.step === 'balls') {
      h += `<div class="hint">${K.bi('<b>Step 1 of 2:</b> tap every square that will have a ball when Karel is done. Tap again to remove.', '<b>Paso 1 de 2:</b> toca cada cuadro que tendrá pelota cuando Karel termine. Toca otra vez para borrar tu marca.')}</div>`;
      h += `<div class="count-box"><b id="ball-count">0</b>${K.bi('balls you marked', 'pelotas marcadas')}</div>`;
      h += '<div class="row2"><button class="btn btn-ghost" id="btn-clear" type="button">' + K.icon.erase + K.bi('Clear', 'Borrar') + '</button>' +
        '<button class="btn" id="btn-next" type="button">' + K.bi('Next: Karel', 'Siguiente: Karel') + K.icon.next + '</button></div>';
    } else {
      if (!ask.dir) h += `<div class="hint">${K.bi('Tap a square on the grid. Or, if you think Karel crashes, tap:', 'Toca un cuadro. O, si crees que Karel choca, toca:')}</div>`;
      if (ask.dir) {
        const b = (cls, d) => `<button class="btn btn-ghost ${cls}" type="button" data-dir="${d}" aria-label="${DIR_EN[d]}"><span style="display:inline-flex;transform:rotate(${90 - 90 * d}deg)">${ARROW}</span>${K.bi(DIR_EN[d], DIR_ES[d])}</button>`;
        h += `<div class="compass" id="compass">${b('n', 1)}${b('w', 2)}<div class="c" id="compass-c"></div>${b('e', 0)}${b('s', 3)}</div>`;
      }
      h += `<button class="btn btn-crash" id="btn-crash" type="button">${BANG}${K.bi('Karel crashes!', '¡Karel choca!')}</button>`;
      h += '<div class="row2">';
      if (S.level === 3) h += '<button class="btn btn-ghost" id="btn-back" type="button" style="flex:.8">' + K.icon.back + K.bi('Balls', 'Pelotas') + '</button>';
      h += `<button class="btn btn-check" id="btn-check" type="button">${K.icon.check}${K.bi('Check', 'Revisar')}</button></div>`;
    }
    el.ctrl.innerHTML = h;
    const on = (id, f) => { const x = K.$('#' + id, el.ctrl); if (x) x.addEventListener('click', f); };
    on('btn-clear', () => { if (S.busy) return; S.pred.balls.clear(); changed(); });
    on('btn-next', () => { if (S.busy) return; S.step = 'karel'; renderPrompt(); renderCtrl(); sync(); });
    on('btn-back', () => { if (S.busy) return; S.step = 'balls'; renderPrompt(); renderCtrl(); sync(); });
    on('btn-crash', () => {
      if (S.busy) return;
      S.pred.crash = !S.pred.crash;
      if (S.pred.crash) { S.pred.square = null; S.pred.dir = null; }
      changed();
    });
    on('btn-check', check);
    K.$$('[data-dir]', el.ctrl).forEach((b) => b.addEventListener('click', () => {
      if (S.busy) return;
      S.pred.dir = +b.dataset.dir;
      S.pred.crash = false;
      changed();
    }));
  }

  function onCell(s, a) {
    if (S.screen !== 'play' || S.busy) return;
    const k = s + ',' + a;
    if (S.step === 'balls') {
      if (S.pred.balls.has(k)) S.pred.balls.delete(k); else S.pred.balls.add(k);
    } else {
      S.pred.square = { s, a };
      S.pred.crash = false;
    }
    changed();
  }

  function changed() { S.wrongShown = null; say(''); sync(); }

  /* bring the board and the buttons in line with the prediction */
  function sync() {
    const p = S.pred;
    const ask = S.puz.ask;
    const wrong = S.wrongShown || {};
    view.ghost(S.step === 'karel' || p.square ? p.square : null, ask.dir ? p.dir : null, ask.dir, wrong.end);
    view.marks(p.balls, S.step === 'balls' ? '' : 'dim');
    const cnt = K.$('#ball-count', el.ctrl);
    if (cnt) cnt.textContent = p.balls.size;
    K.$$('[data-dir]', el.ctrl).forEach((b) => b.classList.toggle('selected', p.dir === +b.dataset.dir));
    const comp = K.$('#compass', el.ctrl);
    if (comp) {
      comp.classList.toggle('no', !!wrong.dir);
      K.$$('[data-dir]', comp).forEach((b) => { b.disabled = p.crash; });
      const c = K.$('#compass-c', comp);
      c.innerHTML = p.dir == null ? '' : `<span style="display:block;transform:rotate(${-90 * p.dir}deg)">${DOG}</span>`;
    }
    const crash = K.$('#btn-crash', el.ctrl);
    if (crash) {
      crash.classList.toggle('selected', p.crash);
      crash.classList.toggle('no', !!(wrong.end && p.crash));
    }
    const chk = K.$('#btn-check', el.ctrl);
    if (chk) chk.disabled = !(p.crash || (p.square && (!ask.dir || p.dir != null)));
    view.lock(S.busy);
  }

  function say(kind, en, es, extra) { K.say(K.$('#fb'), kind, en, es, extra); }

  /* ---------- checking ---------- */
  function evaluate(pred) {
    const a = S.sol;
    const p = pred || S.pred;
    const ask = S.puz.ask;
    const parts = [];
    const endOk = a.crash ? p.crash : (!p.crash && !!p.square && p.square.s === a.s && p.square.a === a.a);
    if (ask.balls) {
      const mine = Array.from(p.balls).sort();
      parts.push({ k: 'balls', ok: JSON.stringify(mine) === JSON.stringify(a.ballKeys) });
    }
    parts.push({ k: 'end', ok: endOk });
    if (ask.dir && !a.crash && !p.crash) parts.push({ k: 'dir', ok: p.dir === a.d });
    return { ok: parts.every((x) => x.ok), parts };
  }
  const PART = {
    balls: ['The balls', 'Las pelotas'],
    end: ['Where it ends', 'Dónde termina'],
    dir: ['Which way', 'Hacia dónde'],
  };

  function check() {
    if (S.busy) return;
    const r = evaluate();
    if (r.ok) { win(); return; }
    const wrong = {};
    r.parts.forEach((x) => { if (!x.ok) wrong[x.k] = true; });
    S.wrongShown = wrong;
    const marks = '<div class="marks">' + r.parts.filter((x) => !x.ok).map((x) =>
      `<span class="m no">&#10007; ${K.bi(PART[x.k][0], PART[x.k][1], 'row')}</span>`).join('') + '</div>';
    say('bad', K.NOT_QUITE[0], K.NOT_QUITE[1], marks);
    sync();
    const box = K.$('#ctrl');
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
  }

  /* ---------- running the code (the animation) ---------- */
  function statusHTML(ev, puz) {
    const w = where(ev.state.s, ev.state.a, ev.state.d);
    let head = K.bi(`Line ${ev.line}`, `Línea ${ev.line}`, 'row');
    let cmd = '';
    let gl = '';
    if (ev.kind === 'prim' || ev.kind === 'crash') { cmd = `${ev.cmd}();`; gl = (GLOSS[ev.cmd] || ['', ''])[1]; }
    else if (ev.kind === 'call') { cmd = `${ev.name}();`; gl = ev.name === 'start' ? 'aquí empieza' : 'un comando nuevo'; }
    else if (ev.kind === 'return') { cmd = '}'; gl = ev.name === 'start' ? 'fin' : 'regresa'; }
    else if (ev.kind === 'loop') { cmd = `for: ${ev.time} / ${ev.count}`; gl = `vez ${ev.time} de ${ev.count}`; }
    else if (ev.kind === 'loopdone') { cmd = 'for: done'; gl = 'el loop terminó'; }
    else if (ev.kind === 'cond') { cmd = `${ev.cond}() → ${ev.value}`; gl = ev.value ? 'verdadero' : 'falso'; }
    const crash = ev.kind === 'crash'
      ? `<div class="rs-p" style="color:#ffb3b3"><b>CRASH!</b> <span class="es" lang="es">¡Choca!</span></div>`
      : `<div class="rs-p">${w.en}<span class="es" lang="es">${w.es}</span></div>`;
    return `<div class="run-status"><div class="rs-h">${head}</div><div class="rs-c">${cmd}</div><div class="rs-g" lang="es">${gl}</div>${crash}</div>`;
  }

  async function play(res, opts) {
    const my = ++S.token;
    S.busy = true;
    S.ff = false;
    view.lock(true);
    const statusBox = document.createElement('div');
    el.ctrl.innerHTML = '';
    el.ctrl.appendChild(statusBox);
    const skip = document.createElement('button');
    skip.className = 'btn btn-ghost';
    skip.type = 'button';
    skip.innerHTML = K.bi('Skip to the end', 'Saltar al final') + K.icon.next;
    skip.addEventListener('click', () => { S.ff = true; });
    el.ctrl.appendChild(skip);
    el.clueBtn.disabled = true;
    view.place(KL.startState(S.puz.world), false);
    view.crash(false);
    for (const ev of res.trace) {
      if (my !== S.token) return false;
      code.mark(ev.line, ev.kind === 'crash');
      statusBox.innerHTML = statusHTML(ev, S.puz);
      if (ev.kind === 'prim' || ev.kind === 'crash') view.place(ev.state, !S.ff && !K.fast);
      if (ev.kind === 'crash') view.crash(true);
      if (!S.ff) await K.wait(ev.kind === 'prim' ? 430 : ev.kind === 'crash' ? 1000 : 240);
    }
    if (my !== S.token) return false;
    view.place(res.final, false);
    if (res.crash) view.crash(true);
    if (!K.fast) await K.sleep(S.ff ? 150 : 500);
    if (my !== S.token) return false;
    if (opts && opts.restore) renderCtrl();
    return true;
  }

  async function win() {
    S.wrongShown = null;
    say('');
    view.ghost(S.pred.square, S.puz.ask.dir ? S.pred.dir : null, S.puz.ask.dir, false);
    const ok = await play(S.sol.res);
    if (!ok) return;
    S.done[S.level] = true;
    K.pills(el.pills, S.level, S.done);
    celebrate();
  }

  function resultLine() {
    const a = S.sol;
    if (a.crash) {
      return K.bi(`Karel crashed on line ${a.res.crash.line}, just as you said.`, `Karel chocó en la línea ${a.res.crash.line}, como dijiste.`);
    }
    const w = where(a.s, a.a, a.d);
    let en = `Karel ended on ${w.en}.`;
    let es = `Karel terminó en la ${w.es}.`;
    if (S.puz.ask.balls) {
      const n = a.ballKeys.length;
      en = `${n === 1 ? '1 ball' : n + ' balls'}, no crash. ` + en;
      es = `${n} ${n === 1 ? 'pelota' : 'pelotas'}, sin choque. ` + es;
    }
    return K.bi(en, es);
  }

  function celebrate() {
    S.busy = false;
    if (S.level === 3) {
      K.celebrate({
        hardest: true,
        title: ['You did the hardest challenge!', '¡Superaste el reto más difícil!'],
        detail: resultLine(),
        actions: [{ id: 'btn-again', cls: 'btn-ghost', html: K.icon.redo + K.bi('Start over', 'Empezar de nuevo'), onClick: () => kiosk.reset('button') }],
      });
      return;
    }
    const n = S.level + 1;
    const next = K.LEVELS[S.level + 1];
    K.celebrate({
      title: [`Challenge ${n} solved!`, `¡Reto ${n} resuelto!`],
      sub: ["You got it. That was the first step. This class is hard, that's the point, and you just showed you can do it.", '¡Lo lograste! Ese fue el primer paso. Esta clase es difícil, esa es la idea, y acabas de demostrar que puedes.'],
      detail: resultLine() + (S.sol.crash ? `<div style="margin-top:12px">${K.bi(COMPUTERS[0], COMPUTERS[1])}</div>` : ''),
      actions: [{
        id: 'btn-nextlevel', cls: 'btn-big',
        html: K.bi(`Next: ${next.en}`, `Siguiente: ${next.es}`) + K.icon.next,
        onClick: () => { K.hideOverlays(stage); loadLevel(S.level + 1); },
      }],
    });
  }

  /* the last clue: watch the run, then answer */
  async function watchRun() {
    if (S.busy) return;
    view.ghost(null);
    const ok = await play(S.sol.res, { restore: true });
    if (!ok) return;
    S.busy = false;
    el.clueBtn.disabled = clues.used >= clues.count;
    view.place(KL.startState(S.puz.world), false);
    view.crash(false);
    code.mark(null);
    if (S.puz.ask.balls) { S.step = 'balls'; renderCtrl(); }
    sync();
    say('', 'You saw it run. Now mark your answer and tap Check.', 'Ya lo viste correr. Ahora marca tu respuesta y toca Revisar.');
  }

  /* ---------- the start screen's little demo ---------- */
  async function attract() {
    const my = S.token;
    aView.setup(ATTRACT.world);
    aCode.show(ATTRACT.code);
    const res = KL.run(ATTRACT.code, ATTRACT.world);
    for (;;) {
      aView.place(KL.startState(ATTRACT.world), false);
      aCode.mark(null);
      await K.sleep(700);
      for (const ev of res.trace) {
        if (my !== S.token || S.screen !== 'start') return;
        aCode.mark(ev.line);
        if (ev.kind === 'prim') aView.place(ev.state, true);
        await K.sleep(ev.kind === 'prim' ? 520 : 300);
      }
      if (my !== S.token || S.screen !== 'start') return;
      await K.sleep(2200);
    }
  }

  el.startBtn.addEventListener('click', () => startPlay(0));

  /* ======================================================================================
     ?level / ?demo for screenshots, ?selftest for the checks
     ====================================================================================== */
  function fillAnswer() {
    const a = S.sol;
    S.pred = freshPred();
    if (S.puz.ask.balls) a.ballKeys.forEach((k) => S.pred.balls.add(k));
    if (a.crash) S.pred.crash = true;
    else { S.pred.square = { s: a.s, a: a.a }; if (S.puz.ask.dir) S.pred.dir = a.d; }
  }

  function boot() {
    const lv = K.num('level', K.demo ? 4 : 0);   // ?demo=solved alone shows the hardest challenge solved
    if (K.selftest) { selftest(); return; }
    if (lv >= 1 && lv <= 4) {
      startPlay(lv - 1);
      for (let i = 0; i < lv - 1; i++) S.done[i] = true;
      K.pills(el.pills, lv - 1, S.done);
      const d = K.demo;
      if (K.param('step') === '2' && S.puz.ask.balls) { S.step = 'karel'; renderCtrl(); sync(); }
      if (d === 'answer' || d === 'solved' || d === 'run') {
        fillAnswer();
        if (S.puz.ask.balls) S.step = 'karel';
        if (d === 'answer' && K.param('step') === '1') S.step = 'balls';
        renderCtrl();
        sync();
        if (d === 'solved') {
          view.place(S.sol.res.final, false);
          if (S.sol.crash) view.crash(true);
          code.mark(S.sol.res.trace[S.sol.res.trace.length - 1].line, S.sol.crash);
          S.done[S.level] = true;
          K.pills(el.pills, S.level, S.done);
          celebrate();
        }
        if (d === 'run') check();
      } else if (d === 'wrong') {
        const a = S.sol;
        S.pred = freshPred();
        if (S.puz.ask.balls) { a.ballKeys.slice(1).forEach((k) => S.pred.balls.add(k)); S.step = 'karel'; renderCtrl(); }
        S.pred.square = { s: a.crash ? 2 : a.s, a: a.crash ? 3 : a.a };
        if (S.puz.ask.dir) S.pred.dir = a.crash ? 1 : (a.d + 1) % 4;
        sync();
        check();
      } else if (d === 'clue') {
        clues.showUpTo(K.num('clue', 3));
      } else if (d === 'balls') {
        fillAnswer();
        S.step = 'balls';
        renderCtrl();
        sync();
      }
    } else showStart();
  }

  /* ---------- self-test ---------- */
  async function selftest() {
    const T = K.Test('karel');
    try {
      // 1. The interpreter against the class's own worked examples (lesson 28 if-tracing sheet; SuperKarel world)
      const D = world(5);
      const ex = (src) => ({ i: KL.run(src, D, { superKarel: true }), j: KL.runAsJS(src, D, { superKarel: true }) });
      let r = ex('function start() {\n    if (ballsPresent()) {\n        takeBall();\n        move();\n    }\n}');
      T.eq([r.i.final.s, r.i.final.a, !!r.i.crash], [1, 1, false], 'sheet ex.1A: Karel stands still');
      r = ex('function start() {\n    if (ballsPresent()) {\n        takeBall();\n    }\n    move();\n}');
      T.eq([r.i.final.s, r.i.final.a], [1, 2], 'sheet ex.1B: Karel moves one');
      r = ex('function start() {\n    turnAround();\n    if (frontIsClear()) {\n        move();\n    }\n    putBall();\n}');
      T.eq([r.i.final.s, r.i.final.a, r.i.final.balls, !!r.i.crash], [1, 1, { '1,1': 1 }, false], 'sheet ex.2: a skip, not a crash');
      r = ex('function start() {\n    putBall();\n    if (ballsPresent()) {\n        takeBall();\n    }\n    if (noBallsPresent()) {\n        putBall();\n    }\n}');
      T.eq(r.i.final.balls, { '1,1': 1 }, 'sheet ex.4: one ball at the end');
      r = ex('function start() {\n    turnAround();\n    if (frontIsClear()) {\n        move();\n    }\n        putBall();\n        move();\n}');
      T.eq([!!r.i.crash, r.i.crash && r.i.crash.line, r.i.final.balls], [true, 7, { '1,1': 1 }], 'sheet ex.5: indents lie, crash on line 7');
      r = ex('function start() {\n    turnAround();\n    safeMove();\n    putBall();\n    turnAround();\n    safeMove();\n    putBall();\n}\n\nfunction safeMove() {\n    if (frontIsClear()) {\n        move();\n    }\n}');
      T.eq([r.i.final.s, r.i.final.a, r.i.final.d, r.i.final.balls, !!r.i.crash], [1, 2, 0, { '1,1': 1, '1,2': 1 }, false], 'sheet ex.6: balls at avenues 1 and 2, Karel on avenue 2 facing East');
      r = ex('function start() {\n    putBall();\n    move();\n    putBall();\n    move();\n    turnAround();\n    for (let i = 0; i < 2; i++) {\n        if (ballsPresent()) {\n            takeBall();\n        }\n        move();\n    }\n}');
      T.eq([r.i.final.s, r.i.final.a, r.i.final.d, r.i.final.balls, r.i.counts.move, r.i.counts.takeBall], [1, 1, 2, { '1,1': 1 }, 4, 1], 'sheet ex.7: one ball left, move ran 2 times in the loop');
      r = ex('function start() {\n    takeBall();\n}');
      T.ok(r.i.crash && r.i.crash.cmd === 'takeBall' && r.j.crashed, 'takeBall() on an empty corner crashes (both runners)');
      r = ex('function start() {\n    turnLeft();\n    while (frontIsClear()) {\n        move();\n    }\n}');
      T.eq([r.i.final.s, r.i.final.a, !!r.i.crash], [5, 1, false], 'while (frontIsClear()) stops at the wall');
      const plain = KL.run('function start() {\n    turnRight();\n}', D);
      T.ok(plain.error && /turnRight is not defined/.test(plain.error.msg), 'plain Karel: turnRight() without a definition is an error');
      const js = KL.runAsJS('function start() {\n    turnRight();\n}', D);
      T.ok(js.error && /turnRight/.test(js.error), 'real JavaScript agrees: turnRight is not defined');

      // 2. Every puzzle: the class's rules, the interpreter vs real JavaScript, and the board can show the answer
      const all = [];
      PUZZLES.forEach((list, lv) => list.forEach((p) => all.push({ p, lv })));
      let crashes = 0;
      for (const { p, lv } of all) {
        const s = solve(p);
        const j = KL.runAsJS(p.code, p.world);
        const id = `${p.id} (challenge ${lv + 1})`;
        T.ok(/^function start\(\) \{/.test(p.code), `${id}: lives in function start() { ... }`);
        T.ok(!/\bvar\b/.test(p.code), `${id}: no var`);
        T.ok(!/\bfor\s*\(/.test(p.code) || /for \(let i = 0; i < \d+; i\+\+\)/.test(p.code), `${id}: loops are written for (let i = 0; i < n; i++)`);
        T.ok(!/turnRight\(\);/.test(p.code) || /function turnRight\(\) \{\n {4}turnLeft\(\);\n {4}turnLeft\(\);\n {4}turnLeft\(\);\n\}/.test(p.code), `${id}: turnRight() appears only with its definition`);
        T.ok(!/turnAround/.test(p.code), `${id}: no SuperKarel-only commands`);
        T.ok(!s.res.error && !j.error, `${id}: runs without errors`);
        T.eq([s.s, s.a, s.d, s.balls, s.crash], [j.s, j.a, j.d, j.balls, j.crashed], `${id}: interpreter = real JavaScript`);
        T.ok(s.s >= 1 && s.s <= p.world.streets && s.a >= 1 && s.a <= p.world.avenues, `${id}: ends inside the world`);
        if (p.ask.balls) T.ok(Object.values(s.balls).every((n) => n <= 1), `${id}: at most one ball a square, so taps can show the answer`);
        if (s.crash) crashes++;
      }
      T.eq(crashes, 1, 'the crash is the right answer exactly once');

      // 3. Through the screen, the way a visitor does it
      const sleep = (ms) => K.sleep(ms);
      const tapCell = (s, a) => K.tap(K.$(`#world .cell[data-s="${s}"][data-a="${a}"]`));
      const tapId = (id) => K.tap(K.$('#' + id));
      async function answer(sol, puz, wrongFirst) {
        if (puz.ask.balls) {
          sol.ballKeys.forEach((k) => { const [s, a] = k.split(','); tapCell(+s, +a); });
          T.eq(+K.$('#ball-count').textContent, sol.ballKeys.length, `${puz.id}: the ball counter shows ${sol.ballKeys.length}`);
          tapId('btn-next');
        }
        if (wrongFirst) {
          // a wrong guess first: never ends the level
          if (sol.crash) { tapCell(3, 3); if (puz.ask.dir) K.tap(K.$('[data-dir="1"]')); }
          else tapId('btn-crash');
          tapId('btn-check');
          await sleep(5);
          T.ok(/Not quite\. Try again\./.test(K.$('#fb').textContent) && /Casi\. Inténtalo otra vez\./.test(K.$('#fb').textContent), `${puz.id}: a wrong answer says "Not quite. Try again." in both languages`);
          T.ok(!K.$('#ov-win') || !K.$('#ov-win').classList.contains('show'), `${puz.id}: ...and the level goes on`);
          if (sol.crash) { /* switch to the crash answer */ }
          else tapId('btn-crash');           // un-pick crash
        }
        if (sol.crash) { if (!K.$('#btn-crash').classList.contains('selected')) tapId('btn-crash'); }
        else {
          tapCell(sol.s, sol.a);
          if (puz.ask.dir) K.tap(K.$(`[data-dir="${sol.d}"]`));
        }
        T.ok(!K.$('#btn-check').disabled, `${puz.id}: Check is ready`);
        tapId('btn-check');
        for (let i = 0; i < 200 && !(K.$('#ov-win') && K.$('#ov-win').classList.contains('show')); i++) await sleep(10);
      }

      tapId('btn-start');
      T.ok(K.$('#play').classList.contains('show'), 'Start opens Challenge 1');
      for (let lv = 0; lv < 4; lv++) {
        const puz = S.puz;
        const sol = S.sol;
        T.eq(code.text(), puz.code, `${puz.id}: the code on screen is exactly the program that runs`);
        const gl = el.gloss.textContent;
        analyze(sol.res.prog).used.forEach((n) => T.ok(gl.includes(n + '()'), `${puz.id}: the glossary explains ${n}()`));
        T.ok(/Try a clue/.test(el.clueBtn.textContent) && /Necesitas una pista/.test(el.clueBtn.textContent), `${puz.id}: "Try a clue / ¿Necesitas una pista?" is there`);
        // clues get more specific: tap through all of them
        const cl = cluesFor(puz, sol);
        T.eq(cl.length, 4, `${puz.id}: four clues`);
        for (let c = 1; c <= cl.length; c++) { tapId('btn-clue'); }
        T.ok(/Clue 4 of 4/.test(el.clueBox.textContent) && K.$('.clue-act', el.clueBox), `${puz.id}: the last clue offers "Watch Karel run"`);
        await answer(sol, puz, lv === 1 || lv === 2 || lv === 3);
        const ov = K.$('#ov-win');
        T.ok(ov && ov.classList.contains('show'), `${puz.id}: the right answer (after clues) clears it`);
        T.eq(view.state, { s: sol.s, a: sol.a, d: sol.d }, `${puz.id}: after the run Karel stands where the interpreter said`);
        if (lv < 3) {
          T.ok(ov.textContent.includes(`Challenge ${lv + 1} solved!`) && ov.textContent.includes(`¡Reto ${lv + 1} resuelto!`), `challenge ${lv + 1}: "Challenge ${lv + 1} solved! / ¡Reto ${lv + 1} resuelto!"`);
          tapId('btn-nextlevel');
        } else {
          T.ok(ov.textContent.includes('You did the hardest challenge!') && ov.textContent.includes('¡Superaste el reto más difícil!') &&
            ov.textContent.includes('Show a helper.') && ov.textContent.includes('Muéstraselo a un ayudante.'), 'hardest: the hardest-challenge words, both languages');
        }
      }
      T.ok(!/boss|nivel jefe|prize|premio/i.test(document.body.textContent), 'no game-talk level names and no prize named anywhere on the page');

      // 4. The other two hardest puzzles, through the screen
      for (let set = 1; set < PUZZLES[3].length; set++) {
        K.hideOverlays(stage);
        S.set = set;
        loadLevel(3);
        await answer(S.sol, S.puz, false);
        T.ok(K.$('#ov-win').classList.contains('show'), `${S.puz.id}: clears with the computed answer`);
      }

      // 5. Watch Karel run (the last clue) puts Karel back at the start and keeps the level going
      K.hideOverlays(stage);
      loadLevel(2);
      for (let c = 0; c < 4; c++) tapId('btn-clue');
      K.tap(K.$('.clue-act'));
      for (let i = 0; i < 100 && S.busy; i++) await sleep(10);
      T.eq(view.state, { s: 1, a: 1, d: 0 }, 'after "Watch Karel run", Karel is back at the start');
      T.ok(K.$('#btn-check') && !K.$('#ov-win').classList.contains('show'), '...and the visitor still answers it');

      // 6. New player and the idle reset, both in JS (no reload), and the hardest puzzle rotates
      const before = S.set;
      tapId('btn-new');
      T.ok(K.$('#play').classList.contains('show'), 'one tap on New player only asks');
      tapId('btn-new');
      T.ok(K.$('#start').classList.contains('show') && S.done.every((x) => !x), 'a second tap starts over');
      T.eq(S.set, (before + 1) % PUZZLES[3].length, 'the next player gets the next hardest puzzle');
      tapId('btn-start');
      kiosk.forceIdle(46000);
      T.ok(kiosk.idleOverlay.classList.contains('show'), 'idle 45 s: "Still playing?" shows');
      kiosk.forceIdle(61000);
      T.ok(K.$('#start').classList.contains('show') && !kiosk.idleOverlay.classList.contains('show'), 'idle 60 s: back to the start screen');
      T.eq(K.fetchedSinceLoad(), 0, 'nothing was fetched after the first load');
      T.finish();
    } catch (e) {
      T.finish(e);
    }
  }

  boot();
})();
