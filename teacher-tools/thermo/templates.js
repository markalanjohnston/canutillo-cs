/* =========================================================
   Templates for Thermo. Each template defines:
     - metadata for the picker
     - form fields for the UI
     - defaults (optional, can read from settings/roster)
     - render(data, ctx) -> HTML string (receipt body)
     - usesSerial: if true, printing bumps the serial counter

   ctx is provided by app.js and contains:
     settings : { teacher, classes[], defaultClass, expiryLabel, serial }
     now      : Date
     escape(s): HTML-escape helper
     fmtDate(d), fmtTime(d), fmtDateTime(d)
     divider(char?), rule()  : visual horizontal rules (ASCII)
     pad4(n)                 : zero-pad serial number to 4 digits
   ========================================================= */

const ENCOURAGEMENTS = [
  "You're crushing it!",
  "Keep it up!",
  "Nailed it.",
  "Absolutely stellar.",
  "Big brain energy.",
  "Clean work.",
  "That was a power move.",
  "Proud of you.",
  "First-ballot hall of famer.",
  "Peak Computer Science vibes.",
  "10/10 no notes.",
  "This is the way.",
  "Certified problem-solver.",
  "Top of the class today.",
  "You made that look easy."
];

function randomEncouragement() {
  return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
}

/* Different tone from ENCOURAGEMENTS: aimed at a struggling student
   ("you can do this") rather than celebrating one who succeeded
   ("you crushed it"). Used by the encourage template. */
const ENCOURAGE_MESSAGES = [
  "Don't give up — you can do this!",
  "I have faith in you!",
  "Keep going — you're closer than you think.",
  "One step at a time.",
  "Mistakes mean you're learning.",
  "Be patient with yourself.",
  "Trust the process.",
  "Hard things take time.",
  "Take a breath, then try again.",
  "I'm rooting for you.",
  "Your effort matters more than the answer.",
  "Future-you will thank present-you.",
  "Progress, not perfection.",
  "You've got more in you than you think.",
  "Struggling means you're stretching.",
  "Every expert was once a beginner.",
  "You belong here.",
  "It's okay to ask for help."
];

function randomEncourageMsg() {
  return ENCOURAGE_MESSAGES[Math.floor(Math.random() * ENCOURAGE_MESSAGES.length)];
}

/* ASCII art library for the encourage template.
   All pieces sit under ~16 chars wide so the parent .r-ascii block
   stays well within the 28-char receipt width when centered. */
const ENCOURAGE_ART = {
  none: '',

  star: [
    "   .    .    .",
    "     \\  *  /",
    "   *  \\ * /  *",
    "  ---  ***  ---",
    "   *  / * \\  *",
    "     /  *  \\",
    "   .    .    ."
  ].join('\n'),

  smile: [
    "   .--------.",
    "  /          \\",
    " |   o    o   |",
    " |     __     |",
    "  \\   \\__/   /",
    "   '--------'"
  ].join('\n'),

  mountain: [
    "        /\\",
    "       /  \\",
    "      /    \\",
    "     /  /\\  \\",
    "    /  /  \\  \\",
    "   /__/____\\__\\"
  ].join('\n'),

  rocket: [
    "       /\\",
    "      /  \\",
    "     |    |",
    "     |[##]|",
    "     |    |",
    "    /|    |\\",
    "   / |____| \\",
    "      /\\/\\",
    "     /\\/\\/\\"
  ].join('\n'),

  robot: [
    "   .---------.",
    "   | [o] [o] |",
    "   |    -    |",
    "   |  \\___/  |",
    "   '----+----'",
    "       _|_",
    "      |   |"
  ].join('\n'),

  thumbs: [
    "        __",
    "       |  |",
    "       |  |",
    "    ___|  |",
    "   |      |",
    "   |  ()  |",
    "   |______|"
  ].join('\n'),

  trophy: [
    "    .-------.",
    "   (         )",
    "    \\   *   /",
    "     \\_____/",
    "       | |",
    "      _| |_",
    "     |_____|"
  ].join('\n'),

  flame: [
    "       ()",
    "      (  )",
    "     ( () )",
    "    (  ()  )",
    "     \\    /",
    "      \\  /",
    "       \\/"
  ].join('\n')
};

const TEMPLATES = {

  /* -------------------- 1. Praise / Awesome (unified) ---- */
  praise: {
    id: 'praise',
    label: 'Good Job / Awesome',
    sub: 'Quick praise, or a formal "caught being awesome" ticket.',
    // Bump serial only when the user opted in to a ticket number on this print.
    usesSerial: (data) => data.includeTicket === true,

    fields: (ctx) => ([
      { name: 'title',       label: 'Title', type: 'select',
        options: [
          { value: 'GOOD JOB!',             label: 'GOOD JOB!' },
          { value: 'CAUGHT BEING AWESOME!', label: 'CAUGHT BEING AWESOME!' },
          { value: 'NICE WORK!',            label: 'NICE WORK!' },
          { value: 'KUDOS!',                label: 'KUDOS!' },
          { value: 'CRUSHED IT!',           label: 'CRUSHED IT!' }
        ],
        default: 'GOOD JOB!' },
      { name: 'student',     label: 'Student',       type: 'student-picker', required: true },
      { name: 'classPeriod', label: 'Class',         type: 'class-select' },
      { name: 'message',     label: 'Short message', type: 'text',
        default: randomEncouragement(),
        placeholder: 'One-line encouragement' },
      { name: 'reason',      label: 'What they did (optional, longer)', type: 'textarea',
        placeholder: 'helped a classmate debug without being asked' },
      { name: 'includeMessage', label: 'Print short message', type: 'checkbox', default: true },
      { name: 'includeClass',   label: 'Print class period',  type: 'checkbox', default: true },
      { name: 'includeTicket',  label: 'Print ticket number (formal)', type: 'checkbox', default: false }
    ]),

    shuffle: (data) => {
      data.message = randomEncouragement();
      return data;
    },

    render: (data, ctx) => {
      const e = ctx.escape;
      const name = (data.student || '').trim().toUpperCase() || '(student)';
      const title = data.title || 'GOOD JOB!';
      return `
        <div class="r">
          ${ctx.logo}
          <div class="r-divider">${ctx.divider('*')}</div>
          <div class="r-title">${e(title)}</div>
          <div class="r-divider">${ctx.divider('*')}</div>
          <div class="r-name">* ${e(name)} *</div>
          ${(data.includeClass !== false && data.classPeriod)
            ? `<div class="r-msg">${e(data.classPeriod)}</div>` : ''}
          ${(data.includeMessage !== false && data.message)
            ? `<div class="r-msg">${e(data.message)}</div>` : ''}
          ${data.reason ? `<div class="r-block">${e(data.reason)}</div>` : ''}
          <div class="r-divider">${ctx.divider('-')}</div>
          ${data.includeTicket === true
            ? `<div class="r-serial">TICKET #${ctx.pad4(ctx.settings.serial)}</div>` : ''}
          <div class="r-footer">
            <div>${e(ctx.fmtDateTime(ctx.now))}</div>
            <div class="r-sig">${e(ctx.settings.teacher)}</div>
            ${ctx.footer}
          </div>
          <div class="r-feed"></div>
        </div>`;
    }
  },

  /* -------------------- 2. Encourage --------------------- */
  encourage: {
    id: 'encourage',
    label: 'Encouragement',
    sub: '"Don\'t give up" — for a student who needs a boost.',
    usesSerial: false,

    fields: (ctx) => ([
      { name: 'title', label: 'Title', type: 'select',
        options: [
          { value: "DON'T GIVE UP!",     label: "DON'T GIVE UP!" },
          { value: 'YOU CAN DO THIS!',   label: 'YOU CAN DO THIS!' },
          { value: 'I BELIEVE IN YOU!',  label: 'I BELIEVE IN YOU!' },
          { value: 'KEEP GOING!',        label: 'KEEP GOING!' },
          { value: 'ALMOST THERE!',      label: 'ALMOST THERE!' },
          { value: 'TAKE A BREATH',      label: 'TAKE A BREATH' }
        ],
        default: "DON'T GIVE UP!" },
      { name: 'student',     label: 'Student',    type: 'student-picker', required: true },
      { name: 'classPeriod', label: 'Class',      type: 'class-select' },
      { name: 'art',         label: 'ASCII art',  type: 'select',
        options: [
          { value: 'none',     label: '(none)' },
          { value: 'star',     label: 'Star burst' },
          { value: 'smile',    label: 'Smiley face' },
          { value: 'mountain', label: 'Mountain (climb it)' },
          { value: 'rocket',   label: 'Rocket (going places)' },
          { value: 'robot',    label: 'Robot pal' },
          { value: 'thumbs',   label: 'Thumbs up' },
          { value: 'trophy',   label: 'Trophy' },
          { value: 'flame',    label: 'Flame (keep your fire)' }
        ],
        default: 'star' },
      { name: 'message', label: 'Short message', type: 'text',
        default: randomEncourageMsg(),
        placeholder: 'One-line encouragement' },
      { name: 'reason', label: "What I've noticed you doing well (optional, longer)", type: 'textarea',
        placeholder: 'showing up every day; asking good questions; not quitting on the last one' },
      { name: 'includeMessage', label: 'Print short message', type: 'checkbox', default: true },
      { name: 'includeClass',   label: 'Print class period',  type: 'checkbox', default: true }
    ]),

    shuffle: (data) => {
      data.message = randomEncourageMsg();
      // Skip the 'none' option when shuffling so you always get art.
      const artKeys = Object.keys(ENCOURAGE_ART).filter(k => k !== 'none');
      data.art = artKeys[Math.floor(Math.random() * artKeys.length)];
      return data;
    },

    render: (data, ctx) => {
      const e = ctx.escape;
      const name = (data.student || '').trim().toUpperCase() || '(student)';
      const title = data.title || "DON'T GIVE UP!";
      const art = ENCOURAGE_ART[data.art || 'star'] || '';
      return `
        <div class="r">
          ${ctx.logo}
          <div class="r-divider">${ctx.divider('*')}</div>
          <div class="r-title">${e(title)}</div>
          <div class="r-divider">${ctx.divider('*')}</div>
          ${art ? `<div class="r-ascii"><pre>${e(art)}</pre></div>` : ''}
          <div class="r-name">${e(name)}</div>
          ${(data.includeClass !== false && data.classPeriod)
            ? `<div class="r-msg">${e(data.classPeriod)}</div>` : ''}
          ${(data.includeMessage !== false && data.message)
            ? `<div class="r-msg">${e(data.message)}</div>` : ''}
          ${data.reason ? `<div class="r-block">${e(data.reason)}</div>` : ''}
          <div class="r-divider">${ctx.divider('-')}</div>
          <div class="r-footer">
            <div>${e(ctx.fmtDateTime(ctx.now))}</div>
            <div class="r-sig">${e(ctx.settings.teacher)}</div>
            ${ctx.footer}
          </div>
          <div class="r-feed"></div>
        </div>`;
    }
  },

  /* -------------------- 3. Pass -------------------------- */
  pass: {
    id: 'pass',
    label: 'Pass',
    sub: 'Advisory / hall / restroom pass with timestamp.',
    usesSerial: false,

    fields: (ctx) => ([
      { name: 'passType',    label: 'Pass type', type: 'select',
        options: [
          { value: 'advisory', label: 'Advisory (to my room)' },
          { value: 'hall',     label: 'Hall pass (destination)' },
          { value: 'restroom', label: 'Restroom' }
        ],
        default: 'advisory' },
      { name: 'student',     label: 'Student',       type: 'student-picker', required: true },
      { name: 'classPeriod', label: 'Class',         type: 'class-select' },
      { name: 'destination', label: 'Destination (hall pass only)', type: 'text',
        placeholder: 'Library, Nurse, Room 204, ...' },
      { name: 'validMinutes',label: 'Valid for (minutes, optional)', type: 'number',
        placeholder: '10' },
      { name: 'freeNote',    label: 'Note (optional)', type: 'textarea' }
    ]),

    render: (data, ctx) => {
      const e = ctx.escape;
      const type = data.passType || 'advisory';
      const name = (data.student || '').trim() || '(student)';
      const teacher = ctx.settings.teacher;

      const title = {
        advisory: 'ADVISORY PASS',
        hall:     'HALL PASS',
        restroom: 'RESTROOM PASS'
      }[type];

      // Body sentence per pass type
      let body = '';
      if (type === 'advisory') {
        body = `I approve of ${name} spending this Advisory period in ${teacher}'s room.`;
      } else if (type === 'hall') {
        const dest = (data.destination || '').trim() || '(destination)';
        body = `${name} has permission to leave ${data.classPeriod || 'class'} to go to ${dest}.`;
      } else {
        body = `${name} has permission to use the restroom.`;
      }

      // Valid-until line
      let validLine = '';
      const mins = parseInt(data.validMinutes, 10);
      if (!isNaN(mins) && mins > 0) {
        const until = new Date(ctx.now.getTime() + mins * 60000);
        validLine = `Valid for ${mins} min (until ${ctx.fmtTime(until)})`;
      }

      return `
        <div class="r">
          ${ctx.logo}
          <div class="r-title">${e(title)}</div>
          <div class="r-divider">${ctx.divider('=')}</div>
          <div class="r-kv"><b>Student:</b> <span>${e(name)}</span></div>
          ${data.classPeriod ? `<div class="r-kv"><b>Class:</b> <span>${e(data.classPeriod)}</span></div>` : ''}
          <div class="r-kv"><b>Issued:</b> <span>${e(ctx.fmtDateTime(ctx.now))}</span></div>
          ${validLine ? `<div class="r-kv"><b>Valid:</b> <span>${e(validLine)}</span></div>` : ''}
          <div class="r-divider">${ctx.divider('-')}</div>
          <div class="r-block">${e(body)}</div>
          ${data.freeNote ? `<div class="r-block">${e(data.freeNote)}</div>` : ''}
          <div class="r-divider">${ctx.divider('-')}</div>
          <div class="r-sig">${e(teacher)}</div>
          ${ctx.footer}
          <div class="r-feed"></div>
        </div>`;
    }
  },

  /* -------------------- 4. Homework pass coupon ---------- */
  homework: {
    id: 'homework',
    label: 'Late Homework Pass',
    sub: 'Coupon-style "good for one late assignment".',
    usesSerial: true,

    fields: (ctx) => ([
      { name: 'student',     label: 'Student', type: 'student-picker', required: true },
      { name: 'classPeriod', label: 'Class',   type: 'class-select' },
      { name: 'expiry',      label: 'Expires', type: 'text',
        default: ctx.settings.expiryLabel }
    ]),

    render: (data, ctx) => {
      const e = ctx.escape;
      const name = (data.student || '').trim().toUpperCase() || '(student)';
      return `
        <div class="r">
          ${ctx.logo}
          <div class="r-title">LATE HOMEWORK PASS</div>
          <div class="r-coupon">
            <div class="r-msg"><b>GOOD FOR ONE (1)</b></div>
            <div class="r-msg"><b>LATE ASSIGNMENT</b></div>
            <div class="r-name">${e(name)}</div>
            ${data.classPeriod ? `<div class="r-msg">${e(data.classPeriod)}</div>` : ''}
            <div class="r-divider">${ctx.divider('-')}</div>
            <div class="r-kv"><b>Issued:</b>  <span>${e(ctx.fmtDate(ctx.now))}</span></div>
            <div class="r-kv"><b>Expires:</b> <span>${e(data.expiry || ctx.settings.expiryLabel)}</span></div>
            <div class="r-kv"><b>Coupon:</b>  <span>#${ctx.pad4(ctx.settings.serial)}</span></div>
            <div class="r-sig">${e(ctx.settings.teacher)}</div>
          </div>
          ${ctx.footer}
          <div class="r-feed"></div>
        </div>`;
    }
  }
};

/* -------------------- 6. Custom (kitchen sink) ---------- */
TEMPLATES.custom = {
  id: 'custom',
  label: 'Custom',
  sub: 'Mix-and-match any pieces from the other templates.',
  // Only burns a serial if the user opted into a serial number on this print.
  usesSerial: (data) => data.includeSerial === true,

  fields: (ctx) => ([
    { type: 'section', label: 'Title' },
    { name: 'title',             label: 'Title text',                 type: 'text',     default: 'NOTICE' },
    { name: 'titleStarBorders',  label: 'Star dividers around title', type: 'checkbox', default: true },

    { type: 'section', label: 'Who' },
    { name: 'includeStudent', label: 'Print student name',  type: 'checkbox', default: true },
    { name: 'student',        label: 'Student',             type: 'student-picker' },
    { name: 'studentBig',     label: 'Display name BIG (centered, large)', type: 'checkbox', default: true },
    { name: 'includeClass',   label: 'Print class period',  type: 'checkbox', default: true },
    { name: 'classPeriod',    label: 'Class',               type: 'class-select' },

    { type: 'section', label: 'When' },
    { name: 'dateMode', label: 'Date / time', type: 'select',
      options: [
        { value: 'none',     label: 'Neither' },
        { value: 'date',     label: 'Date only' },
        { value: 'time',     label: 'Time only' },
        { value: 'datetime', label: 'Date + time' }
      ],
      default: 'datetime' },
    { name: 'dateStyle', label: 'Style', type: 'select',
      options: [
        { value: 'centered', label: 'Centered line' },
        { value: 'kv',       label: 'Key-value rows (Date: ..., Time: ...)' }
      ],
      default: 'centered' },

    { type: 'section', label: 'Message / body' },
    { name: 'shortMessage', label: 'Short message (centered, one line)', type: 'text',
      placeholder: 'e.g., Keep it up!' },
    { name: 'bodyText',     label: 'Body / long text (left-aligned block)', type: 'textarea',
      placeholder: 'A longer paragraph, e.g., a pass body sentence.' },

    { type: 'section', label: 'Detail rows' },
    { name: 'includeDestination', label: 'Print "Destination: ..."', type: 'checkbox' },
    { name: 'destination',        label: 'Destination',              type: 'text',
      placeholder: 'Library, Nurse, Room 204, ...' },
    { name: 'includeValid',       label: 'Print "Valid for X minutes"', type: 'checkbox' },
    { name: 'validMinutes',       label: 'Minutes', type: 'number', placeholder: '10' },
    { name: 'includeDevice',      label: 'Print "Device: ..."', type: 'checkbox' },
    { name: 'device',             label: 'Device', type: 'text', placeholder: 'Cell phone' },

    { type: 'section', label: 'Coupon block (dashed border)' },
    { name: 'includeCoupon', label: 'Wrap content in a coupon block', type: 'checkbox' },
    { name: 'couponLine1',   label: 'Coupon line 1', type: 'text', default: 'GOOD FOR ONE (1)' },
    { name: 'couponLine2',   label: 'Coupon line 2', type: 'text', default: 'LATE ASSIGNMENT' },
    { name: 'includeExpiry', label: 'Print expiry date', type: 'checkbox' },
    { name: 'expiry',        label: 'Expiry text', type: 'text', default: ctx.settings.expiryLabel },

    { type: 'section', label: 'Long sectioned blocks' },
    { name: 'includePickup', label: 'Print PICKUP block', type: 'checkbox' },
    { name: 'pickupLabel',   label: 'Section label', type: 'text', default: 'PICKUP' },
    { name: 'pickupText',    label: 'Body text', type: 'textarea',
      default: '' },
    { name: 'includePolicy', label: 'Print POLICY block', type: 'checkbox' },
    { name: 'policyLabel',   label: 'Section label', type: 'text', default: 'POLICY' },
    { name: 'policyText',    label: 'Body text', type: 'textarea',
      default: '' },
    { name: 'includeEscalation', label: 'Print ESCALATION block', type: 'checkbox' },
    { name: 'escalationLabel',   label: 'Section label', type: 'text',
      default: 'ESCALATION' },
    { name: 'escalationText',    label: 'Body text', type: 'textarea',
      default: '' },

    { type: 'section', label: 'Closing' },
    { name: 'includeSignatureLine', label: 'Print blank signature line', type: 'checkbox' },
    { name: 'signatureLabel',       label: 'Signature label', type: 'text', default: 'Student signature:' },
    { name: 'includeSerial', label: 'Print serial / record number', type: 'checkbox' },
    { name: 'serialLabel',   label: 'Serial label', type: 'text', default: 'TICKET' },
    { name: 'includeTeacher',         label: 'Print teacher signature', type: 'checkbox', default: true },
    { name: 'includeClosingDivider',  label: 'Print "===" divider above closing', type: 'checkbox', default: true }
  ]),

  render: (data, ctx) => {
    const e = ctx.escape;
    const out = [];

    // Header logo (always available — pulls from settings if set)
    if (ctx.logo) out.push(ctx.logo);

    // Title block
    if (data.titleStarBorders) out.push(`<div class="r-divider">${ctx.divider('*')}</div>`);
    if (data.title && data.title.trim()) {
      out.push(`<div class="r-title">${e(data.title)}</div>`);
    }
    if (data.titleStarBorders) out.push(`<div class="r-divider">${ctx.divider('*')}</div>`);

    // Recipient
    const showStudent = data.includeStudent !== false && data.student && data.student.trim();
    const showClass   = data.includeClass   !== false && data.classPeriod;
    if (showStudent) {
      const name = data.student.trim();
      if (data.studentBig) {
        out.push(`<div class="r-name">${e(name.toUpperCase())}</div>`);
      } else {
        out.push(`<div class="r-kv"><b>Student:</b> <span>${e(name)}</span></div>`);
      }
    }
    if (showClass) {
      // If we displayed the name BIG, follow with a centered class line; otherwise key-value.
      if (data.studentBig && showStudent) {
        out.push(`<div class="r-msg">${e(data.classPeriod)}</div>`);
      } else {
        out.push(`<div class="r-kv"><b>Class:</b> <span>${e(data.classPeriod)}</span></div>`);
      }
    }

    // Date / time
    const mode  = data.dateMode  || 'datetime';
    const style = data.dateStyle || 'centered';
    if (mode !== 'none') {
      const date = ctx.fmtDate(ctx.now);
      const time = ctx.fmtTime(ctx.now);
      const dt   = ctx.fmtDateTime(ctx.now);
      if (style === 'kv') {
        if (mode === 'date' || mode === 'datetime') {
          out.push(`<div class="r-kv"><b>Date:</b> <span>${e(date)}</span></div>`);
        }
        if (mode === 'time' || mode === 'datetime') {
          out.push(`<div class="r-kv"><b>Time:</b> <span>${e(time)}</span></div>`);
        }
      } else {
        const text = mode === 'date' ? date : mode === 'time' ? time : dt;
        out.push(`<div class="r-msg">${e(text)}</div>`);
      }
    }

    // Message + body
    if (data.shortMessage && data.shortMessage.trim()) {
      out.push(`<div class="r-msg">${e(data.shortMessage)}</div>`);
    }
    if (data.bodyText && data.bodyText.trim()) {
      out.push(`<div class="r-block">${e(data.bodyText)}</div>`);
    }

    // Detail key/value rows
    const details = [];
    if (data.includeDestination && data.destination && data.destination.trim()) {
      details.push(`<div class="r-kv"><b>Destination:</b> <span>${e(data.destination)}</span></div>`);
    }
    if (data.includeValid) {
      const mins = parseInt(data.validMinutes, 10);
      if (!isNaN(mins) && mins > 0) {
        const until = new Date(ctx.now.getTime() + mins * 60000);
        details.push(`<div class="r-kv"><b>Valid:</b> <span>${e(`${mins} min (until ${ctx.fmtTime(until)})`)}</span></div>`);
      }
    }
    if (data.includeDevice && data.device && data.device.trim()) {
      details.push(`<div class="r-kv"><b>Device:</b> <span>${e(data.device)}</span></div>`);
    }
    if (details.length) {
      out.push(`<div class="r-divider">${ctx.divider('-')}</div>`);
      out.push(...details);
    }

    // Coupon block (wraps lines + optional expiry in a dashed border)
    if (data.includeCoupon) {
      const couponBits = [];
      if (data.couponLine1 && data.couponLine1.trim()) {
        couponBits.push(`<div class="r-msg"><b>${e(data.couponLine1)}</b></div>`);
      }
      if (data.couponLine2 && data.couponLine2.trim()) {
        couponBits.push(`<div class="r-msg"><b>${e(data.couponLine2)}</b></div>`);
      }
      if (data.includeExpiry && data.expiry && data.expiry.trim()) {
        couponBits.push(`<div class="r-kv"><b>Expires:</b> <span>${e(data.expiry)}</span></div>`);
      }
      if (couponBits.length) {
        out.push(`<div class="r-coupon">${couponBits.join('')}</div>`);
      }
    } else if (data.includeExpiry && data.expiry && data.expiry.trim()) {
      // Expiry alone, not wrapped in a coupon
      out.push(`<div class="r-kv"><b>Expires:</b> <span>${e(data.expiry)}</span></div>`);
    }

    // Long sectioned text blocks (-- LABEL -- followed by body)
    const sectionBlock = (label, body) => {
      const l = (label || '').trim();
      const b = (body  || '').trim();
      if (!b) return;
      out.push(`<div class="r-divider">${ctx.divider('-')}</div>`);
      if (l) out.push(`<div class="r-msg">--- ${e(l)} ---</div>`);
      out.push(`<div class="r-block">${e(b)}</div>`);
    };
    if (data.includePickup)     sectionBlock(data.pickupLabel,     data.pickupText);
    if (data.includePolicy)     sectionBlock(data.policyLabel,     data.policyText);
    if (data.includeEscalation) sectionBlock(data.escalationLabel, data.escalationText);

    // Blank signature line
    if (data.includeSignatureLine) {
      out.push(`<div class="r-divider">${ctx.divider('-')}</div>`);
      const lbl = (data.signatureLabel || '').trim();
      if (lbl) out.push(`<div class="r-msg">${e(lbl)}</div>`);
      out.push(`<div class="r-msg">${'_'.repeat(28)}</div>`);
    }

    // Serial number
    if (data.includeSerial) {
      const lbl = (data.serialLabel || 'TICKET').trim().toUpperCase();
      out.push(`<div class="r-divider">${ctx.divider('-')}</div>`);
      out.push(`<div class="r-serial">${e(lbl)} #${ctx.pad4(ctx.settings.serial)}</div>`);
    }

    // Closing — divider, teacher sig, footer line from settings
    const showTeacher = data.includeTeacher !== false;
    const hasClosing  = showTeacher || (ctx.footer && ctx.footer.trim());
    if (hasClosing) {
      if (data.includeClosingDivider !== false) {
        out.push(`<div class="r-divider">${ctx.divider('=')}</div>`);
      }
      if (showTeacher) {
        out.push(`<div class="r-sig">${e(ctx.settings.teacher)}</div>`);
      }
      if (ctx.footer) out.push(ctx.footer);
    }

    out.push(`<div class="r-feed"></div>`);
    return `<div class="r">${out.filter(Boolean).join('')}</div>`;
  }
};

const TEMPLATE_ORDER = ['praise', 'encourage', 'pass', 'homework', 'custom'];
