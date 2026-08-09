/* =========================================================
   Thermo — main app logic.
   Dependencies: templates.js (TEMPLATES, TEMPLATE_ORDER)
   ========================================================= */

const LS_SETTINGS = 'passprinter.settings';
const LS_ROSTER   = 'passprinter.roster';

// All defaults are generic — anyone can clone this tool and fill in their own
// school info via the Settings modal. Values persist in localStorage.
const DEFAULT_SETTINGS = {
  teacher:              'Mr. Teacher',
  schoolName:           '',
  classes:              ['Period 1', 'Period 2', 'Period 3', 'Period 4'],
  defaultClass:         'Period 1',
  expiryLabel:          'End of Quarter',
  serial:               1,
  qrPresets:            [],
  qrNote:               '',
  logoPresets:          [],    // [{ label, file, width }, ...] — editable in Settings
  logoFile:             '',
  footerText:           '',
  room:                 '',
  contactEmail:         '',
  phonePolicyText:      '',    // Body of the POLICY section on the phone template
  phoneEscalationLabel: 'ESCALATION',
  phoneEscalationText:  '',    // Body of the ESCALATION section on the phone template
  phonePickupDefault:   ''     // Default text for the "Pickup instructions" field
};

// Built-in "no logo" option is always available; everything else comes from settings.
function getLogoOptions() {
  const presets = state.settings.logoPresets || [];
  return [...presets, { file: '', label: 'None (no logo)' }];
}

const DIVIDER_WIDTH = 28;   // chars — tuned for Courier New 12pt at 72mm

// ---------- State ----------

const state = {
  templateId: null,
  formData:   {},      // current form values for active template
  qrText:     '',      // universal: shown on every template if non-empty
  qrShowText: false,   // off by default — keeps the QR a surprise
  settings:   loadSettings(),
  roster:     loadRoster()
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings() {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings));
}

function loadRoster() {
  try {
    const raw = localStorage.getItem(LS_ROSTER);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveRoster() {
  localStorage.setItem(LS_ROSTER, JSON.stringify(state.roster));
}

// ---------- Helpers ----------

function escapeHTML(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// No explicit timeZone — use the machine's local time, always correct for Mark.
function fmtDateTime(d) {
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}
function fmtDate(d) {
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}
function fmtTime(d) {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit'
  });
}

function pad4(n) { return String(n).padStart(4, '0'); }

function divider(ch = '=') { return ch.repeat(DIVIDER_WIDTH); }

// Parse the Settings "Saved QR codes" textarea into [{label, content}, ...].
// Format per line: "Label, Content". First comma is the separator, so content
// may contain further commas. Lines with no comma treat the whole line as both
// label and content (forgiving — lets Mark paste a bare URL).
function parseQRPresets(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const i = line.indexOf(',');
      if (i === -1) return { label: line, content: line };
      const label = line.slice(0, i).trim();
      const content = line.slice(i + 1).trim();
      return { label: label || content, content };
    })
    .filter(p => p.content);
}

function formatQRPresets(presets) {
  return (presets || []).map(p => `${p.label}, ${p.content}`).join('\n');
}

// The brand subtitle in the app header shows the school name if set.
function updateBrandSubtitle() {
  const el = document.querySelector('.brand-sub');
  if (!el) return;
  const s = (state.settings.schoolName || '').trim();
  el.textContent = s;
  el.style.display = s ? '' : 'none';
}

function footerHTML() {
  const text = (state.settings.footerText || '').trim();
  if (!text) return '';
  return `<div class="r-tiny">${escapeHTML(text)}</div>`;
}

function logoHTML() {
  const file = state.settings.logoFile;
  if (!file) return '';
  const entry = (state.settings.logoPresets || []).find(l => l.file === file);
  const width = (entry && entry.width) || '28mm';
  return `<div class="r-logo"><img src="${escapeHTML(file)}" alt="" style="width:${width}" /></div>`;
}

function buildCtx() {
  return {
    settings: state.settings,
    now: new Date(),
    escape: escapeHTML,
    fmtDate, fmtTime, fmtDateTime,
    divider,
    pad4,
    logo: logoHTML(),
    footer: footerHTML(),
    qrBlock: makeQRHTML   // templates can embed their own QR codes
  };
}

// ---------- Template picker ----------

function renderTemplatePicker() {
  const el = document.getElementById('templatePicker');
  el.innerHTML = '<h2>Templates</h2>' + TEMPLATE_ORDER.map(id => {
    const t = TEMPLATES[id];
    return `
      <button type="button" class="tpl-btn" data-tpl="${t.id}">
        <span class="tpl-title">${escapeHTML(t.label)}</span>
        <span class="tpl-sub">${escapeHTML(t.sub)}</span>
      </button>`;
  }).join('');

  el.querySelectorAll('[data-tpl]').forEach(btn => {
    btn.addEventListener('click', () => selectTemplate(btn.dataset.tpl));
  });
}

function selectTemplate(id) {
  state.templateId = id;
  state.formData = {};
  const t = TEMPLATES[id];

  // Seed defaults
  const fields = t.fields(buildCtx());
  for (const f of fields) {
    if (f.default !== undefined) {
      state.formData[f.name] = f.default;
    } else if (f.type === 'class-select') {
      state.formData[f.name] = state.settings.defaultClass;
    }
  }

  // Update picker active state
  document.querySelectorAll('.tpl-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tpl === id);
  });

  document.getElementById('formTitle').textContent = t.label;
  renderPrintButtons(t);
  renderForm();
  renderPreview();
}

// Each template gets one or more print buttons. A template can declare
// printButtons: [{ label, copyLabel }, ...] to get multiple variants (e.g.,
// "Teacher record", "Student copy"). Clicking each button fires its own
// print job so the thermal driver cuts between them.
function renderPrintButtons(t) {
  const actions = document.getElementById('actions');
  actions.querySelectorAll('.print-btn').forEach(b => b.remove());

  const buttons = (t.printButtons && t.printButtons.length)
    ? t.printButtons
    : [{ label: 'Print', copyLabel: null }];

  const testBtn = document.getElementById('btnTestPrint');
  for (const spec of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'print-btn primary';
    btn.textContent = spec.label;
    btn.addEventListener('click', () => printCurrent(spec.copyLabel));
    actions.insertBefore(btn, testBtn);
  }
}

// ---------- Dynamic form ----------

function renderForm() {
  const host = document.getElementById('formFields');
  const t = TEMPLATES[state.templateId];
  if (!t) { host.innerHTML = ''; return; }

  const fields = t.fields(buildCtx());
  const dataListId = 'dl-students';

  // Universal QR field shown on every template. Kept outside the template
  // definitions so any template inherits it for free.
  const presets = state.settings.qrPresets || [];
  const presetDropdown = presets.length
    ? `<select id="fld-qrPreset" title="Load a saved QR code">
         <option value="">Saved QR...</option>
         ${presets.map((p, i) =>
           `<option value="${i}" ${p.content === state.qrText ? 'selected' : ''}>${escapeHTML(p.label)}</option>`
         ).join('')}
       </select>`
    : '';

  const universalHTML = `
    <div class="field field-universal">
      <span>QR code (optional) &mdash; URL, text, phone, etc.</span>
      <div class="row">
        ${presetDropdown}
        <input type="text" id="fld-qrText" value="${escapeHTML(state.qrText || '')}"
               placeholder="https://classroom.google.com/..." autocomplete="off" />
      </div>
      <label class="inline-check">
        <input type="checkbox" id="fld-qrShowText" ${state.qrShowText ? 'checked' : ''} />
        Print the text under the QR
        <span class="inline-hint">(uncheck to keep it a surprise)</span>
      </label>
    </div>`;

  host.innerHTML = fields.map(f => renderField(f)).join('') +
    universalHTML +
    // shared datalist for any student-picker in the form
    `<datalist id="${dataListId}">
       ${state.roster.map(s => `<option value="${escapeHTML(s.name)}"></option>`).join('')}
     </datalist>`;

  // Wire the universal QR input + preset dropdown + show-text checkbox.
  const qrInput = host.querySelector('#fld-qrText');
  const qrPresetSel = host.querySelector('#fld-qrPreset');
  if (qrInput) {
    qrInput.addEventListener('input', () => {
      state.qrText = qrInput.value;
      // Typing breaks the link to any currently-selected preset.
      if (qrPresetSel) qrPresetSel.value = '';
      renderPreview();
    });
  }
  if (qrPresetSel) {
    qrPresetSel.addEventListener('change', () => {
      const i = parseInt(qrPresetSel.value, 10);
      const preset = state.settings.qrPresets[i];
      if (preset) {
        state.qrText = preset.content;
        if (qrInput) qrInput.value = preset.content;
        renderPreview();
      }
    });
  }
  const qrShowCheck = host.querySelector('#fld-qrShowText');
  if (qrShowCheck) {
    qrShowCheck.addEventListener('change', () => {
      state.qrShowText = qrShowCheck.checked;
      renderPreview();
    });
  }

  // Wire listeners
  fields.forEach(f => {
    const input = host.querySelector(`[name="${CSS.escape(f.name)}"]`);
    if (!input) return;
    const evt = (f.type === 'textarea' || f.type === 'text' || f.type === 'number' || f.type === 'student-picker')
      ? 'input' : 'change';
    input.addEventListener(evt, () => {
      state.formData[f.name] = (f.type === 'checkbox') ? input.checked : input.value;
      // When a student name matches a known roster entry, auto-fill their class.
      if (f.type === 'student-picker') {
        const match = state.roster.find(r => r.name.toLowerCase() === input.value.trim().toLowerCase());
        if (match && match.classPeriod) {
          const classEl = host.querySelector(`[name="classPeriod"]`);
          if (classEl && !classEl.dataset.userEdited) {
            classEl.value = match.classPeriod;
            state.formData.classPeriod = match.classPeriod;
          }
        }
      }
      if (f.name === 'classPeriod') {
        input.dataset.userEdited = '1';
      }
      renderPreview();
    });
  });
}

function renderField(f) {
  // Section dividers are pure layout — no value, no listener, no name.
  // Used by the Custom template to keep its long checkbox list scannable.
  if (f.type === 'section') {
    return `<div class="form-section"><h3>${escapeHTML(f.label)}</h3></div>`;
  }

  const v = state.formData[f.name] ?? '';
  const common = `name="${f.name}" id="fld-${f.name}"`;

  // Checkbox has its own layout: checkbox first, label after, inline.
  if (f.type === 'checkbox') {
    return `
      <label class="field field-checkbox">
        <input type="checkbox" ${common} ${v ? 'checked' : ''} />
        <span>${escapeHTML(f.label)}</span>
      </label>`;
  }

  let control = '';

  switch (f.type) {
    case 'textarea':
      control = `<textarea ${common} rows="3" placeholder="${escapeHTML(f.placeholder || '')}">${escapeHTML(v)}</textarea>`;
      break;
    case 'number':
      control = `<input type="number" ${common} value="${escapeHTML(v)}" placeholder="${escapeHTML(f.placeholder || '')}" min="0" />`;
      break;
    case 'select':
      control = `<select ${common}>
        ${(f.options || []).map(o =>
          `<option value="${escapeHTML(o.value)}" ${o.value === v ? 'selected' : ''}>${escapeHTML(o.label)}</option>`
        ).join('')}
      </select>`;
      break;
    case 'class-select':
      control = `<select ${common}>
        ${state.settings.classes.map(c =>
          `<option value="${escapeHTML(c)}" ${c === v ? 'selected' : ''}>${escapeHTML(c)}</option>`
        ).join('')}
      </select>`;
      break;
    case 'student-picker':
      control = `<input type="text" ${common} list="dl-students" value="${escapeHTML(v)}" placeholder="Start typing a name..." autocomplete="off" />`;
      break;
    case 'text':
    default:
      control = `<input type="text" ${common} value="${escapeHTML(v)}" placeholder="${escapeHTML(f.placeholder || '')}" />`;
  }

  return `
    <label class="field">
      <span>${escapeHTML(f.label)}${f.required ? ' *' : ''}</span>
      ${control}
    </label>`;
}

// ---------- Preview ----------

function renderPreview() {
  const host = document.getElementById('receiptPreview');
  const t = TEMPLATES[state.templateId];
  if (!t) {
    host.innerHTML = '<div class="receipt-placeholder">Select a template on the left.</div>';
    return;
  }
  host.innerHTML = t.render(state.formData, buildCtx());
  injectQR(host);
}

function injectQR(host) {
  const text = (state.qrText || '').trim();
  if (!text) return;
  const html = makeQRHTML(text);
  if (!html) return;
  // Insert just above the tear line so the QR is always the last content,
  // but the dashed tear line still follows.
  const feed = host.querySelector('.r-feed');
  if (feed) {
    feed.insertAdjacentHTML('beforebegin', html);
  } else {
    const r = host.querySelector('.r');
    if (r) r.insertAdjacentHTML('beforeend', html);
  }
}

// makeQRHTML is used both by the universal QR field (which respects the
// user's "show text" checkbox) and by templates that want to embed their own
// QRs (e.g., the phone-confiscation template pointing to district policy).
// Templates can pass { showCaption, captionText } to override the universal
// caption behavior.
function makeQRHTML(text, opts) {
  if (typeof qrcode !== 'function') return '';    // vendor script missing
  const t = String(text || '').trim();
  if (!t) return '';
  const { showCaption, captionText } = opts || {};

  let svg = null;
  for (const level of ['M', 'L']) {
    try {
      const qr = qrcode(0, level);
      qr.addData(t);
      qr.make();
      svg = qr.createSvgTag({ scalable: true, cellSize: 2, margin: 0 });
      break;
    } catch { svg = null; }
  }
  if (!svg) return `<div class="r-msg">[QR text too long]</div>`;

  const showIt = typeof showCaption === 'boolean' ? showCaption : state.qrShowText;
  const capText = captionText != null ? captionText : t;
  const caption = showIt
    ? `<div class="r-qr-caption">${escapeHTML(capText)}</div>`
    : '';
  const note = (state.settings.qrNote || '').trim();
  const noteHTML = note ? `<div class="r-qr-note">${escapeHTML(note)}</div>` : '';
  return `<div class="r-qr">${svg}</div>${caption}${noteHTML}`;
}

// ---------- Print ----------

function printCurrent(copyLabel) {
  const t = TEMPLATES[state.templateId];
  if (!t) { alert('Pick a template first.'); return; }

  // Rebuild preview to capture latest "now" timestamp & data, then copy into print-area.
  renderPreview();
  const previewHTML = document.getElementById('receiptPreview').innerHTML;
  const printArea = document.getElementById('printArea');

  // Optional copy label (e.g., "-- TEACHER RECORD --") prepended to the receipt
  // so a template's per-variant print buttons produce visibly-different copies.
  const labelHTML = copyLabel
    ? `<div class="r-copy-note">${escapeHTML(copyLabel)}</div>`
    : '';
  printArea.innerHTML = labelHTML + previewHTML;

  const wasSerial = (typeof t.usesSerial === 'function')
    ? !!t.usesSerial(state.formData)
    : !!t.usesSerial;

  const onAfter = () => {
    window.removeEventListener('afterprint', onAfter);
    if (wasSerial) {
      state.settings.serial = (state.settings.serial || 1) + 1;
      saveSettings();
      renderPreview();   // reflect next serial
    }
    document.getElementById('printArea').innerHTML = '';
  };
  window.addEventListener('afterprint', onAfter);

  window.print();
}

function testPrint() {
  const area = document.getElementById('printArea');
  area.innerHTML = `
    <div class="r">
      <div class="r-title">ALIGNMENT TEST</div>
      <div class="r-divider">${divider('=')}</div>
      <div class="r-msg">If the line above reaches</div>
      <div class="r-msg">both edges without wrapping,</div>
      <div class="r-msg">you're calibrated.</div>
      <div class="r-divider">${divider('-')}</div>
      <div class="r-block">0        1         2         3
0123456789012345678901234567890</div>
      <div class="r-divider">${divider('=')}</div>
      <div class="r-feed"></div>
    </div>`;
  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup);
    area.innerHTML = '';
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

function shufflePreview() {
  const t = TEMPLATES[state.templateId];
  if (!t) return;
  if (typeof t.shuffle === 'function') {
    t.shuffle(state.formData);
    renderForm();         // reflect new randomized values in the form
  }
  renderPreview();
}

// ---------- Students modal ----------

function openStudents() {
  populateStudentClassOptions();
  renderRoster();
  document.getElementById('studentsModal').showModal();
}

function populateStudentClassOptions() {
  const sel = document.getElementById('studentClassInput');
  sel.innerHTML = `<option value="">(no class)</option>` +
    state.settings.classes.map(c =>
      `<option value="${escapeHTML(c)}" ${c === state.settings.defaultClass ? 'selected' : ''}>${escapeHTML(c)}</option>`
    ).join('');
}

function renderRoster() {
  const list = document.getElementById('rosterList');
  document.getElementById('rosterCount').textContent = state.roster.length;
  if (!state.roster.length) {
    list.innerHTML = `<li class="roster-class" style="justify-content:center;">No students yet.</li>`;
    return;
  }
  // Sort by name for stable display
  const sorted = [...state.roster].sort((a, b) => a.name.localeCompare(b.name));
  list.innerHTML = sorted.map((s, i) => {
    const idx = state.roster.indexOf(s);
    return `
      <li>
        <span>${escapeHTML(s.name)}${s.classPeriod ? ` <span class="roster-class">(${escapeHTML(s.classPeriod)})</span>` : ''}</span>
        <button type="button" data-idx="${idx}">Remove</button>
      </li>`;
  }).join('');
  list.querySelectorAll('button[data-idx]').forEach(b => {
    b.addEventListener('click', () => {
      state.roster.splice(parseInt(b.dataset.idx, 10), 1);
      saveRoster();
      renderRoster();
      renderForm();  // refresh datalist
    });
  });
}

function addStudentFromInputs() {
  const name = document.getElementById('studentNameInput').value.trim();
  if (!name) return;
  const classPeriod = document.getElementById('studentClassInput').value;
  addOrUpdateStudent(name, classPeriod);
  document.getElementById('studentNameInput').value = '';
  renderRoster();
  renderForm();
}

function addOrUpdateStudent(name, classPeriod) {
  const existing = state.roster.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (classPeriod) existing.classPeriod = classPeriod;
  } else {
    state.roster.push({ name, classPeriod: classPeriod || '' });
  }
  saveRoster();
}

function bulkImport() {
  const raw = document.getElementById('studentBulkInput').value;
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let added = 0;
  for (const line of lines) {
    // Allow "Name, Class" or just "Name"
    const [namePart, classPart] = line.split(/\s*,\s*/);
    if (!namePart) continue;
    addOrUpdateStudent(namePart, classPart || '');
    added++;
  }
  document.getElementById('studentBulkInput').value = '';
  renderRoster();
  renderForm();
  if (added) {
    // brief inline signal — flash the count
    const c = document.getElementById('rosterCount');
    c.style.transition = 'color 0.4s';
    c.style.color = '#1d7874';
    setTimeout(() => { c.style.color = ''; }, 700);
  }
}

function clearRoster() {
  if (!state.roster.length) return;
  if (!confirm(`Remove all ${state.roster.length} students?`)) return;
  state.roster = [];
  saveRoster();
  renderRoster();
  renderForm();
}

// ---------- Settings modal ----------

function openSettings() {
  const s = state.settings;
  document.getElementById('settingsTeacher').value              = s.teacher;
  document.getElementById('settingsSchoolName').value           = s.schoolName;
  document.getElementById('settingsRoom').value                 = s.room;
  document.getElementById('settingsEmail').value                = s.contactEmail;
  document.getElementById('settingsFooter').value               = s.footerText;
  document.getElementById('settingsClasses').value              = s.classes.join('\n');
  document.getElementById('settingsExpiry').value               = s.expiryLabel;
  document.getElementById('settingsSerial').value               = s.serial;
  document.getElementById('settingsQRPresets').value            = formatQRPresets(s.qrPresets);
  document.getElementById('settingsQRNote').value               = s.qrNote;
  document.getElementById('settingsPhonePolicy').value          = s.phonePolicyText;
  document.getElementById('settingsPhoneEscalationLabel').value = s.phoneEscalationLabel;
  document.getElementById('settingsPhoneEscalation').value      = s.phoneEscalationText;
  document.getElementById('settingsPhonePickup').value          = s.phonePickupDefault;
  renderLogoList();
  populateLogoDropdown();
  refreshDefaultClassDropdown();
  document.getElementById('settingsModal').showModal();
}

function populateLogoDropdown() {
  const sel = document.getElementById('settingsLogo');
  const options = getLogoOptions();
  const current = state.settings.logoFile;
  // Preserve the current selection even if no preset defines it — prevents
  // silent data loss when the user hasn't yet set up logo presets.
  if (current && !options.some(l => l.file === current)) {
    options.unshift({ file: current, label: `${current} (no preset)` });
  }
  sel.innerHTML = options.map(l =>
    `<option value="${escapeHTML(l.file)}" ${l.file === current ? 'selected' : ''}>${escapeHTML(l.label)}</option>`
  ).join('');
}

// Reads an uploaded image file, auto-resizes it to keep localStorage lean,
// and returns a data URL (embeddable in an <img src="">). Max dimension
// default is 800px — plenty for an 80mm thermal receipt, keeps storage small.
function readFileAsResizedDataURL(file, maxDim = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not a valid image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = maxDim / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        resolve(canvas.toDataURL(mime, 0.92));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function addLogoFromInputs() {
  const label = document.getElementById('newLogoLabel').value.trim();
  const width = document.getElementById('newLogoWidth').value.trim() || '28mm';
  const fileInput = document.getElementById('newLogoFile');
  const file = fileInput.files && fileInput.files[0];

  if (!label) { alert('Enter a name for this logo.'); return; }
  if (!file)  { alert('Choose an image file to upload.'); return; }

  let src;
  try {
    src = await readFileAsResizedDataURL(file);
  } catch (err) {
    alert(`Couldn't read that image: ${err.message}`);
    return;
  }

  state.settings.logoPresets = state.settings.logoPresets || [];
  state.settings.logoPresets.push({ label, file: src, width });

  // If this is the first logo, make it active automatically.
  if (!state.settings.logoFile) state.settings.logoFile = src;

  try {
    saveSettings();
  } catch (err) {
    // localStorage quota — pop the just-added logo and tell the user.
    state.settings.logoPresets.pop();
    alert(`Couldn't save — probably localStorage is full. Try a smaller image or delete an existing logo first.\n\n(${err.message})`);
    return;
  }

  // Reset the upload inputs so the next add starts fresh.
  document.getElementById('newLogoLabel').value = '';
  document.getElementById('newLogoWidth').value = '28mm';
  fileInput.value = '';

  renderLogoList();
  populateLogoDropdown();
  renderPreview();
}

function renderLogoList() {
  const ul = document.getElementById('logoList');
  const presets = state.settings.logoPresets || [];
  if (!presets.length) {
    ul.innerHTML = '<li class="empty">No logos yet — add one above.</li>';
    return;
  }
  ul.innerHTML = presets.map((p, i) => `
    <li>
      <img src="${escapeHTML(p.file)}" alt="" />
      <span class="logo-label">${escapeHTML(p.label)} <small>(${escapeHTML(p.width || '28mm')})</small></span>
      <button type="button" data-idx="${i}">Remove</button>
    </li>
  `).join('');
  ul.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => removeLogo(parseInt(btn.dataset.idx, 10)));
  });
}

function removeLogo(i) {
  const presets = state.settings.logoPresets || [];
  const removed = presets.splice(i, 1)[0];
  // If the active logo was the one we removed, clear the active selection.
  if (removed && state.settings.logoFile === removed.file) {
    state.settings.logoFile = '';
  }
  saveSettings();
  renderLogoList();
  populateLogoDropdown();
  renderPreview();
}

function refreshDefaultClassDropdown() {
  const sel = document.getElementById('settingsDefaultClass');
  sel.innerHTML = state.settings.classes.map(c =>
    `<option value="${escapeHTML(c)}" ${c === state.settings.defaultClass ? 'selected' : ''}>${escapeHTML(c)}</option>`
  ).join('');
}

function commitSettingsFromInputs() {
  const S = state.settings;
  S.teacher      = document.getElementById('settingsTeacher').value.trim() || DEFAULT_SETTINGS.teacher;
  S.schoolName   = document.getElementById('settingsSchoolName').value.trim();
  S.footerText   = document.getElementById('settingsFooter').value;  // allow empty to hide footer line
  S.room         = document.getElementById('settingsRoom').value.trim();
  S.contactEmail = document.getElementById('settingsEmail').value.trim();

  const classes = document.getElementById('settingsClasses').value
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  S.classes = classes.length ? classes : DEFAULT_SETTINGS.classes.slice();
  if (!S.classes.includes(S.defaultClass)) {
    S.defaultClass = S.classes[0];
  }
  S.defaultClass = document.getElementById('settingsDefaultClass').value || S.defaultClass;
  S.expiryLabel  = document.getElementById('settingsExpiry').value.trim() || DEFAULT_SETTINGS.expiryLabel;

  const serial = parseInt(document.getElementById('settingsSerial').value, 10);
  if (!isNaN(serial) && serial >= 0) S.serial = serial;

  // logoPresets is managed directly by the upload UI (add/remove save immediately).
  S.logoFile    = document.getElementById('settingsLogo').value;
  S.qrPresets   = parseQRPresets(document.getElementById('settingsQRPresets').value);
  S.qrNote      = document.getElementById('settingsQRNote').value;

  S.phonePolicyText      = document.getElementById('settingsPhonePolicy').value;
  S.phoneEscalationLabel = document.getElementById('settingsPhoneEscalationLabel').value.trim() || DEFAULT_SETTINGS.phoneEscalationLabel;
  S.phoneEscalationText  = document.getElementById('settingsPhoneEscalation').value;
  S.phonePickupDefault   = document.getElementById('settingsPhonePickup').value;

  saveSettings();
  updateBrandSubtitle();
}

// ---------- Wire everything up ----------

function wire() {
  updateBrandSubtitle();
  renderTemplatePicker();

  // Default to first template so the app feels alive on first open
  selectTemplate(TEMPLATE_ORDER[0]);

  document.getElementById('btnTestPrint').addEventListener('click', testPrint);
  document.getElementById('btnShuffle').addEventListener('click', shufflePreview);

  document.getElementById('btnStudents').addEventListener('click', openStudents);
  document.getElementById('btnSettings').addEventListener('click', openSettings);

  document.getElementById('btnAddStudent').addEventListener('click', addStudentFromInputs);
  document.getElementById('studentNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addStudentFromInputs(); }
  });
  document.getElementById('btnBulkAdd').addEventListener('click', bulkImport);
  document.getElementById('btnClearRoster').addEventListener('click', clearRoster);

  document.getElementById('btnResetSerial').addEventListener('click', () => {
    document.getElementById('settingsSerial').value = '1';
  });

  document.getElementById('btnAddLogo').addEventListener('click', addLogoFromInputs);

  // When the settings classes textarea changes, refresh the default-class dropdown live.
  document.getElementById('settingsClasses').addEventListener('input', () => {
    const classes = document.getElementById('settingsClasses').value
      .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const current = document.getElementById('settingsDefaultClass').value;
    const sel = document.getElementById('settingsDefaultClass');
    sel.innerHTML = classes.map(c =>
      `<option value="${escapeHTML(c)}" ${c === current ? 'selected' : ''}>${escapeHTML(c)}</option>`
    ).join('');
  });

  // On settings dialog close, commit changes and re-render form (class dropdown, etc.)
  document.getElementById('settingsModal').addEventListener('close', () => {
    commitSettingsFromInputs();
    renderForm();
    renderPreview();
  });

  // Ctrl/Cmd+P fires the template's first print button (not the browser page).
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      const firstBtn = document.querySelector('#actions .print-btn');
      if (firstBtn) firstBtn.click();
    }
  });
}

document.addEventListener('DOMContentLoaded', wire);
