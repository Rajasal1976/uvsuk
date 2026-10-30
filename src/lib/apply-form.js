// Online application form engine. The questions come from src/data/applications.js.
import { readPassport, warmUp } from './passport-ocr.js';
import { countries, commonCountries } from '../data/countries.js';

const MAX_TOTAL = 7.5 * 1024 * 1024; // Netlify Forms accepts up to 8 MB per submission
const MAX_PDF = 4 * 1024 * 1024;

// ---------- small helpers ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const fmtSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : v);
const isEmpty = (v) => v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

async function compressImage(file, maxSide = 2000, quality = 0.85) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // e.g. HEIC in browsers that can't open it: send the original
  }
}

// ---------- the form ----------
export function mountApplication(root, config, opts = {}) {
  const storeKey = `uvs-apply-${config.slug}`;
  const allFields = config.steps.flatMap((s) => s.fields);
  const fieldByName = Object.fromEntries(allFields.map((f) => [f.name, f]));
  const steps = [
    ...config.steps,
    { id: 'documents', title: 'Documents' },
    { id: 'review', title: 'Check and send' },
  ];

  let answers = {};
  let files = {}; // slot -> File
  let autofilled = new Set();
  let current = 0;
  let furthest = 0;
  let passportPreview = null;

  // defaults
  for (const f of allFields) if (f.default && answers[f.name] == null) answers[f.name] = f.default;

  // restore saved answers (this tab only; files can't be saved)
  let restored = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
    if (saved?.answers) { answers = { ...answers, ...saved.answers }; current = saved.current || 0; furthest = saved.furthest || 0; autofilled = new Set(saved.autofilled || []); restored = true; }
  } catch {}
  const save = () => { try { sessionStorage.setItem(storeKey, JSON.stringify({ answers, current, furthest, autofilled: [...autofilled] })); } catch {} };

  const visible = (f, scope = answers) => {
    const c = f.showIf;
    if (!c) return true;
    const dep = fieldByName[c.name];
    if (dep && !visible(dep)) return false;
    const v = scope[c.name] ?? answers[c.name];
    if (c.filled) return !isEmpty(v);
    if (c.isNot !== undefined) return !isEmpty(v) && v !== c.isNot;
    return Array.isArray(c.is) ? c.is.includes(v) : v === c.is;
  };
  const visibleUploads = () => config.uploads.filter((u) => visible(u));
  const PASSPORT_SLOT = { name: 'passport', label: 'Passport photo page' };
  const slotInfo = (slot) => (slot === 'passport' ? PASSPORT_SLOT : visibleUploads().find((u) => u.name === slot));
  // Only files for documents that still apply (e.g. if the client changed their visa type)
  const SLOT_ORDER = ['passport', 'photo', 'doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6', 'doc7', 'doc8'];
  const activeFiles = () => Object.entries(files).filter(([slot]) => slotInfo(slot)).sort(([a], [b]) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));
  const safeName = (t) => t.replace(/[^\w\s().,-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);

  // ---------- layout ----------
  root.innerHTML = '';
  const sideList = h('ol', { class: 'ap-steps' });
  const progressText = h('p', { class: 'ap-progress-text' });
  const progressBar = h('div', { class: 'ap-progress-bar' }, h('span'));
  const stage = h('div', { class: 'ap-stage' });
  root.append(
    h('div', { class: 'ap-layout' },
      h('aside', { class: 'ap-side', 'aria-label': 'Steps' }, sideList),
      h('div', { class: 'ap-main' },
        h('div', { class: 'ap-progress' }, progressText, progressBar),
        restored ? h('div', { class: 'ap-note' }, 'We’ve kept the answers you gave earlier in this browser tab. ',
          h('button', { type: 'button', class: 'ap-link', onclick: () => { sessionStorage.removeItem(storeKey); location.reload(); } }, 'Start again')) : null,
        stage)),
  );

  function renderSide() {
    sideList.innerHTML = '';
    steps.forEach((s, i) => {
      const state = i === current ? 'current' : i <= furthest ? 'done' : 'todo';
      const inner = i <= furthest && i !== current
        ? h('button', { type: 'button', onclick: () => go(i) }, s.title)
        : h('span', {}, s.title);
      sideList.append(h('li', { class: `ap-step ${state}`, 'aria-current': i === current ? 'step' : false }, inner));
    });
    progressText.textContent = `Step ${current + 1} of ${steps.length}: ${steps[current].title}`;
    progressBar.firstChild.style.width = `${((current + 1) / steps.length) * 100}%`;
  }

  // ---------- inputs ----------
  function countryOptions(selected) {
    const opts = [h('option', { value: '' }, 'Choose a country')];
    const g1 = h('optgroup', { label: 'Common' }, commonCountries.map((c) => h('option', { value: c, selected: c === selected }, c)));
    const g2 = h('optgroup', { label: 'All countries' }, countries.map((c) => h('option', { value: c, selected: c === selected && !commonCountries.includes(c) }, c)));
    // an unknown value from a passport scan (e.g. an ICAO code) stays selectable
    if (selected && !countries.includes(selected)) opts.push(h('option', { value: selected, selected: true }, selected));
    return [...opts, g1, g2];
  }

  function control(f, id, value, onChange) {
    const common = { id, name: id, 'aria-describedby': `${id}-hint ${id}-err`, autocomplete: f.autocomplete || 'off' };
    switch (f.type) {
      case 'textarea':
        return h('textarea', { ...common, rows: 3, oninput: (e) => onChange(e.target.value) }, value || '');
      case 'select':
        return h('select', { ...common, onchange: (e) => onChange(e.target.value) },
          h('option', { value: '' }, 'Choose…'), f.options.map((o) => h('option', { value: o, selected: o === value }, o)));
      case 'country':
        return h('select', { ...common, onchange: (e) => onChange(e.target.value) }, countryOptions(value));
      case 'radio':
      case 'yesno': {
        const options = f.type === 'yesno' ? ['Yes', 'No'] : f.options;
        return h('div', { class: `ap-choices${f.type === 'yesno' ? ' ap-yesno' : ''}`, role: 'radiogroup', id },
          options.map((o, i) => h('label', { class: `ap-choice${o === value ? ' on' : ''}` },
            h('input', { type: 'radio', name: id, value: o, checked: o === value, id: i === 0 ? `${id}-0` : false,
              onchange: (e) => { e.target.closest('.ap-choices').querySelectorAll('.ap-choice').forEach((l) => l.classList.toggle('on', l.contains(e.target))); onChange(o); } }),
            h('span', {}, o))));
      }
      default: {
        const type = { email: 'email', tel: 'tel', date: 'date', number: 'number' }[f.type] || 'text';
        const ac = { email: 'email', tel: 'tel' }[f.type];
        return h('input', { ...common, type, value: value ?? '', autocomplete: ac || common.autocomplete, inputmode: f.type === 'number' ? 'numeric' : false, oninput: (e) => onChange(e.target.value) });
      }
    }
  }

  function fieldBlock(f, { id = `f-${f.name}`, value, onChange, scope }) {
    const wrap = h('div', { class: `ap-field${f.half ? ' half' : ''}${autofilled.has(f.name) ? ' autofilled' : ''}`, 'data-field': f.name });
    const labelEl = ['radio', 'yesno'].includes(f.type)
      ? h('p', { class: 'ap-label', id: `${id}-label` }, f.label, f.required ? null : '')
      : h('label', { class: 'ap-label', for: id }, f.label);
    if (autofilled.has(f.name)) labelEl.append(h('span', { class: 'ap-badge' }, 'From your passport'));
    wrap.append(labelEl);
    wrap.append(h('p', { class: 'ap-hint', id: `${id}-hint` }, f.hint || ''));
    const ctl = control(f, id, value, (v) => { wrap.classList.remove('has-error'); wrap.querySelector('.ap-err').textContent = ''; onChange(v); });
    if (['radio', 'yesno'].includes(f.type)) ctl.setAttribute('aria-labelledby', `${id}-label`);
    wrap.append(ctl, h('p', { class: 'ap-err', id: `${id}-err`, role: 'alert' }));
    wrap._field = f; wrap._scope = scope;
    return wrap;
  }

  function repeatBlock(f) {
    const wrap = h('div', { class: 'ap-field ap-repeat', 'data-field': f.name });
    const rows = Array.isArray(answers[f.name]) ? answers[f.name] : [];
    const list = h('div', { class: 'ap-rows' });
    const draw = () => {
      list.innerHTML = '';
      const rows = answers[f.name] || [];
      rows.forEach((row, i) => {
        const box = h('div', { class: 'ap-row' },
          h('div', { class: 'ap-row-head' }, h('strong', {}, `${i + 1}`),
            h('button', { type: 'button', class: 'ap-link', onclick: () => { rows.splice(i, 1); answers[f.name] = rows; save(); draw(); } }, 'Remove')));
        f.fields.forEach((sf) => box.append(fieldBlock(sf, {
          id: `f-${f.name}-${i}-${sf.name}`, value: row[sf.name], scope: row,
          onChange: (v) => { row[sf.name] = v; save(); },
        })));
        list.append(box);
      });
      addBtn.hidden = rows.length >= (f.max || 10);
    };
    const addBtn = h('button', { type: 'button', class: 'btn btn-outline ap-add', onclick: () => {
      answers[f.name] = [...(answers[f.name] || []), {}]; save(); draw();
      list.lastChild?.querySelector('input,select,textarea')?.focus();
    } }, f.addLabel || 'Add');
    wrap.append(h('p', { class: 'ap-label' }, f.label), list, addBtn, h('p', { class: 'ap-err', role: 'alert' }));
    if (!rows.length && f.showIf) answers[f.name] = [{}]; // start with one row when the question opens up
    draw();
    wrap._field = f;
    return wrap;
  }

  function refreshVisibility() {
    stage.querySelectorAll('.ap-fields > .ap-field').forEach((el) => {
      const f = el._field;
      const show = visible(f);
      if (el.hidden === show) {
        el.hidden = !show;
        if (show && f.type === 'repeat' && isEmpty(answers[f.name])) { const fresh = repeatBlock(f); el.replaceWith(fresh); }
      }
    });
  }

  // ---------- passport scan ----------
  function passportScanBlock() {
    const status = h('div', { class: 'ap-scan-status', 'aria-live': 'polite' });
    const thumb = h('div', { class: 'ap-scan-thumb' });
    const input = h('input', { type: 'file', accept: 'image/*,application/pdf', id: 'passport-file', class: 'ap-file-input' });
    const drop = h('label', { class: 'ap-scan', for: 'passport-file' },
      h('span', { class: 'ap-scan-icon', 'aria-hidden': 'true' }, passportIcon()),
      h('span', { class: 'ap-scan-text' },
        h('strong', {}, 'Upload or take a photo of your passport photo page'),
        h('small', {}, 'The page with your photo. Include the two lines of letters and <<< at the bottom. JPG, PNG or PDF.')),
      h('span', { class: 'btn btn-primary' }, 'Choose photo'));
    const showThumb = () => {
      thumb.innerHTML = '';
      if (files.passport) {
        thumb.append(passportPreview ? h('img', { src: passportPreview, alt: 'Your passport photo page' }) : h('span', { class: 'ap-pdf' }, 'PDF'),
          h('span', {}, files.passport.name, h('small', {}, fmtSize(files.passport.size))));
      }
    };
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      input.value = '';
      drop.classList.add('busy');
      status.className = 'ap-scan-status working';
      status.textContent = 'Preparing the passport reader…';
      try {
        const processed = await compressImage(file);
        files.passport = processed;
        if (passportPreview) URL.revokeObjectURL(passportPreview);
        passportPreview = processed.type.startsWith('image/') ? URL.createObjectURL(processed) : null;
        showThumb();
        const result = await readPassport(file, (s) => { status.textContent = s; });
        if (result.ok) {
          const d = result.data;
          for (const f of config.steps[0].fields) {
            if (f.autofill && d[f.autofill]) { answers[f.name] = d[f.autofill]; autofilled.add(f.name); }
          }
          save();
          status.className = `ap-scan-status ${d.valid ? 'ok' : 'warn'}`;
          status.textContent = result.message;
          renderStep(false);
          stage.querySelector('.ap-scan-status').className = status.className;
          stage.querySelector('.ap-scan-status').textContent = result.message;
        } else {
          status.className = 'ap-scan-status warn';
          status.textContent = result.message;
        }
      } catch (e) {
        status.className = 'ap-scan-status warn';
        status.textContent = 'We couldn’t read your passport automatically. Please type your details below. Your passport photo is still attached.';
      } finally {
        drop.classList.remove('busy');
      }
    });
    showThumb();
    return h('div', { class: 'ap-scan-wrap' }, input, drop, thumb, status,
      h('p', { class: 'ap-privacy' }, lockIcon(), 'Your passport is read on this device. Nothing is sent to us until you press Send at the end.'));
  }

  // ---------- documents step ----------
  function documentsStep() {
    const wrap = h('div', { class: 'ap-docs' });
    const total = h('p', { class: 'ap-total' });
    const intro = config.docsIntro?.[answers.visaType];
    if (intro) wrap.append(h('div', { class: 'ap-docs-intro' }, h('strong', {}, answers.visaType), h('p', {}, intro)));
    const slots = [{ name: 'passport', label: 'Passport photo page', required: true, hint: 'Added in step 1. You can replace it here.' }, ...visibleUploads()];
    const updateTotal = () => {
      const sum = activeFiles().reduce((a, [, f]) => a + f.size, 0);
      total.textContent = `Total size: ${fmtSize(sum)} of ${fmtSize(MAX_TOTAL)}`;
      total.classList.toggle('over', sum > MAX_TOTAL);
    };
    for (const u of slots) {
      const id = `up-${u.name}`;
      const info = h('div', { class: 'ap-up-file' });
      const err = h('p', { class: 'ap-err', role: 'alert' });
      const input = h('input', { type: 'file', id, accept: 'image/*,application/pdf', class: 'ap-file-input' });
      const card = h('div', { class: 'ap-up', 'data-slot': u.name },
        h('div', { class: 'ap-up-text' }, h('strong', {}, u.label, u.required || /optional/i.test(u.label) ? null : h('span', { class: 'ap-optional' }, ' (optional)')), u.hint ? h('small', {}, u.hint) : null),
        info, input, h('label', { for: id, class: 'btn btn-outline' }, 'Choose file'), err);
      const draw = () => {
        info.innerHTML = '';
        const f = files[u.name];
        card.classList.toggle('has-file', !!f);
        card.querySelector('label.btn').textContent = f ? 'Replace' : 'Choose file';
        if (f) info.append(h('span', { class: 'ap-tick', 'aria-hidden': 'true' }, '✓'), h('span', {}, f.name, h('small', {}, fmtSize(f.size))),
          h('button', { type: 'button', class: 'ap-link', onclick: () => { delete files[u.name]; if (u.name === 'passport') passportPreview = null; draw(); updateTotal(); } }, 'Remove'));
      };
      input.addEventListener('change', async () => {
        const file = input.files[0]; input.value = ''; err.textContent = '';
        if (!file) return;
        if (!/^image\/|application\/pdf/.test(file.type)) { err.textContent = 'Please upload a photo (JPG or PNG) or a PDF.'; return; }
        if (file.type === 'application/pdf' && file.size > MAX_PDF) { err.textContent = `This PDF is ${fmtSize(file.size)}. Please upload one under ${fmtSize(MAX_PDF)}, or a photo of the page instead.`; return; }
        card.classList.add('busy');
        files[u.name] = await compressImage(file);
        card.classList.remove('busy');
        card.classList.remove('has-error');
        draw(); updateTotal();
      });
      card._upload = u;
      draw();
      wrap.append(card);
    }
    updateTotal();
    wrap.append(total, h('p', { class: 'ap-hint' }, 'Photos are made smaller automatically. If a document has several pages, a PDF is best.'));
    return wrap;
  }

  // ---------- review ----------
  function answerText(f, v) {
    if (isEmpty(v)) return null;
    if (f.type === 'date') return fmtDate(v);
    return String(v);
  }
  function summaryLines() {
    const lines = [];
    for (const s of config.steps) {
      lines.push('', `== ${s.title.toUpperCase()} ==`);
      for (const f of s.fields) {
        if (!visible(f)) continue;
        if (f.type === 'repeat') {
          const rows = (answers[f.name] || []).filter((r) => Object.values(r).some((x) => !isEmpty(x)));
          if (!rows.length) continue;
          lines.push(`${f.label}:`);
          rows.forEach((r, i) => lines.push(`  ${i + 1}. ` + f.fields.map((sf) => `${sf.label}: ${answerText(sf, r[sf.name]) ?? '-'}`).join('; ')));
        } else {
          const t = answerText(f, answers[f.name]);
          if (t) lines.push(`${f.label}: ${t}`);
        }
      }
    }
    return lines;
  }

  function reviewStep() {
    const wrap = h('div', { class: 'ap-review' });
    config.steps.forEach((s, i) => {
      const dl = h('dl');
      for (const f of s.fields) {
        if (!visible(f)) continue;
        if (f.type === 'repeat') {
          const rows = (answers[f.name] || []).filter((r) => Object.values(r).some((x) => !isEmpty(x)));
          if (!rows.length) continue;
          dl.append(h('div', {}, h('dt', {}, f.label), h('dd', {}, rows.map((r) => h('span', { class: 'ap-rowsum' }, f.fields.map((sf) => answerText(sf, r[sf.name])).filter(Boolean).join(', '))))));
        } else {
          const t = answerText(f, answers[f.name]);
          if (t) dl.append(h('div', {}, h('dt', {}, f.label), h('dd', {}, t)));
        }
      }
      wrap.append(h('section', { class: 'ap-review-sec' },
        h('div', { class: 'ap-review-head' }, h('h3', {}, s.title), h('button', { type: 'button', class: 'ap-link', onclick: () => go(i) }, `Change`, h('span', { class: 'sr-only' }, ` ${s.title}`))),
        dl));
    });
    const docs = h('ul', { class: 'ap-doclist' }, activeFiles().map(([slot, f]) => h('li', {}, `${slotInfo(slot).label}: ${f.name} (${fmtSize(f.size)})`)));
    wrap.append(h('section', { class: 'ap-review-sec' },
      h('div', { class: 'ap-review-head' }, h('h3', {}, 'Documents'), h('button', { type: 'button', class: 'ap-link', onclick: () => go(steps.length - 2) }, 'Change', h('span', { class: 'sr-only' }, ' documents'))),
      activeFiles().length ? docs : h('p', { class: 'ap-hint' }, 'No documents added.')));

    const c1 = h('input', { type: 'checkbox', id: 'decl-true' });
    const c2 = h('input', { type: 'checkbox', id: 'decl-privacy' });
    wrap.append(h('div', { class: 'ap-declare' },
      h('h3', {}, 'Declaration'),
      h('label', { class: 'ap-check' }, c1, h('span', {}, opts.declaration)),
      h('label', { class: 'ap-check' }, c2, h('span', {}, 'I agree to Unique Visa Services keeping and using my information and documents to prepare my application, as described in the ', h('a', { href: '/privacy-policy/', target: '_blank' }, 'privacy policy'), '.')),
      h('p', { class: 'ap-err', id: 'decl-err', role: 'alert' })));
    return wrap;
  }

  // ---------- validation ----------
  function validateStep() {
    const errors = [];
    const step = steps[current];
    const today = new Date().toISOString().slice(0, 10);
    const flag = (el, msg, focusEl) => {
      el.classList.add('has-error');
      el.querySelector(':scope > .ap-err').textContent = msg;
      errors.push({ msg, el: focusEl || el.querySelector('input,select,textarea') });
    };
    if (step.id === 'documents') {
      stage.querySelectorAll('.ap-up').forEach((card) => {
        const u = card.dataset.slot === 'passport' ? { required: true, label: 'Passport photo page' } : card._upload;
        if (u.required && !files[card.dataset.slot]) flag(card, `Add your ${u.label.toLowerCase()}`, card.querySelector('label.btn'));
      });
      const sum = activeFiles().reduce((a, [, f]) => a + f.size, 0);
      if (sum > MAX_TOTAL) errors.push({ msg: `Your documents add up to ${fmtSize(sum)}. Please remove or shrink some so they total under ${fmtSize(MAX_TOTAL)}.`, el: null });
      return errors;
    }
    if (step.id === 'review') {
      const ok = stage.querySelector('#decl-true').checked && stage.querySelector('#decl-privacy').checked;
      if (!ok) { stage.querySelector('#decl-err').textContent = 'Please tick both boxes to send your application.'; errors.push({ msg: 'Please tick both declaration boxes', el: stage.querySelector('#decl-true') }); }
      return errors;
    }
    stage.querySelectorAll('.ap-field').forEach((el) => {
      if (el.hidden || el.closest('[hidden]')) return;
      const f = el._field;
      if (!f || f.type === 'repeat') return;
      const id = el.querySelector('input,select,textarea,[role=radiogroup]')?.id || '';
      const scopeVal = el._scope ? el._scope[f.name] : answers[f.name];
      if (el._scope && el._scope !== answers) { if (f.showIf && !visible(f, el._scope)) return; }
      const v = scopeVal;
      if (f.required && isEmpty(v)) return flag(el, ['radio', 'yesno', 'select', 'country'].includes(f.type) ? `Choose an answer for “${f.label}”` : `Enter ${f.label.charAt(0).toLowerCase() + f.label.slice(1)}`, el.querySelector(`#${CSS.escape(id)}-0`) || null);
      if (isEmpty(v)) return;
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return flag(el, 'Enter a valid email address, like name@example.com');
      if (f.type === 'tel' && v.replace(/\D/g, '').length < 7) return flag(el, 'Enter a valid phone number');
      if (f.type === 'date') {
        if (/(dateOfBirth|dob|Dob)$/.test(f.name) && v > today) return flag(el, 'Date of birth must be in the past');
        if (f.name === 'passportExpiry' && v <= today) return flag(el, 'Your passport has expired. You’ll need a new passport before applying. Call us if you need help.');
        if (f.name === 'passportIssueDate' && v > today) return flag(el, 'The issue date must be in the past');
        if (f.name === 'arrivalDate' && v < today) return flag(el, 'Your arrival date must be in the future');
        if (f.name === 'departureDate' && answers.arrivalDate && v < answers.arrivalDate) return flag(el, 'Your departure date must be after your arrival date');
      }
    });
    // passport validity warning (not blocking) is shown on the review page by the embassy rules; we just check expiry > arrival
    return errors;
  }

  function showErrors(errors) {
    stage.querySelector('.ap-errors')?.remove();
    if (!errors.length) return;
    const box = h('div', { class: 'ap-errors', role: 'alert', tabindex: '-1' },
      h('h3', {}, errors.length === 1 ? 'There’s a problem' : `There are ${errors.length} problems`),
      h('ul', {}, errors.map((e) => h('li', {}, e.el ? h('a', { href: '#', onclick: (ev) => { ev.preventDefault(); e.el.focus(); e.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, e.msg) : e.msg))));
    stage.querySelector('.ap-head').after(box);
    box.focus();
    box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---------- step rendering ----------
  function renderStep(focus = true) {
    const step = steps[current];
    stage.innerHTML = '';
    const head = h('div', { class: 'ap-head' }, h('h2', { tabindex: '-1' }, step.title), step.intro ? h('p', { class: 'ap-intro' }, step.intro) : null);
    stage.append(head);

    if (step.id === 'documents') {
      stage.append(h('p', { class: 'ap-intro' }, 'Add the documents for your application. You can use photos taken on your phone.'), documentsStep());
    } else if (step.id === 'review') {
      stage.append(h('p', { class: 'ap-intro' }, 'Check your answers before you send them. You can change anything.'), reviewStep());
    } else {
      if (step.passportScan) stage.append(passportScanBlock());
      const grid = h('div', { class: 'ap-fields' });
      step.fields.forEach((f) => {
        const el = f.type === 'repeat' ? repeatBlock(f) : fieldBlock(f, { value: answers[f.name], scope: answers, onChange: (v) => {
          answers[f.name] = v;
          if (autofilled.has(f.name)) { autofilled.delete(f.name); grid.querySelector(`[data-field="${f.name}"]`)?.classList.remove('autofilled'); grid.querySelector(`[data-field="${f.name}"] .ap-badge`)?.remove(); }
          save(); refreshVisibility();
        } });
        el.hidden = !visible(f);
        grid.append(el);
      });
      stage.append(grid);
    }

    const back = current > 0 ? h('button', { type: 'button', class: 'btn btn-outline', onclick: () => go(current - 1) }, 'Back') : h('span');
    const nextLabel = step.id === 'review' ? 'Send application' : steps[current + 1]?.id === 'review' ? 'Check your answers' : 'Continue';
    const next = h('button', { type: 'button', class: 'btn btn-primary ap-next', onclick: onNext }, nextLabel);
    stage.append(h('div', { class: 'ap-nav' }, back, next));
    if (step.id !== 'review') stage.append(h('p', { class: 'ap-saved' }, 'Your answers are saved in this browser tab as you go.'));

    renderSide();
    if (focus) { head.querySelector('h2').focus({ preventScroll: true }); root.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    if (step.passportScan) warmUp();
  }

  function go(i) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    furthest = Math.max(furthest, current);
    save();
    renderStep();
  }

  async function onNext() {
    const errors = validateStep();
    if (errors.length) return showErrors(errors);
    if (steps[current].id === 'review') return submit();
    go(current + 1);
  }

  // ---------- submit ----------
  async function submit() {
    const btn = stage.querySelector('.ap-next');
    btn.disabled = true; btn.textContent = 'Sending…';
    const ref = `UVS-${config.code}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const name = `${(answers.givenNames || '').trim()} ${(answers.surname || '').trim()}`.trim();
    const fd = new FormData();
    fd.append('form-name', config.slug);
    fd.append('applicant_name', name);
    fd.append('email', answers.email || '');
    fd.append('phone', answers.phone || '');
    fd.append('visa_type', answers.visaType || '');
    fd.append('reference', ref);
    fd.append('subject', `${config.title}: ${name} (${ref})`);
    fd.append('summary', [`${config.title}`, `Reference: ${ref}`, `Submitted: ${new Date().toLocaleString('en-GB')}`, ...summaryLines(), '', '== DOCUMENTS ==', ...activeFiles().map(([k, f]) => `${slotInfo(k).label}: ${f.name} (${fmtSize(f.size)})`)].join('\n'));
    fd.append('answers_json', JSON.stringify(answers));
    fd.append('bot-field', '');
    // Name each file after the document it is, e.g. "KHAN - Invitation letter from the Chinese company.pdf"
    for (const [slot, f] of activeFiles()) {
      const ext = (f.name.match(/\.\w+$/) || [''])[0];
      fd.append(slot, f, `${safeName(answers.surname || 'Applicant')} - ${safeName(slotInfo(slot).label.replace(/\s*\((optional|if [^)]*)\)/gi, ''))}${ext}`);
    }
    try {
      const res = await fetch('/', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(String(res.status));
      sessionStorage.removeItem(storeKey);
      done(ref, name);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Send application';
      showErrors([{ msg: `Your application couldn’t be sent (${e.message}). Please check your internet connection and try again, or call us on ${opts.phone}.`, el: null }]);
    }
  }

  function done(ref, name) {
    root.innerHTML = '';
    root.append(h('div', { class: 'ap-done' },
      h('div', { class: 'ap-done-icon', 'aria-hidden': 'true' }, '✓'),
      h('h2', { tabindex: '-1' }, 'Application sent'),
      h('p', { class: 'ap-ref' }, 'Your reference: ', h('strong', {}, ref)),
      h('p', {}, `Thank you${name ? ', ' + name.split(' ')[0] : ''}. We’ll check everything and contact you within one working day about the next steps and our fee.`),
      h('p', {}, 'If anything is urgent, call us on ', h('a', { href: `tel:${opts.phoneIntl}` }, opts.phone), '.'),
      h('a', { class: 'btn btn-primary', href: '/' }, 'Back to the homepage')));
    root.querySelector('h2').focus();
    root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  renderStep(false);
}

function passportIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('width', '44'); s.setAttribute('height', '44'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<rect x="7" y="4" width="34" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="24" cy="19" r="7" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M13 34h22M13 39h22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 3"/>';
  return s;
}
function lockIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>';
  return s;
}
