// The back office screens (/office/). Talks to netlify/functions/office-api.mjs.
// Pages: Home (what needs doing), Applications, Clients, one record (details + invoice), New record, Settings.

const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};

// replaceChildren/append without the gaps left by optional parts
const put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
const add = (el, ...kids) => el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const fmtDate = (iso) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const money = (n) => `£${(Math.round(Number(n || 0) * 100) / 100).toFixed(2)}`;
const amountOf = (v) => { const m = String(v || '').replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/); return m ? Number(m[1]) : 0; };
const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());

export function mountOffice(root, cfg) {
  let me = null;
  let apps = [];
  let started = false;

  async function api(action, body) {
    const res = await fetch(`/office/api/${action}${body === undefined ? '' : ''}`, body === undefined
      ? { credentials: 'same-origin' }
      : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Office': '1' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    if (res.status === 401 && action !== 'login') { me = null; showLogin(); throw new Error('Please sign in again.'); }
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }
  const get = (action) => api(action);

  // ---------- sign in ----------
  function showLogin(message) {
    root.innerHTML = '';
    const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
    const err = h('p', { class: 'msg err', hidden: !message, role: 'alert' }, message || '');
    const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Sign in');
    const form = h('form', { class: 'card login stack', onsubmit: async (e) => {
      e.preventDefault(); btn.disabled = true; err.hidden = true;
      try { await api('login', { password: pw.value }); await start(); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; pw.select(); }
    } },
    h('div', { class: 'of-brand', style: 'color:var(--green)' }, h('span', {}, 'UVS'), 'Back office'),
    h('label', { class: 'f', for: 'pw' }, 'Password', pw), err, btn);
    root.append(form);
    pw.focus();
  }

  async function start() {
    try { me = await get('me'); } catch (e) { if (!me) return showLogin(); }
    await loadApps();
    if (!started) { window.addEventListener('hashchange', route); started = true; }
    route();
  }
  async function loadApps() { apps = (await get('apps')).apps || []; }

  // ---------- layout ----------
  function frame(current, ...content) {
    root.innerHTML = '';
    const link = (hash, label) => h('a', { href: `#${hash}`, 'aria-current': current === hash ? 'page' : false }, label);
    root.append(
      h('header', { class: 'of-top' },
        h('div', { class: 'of-brand' }, h('span', {}, 'UVS'), 'Back office'),
        h('nav', { class: 'of-nav', 'aria-label': 'Back office' }, link('home', 'Home'), link('apps', 'Applications'), link('clients', 'Clients'), link('newsletter', 'Newsletter'), link('new', '+ New record'), link('settings', 'Settings'), h('a', { href: '/admin/' }, 'Edit website ↗'))),
      h('main', { class: 'of-main' },
        me?.preview ? h('p', { class: 'of-banner' }, h('strong', {}, 'Test copy. '), 'You’re on a preview of the site, so the records here are test records, kept apart from your real ones. Invoices made here still go to your real FreeAgent and Wave, so delete any test invoices there.') : null,
        ...content));
    window.scrollTo(0, 0);
  }

  function route() {
    const [view, ...rest] = (location.hash.slice(1) || 'home').split('/');
    const arg = decodeURIComponent(rest.join('/'));
    ({ home, apps: appsView, clients, client: () => clientView(arg), app: () => recordView(arg), new: newRecord, newsletter, settings }[view] || home)();
  }
  const go = (hash) => { if (location.hash === `#${hash}`) route(); else location.hash = hash; };

  const statusTag = (s) => h('span', { class: `tag${s === 'New' ? ' new' : ''}` }, s);
  const invoiceTag = (a) => {
    const inv = a.invoices || [];
    if (!inv.length) return h('span', { class: 'muted small' }, 'Not invoiced');
    const last = inv[inv.length - 1];
    return h('span', { class: `tag${last.status === 'draft' ? ' draft' : ''}` }, `${last.status === 'draft' ? 'Draft' : last.status === 'marked sent' ? 'Marked sent' : 'Sent'} ${money(last.total)}`);
  };

  function appTable(list, empty = 'Nothing here yet.') {
    if (!list.length) return h('p', { class: 'muted' }, empty);
    return h('div', { class: 'tablebox' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Received'), h('th', {}, 'Client'), h('th', {}, 'Service'), h('th', {}, 'Status'), h('th', {}, 'Invoice'))),
      h('tbody', {}, list.map((a) => h('tr', { class: 'click', tabindex: '0', onclick: () => go(`app/${a.ref}`), onkeydown: (e) => { if (e.key === 'Enter') go(`app/${a.ref}`); } },
        h('td', {}, fmtDate(a.received), h('div', { class: 'small muted' }, a.ref)),
        h('td', {}, titleCase(a.name) || '–', a.companyName ? h('div', { class: 'small muted' }, a.companyName) : null, a.people > 1 ? h('div', { class: 'small muted' }, `${a.people} people`) : null),
        h('td', {}, a.formTitle || '', a.service ? h('div', { class: 'small muted' }, a.service) : null),
        h('td', {}, statusTag(a.status)),
        h('td', {}, invoiceTag(a)))))));
  }

  // ---------- home ----------
  function home() {
    const days = Number(me.settings?.reminderDays) || 90;
    const fresh = apps.filter((a) => a.status === 'New');
    const due = apps.filter((a) => a.nextReminder && a.nextReminder.due <= today());
    const expiring = apps.filter((a) => a.visaExpiry && a.visaExpiry >= today() && a.visaExpiry <= addDays(days)).sort((x, y) => x.visaExpiry.localeCompare(y.visaExpiry));
    const drafts = apps.filter((a) => (a.invoices || []).some((i) => i.status === 'draft'));
    const box = (title, count, body) => h('section', { class: 'card' }, h('h2', {}, title, ' ', h('span', { class: 'muted' }, `(${count})`)), body);
    const mini = (list, extra) => list.length ? h('ul', { class: 'list' }, list.slice(0, 12).map((a) => h('li', {}, h('a', { href: `#app/${a.ref}` }, titleCase(a.name) || a.ref), ' ', h('span', { class: 'small muted' }, extra(a))))) : h('p', { class: 'muted small' }, 'Nothing right now.');
    frame('home',
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Home'), h('p', { class: 'muted' }, 'What needs doing today.')), h('a', { class: 'btn primary', href: '#new' }, '+ New record')),
      !apps.length ? h('section', { class: 'card stack', style: 'margin-bottom:16px;border-left:4px solid var(--gold)' },
        h('h2', {}, 'How records get here'),
        h('p', { style: 'margin:0' }, h('strong', {}, 'Automatically: '), 'when a client sends one of the online application forms on the website, it appears here under New applications.'),
        h('p', { style: 'margin:0' }, h('strong', {}, 'By hand: '), 'for phone calls, walk-ins and UK immigration clients, press ', h('strong', {}, '+ New record'), ', fill in their details, and the record opens with the invoice beside it.'),
        h('a', { class: 'btn primary', href: '#new', style: 'align-self:flex-start' }, '+ Add your first record')) : null,
      h('div', { class: 'grid' },
        box('New applications', fresh.length, mini(fresh, (a) => `${a.formTitle || ''} · ${fmtDate(a.received)}`)),
        box('Reminders due', due.length, mini(due, (a) => `${a.nextReminder.text} · ${fmtDate(a.nextReminder.due)}`)),
        box(`Visas expiring in the next ${days} days`, expiring.length, mini(expiring, (a) => `${a.service || a.formTitle || ''} · expires ${fmtDate(a.visaExpiry)}${a.expiryReminded ? ' · reminder sent' : ''}`)),
        box('Draft invoices', drafts.length, mini(drafts, (a) => `${money((a.invoices || []).filter((i) => i.status === 'draft').reduce((s, i) => s + i.total, 0))} in drafts`))));
  }

  // ---------- applications ----------
  function appsView() {
    const q = h('input', { type: 'search', placeholder: 'Search name, email, company or reference', 'aria-label': 'Search' });
    const st = h('select', { 'aria-label': 'Status' }, h('option', { value: '' }, 'All statuses'), me.statuses.map((s) => h('option', { value: s }, s)));
    const out = h('div');
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      const list = apps.filter((a) => (!st.value || a.status === st.value) && (!t || [a.name, a.email, a.companyName, a.ref, a.phone, a.formTitle, a.service].some((v) => String(v || '').toLowerCase().includes(t))));
      put(out, appTable(list, 'No records match.'));
    };
    q.addEventListener('input', draw); st.addEventListener('change', draw);
    frame('apps', h('div', { class: 'head' }, h('h1', {}, 'Applications'), h('a', { class: 'btn primary', href: '#new' }, '+ New record')),
      h('section', { class: 'card stack' }, h('div', { class: 'row' }, h('div', { style: 'flex:2 1 260px' }, q), h('div', { style: 'flex:1 1 180px' }, st)), out));
    draw();
  }

  // ---------- clients (CRM) ----------
  const clientKey = (a) => a.email || `name:${String(a.name || '').toLowerCase()}`;
  function groupClients() {
    const map = new Map();
    for (const a of apps) {
      const k = clientKey(a);
      const c = map.get(k) || { key: k, name: a.name, email: a.email, phone: a.phone, companies: new Set(), apps: [] };
      c.apps.push(a); if (a.companyName) c.companies.add(a.companyName); if (!c.phone && a.phone) c.phone = a.phone;
      map.set(k, c);
    }
    return [...map.values()].map((c) => ({ ...c, last: c.apps[0]?.received, expiry: c.apps.map((a) => a.visaExpiry).filter((d) => d && d >= today()).sort()[0] || '' }));
  }
  function clients() {
    const q = h('input', { type: 'search', placeholder: 'Search clients', 'aria-label': 'Search clients' });
    const out = h('div');
    const all = groupClients();
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      const list = all.filter((c) => !t || [c.name, c.email, c.phone, ...c.companies].some((v) => String(v || '').toLowerCase().includes(t)));
      put(out, list.length ? h('div', { class: 'tablebox' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Client'), h('th', {}, 'Contact'), h('th', {}, 'Applications'), h('th', {}, 'Last activity'), h('th', {}, 'Next visa expiry'))),
        h('tbody', {}, list.map((c) => h('tr', { class: 'click', tabindex: '0', onclick: () => go(`client/${encodeURIComponent(c.key)}`), onkeydown: (e) => { if (e.key === 'Enter') go(`client/${encodeURIComponent(c.key)}`); } },
          h('td', {}, titleCase(c.name) || '–', c.companies.size ? h('div', { class: 'small muted' }, [...c.companies].join(', ')) : null),
          h('td', {}, c.email || '', h('div', { class: 'small muted' }, c.phone || '')),
          h('td', {}, String(c.apps.length)), h('td', {}, fmtDate(c.last)), h('td', {}, c.expiry ? fmtDate(c.expiry) : h('span', { class: 'muted' }, '–'))))))) : h('p', { class: 'muted' }, 'No clients match.'));
    };
    q.addEventListener('input', draw);
    frame('clients', h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Clients'), h('p', { class: 'muted' }, 'Everyone you’ve helped, grouped by email address.'))), h('section', { class: 'card stack' }, q, out));
    draw();
  }
  function clientView(key) {
    const c = groupClients().find((x) => x.key === key);
    if (!c) return frame('clients', h('p', {}, 'Client not found. ', h('a', { href: '#clients' }, 'Back to clients')));
    const invoices = c.apps.flatMap((a) => (a.invoices || []).map((i) => ({ ...i, ref: a.ref })));
    frame('clients',
      h('p', {}, h('a', { href: '#clients' }, '← All clients')),
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, titleCase(c.name) || c.email), h('p', { class: 'muted' }, [c.email, c.phone].filter(Boolean).join(' · '))),
        h('button', { class: 'btn primary', onclick: () => go(`new/${encodeURIComponent(c.apps[0].ref)}`) }, '+ New application for this client')),
      h('div', { class: 'cols' },
        h('div', { class: 'right' }, h('section', { class: 'card' }, h('h2', {}, 'Applications'), appTable(c.apps))),
        h('div', { class: 'left' },
          h('section', { class: 'card' }, h('h2', {}, 'Details'), h('p', {}, c.email || '–'), h('p', {}, c.phone || ''), c.companies.size ? h('p', { class: 'muted' }, 'Companies: ', [...c.companies].join(', ')) : null),
          h('section', { class: 'card' }, h('h2', {}, 'Invoices'), invoices.length ? h('ul', { class: 'list' }, invoices.map((i) => h('li', {}, `${money(i.total)} · ${i.status === 'draft' ? 'Draft' : i.status === 'marked sent' ? 'Marked sent' : 'Sent'}`, h('div', { class: 'small muted' }, `${i.ref}`)))) : h('p', { class: 'muted' }, 'No invoices yet.')))));
  }

  // ---------- one record: details, CRM and invoice on one page ----------
  async function recordView(ref) {
    frame('apps', h('p', { class: 'muted' }, 'Loading…'));
    let a;
    try { a = (await get(`app?ref=${encodeURIComponent(ref)}`)).app; } catch (e) { return frame('apps', h('p', { class: 'msg err' }, e.message)); }
    const save = async (patch, note) => {
      try { a = (await api('update', { ref: a.ref, patch })).app; syncIndex(a); if (note) flash(note); return true; }
      catch (e) { flash(e.message, true); return false; }
    };
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const flash = (text, bad) => { put(msg, h('p', { class: `msg ${bad ? 'err' : 'ok'}` }, text)); if (!bad) setTimeout(() => put(msg, ), 4000); };

    let panel = null;
    const newPanel = () => { panel = invoicePanel(a, (next) => { a = next; syncIndex(a); newPanel(); draw(); }, flash); };
    newPanel();
    const draw = () => {
      const status = h('select', { 'aria-label': 'Status', onchange: (e) => save({ status: e.target.value }, 'Status saved') }, me.statuses.map((s) => h('option', { value: s, selected: s === a.status }, s)));
      const expiry = h('input', { type: 'date', value: a.visaExpiry || '', 'aria-label': 'Visa expiry date', onchange: (e) => save({ visaExpiry: e.target.value }, 'Visa expiry saved').then(draw) });

      // Details (editable)
      const details = h('section', { class: 'card stack' }, h('h2', {}, 'Client details'));
      const fieldsView = () => {
        const rows = [['Name', a.name], ['Email', a.email], ['Phone', a.phone], ['Home address', a.address], ['Company', a.companyName], ['Company number', a.companyNumber], ['Company address', a.companyAddress], ['Invoice preference on form', a.invoiceTo]].filter(([, v]) => v);
        return [h('dl', { style: 'margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px' }, rows.map(([k, v]) => [h('dt', { class: 'muted small', style: 'font-weight:600' }, k), h('dd', { style: 'margin:0;white-space:pre-line' }, v)])),
          a.people?.length > 1 ? h('p', { class: 'small muted' }, `People on this application: ${a.people.map(titleCase).join(', ')}`) : null,
          h('button', { class: 'btn small', style: 'align-self:flex-start', onclick: () => put(details, h('h2', {}, 'Client details'), editForm()) }, 'Edit details')];
      };
      const editForm = () => {
        const inputs = {};
        const f = (k, label, type = 'text') => h('label', { class: 'f' }, label, inputs[k] = type === 'textarea' ? h('textarea', {}, a[k] || '') : h('input', { type, value: a[k] || '' }));
        return [h('div', { class: 'fields' }, f('name', 'Name'), f('email', 'Email', 'email'), f('phone', 'Phone', 'tel'), f('service', 'Service')),
          f('address', 'Home address', 'textarea'), h('div', { class: 'fields' }, f('companyName', 'Company name'), f('companyNumber', 'Company number')), f('companyAddress', 'Company address', 'textarea'),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => { if (await save(Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])), 'Details saved')) draw(); } }, 'Save details'), h('button', { class: 'btn', onclick: draw }, 'Cancel'))];
      };
      add(details, fieldsView());

      // Status, expiry and reminder email
      const tracking = h('section', { class: 'card stack' }, h('h2', {}, 'Progress'),
        h('label', { class: 'f' }, 'Status', status),
        h('label', { class: 'f' }, 'Visa expiry date (once granted)', expiry),
        a.visaExpiry ? h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: async (e) => {
            if (!confirm(`Email ${a.email} a reminder that their visa expires on ${fmtDate(a.visaExpiry)}?`)) return;
            e.target.disabled = true;
            try { a = (await api('remind-email', { ref: a.ref })).app; syncIndex(a); flash('Reminder email sent'); draw(); } catch (ex) { flash(ex.message, true); e.target.disabled = false; }
          } }, 'Email expiry reminder to client'),
          a.expiryReminded ? h('span', { class: 'small muted' }, `Last sent ${fmtDate(a.expiryReminded)}`) : null) : null,
        a.email ? newsletterToggle(a) : null);

      // Reminders
      const rText = h('input', { type: 'text', placeholder: 'e.g. Chase bank statements', 'aria-label': 'Reminder' });
      const rDate = h('input', { type: 'date', value: addDays(3), 'aria-label': 'Reminder date' });
      const open = (a.reminders || []).filter((r) => !r.done).sort((x, y) => x.due.localeCompare(y.due));
      const reminders = h('section', { class: 'card stack' }, h('h2', {}, 'Reminders'),
        open.length ? h('ul', { class: 'list' }, open.map((r) => h('li', { class: 'row', style: 'justify-content:space-between' }, h('span', {}, r.due <= today() ? h('span', { class: 'tag due' }, 'Due') : null, ' ', r.text, h('span', { class: 'small muted' }, ` · ${fmtDate(r.due)}`)),
          h('button', { class: 'btn small', onclick: async () => { if (await save({ doneReminder: r.id }, 'Reminder done')) draw(); } }, 'Done')))) : h('p', { class: 'muted small' }, 'No reminders.'),
        h('div', { class: 'row' }, h('div', { style: 'flex:2 1 180px' }, rText), h('div', { style: 'flex:1 1 140px' }, rDate),
          h('button', { class: 'btn small', onclick: async () => { if (!rText.value.trim()) return rText.focus(); if (await save({ addReminder: { text: rText.value, due: rDate.value } }, 'Reminder added')) draw(); } }, 'Add')));

      // Notes
      const nText = h('textarea', { placeholder: 'Add a note', 'aria-label': 'Note' });
      const notes = h('section', { class: 'card stack' }, h('h2', {}, 'Notes'), nText,
        h('button', { class: 'btn small', style: 'align-self:flex-start', onclick: async () => { if (!nText.value.trim()) return nText.focus(); if (await save({ addNote: nText.value }, 'Note added')) draw(); } }, 'Add note'),
        (a.notes || []).length ? h('ul', { class: 'list' }, a.notes.map((n) => h('li', {}, h('div', { class: 'small muted' }, fmtDateTime(n.at)), h('div', { style: 'white-space:pre-line' }, n.text)))) : null);

      put(root.querySelector('.of-main'), 
        ...(me.preview ? [h('p', { class: 'of-banner' }, h('strong', {}, 'Test copy. '), 'Records here are test records. Invoices still go to your real FreeAgent and Wave.')] : []),
        h('p', {}, h('a', { href: '#apps' }, '← Applications'), a.email || a.name ? [' · ', h('a', { href: `#client/${encodeURIComponent(clientKey(a))}` }, 'Client page')] : null),
        h('div', { class: 'head' }, h('div', {}, h('h1', {}, `${a.formTitle || 'Client record'}${a.service ? `: ${a.service}` : ''}`), h('p', { class: 'muted' }, `${titleCase(a.name)} · Received ${fmtDateTime(a.received)} · Ref ${a.ref}`)), statusTag(a.status)),
        msg,
        h('div', { class: 'cols' }, h('div', { class: 'left' }, details, tracking, reminders, notes), h('div', { class: 'right' }, panel)));
    };
    draw();
  }
  // On the newsletter? (shown on each record)
  let subs = null;
  function newsletterToggle(a) {
    const box = h('div', { class: 'row small' }, h('span', { class: 'muted' }, 'Newsletter: checking…'));
    const draw = () => {
      const me1 = (subs || []).find((x) => x.email === String(a.email).toLowerCase());
      const on = me1 && me1.status === 'subscribed';
      put(box, h('span', {}, h('strong', {}, 'Newsletter: '), on ? 'on the list' : me1 ? 'unsubscribed' : 'not on the list'),
        on ? h('button', { class: 'btn small', onclick: async () => { await api('newsletter-status', { email: a.email, status: 'unsubscribed' }); subs = (await get('newsletter')).list; draw(); } }, 'Take off')
          : (!me1 ? h('button', { class: 'btn small', onclick: async () => {
            if (!confirm(`Add ${a.email} to the newsletter?\n\nOnly do this if they're your client or have agreed to get emails from you.`)) return;
            try { await api('newsletter-add', { people: [{ email: a.email, name: titleCase(a.name) }], agreed: true, source: 'record' }); subs = (await get('newsletter')).list; draw(); } catch (e) { alert(e.message); }
          } }, 'Add to newsletter') : h('span', { class: 'muted' }, ' (they unsubscribed themselves, so they can’t be added back by hand)')));
    };
    (subs ? Promise.resolve() : get('newsletter').then((r) => { subs = r.list; })).then(draw).catch(() => put(box, ''));
    return box;
  }

  // ---------- newsletter ----------
  async function newsletter() {
    frame('newsletter', h('p', { class: 'muted' }, 'Loading…'));
    let data;
    try { data = await get('newsletter'); } catch (e) { return frame('newsletter', h('p', { class: 'msg err' }, e.message)); }
    subs = data.list;
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const ok = (t) => put(msg, h('p', { class: 'msg ok' }, t));
    const bad = (t) => put(msg, h('p', { class: 'msg err' }, t));
    const active = data.list.filter((x) => x.status === 'subscribed');

    // Add people
    const nName = h('input', { type: 'text', placeholder: 'Name', 'aria-label': 'Name' });
    const nEmail = h('input', { type: 'email', placeholder: 'Email', 'aria-label': 'Email' });
    const paste = h('textarea', { placeholder: 'Paste contacts, one per line, e.g.\nJane Smith, jane@example.com\nor: Jane Smith <jane@example.com>', 'aria-label': 'Contacts to add', style: 'min-height:110px' });
    const file = h('input', { type: 'file', accept: '.csv,.txt,.vcf', 'aria-label': 'Contacts file (CSV)', onchange: async (e) => { const f = e.target.files[0]; if (f) paste.value = (await f.text()).slice(0, 2e6); } });
    const agree = h('input', { type: 'checkbox', id: 'nl-agree' });
    const addPeople = async (body) => {
      if (!agree.checked) return bad('Please tick the box to confirm these people are clients or have agreed to hear from you.');
      try { const r = await api('newsletter-add', { ...body, agreed: true }); ok(`Added ${r.added}${r.skipped ? ` (${r.skipped} already on the list, unsubscribed or not valid)` : ''}. ${r.total} on the list now.`); setTimeout(newsletter, 1200); }
      catch (e) { bad(e.message); }
    };

    // Write and send
    const subj = h('input', { type: 'text', 'aria-label': 'Subject line', placeholder: 'Subject line, e.g. Spouse visa changes from January' });
    const body = h('textarea', { 'aria-label': 'Newsletter text', style: 'min-height:260px', placeholder: 'Write your newsletter here.\n\nLeave a blank line between paragraphs.\n# A line starting with # becomes a heading\n- Lines starting with - become bullet points\nLinks like https://www.uvsuk.co.uk become clickable.' });
    try { const d = JSON.parse(localStorage.getItem('uvs-nl-draft') || '{}'); subj.value = d.s || ''; body.value = d.b || ''; } catch {}
    const keep = () => { try { localStorage.setItem('uvs-nl-draft', JSON.stringify({ s: subj.value, b: body.value })); } catch {} };
    subj.addEventListener('input', keep); body.addEventListener('input', keep);
    const progress = h('div');
    async function run(id) {
      let stop = false;
      const stopBtn = h('button', { class: 'btn small', onclick: () => { stop = true; } }, 'Pause');
      for (;;) {
        let r;
        try { r = await api('newsletter-batch', { id }); } catch (e) { put(progress, h('p', { class: 'msg err' }, e.message)); return; }
        const c = r.campaign;
        put(progress, h('div', { class: 'box stack', style: 'gap:6px' }, h('strong', {}, c.subject),
          h('div', {}, `Sent ${c.sent} of ${c.total}${c.failed ? ` · ${c.failed} failed` : ''}`),
          h('progress', { max: c.total, value: c.sent + c.failed, style: 'width:100%' }),
          r.paused ? h('p', { class: 'small', style: 'margin:0' }, 'Today’s sending limit is reached, so the rest are waiting. Come back tomorrow and press Continue sending under Sent newsletters.')
            : r.remaining ? h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Keep this page open while it sends.'), stopBtn) : h('p', { class: 'msg ok', style: 'margin:0' }, 'All sent.')));
        if (!r.remaining || r.paused || stop) { if (stop && r.remaining) put(progress, h('p', { class: 'msg ok' }, `Paused with ${r.remaining} still to send. Press Continue sending under Sent newsletters to carry on.`)); return; }
      }
    }

    frame('newsletter',
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Newsletter'), h('p', { class: 'muted' }, `${active.length} on the list · ${data.list.length - active.length} unsubscribed`))),
      msg,
      h('div', { class: 'cols' },
        h('div', { class: 'right' },
          h('section', { class: 'card stack' }, h('h2', {}, 'Write a newsletter'),
            h('label', { class: 'f' }, 'Subject', subj), h('label', { class: 'f' }, 'Newsletter', body),
            h('p', { class: 'small muted', style: 'margin:0' }, 'Your phone number, address and an unsubscribe link are added at the bottom automatically.'),
            h('div', { class: 'row', style: 'justify-content:flex-end' },
              h('button', { class: 'btn', onclick: async (e) => { e.target.disabled = true; try { const r = await api('newsletter-test', { subject: subj.value, body: body.value }); ok(`Test sent to ${r.to}. Check how it looks before sending to everyone.`); } catch (ex) { bad(ex.message); } e.target.disabled = false; } }, 'Send a test to me'),
              h('button', { class: 'btn gold', onclick: async () => {
                if (!confirm(`Send “${subj.value}” to ${active.length} people on the list?`)) return;
                try { const r = await api('newsletter-create', { subject: subj.value, body: body.value }); try { localStorage.removeItem('uvs-nl-draft'); } catch {} run(r.campaign.id); } catch (ex) { bad(ex.message); }
              } }, `Send to ${active.length} ${active.length === 1 ? 'person' : 'people'}`)),
            progress),
          h('section', { class: 'card stack' }, h('h2', {}, 'Sent newsletters'),
            data.campaigns.length ? h('ul', { class: 'list' }, data.campaigns.map((c) => h('li', { class: 'row', style: 'justify-content:space-between' },
              h('span', {}, h('strong', {}, c.subject), h('div', { class: 'small muted' }, `${fmtDateTime(c.created)} · sent ${c.sent} of ${c.total}${c.failed ? ` · ${c.failed} failed` : ''}`)),
              c.status !== 'sent' ? h('button', { class: 'btn small', onclick: () => { progress.scrollIntoView({ behavior: 'smooth' }); run(c.id); } }, 'Continue sending') : h('span', { class: 'tag' }, 'Sent')))) : h('p', { class: 'muted small' }, 'None yet.'))),
        h('div', { class: 'left' },
          h('section', { class: 'card stack' }, h('h2', {}, 'Add people'),
            h('label', { class: 'row small', for: 'nl-agree', style: 'align-items:flex-start;gap:8px;flex-wrap:nowrap' }, agree, h('span', { style: 'flex:1 1 200px' }, 'These people are my clients or have agreed to get emails from Unique Visa Services.')),
            h('h3', { style: 'margin:6px 0 0' }, 'One person'),
            h('div', { class: 'fields' }, nName, nEmail),
            h('button', { class: 'btn small', style: 'align-self:flex-start', onclick: () => { if (!nEmail.value.trim()) return nEmail.focus(); addPeople({ people: [{ name: nName.value, email: nEmail.value }] }); } }, 'Add'),
            h('h3', { style: 'margin:10px 0 0' }, 'Several at once'),
            paste, h('label', { class: 'f' }, 'Or choose a contacts file (CSV)', file),
            h('p', { class: 'small muted', style: 'margin:0' }, 'From Zoho Mail: open Contacts, select the ones to include, then Export as CSV and choose the file here.'),
            h('button', { class: 'btn small', style: 'align-self:flex-start', onclick: () => { if (!paste.value.trim()) return paste.focus(); addPeople({ text: paste.value }); } }, 'Add these contacts')),
          h('section', { class: 'card stack' }, h('h2', {}, 'People on the list'), subscriberTable(data.list, ok, bad)))));
  }
  function subscriberTable(list, ok, bad) {
    const q = h('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search the list' });
    const out = h('div');
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      const rows = list.filter((x) => !t || [x.email, x.name].some((v) => String(v || '').toLowerCase().includes(t))).slice(0, 300);
      put(out, rows.length ? h('ul', { class: 'list' }, rows.map((x) => h('li', { class: 'row', style: 'justify-content:space-between' },
        h('span', {}, x.name || x.email, h('div', { class: 'small muted' }, `${x.name ? x.email + ' · ' : ''}${x.status === 'subscribed' ? x.source : 'unsubscribed'}`)),
        x.status === 'subscribed' ? h('button', { class: 'btn link small', onclick: async () => { if (!confirm(`Take ${x.email} off the newsletter?`)) return; try { await api('newsletter-status', { email: x.email, status: 'unsubscribed' }); x.status = 'unsubscribed'; draw(); ok('Taken off the list.'); } catch (e) { bad(e.message); } } }, 'Take off') : null))) : h('p', { class: 'muted small' }, 'Nobody yet.'));
    };
    q.addEventListener('input', draw); draw();
    return h('div', { class: 'stack' }, q, out);
  }

  const syncIndex = (a) => {
    const i = apps.findIndex((x) => x.ref === a.ref);
    const s = { ...apps[i], ...a, invoices: (a.invoices || []).map((v) => ({ status: v.status, total: v.total, company: v.company })), people: (a.people || []).length, nextReminder: (a.reminders || []).filter((r) => !r.done).sort((x, y) => x.due.localeCompare(y.due)).map((r) => ({ due: r.due, text: r.text }))[0] || null };
    if (i >= 0) apps[i] = s; else apps.unshift(s);
  };

  // ---------- the invoice panel ----------
  function invoicePanel(a, onSaved, flash) {
    const travel = a.source === 'website' && !String(a.form || '').startsWith('client-');
    const st = { company: travel ? 'tvh' : 'uvs', to: a.invoiceTo === 'Company' && a.companyName ? 'Company' : 'Personal', lines: [] };
    const pageSlug = (a.pageUrl || cfg.forms[a.form] || '').replace(/^\/|\/$/g, '');
    let page = cfg.pages.find((p) => p.slug === pageSlug) || null;
    const feeVat = () => Number(st.company === 'tvh' ? me.settings.tvhFeeVat : me.settings.uvsFeeVat) || 0;
    const defaultLines = () => (st.company === 'tvh'
      ? [{ kind: 'embassy', description: `Embassy fee${page ? ` – ${page.title}` : ''}`, amount: 0, vat: 0 }, { kind: 'fee', description: 'Travel Visa Help service fee', amount: 0, vat: feeVat() }]
      : [{ kind: 'fee', description: `UVSUK fee${a.service ? ` – ${a.service}` : ''}`, amount: 0, vat: feeVat() }]);
    st.lines = defaultLines();
    if (st.company === 'tvh' && page && page.rows.length === 1) pickRow(page.rows[0]);
    function pickRow(r) {
      const e = st.lines.find((l) => l.kind === 'embassy'), f = st.lines.find((l) => l.kind === 'fee');
      const label = [r.service, r.detail].filter(Boolean).join(', ');
      if (e) { e.amount = amountOf(r.embassy); e.description = `Embassy fee – ${page.title}${label ? ` (${label})` : ''}`; }
      if (f) { f.amount = amountOf(r.fee); f.description = `Travel Visa Help service fee – ${page.title}${label ? ` (${label})` : ''}`; }
    }

    const card = h('section', { class: 'card stack' });
    const draw = () => {
      const pill = (on, label, click) => h('button', { type: 'button', class: 'pill', 'aria-pressed': String(on), onclick: click }, label);
      const isCo = st.to === 'Company';
      const billTo = isCo
        ? { name: a.companyName || '', email: a.email, phone: a.phone, address: a.companyAddress || '', companyNumber: a.companyNumber || '', isCompany: true, contactName: a.name }
        : { name: titleCase(a.name), email: a.email, phone: a.phone, address: a.address || '', isCompany: false };
      const conn = me.connections[me.companies[st.company].app];

      // Price picker from the website's price tables (travel visas)
      const priceArea = st.company === 'tvh' ? h('div', { class: 'stack' },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', { style: 'margin:0' }, page ? `Prices from the ${page.title} page` : 'Prices from the website'),
          h('select', { 'aria-label': 'Choose a page’s prices', style: 'max-width:320px', onchange: (e) => { page = cfg.pages.find((p) => p.slug === e.target.value) || null; st.lines = st.lines.map((l) => l.kind === 'embassy' ? { ...l, description: `Embassy fee${page ? ` – ${page.title}` : ''}` } : l); draw(); } },
            h('option', { value: '' }, 'Choose another page…'), cfg.pages.map((p) => h('option', { value: p.slug, selected: page && p.slug === page.slug }, `${p.country ? p.country + ' › ' : ''}${p.title}`)))),
        page ? h('div', { class: 'rows' }, page.rows.map((r) => h('button', { type: 'button', class: 'chip', onclick: () => { pickRow(r); draw(); } }, h('b', {}, [r.service, r.detail].filter(Boolean).join(' · ')), `Embassy ${r.embassy || '–'} + fee ${r.fee || '–'}`))) : h('p', { class: 'small muted' }, 'Pick the page to fill in the prices, or type them below.')) : null;

      const lineRows = st.lines.map((l, i) => h('div', { class: 'line' },
        h('input', { type: 'text', value: l.description, 'aria-label': `Line ${i + 1} description`, oninput: (e) => { l.description = e.target.value; } }),
        h('input', { type: 'number', class: 'amt', step: '0.01', min: '0', value: l.amount ? l.amount.toFixed(2) : '', placeholder: '0.00', 'aria-label': `Line ${i + 1} amount (£)`, oninput: (e) => { l.amount = Number(e.target.value) || 0; totals(); } }),
        h('select', { 'aria-label': `Line ${i + 1} VAT`, onchange: (e) => { l.vat = Number(e.target.value); totals(); } }, [0, 20].map((v) => h('option', { value: v, selected: Number(l.vat) === v }, v ? '+20% VAT' : 'No VAT'))),
        h('button', { type: 'button', class: 'btn link x', 'aria-label': `Remove line ${i + 1}`, title: 'Remove', onclick: () => { st.lines.splice(i, 1); draw(); } }, '✕')));

      const delivery = st.company === 'tvh' ? h('label', { class: 'f' }, 'Additional delivery',
        h('select', { onchange: (e) => {
          st.lines = st.lines.filter((l) => l.kind !== 'delivery');
          const opt = [...cfg.delivery, ...(cfg.evisaDelivery ? [{ service: 'eVisa posted copy', price: cfg.evisaDelivery }] : [])][Number(e.target.value)];
          if (opt) st.lines.push({ kind: 'delivery', description: `Delivery – ${opt.service}`, amount: amountOf(opt.price), vat: 0 });
          draw();
        } }, h('option', { value: '' }, 'None (collect from the office)'),
        [...cfg.delivery, ...(cfg.evisaDelivery ? [{ service: 'eVisa posted copy', price: cfg.evisaDelivery }] : [])].map((d, i) => h('option', { value: i, selected: st.lines.some((l) => l.kind === 'delivery' && l.description === `Delivery – ${d.service}`) }, `${d.service} · ${d.price}`)))) : null;

      const sub = h('span'), vatEl = h('span'), tot = h('strong');
      const totals = () => {
        const net = st.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
        const vat = st.lines.reduce((s, l) => s + (Number(l.amount) || 0) * (Number(l.vat) || 0) / 100, 0);
        sub.textContent = money(net); vatEl.textContent = money(vat); tot.textContent = money(net + vat);
      };

      const send = async (mode, btn) => {
        const missing = !billTo.name ? 'The invoice needs a name: add the company name in Client details.' : !billTo.email ? 'Add the client’s email in Client details first.' : '';
        if (missing) return flash(missing, true);
        const total = tot.textContent;
        const app = me.companies[st.company].appName;
        if (mode === 'send' && !confirm(`Create the invoice in ${app} and email it to ${billTo.email}?\n\n${billTo.name}\nTotal ${total}`)) return;
        if (mode === 'mark' && !confirm(`Create the invoice in ${app} and mark it as sent, without emailing the client?\n\nTotal ${total}`)) return;
        card.querySelectorAll('.inv-actions button').forEach((b) => { b.disabled = true; });
        btn.textContent = 'Working…';
        try {
          const r = await api('invoice', { ref: a.ref, invoice: { company: st.company, mode, billTo, lines: st.lines.map(({ description, amount, vat }) => ({ description, amount, vat })) } });
          flash(mode === 'send' ? `Invoice ${r.invoice.number} emailed to ${billTo.email}.` : mode === 'mark' ? `Invoice ${r.invoice.number} saved and marked as sent.` : `Draft invoice ${r.invoice.number} saved in ${app}.`);
          onSaved(r.app);
        } catch (e) { flash(e.message, true); draw(); }
      };

      const history = (a.invoices || []).slice().reverse();
      put(card, 
        h('h2', {}, 'Invoice'),
        h('div', { class: 'row', style: 'gap:20px;align-items:flex-start' },
          h('div', { class: 'stack', style: 'gap:6px' }, h('span', { class: 'small muted', style: 'font-weight:600' }, 'Bill from'),
            h('div', { class: 'pills' }, pill(st.company === 'tvh', 'Travel Visa Help · FreeAgent', () => { st.company = 'tvh'; st.lines = defaultLines(); draw(); }), pill(st.company === 'uvs', 'Unique Visa Services · Wave', () => { st.company = 'uvs'; st.lines = defaultLines(); draw(); }))),
          h('div', { class: 'stack', style: 'gap:6px' }, h('span', { class: 'small muted', style: 'font-weight:600' }, 'Invoice to'),
            h('div', { class: 'pills' }, pill(!isCo, 'Personal', () => { st.to = 'Personal'; draw(); }), pill(isCo, 'Company', () => { st.to = 'Company'; draw(); })))),
        h('div', { class: 'box small' }, h('div', { class: 'muted', style: 'font-weight:600;font-size:12px' }, 'BILLED TO'),
          h('div', { style: 'font-weight:600;font-size:15px' }, billTo.name || h('span', { class: 'muted' }, isCo ? 'No company name on the form: add it in Client details' : 'No name')),
          billTo.isCompany && billTo.companyNumber ? h('div', {}, `Company no. ${billTo.companyNumber}`) : null,
          billTo.address ? h('div', { style: 'white-space:pre-line' }, billTo.address) : null,
          h('div', {}, [billTo.phone, billTo.email].filter(Boolean).join(' · '))),
        !conn.connected ? h('p', { class: 'msg err small' }, `${me.companies[st.company].appName} isn’t connected yet. `, h('a', { href: '#settings' }, 'Connect it in Settings'), ' before saving or sending.') : null,
        priceArea,
        h('div', { class: 'stack', style: 'gap:8px' }, lineRows, h('button', { type: 'button', class: 'btn small', style: 'align-self:flex-start', onclick: () => { st.lines.push({ kind: 'extra', description: '', amount: 0, vat: 0 }); draw(); card.querySelectorAll('.line input[type=text]')[st.lines.length - 1]?.focus(); } }, '+ Add line')),
        delivery,
        h('div', { class: 'stack', style: 'gap:4px' },
          h('div', { class: 'row small muted', style: 'justify-content:space-between' }, 'Subtotal', sub),
          h('div', { class: 'row small muted', style: 'justify-content:space-between' }, 'VAT', vatEl),
          h('div', { class: 'total' }, h('span', { style: 'font-weight:600' }, 'Total'), tot)),
        h('div', { class: 'row inv-actions', style: 'justify-content:flex-end' },
          h('button', { class: 'btn', onclick: (e) => send('draft', e.currentTarget) }, 'Save as draft'),
          h('button', { class: 'btn', onclick: (e) => send('mark', e.currentTarget) }, 'Save as sent (no email)'),
          h('button', { class: 'btn gold', onclick: (e) => send('send', e.currentTarget) }, 'Send invoice to client')),
        history.length ? h('div', { class: 'stack', style: 'gap:6px' }, h('h3', {}, 'Invoices for this application'),
          h('ul', { class: 'list' }, history.map((i) => h('li', { class: 'row', style: 'justify-content:space-between' },
            h('span', {}, `${i.number ? `#${i.number} · ` : ''}${money(i.total)} · ${me.companies[i.company]?.name || ''}`, h('div', { class: 'small muted' }, `${i.status === 'draft' ? 'Draft' : i.status === 'marked sent' ? 'Marked as sent' : 'Emailed'} ${fmtDateTime(i.at)}${i.test ? ' · made from the test copy' : ''}`)),
            i.openUrl ? h('a', { class: 'btn small', href: i.openUrl, target: '_blank', rel: 'noopener' }, `Open in ${i.app === 'wave' ? 'Wave' : 'FreeAgent'}`) : null)))) : null);
      totals();
    };
    draw();
    return card;
  }

  // ---------- new record (phone enquiries, UK immigration clients) ----------
  function newRecord() {
    const fromRef = decodeURIComponent((location.hash.split('/')[1] || ''));
    const base = apps.find((x) => x.ref === fromRef) || {};
    const inputs = {};
    const f = (k, label, type = 'text', value = '') => h('label', { class: 'f' }, label, inputs[k] = type === 'textarea' ? h('textarea', {}, value) : h('input', { type, value }));
    const to = h('select', {}, h('option', { value: 'Personal' }, 'Personal'), h('option', { value: 'Company' }, 'Company'));
    const err = h('div', { role: 'alert' });
    frame('new',
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'New record'), h('p', { class: 'muted' }, 'For phone and walk-in enquiries, or UK immigration clients who didn’t use an online form.'))),
      h('section', { class: 'card stack', style: 'max-width:760px' },
        h('div', { class: 'fields' }, f('name', 'Client name', 'text', base.name || ''), f('email', 'Email', 'email', base.email || ''), f('phone', 'Phone', 'tel', base.phone || ''), f('service', 'Service (e.g. Spouse visa extension)')),
        f('address', 'Home address', 'textarea'),
        h('label', { class: 'f' }, 'Invoice to', to),
        h('div', { class: 'fields' }, f('companyName', 'Company name (if a company is paying)', 'text', base.companyName || ''), f('companyNumber', 'Company number')),
        f('companyAddress', 'Company address', 'textarea'),
        err,
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async (e) => {
          e.target.disabled = true;
          try { const r = await api('create', { ...Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])), invoiceTo: to.value }); syncIndex(r.app); go(`app/${r.app.ref}`); }
          catch (ex) { put(err, h('p', { class: 'msg err' }, ex.message)); e.target.disabled = false; }
        } }, 'Create record'))));
    inputs.name.focus();
  }

  // ---------- settings ----------
  function settings() {
    const s = me.settings;
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const ok = (t) => put(msg, h('p', { class: 'msg ok' }, t));
    const bad = (t) => put(msg, h('p', { class: 'msg err' }, t));
    const onLive = !me.preview;
    const connCard = (app, name, company) => {
      const c = me.connections[app];
      return h('section', { class: 'card stack' }, h('h2', {}, `${name} · ${company}`),
        c.connected ? h('p', {}, h('span', { class: 'tag' }, 'Connected'), c.companyName ? ` to ${c.companyName}` : '', h('span', { class: 'small muted' }, ` since ${fmtDate(c.since)}`))
          : !c.keys ? h('p', { class: 'small' }, `Step 1: make a free developer app at ${app === 'wave' ? 'developer.waveapps.com' : 'dev.freeagent.com'}, with the callback address `, h('code', {}, `https://www.uvsuk.co.uk/office/connect/${app}/callback`), `. Step 2: add its keys in Netlify as ${app === 'wave' ? 'WAVE_CLIENT_ID and WAVE_CLIENT_SECRET' : 'FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET'}.`)
          : h('p', { class: 'small muted' }, onLive ? 'Ready to connect. You’ll sign in to ' + name + ' and approve access.' : 'Connect from the live site (www.uvsuk.co.uk/office/), as the sign-in only returns there.'),
        h('div', { class: 'row' },
          c.keys && onLive ? h('a', { class: 'btn primary small', href: `/office/connect/${app}` }, c.connected ? 'Reconnect' : 'Connect') : null,
          c.connected ? h('button', { class: 'btn small', onclick: async () => { if (!confirm(`Disconnect ${name}?`)) return; await api('disconnect', { app }); me = await get('me'); settings(); } }, 'Disconnect') : null));
    };
    const terms = h('input', { type: 'number', min: '0', max: '120', value: s.paymentTermsDays });
    const days = h('input', { type: 'number', min: '1', max: '365', value: s.reminderDays });
    const nlLimit = h('input', { type: 'number', min: '1', max: '2000', value: s.newsletterDailyLimit || 200 });
    const vatSel = (v) => h('select', {}, [0, 20].map((x) => h('option', { value: x, selected: Number(v) === x }, x ? '+20% VAT' : 'No VAT')));
    const tvhVat = vatSel(s.tvhFeeVat), uvsVat = vatSel(s.uvsFeeVat);
    const waveBox = h('div', { class: 'stack' });
    const loadWave = async () => {
      put(waveBox, h('p', { class: 'muted small' }, 'Loading your Wave products…'));
      try {
        const cat = await get('wave-catalogue');
        const sel = (v, blank) => h('select', {}, h('option', { value: '' }, blank), cat.products.map((p) => h('option', { value: p.id, selected: p.id === v }, p.name)));
        const main = sel(s.waveProductMain, 'Choose…'), other = sel(s.waveProductOther, 'Same as the first line');
        const tax = h('select', {}, h('option', { value: '' }, 'None'), cat.taxes.map((t) => h('option', { value: t.id, selected: t.id === s.waveVatTaxId }, `${t.name} (${t.rate}%)`)));
        put(waveBox, h('p', { class: 'small muted' }, 'Wave needs every invoice line to use one of your Wave products. The description is still what you type.'),
          h('div', { class: 'fields' }, h('label', { class: 'f' }, 'Product for the UVSUK fee line', main), h('label', { class: 'f' }, 'Product for other lines', other), h('label', { class: 'f' }, 'VAT tax (for lines with +20% VAT)', tax)),
          h('button', { class: 'btn small', style: 'align-self:flex-start', onclick: async () => { try { me.settings = (await api('settings', { waveProductMain: main.value, waveProductOther: other.value, waveVatTaxId: tax.value })).settings; ok('Wave settings saved'); } catch (e) { bad(e.message); } } }, 'Save Wave settings'));
      } catch (e) { put(waveBox, h('p', { class: 'msg err small' }, e.message)); }
    };
    frame('settings',
      h('div', { class: 'head' }, h('h1', {}, 'Settings'), h('button', { class: 'btn', onclick: async () => { await api('logout', {}); showLogin('You’ve signed out.'); } }, 'Sign out')),
      msg,
      h('div', { class: 'grid' }, connCard('freeagent', 'FreeAgent', 'Travel Visa Help'), connCard('wave', 'Wave', 'Unique Visa Services')),
      me.connections.wave.connected ? h('section', { class: 'card stack', style: 'margin-top:16px' }, h('h2', {}, 'Wave invoice lines'), waveBox) : null,
      h('section', { class: 'card stack', style: 'margin-top:16px' }, h('h2', {}, 'Invoices and reminders'),
        h('div', { class: 'fields' },
          h('label', { class: 'f' }, 'Payment terms (days, 0 = due on receipt)', terms),
          h('label', { class: 'f' }, 'Travel Visa Help fee: default VAT', tvhVat),
          h('label', { class: 'f' }, 'UVSUK fee: default VAT', uvsVat),
          h('label', { class: 'f' }, 'Show visas expiring within (days)', days),
          h('label', { class: 'f' }, 'Newsletter: most emails to send a day', nlLimit)),
        h('button', { class: 'btn primary small', style: 'align-self:flex-start', onclick: async () => {
          try { me.settings = (await api('settings', { paymentTermsDays: terms.value, reminderDays: days.value, newsletterDailyLimit: nlLimit.value, tvhFeeVat: tvhVat.value, uvsFeeVat: uvsVat.value })).settings; ok('Settings saved'); } catch (e) { bad(e.message); }
        } }, 'Save')),
      h('section', { class: 'card stack', style: 'margin-top:16px' }, h('h2', {}, 'Import past applications'),
        h('p', { class: 'small', style: 'margin:0' }, 'Bring in applications sent through your website forms before the back office existed. Ones already here are skipped, so it’s safe to press more than once.'),
        h('p', { class: 'small muted', style: 'margin:0' }, 'One-time setup: in Netlify, click your profile picture › User settings › Applications › Personal access tokens › New access token. Copy it, then add it to the site as an environment variable called NETLIFY_API_TOKEN (tick “Contains secret values”, put it in Production) and rebuild the site.'),
        h('button', { class: 'btn primary small', style: 'align-self:flex-start', onclick: async (e) => {
          e.target.disabled = true; e.target.textContent = 'Importing…';
          try { const r = await api('import-forms', {}); await loadApps(); ok(`Imported ${r.added} past application${r.added === 1 ? '' : 's'}${r.skipped ? ` (${r.skipped} already here)` : ''}.`); }
          catch (ex) { bad(ex.message); }
          e.target.disabled = false; e.target.textContent = 'Import past applications';
        } }, 'Import past applications')),
      h('section', { class: 'card stack', style: 'margin-top:16px' }, h('h2', {}, 'Records'),
        h('p', { class: 'small muted' }, 'If the lists ever look out of date, rebuild them from the saved records.'),
        h('button', { class: 'btn small', style: 'align-self:flex-start', onclick: async () => { try { const r = await api('rebuild', {}); await loadApps(); ok(`Rebuilt: ${r.count} records.`); } catch (e) { bad(e.message); } } }, 'Rebuild lists')));
    if (me.connections.wave.connected) loadWave();
  }

  start();
}
