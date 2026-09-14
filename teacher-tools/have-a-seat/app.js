/* Have a Seat — seating chart builder. Everything lives in localStorage.
   No network, no upload. Coordinates are canonical: row 1 = front row,
   column 1 = leftmost from a student's seat facing the front. */
'use strict';

const LS_KEY = 'haveaseat.v1';   // key kept for continuity; the payload is v2 (period tabs)
const SEAT_CYCLE = ['standard', 'special', 'na'];

// ---------- state ----------
const uid = () => Math.random().toString(36).slice(2, 9);
function defaultState() {
  const p = newPeriod('Period 1');
  return {
    v: 2,
    view: 'front',          // 'front' = teacher standing at the front looking at the class
    edit: false,
    room: { rows: 4, cols: 6, seats: {}, aisleCols: [], aisleRows: [], notes: [] },   // shared by every period
    periods: [p],           // { id, name, students: [{ id, name, cond, label, seat }] }
    active: p.id
  };
}
function newPeriod(name) { return { id: uid(), name, students: [] }; }
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.room && Array.isArray(s.periods) && s.periods.length) return Object.assign(defaultState(), s);
      if (s && s.room && Array.isArray(s.students)) {          // v1: one chart → first tab
        const p = { id: uid(), name: s.title || 'Period 1', students: s.students };
        return Object.assign(defaultState(), { view: s.view, edit: s.edit, room: s.room, periods: [p], active: p.id });
      }
    }
  } catch (e) { console.warn('Could not read saved chart', e); }
  return defaultState();
}
const cur = () => state.periods.find(p => p.id === state.active) || state.periods[0];
const students = () => cur().students;
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { alert('Could not save — browser storage may be full or blocked.\n\n' + e.message); }
}
const byId = id => students().find(s => s.id === id);
const seatOf = key => students().find(s => s.seat === key);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- chart CSS (shared with the print page) ----------
const CHART_CSS = `
.chart { --seat:1fr; --gutter:8px; --aisle:34px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#1d2330;
         display:grid; grid-template-columns:auto minmax(0,1fr) auto; grid-template-rows:auto minmax(0,1fr) auto; gap:6px; }
.edge { display:flex; gap:6px; flex-wrap:wrap; align-items:center; justify-content:center; font-size:12px; }
.edge-top { grid-column:2; grid-row:1; }
.edge-bottom { grid-column:2; grid-row:3; }
.edge-left, .edge-right { grid-row:2; flex-direction:column; justify-content:center; }
.edge-left { grid-column:1; } .edge-right { grid-column:3; }
.edge-left .note, .edge-right .note { writing-mode:vertical-rl; }
.edge-right .note { transform:rotate(180deg); }
.front-banner { background:#1B2A52; color:#fff; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:4px 18px; border-radius:6px; }
.back-banner { color:#5a6270; font-weight:600; letter-spacing:1px; text-transform:uppercase; padding:2px 10px; border:1px dashed #b9bfcc; border-radius:6px; }
.note { background:#fdf3d7; border:1px solid #e0c56a; color:#3a2c00; border-radius:6px; padding:3px 10px; font-weight:600; }
.grid { grid-column:2; grid-row:2; display:grid; align-items:stretch; }
.gut { min-width:0; min-height:0; }
.gut.aisle-mark { position:relative; }
.chart.editing { --gutter:18px; }
.chart.editing .gut { cursor:pointer; border-radius:4px; background:repeating-linear-gradient(90deg,transparent 0 3px,#e4e7ee 3px 6px); }
.chart.editing .gut-row { background:repeating-linear-gradient(0deg,transparent 0 3px,#e4e7ee 3px 6px); }
.chart.editing .gut:hover { background:#c9d2e8; }
.chart.editing .gut.aisle-mark { background:#fdf3d7; outline:1px dashed #d8b64a; }
.seat { border:1.5px solid #6b7280; border-radius:8px; background:#fff; min-height:58px; aspect-ratio:1.35; position:relative;
        display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px; text-align:center; font-size:13px; line-height:1.2; overflow:hidden; }
.seat.special { background:#fff3c4; border-color:#d8b64a; }
.seat.special::after { content:'special'; position:absolute; top:2px; right:5px; font-size:9px; letter-spacing:.5px; text-transform:uppercase; color:#8a6d00; }
.seat.na { background:repeating-linear-gradient(45deg,#e6e6e6 0 4px,#f7f7f7 4px 8px); border-style:dashed; border-color:#b0b0b0; }
.seat.na.student-mode { background:#fafafa; border-color:#d0d0d0; }
.seat.special.student-mode { background:#fff; border-color:#6b7280; }
.seat.special.student-mode::after { content:none; }
.chart.editing .seat { cursor:pointer; }
.chart.editing .seat:hover { box-shadow:0 0 0 3px #c9d2e8; }
.seat.over { box-shadow:0 0 0 3px #1B2A52; }
.seat .who { font-weight:600; word-break:break-word; }
.card { border:1.5px solid #6b7280; border-radius:8px; background:#fff; padding:6px 8px; display:flex; align-items:center; gap:6px; cursor:grab; user-select:none; font-size:14px; }
.card:active { cursor:grabbing; }
.card.dragging, .seat .card.dragging { opacity:.4; }
.seat .card { border:0; padding:0; background:transparent; flex-direction:column; gap:3px; width:100%; }
.card .who { font-weight:600; flex:1; word-break:break-word; }
.pill { display:inline-block; font-size:10px; font-weight:700; letter-spacing:.3px; text-transform:uppercase; border-radius:999px; padding:1px 7px; line-height:1.5; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis; }
.pill-none { display:none; }
.pill-talker { background:#fde3cf; color:#8a3b00; border:1px solid #f0b184; }
.pill-accommodation { background:#dbe7ff; color:#1b3f8f; border:1px solid #9db6ee; }
.pill-label { background:#ead9fb; color:#4b1f7a; border:1px solid #c6a3ec; text-transform:none; }
.card .gear { border:0; background:transparent; cursor:pointer; font-size:14px; padding:0 2px; color:#5a6270; line-height:1; }
.seat .card .gear { position:absolute; top:2px; left:4px; }
.card .gear:hover { color:#1B2A52; }
.view-tag { font-size:12px; color:#5a6270; }
`;

// ---------- chart renderer (self-contained: it is serialized into the print page) ----------
function chartHTML(state, mode, view) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R = state.room, fromFront = view === 'front';
  const rows = [], cols = [];
  for (let r = 1; r <= R.rows; r++) rows.push(r);
  for (let c = 1; c <= R.cols; c++) cols.push(c);
  if (fromFront) { rows.reverse(); cols.reverse(); }
  const aisleBetween = (list, i, arr) => list.includes(Math.min(arr[i], arr[i + 1]));

  const colTracks = [];
  cols.forEach((c, i) => {
    colTracks.push('var(--seat)');
    if (i < cols.length - 1) colTracks.push(aisleBetween(R.aisleCols, i, cols) ? 'var(--aisle)' : 'var(--gutter)');
  });

  const pillOf = s => {
    if (!s || s.cond === 'none' || (s.cond === 'label' && !s.label)) return '';
    const text = s.cond === 'talker' ? 'Talker' : s.cond === 'accommodation' ? 'Accommodation' : s.label;
    return `<span class="pill pill-${s.cond}">${esc(text)}</span>`;
  };
  const studentIn = key => state.students.find(s => s.seat === key);

  let cells = '';
  rows.forEach((r, ri) => {
    cols.forEach((c, ci) => {
      const key = r + '-' + c, type = R.seats[key] || 'standard', st = studentIn(key);
      let inner = '';
      if (mode === 'app' && st) {
        inner = `<div class="card" draggable="true" data-id="${st.id}">
          <button type="button" class="gear" data-gear="${st.id}" title="Edit student">⚙</button>
          <span class="who">${esc(st.name)}</span>${pillOf(st)}</div>`;
      } else if (mode === 'teacher' && st) {
        inner = `<span class="who">${esc(st.name)}</span>${pillOf(st)}`;
      }
      const cls = ['seat', type, mode === 'student' ? 'student-mode' : ''].join(' ');
      cells += `<div class="${cls}" data-seat="${key}" data-type="${type}">${inner}</div>`;
      if (ci < cols.length - 1) {
        const a = aisleBetween(R.aisleCols, ci, cols);
        cells += `<div class="gut gut-col${a ? ' aisle-mark' : ''}" data-aisle-col="${Math.min(c, cols[ci + 1])}"></div>`;
      }
    });
    if (ri < rows.length - 1) {
      const a = aisleBetween(R.aisleRows, ri, rows);
      cells += `<div class="gut gut-row${a ? ' aisle-mark' : ''}" data-aisle-row="${Math.min(r, rows[ri + 1])}" style="grid-column:1/-1;height:${a ? 'var(--aisle)' : 'var(--gutter)'}"></div>`;
    }
  });

  const notes = side => R.notes.filter(n => n.side === side).map(n => `<span class="note">${esc(n.text)}</span>`).join('');
  const frontEdge = `<span class="front-banner">Front of room</span>${notes('front')}`;
  const backEdge = `<span class="back-banner">Back of room</span>${notes('back')}`;
  // Left/right are a student's left/right (facing the front). Seen from the front they swap.
  const leftEdge = notes(fromFront ? 'right' : 'left');
  const rightEdge = notes(fromFront ? 'left' : 'right');

  return `<div class="chart${mode === 'app' && state.edit ? ' editing' : ''}">
    <div class="edge edge-top">${fromFront ? backEdge : frontEdge}</div>
    <div class="edge edge-left">${leftEdge}</div>
    <div class="grid" style="grid-template-columns:${colTracks.join(' ')}">${cells}</div>
    <div class="edge edge-right">${rightEdge}</div>
    <div class="edge edge-bottom">${fromFront ? frontEdge : backEdge}</div>
  </div>`;
}

// ---------- DOM ----------
const $ = id => document.getElementById(id);
document.head.insertAdjacentHTML('beforeend', `<style>${CHART_CSS}</style>`);

function render() {
  renderTabs();
  $('btnView').textContent = state.view === 'front' ? '👁 Viewing from the front' : '👁 Viewing from the back';
  $('btnRoomGear').setAttribute('aria-pressed', String(state.edit));
  $('roomPanel').hidden = !state.edit;
  $('inRows').value = state.room.rows;
  $('inCols').value = state.room.cols;
  $('noteList').innerHTML = state.room.notes.map(n =>
    `<li>${esc(n.text)} <small>${n.side}</small><button type="button" data-del-note="${n.id}" title="Remove note">✕</button></li>`).join('');
  const chips = (n, list, attr) => {
    if (n < 2) return '<span class="none">needs at least two</span>';
    let h = ''; for (let i = 1; i < n; i++) h += `<button type="button" ${attr}="${i}" aria-pressed="${list.includes(i)}" title="Toggle aisle">${i} | ${i + 1}</button>`;
    return h;
  };
  $('aisleCols').innerHTML = chips(state.room.cols, state.room.aisleCols, 'data-aisle-col');
  $('aisleRows').innerHTML = chips(state.room.rows, state.room.aisleRows, 'data-aisle-row');

  const all = students(), pool = all.filter(s => !s.seat);
  $('poolCount').textContent = `· ${pool.length} unseated / ${all.length} total`;
  $('pool').innerHTML = pool.length ? pool.map(cardHTML).join('')
    : `<div class="empty">${all.length ? 'Everyone has a seat.' : 'No students yet — click Import.'}</div>`;

  $('chart').innerHTML = chartHTML(chartState(), 'app', state.view);
  save();
}
// What the renderer sees: the shared room plus the active period's roster.
function chartState() { return { room: state.room, students: students(), edit: state.edit, title: cur().name }; }

function renderTabs() {
  $('tabs').innerHTML = state.periods.map(p => {
    const on = p.id === state.active;
    return `<button type="button" class="tab" role="tab" aria-selected="${on}" data-tab="${p.id}">${esc(p.name)}
      ${on ? `<span class="mini" data-rename="${p.id}" title="Rename">✎</span><span class="mini" data-close="${p.id}" title="Delete this period">✕</span>` : ''}</button>`;
  }).join('') + `<button type="button" class="tab add" id="btnAddPeriod" title="Add a period">＋ Add period</button>`;
}

function cardHTML(s) {
  const pill = s.cond === 'none' || (s.cond === 'label' && !s.label) ? '' :
    `<span class="pill pill-${s.cond}">${esc(s.cond === 'talker' ? 'Talker' : s.cond === 'accommodation' ? 'Accommodation' : s.label)}</span>`;
  return `<div class="card" draggable="true" data-id="${s.id}"><span class="who">${esc(s.name)}</span>${pill}
    <button type="button" class="gear" data-gear="${s.id}" title="Edit student">⚙</button></div>`;
}

function cycleCond(s) {
  const order = ['none', 'talker', 'accommodation'];
  if (s.label) order.push('label');
  s.cond = order[(order.indexOf(s.cond) + 1) % order.length];
}

// ---------- clicks ----------
document.addEventListener('click', e => {
  const tab = e.target.closest('[data-rename], [data-close], [data-tab], #btnAddPeriod');
  if (tab) {
    if (tab.id === 'btnAddPeriod') { const p = newPeriod(`Period ${state.periods.length + 1}`); state.periods.push(p); state.active = p.id; render(); renamePeriod(p.id); return; }
    if (tab.dataset.rename) { renamePeriod(tab.dataset.rename); return; }
    if (tab.dataset.close) { deletePeriod(tab.dataset.close); return; }
    state.active = tab.dataset.tab; render(); return;
  }
  const t = e.target.closest('[data-gear], [data-del-note], .card, .seat, .gut, .chips button');
  if (!t) return;
  if (t.dataset.gear) { openStudent(t.dataset.gear); return; }
  if (t.dataset.delNote) { state.room.notes = state.room.notes.filter(n => n.id !== t.dataset.delNote); render(); return; }
  if (t.classList.contains('card')) { const s = byId(t.dataset.id); if (s) { cycleCond(s); render(); } return; }
  if (!state.edit) return;
  if (t.dataset.aisleCol) { toggle(state.room.aisleCols, +t.dataset.aisleCol); render(); return; }
  if (t.dataset.aisleRow) { toggle(state.room.aisleRows, +t.dataset.aisleRow); render(); return; }
  if (t.classList.contains('seat')) {
    const key = t.dataset.seat, next = SEAT_CYCLE[(SEAT_CYCLE.indexOf(t.dataset.type) + 1) % SEAT_CYCLE.length];
    if (next === 'standard') delete state.room.seats[key]; else state.room.seats[key] = next;
    if (next === 'na') state.periods.forEach(p => p.students.forEach(s => { if (s.seat === key) s.seat = null; }));
    render();
  }
});
function toggle(arr, v) { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); }

function renamePeriod(id) {
  const p = state.periods.find(x => x.id === id); if (!p) return;
  const name = prompt('Name this period (it is also the printed chart title):', p.name);
  if (name === null) return;
  if (name.trim()) { p.name = name.trim(); render(); }
}
function deletePeriod(id) {
  const p = state.periods.find(x => x.id === id); if (!p) return;
  if (state.periods.length === 1) { alert('This is the only period. Add another before deleting this one, or use Clear to empty its roster.'); return; }
  if (!confirm(`Delete "${p.name}" and its ${p.students.length} students? The room layout is kept.`)) return;
  state.periods = state.periods.filter(x => x.id !== id);
  state.active = state.periods[0].id; render();
}

$('btnRoomGear').onclick = () => { state.edit = !state.edit; render(); };
$('btnView').onclick = () => { state.view = state.view === 'front' ? 'back' : 'front'; render(); };

function resize() {
  const rows = Math.max(1, Math.min(15, +$('inRows').value || 1));
  const cols = Math.max(1, Math.min(15, +$('inCols').value || 1));
  state.room.rows = rows; state.room.cols = cols;
  state.periods.forEach(p => p.students.forEach(s => { if (s.seat) { const [r, c] = s.seat.split('-').map(Number); if (r > rows || c > cols) s.seat = null; } }));
  Object.keys(state.room.seats).forEach(k => { const [r, c] = k.split('-').map(Number); if (r > rows || c > cols) delete state.room.seats[k]; });
  state.room.aisleCols = state.room.aisleCols.filter(c => c < cols);
  state.room.aisleRows = state.room.aisleRows.filter(r => r < rows);
  render();
}
$('inRows').onchange = resize; $('inCols').onchange = resize;

$('btnResetRoom').onclick = () => {
  if (!confirm('Reset the room to a blank 4 × 6 grid? Seat types, aisles and notes are cleared, and every student in every period is unseated. Rosters are kept.')) return;
  state.room = defaultState().room; state.periods.forEach(p => p.students.forEach(s => s.seat = null)); render();
};
$('btnAddNote').onclick = () => {
  const text = $('inNote').value.trim(); if (!text) return;
  state.room.notes.push({ id: uid(), text, side: $('inNoteSide').value });
  $('inNote').value = ''; render();
};
$('inNote').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('btnAddNote').click(); } };

$('btnClearStudents').onclick = () => {
  if (!students().length) return;
  if (!confirm(`Remove all ${students().length} students from "${cur().name}"?`)) return;
  cur().students = []; render();
};

// ---------- drag & drop ----------
let dragId = null;
document.addEventListener('dragstart', e => {
  const card = e.target.closest('.card'); if (!card) return;
  dragId = card.dataset.id; e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});
document.addEventListener('dragend', e => { e.target.closest?.('.card')?.classList.remove('dragging'); dragId = null;
  document.querySelectorAll('.over').forEach(el => el.classList.remove('over')); });
document.addEventListener('dragover', e => {
  const target = e.target.closest('.seat, #pool'); if (!target || !dragId) return;
  if (target.classList.contains('seat') && target.dataset.type === 'na') return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move'; target.classList.add('over');
});
document.addEventListener('dragleave', e => { e.target.closest?.('.seat, #pool')?.classList.remove('over'); });
document.addEventListener('drop', e => {
  const target = e.target.closest('.seat, #pool'); if (!target) return;
  e.preventDefault();
  const s = byId(dragId || e.dataTransfer.getData('text/plain')); if (!s) return;
  if (target.id === 'pool') { s.seat = null; render(); return; }
  if (target.dataset.type === 'na') return;
  const key = target.dataset.seat, occupant = seatOf(key);
  if (occupant && occupant !== s) occupant.seat = s.seat;   // swap (or unseat if dragged from the pool)
  s.seat = key; render();
});

// ---------- student dialog ----------
let editingId = null;
function openStudent(id) {
  const s = byId(id); if (!s) return; editingId = id;
  $('stName').value = s.name; $('stLabel').value = s.label || '';
  $('stUnseat').hidden = !s.seat;
  $('studentDialog').showModal(); $('stName').select();
}
$('stSave').onclick = () => {
  const s = byId(editingId); if (!s) return;
  const name = $('stName').value.trim(); if (name) s.name = name;
  s.label = $('stLabel').value.trim();
  if (s.cond === 'label' && !s.label) s.cond = 'none';
  $('studentDialog').close(); render();
};
$('stUnseat').onclick = () => { const s = byId(editingId); if (s) s.seat = null; $('studentDialog').close(); render(); };
$('stRemove').onclick = () => {
  const s = byId(editingId); if (!s) return;
  if (!confirm(`Remove ${s.name}?`)) return;
  cur().students = students().filter(x => x.id !== s.id); $('studentDialog').close(); render();
};
$('stCancel').onclick = () => $('studentDialog').close();
$('studentDialog').querySelector('form').onsubmit = e => { e.preventDefault(); $('stSave').click(); };

// ---------- import ----------
function parseNames(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delim = lines.some(l => l.includes('\t')) ? '\t' : lines.some(l => l.includes(',')) ? ',' : null;
  if (!delim) return lines;
  const rows = lines.map(l => l.split(delim).map(x => x.trim().replace(/^"(.*)"$/, '$1')));
  const head = rows[0].map(h => h.toLowerCase());
  const iName = head.findIndex(h => /^(student\s*)?(full\s*)?name$/.test(h) || h === 'student');
  const iFirst = head.findIndex(h => /first/.test(h)), iLast = head.findIndex(h => /last/.test(h));
  if (iName >= 0) return rows.slice(1).map(r => r[iName]).filter(Boolean);
  if (iFirst >= 0 && iLast >= 0) return rows.slice(1).map(r => [r[iFirst], r[iLast]].filter(Boolean).join(' ')).filter(Boolean);
  if (delim === ',' && rows.every(r => r.length === 2)) return rows.map(r => `${r[1]} ${r[0]}`.trim()).filter(Boolean);
  return rows.map(r => r[0]).filter(Boolean);
}
function previewImport() {
  const names = parseNames($('importText').value);
  const have = new Set(students().map(s => s.name.toLowerCase()));
  const fresh = names.filter(n => !have.has(n.toLowerCase()));
  const dupes = names.length - fresh.length;
  $('importPreview').innerHTML = names.length
    ? `<b>${fresh.length}</b> will be added${dupes ? `, <b>${dupes}</b> already on the list` : ''}:<ol>${fresh.map(n => `<li>${esc(n)}</li>`).join('')}</ol>` : '';
  $('btnImportAdd').disabled = !fresh.length;
  return fresh;
}
$('btnImport').onclick = () => { $('importText').value = ''; previewImport(); $('importDialog').showModal(); $('importText').focus(); };
$('importText').oninput = previewImport;
$('btnImportCancel').onclick = () => $('importDialog').close();
$('btnImportAdd').onclick = () => {
  const seen = new Set();
  previewImport().forEach(n => { const k = n.toLowerCase(); if (seen.has(k)) return; seen.add(k);
    students().push({ id: uid(), name: n, cond: 'none', label: '', seat: null }); });
  $('importDialog').close(); render();
};
$('importDialog').querySelector('form').onsubmit = e => e.preventDefault();

// ---------- print pages ----------
function openPrint(mode) {
  const w = window.open('', '_blank');
  if (!w) { alert('The browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
  const json = JSON.stringify(Object.assign(chartState(), { edit: false })).replace(/<\//g, '<\\/');
  const label = mode === 'teacher' ? 'Teacher copy' : 'Student copy';
  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>${esc(cur().name || 'Seating chart')} — ${label}</title>
<style>
body { margin:0; padding:16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#1d2330; background:#fff; }
.toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px; padding:10px 12px; background:#f4f6fa; border-radius:10px; font-size:14px; color:#5a6270; }
.toolbar button { font:inherit; font-weight:600; border:2px solid #1B2A52; background:#fff; color:#1B2A52; border-radius:999px; padding:5px 14px; cursor:pointer; }
.toolbar button.primary { background:#1B2A52; color:#fff; }
h1 { font-size:20px; margin:0 0 10px; display:flex; justify-content:space-between; gap:10px; align-items:baseline; }
h1 small { font-size:12px; color:#5a6270; font-weight:400; }
@media print { .toolbar { display:none; } body { padding:0; } }
${CHART_CSS}
</style></head><body>
<div class="toolbar"><button type="button" id="flip"></button><button type="button" class="primary" onclick="print()">Print…</button>
<span>Use the print dialog for paper size, orientation, margins and scale.</span></div>
<h1><span id="title"></span><small id="viewTag"></small></h1>
<div id="chart"></div>
<script>
const STATE=${json}; const MODE=${JSON.stringify(mode)}; let view=${JSON.stringify(state.view)};
${chartHTML.toString()}
function draw(){
  document.getElementById('title').textContent = STATE.title || 'Seating chart';
  document.getElementById('viewTag').textContent = (view==='front' ? 'Viewed from the front of the room' : 'Viewed from the back of the room') + ' · ' + ${JSON.stringify(label)};
  document.getElementById('flip').textContent = view==='front' ? '👁 Viewing from the front — flip' : '👁 Viewing from the back — flip';
  document.getElementById('chart').innerHTML = chartHTML(STATE, MODE, view);
}
document.getElementById('flip').onclick = () => { view = view==='front' ? 'back' : 'front'; draw(); };
draw();
<\/script></body></html>`);
  w.document.close();
}
$('btnPrintTeacher').onclick = () => openPrint('teacher');
$('btnPrintStudent').onclick = () => openPrint('student');

render();
