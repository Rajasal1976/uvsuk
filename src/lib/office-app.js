// The back office screens (/office/). Talks to netlify/functions/office-api.mjs.
// Pages: Home (what needs doing), Applications, Diary (appointments), To do (simple list with photos), Messages (phone messages), Clients, one record (details + invoice), New record, Settings.

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
const putInto = put;
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
  let openMsgs = 0; // phone messages not dealt with yet (shown on the menu)
  const countMsgs = async () => { try { openMsgs = (await get('messages')).messages.filter((m) => !m.done).length; } catch {} const b = root.querySelector('.of-nav .badge'); if (b) { b.textContent = openMsgs; b.hidden = !openMsgs; } };

  async function api(action, body) {
    const res = await fetch(`/office/api/${action}${body === undefined ? '' : ''}`, body === undefined
      ? { credentials: 'same-origin' }
      : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Office': '1' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    if (res.status === 401 && action !== 'login') { me = null; showLogin(); throw new Error('Please sign in again.'); }
    if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { data });
    return data;
  }
  const get = (action) => api(action);

  // ---------- sign in ----------
  async function showLogin(message) {
    const turn = (showLogin.turn = (showLogin.turn || 0) + 1);
    root.innerHTML = '';
    // People with their own password (Raj, Sunita). The last choice is remembered on this device.
    const people = (await get('login-options').catch(() => ({}))).people || [];
    if (turn !== showLogin.turn) return; // called again while waiting: only draw once
    root.innerHTML = '';
    let name = '';
    try { name = localStorage.getItem('uvs-office-who') || ''; } catch {}
    if (!people.includes(name)) name = people.length === 1 ? people[0] : '';
    const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
    const err = h('p', { class: 'msg err', hidden: !message, role: 'alert' }, message || '');
    const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Sign in');
    const whoBox = h('div', { class: 'pills', role: 'group', 'aria-label': 'Who are you?' });
    const drawWho = () => put(whoBox, people.map((p) => h('button', { type: 'button', class: 'pill', 'aria-pressed': String(name === p), onclick: () => { name = p; drawWho(); pw.focus(); } }, p)));
    if (people.length) drawWho();
    const form = h('form', { class: 'card login stack', onsubmit: async (e) => {
      e.preventDefault();
      if (people.length && !name) { err.textContent = 'Tap your name first.'; err.hidden = false; return; }
      btn.disabled = true; err.hidden = true;
      try { await api('login', { password: pw.value, name }); try { localStorage.setItem('uvs-office-who', name); } catch {} await start(); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; pw.select(); }
    } },
    h('div', { class: 'of-brand', style: 'color:var(--green)' }, h('span', {}, 'UVS'), 'Back office'),
    people.length ? h('div', { class: 'stack', style: 'gap:6px' }, h('span', { class: 'small', style: 'font-weight:600;color:var(--muted)' }, 'Who are you?'), whoBox) : null,
    h('label', { class: 'f', for: 'pw' }, people.length ? 'Your password' : 'Password', pw), err, btn);
    root.append(form);
    if (!people.length || name) pw.focus();
  }

  let unreadMail = 0; // emails not opened yet, across this person's mailboxes
  const showMailBadge = () => { const b = root.querySelector('.of-nav .mail-badge'); if (b) { b.textContent = unreadMail; b.hidden = !unreadMail; } };
  const countMail = async () => { if (!me?.user) return; try { const d = await get('mail'); unreadMail = d.accounts.reduce((n, a) => n + (a.unread || 0), 0); showMailBadge(); } catch {} };

  async function start() {
    try { me = await get('me'); } catch (e) { if (!me) return showLogin(); }
    await Promise.all([loadApps(), countMsgs(), countMail()]);
    if (!start.timer) start.timer = setInterval(() => { if (document.visibilityState === 'visible') countMail(); }, 120000);
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
        h('nav', { class: 'of-nav', 'aria-label': 'Back office' }, link('home', 'Home'), link('apps', 'Applications'), link('diary', 'Diary'), link('todo', 'To do'), me?.user ? h('a', { href: '#mail', 'aria-current': current === 'mail' ? 'page' : false }, 'Email ', h('span', { class: 'badge mail-badge', hidden: !unreadMail }, String(unreadMail))) : null, h('a', { href: '#messages', 'aria-current': current === 'messages' ? 'page' : false }, 'Messages ', h('span', { class: 'badge', hidden: !openMsgs }, String(openMsgs))), link('clients', 'Clients'), link('contacts', 'Address book'), link('newsletter', 'Newsletter'), link('new', '+ New record'), link('settings', 'Settings'), h('a', { href: '/admin/' }, 'Edit website ↗'))),
      h('main', { class: 'of-main' },
        me?.preview ? h('p', { class: 'of-banner' }, h('strong', {}, 'Test copy. '), 'You’re on a preview of the site, so the records here are test records, kept apart from your real ones. Invoices made here still go to your real FreeAgent and Wave, so delete any test invoices there.') : null,
        ...content));
    window.scrollTo(0, 0);
  }

  function route() {
    const [view, ...rest] = (location.hash.slice(1) || 'home').split('/');
    const arg = decodeURIComponent(rest.join('/'));
    ({ home, apps: appsView, clients, client: () => clientView(arg), app: () => recordView(arg), new: newRecord, newsletter, settings, diary: () => diaryView(arg), todo: () => todoView(arg), messages: messagesView, contacts: contactsView, mail: () => mailView(arg) }[view] || home)();
  }
  const go = (hash) => { if (location.hash === `#${hash}`) route(); else location.hash = hash; };

  const statusTag = (s) => h('span', { class: `tag${s === 'New' ? ' new' : ''}` }, s);
  const invoiceTag = (a) => {
    const inv = a.invoices || [];
    if (!inv.length) return h('span', { class: 'muted small' }, 'Not invoiced');
    const last = inv[inv.length - 1];
    return h('span', { class: `tag${last.status === 'draft' ? ' draft' : ''}` }, `${last.status === 'draft' ? 'Draft' : last.status === 'marked sent' ? 'Marked sent' : 'Sent'} ${money(last.total)}`);
  };

  // Two small buttons for any client: book in the diary, or put on the to-do list
  const quickBtns = (a) => h('span', { class: 'quick', onclick: (e) => e.stopPropagation(), onkeydown: (e) => e.stopPropagation() },
    h('a', { class: 'btn small', href: `#diary/new/${encodeURIComponent(a.ref)}` }, 'Diary'),
    h('a', { class: 'btn small', href: `#todo/${encodeURIComponent(a.ref)}` }, 'To do'));

  function appTable(list, empty = 'Nothing here yet.') {
    if (!list.length) return h('p', { class: 'muted' }, empty);
    return h('div', { class: 'tablebox' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Received'), h('th', {}, 'Client'), h('th', {}, 'Service'), h('th', {}, 'Status'), h('th', {}, 'Invoice'), h('th', {}, ''))),
      h('tbody', {}, list.map((a) => h('tr', { class: 'click', tabindex: '0', onclick: () => go(`app/${a.ref}`), onkeydown: (e) => { if (e.key === 'Enter') go(`app/${a.ref}`); } },
        h('td', {}, fmtDate(a.received), h('div', { class: 'small muted' }, a.ref)),
        h('td', {}, titleCase(a.name) || '–', a.companyName ? h('div', { class: 'small muted' }, a.companyName) : null, a.people > 1 ? h('div', { class: 'small muted' }, `${a.people} people`) : null),
        h('td', {}, a.formTitle || '', a.service ? h('div', { class: 'small muted' }, a.service) : null),
        h('td', {}, statusTag(a.status)),
        h('td', {}, invoiceTag(a)),
        h('td', {}, quickBtns(a)))))));
  }

  // ---------- home ----------
  function home() {
    const days = Number(me.settings?.reminderDays) || 90;
    const fresh = apps.filter((a) => a.status === 'New');
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
        notifyCard(true),
        todayBox(),
        messagesBox(),
        draftsBox(),
        box('New applications', fresh.length, mini(fresh, (a) => `${a.formTitle || ''} · ${fmtDate(a.received)}`)),
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
        h('thead', {}, h('tr', {}, h('th', {}, 'Client'), h('th', {}, 'Contact'), h('th', {}, 'Applications'), h('th', {}, 'Last activity'), h('th', {}, 'Next visa expiry'), h('th', {}, ''))),
        h('tbody', {}, list.map((c) => h('tr', { class: 'click', tabindex: '0', onclick: () => go(`client/${encodeURIComponent(c.key)}`), onkeydown: (e) => { if (e.key === 'Enter') go(`client/${encodeURIComponent(c.key)}`); } },
          h('td', {}, titleCase(c.name) || '–', c.companies.size ? h('div', { class: 'small muted' }, [...c.companies].join(', ')) : null),
          h('td', {}, c.email || '', h('div', { class: 'small muted' }, c.phone || '')),
          h('td', {}, String(c.apps.length)), h('td', {}, fmtDate(c.last)), h('td', {}, c.expiry ? fmtDate(c.expiry) : h('span', { class: 'muted' }, '–')), h('td', {}, quickBtns(c.apps[0]))))))) : h('p', { class: 'muted' }, 'No clients match.'));
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
        h('div', { class: 'row' }, quickBtns(c.apps[0]), h('button', { class: 'btn primary', onclick: () => go(`new/${encodeURIComponent(c.apps[0].ref)}`) }, '+ New application for this client'))),
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
        a.email ? newsletterToggle(a) : null,
        clientAppointments(a));

      // To do (shared with the diary)
      const reminders = clientTodos(a, async () => { try { a = (await get(`app?ref=${encodeURIComponent(a.ref)}`)).app; syncIndex(a); } catch {} draw(); });

      // Notes
      const nText = h('textarea', { placeholder: 'Add a note', 'aria-label': 'Note' });
      const notes = h('section', { class: 'card stack' }, h('h2', {}, 'Notes'), nText,
        h('button', { class: 'btn small', style: 'align-self:flex-start', onclick: async () => { if (!nText.value.trim()) return nText.focus(); if (await save({ addNote: nText.value }, 'Note added')) draw(); } }, 'Add note'),
        (a.notes || []).length ? h('ul', { class: 'list' }, a.notes.map((n) => h('li', {}, h('div', { class: 'small muted' }, fmtDateTime(n.at)), h('div', { style: 'white-space:pre-line' }, n.text)))) : null);

      put(root.querySelector('.of-main'), 
        ...(me.preview ? [h('p', { class: 'of-banner' }, h('strong', {}, 'Test copy. '), 'Records here are test records. Invoices still go to your real FreeAgent and Wave.')] : []),
        h('p', {}, h('a', { href: '#apps' }, '← Applications'), a.email || a.name ? [' · ', h('a', { href: `#client/${encodeURIComponent(clientKey(a))}` }, 'Client page')] : null),
        h('div', { class: 'head' }, h('div', {}, h('h1', {}, `${a.formTitle || 'Client record'}${a.service ? `: ${a.service}` : ''}`), h('p', { class: 'muted' }, `${titleCase(a.name)} · Received ${fmtDateTime(a.received)} · Ref ${a.ref}`)), h('div', { class: 'row' }, quickBtns(a), statusTag(a.status))),
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

  // ---------- diary ----------
  // Appointments plus to-dos (call a client, put a visa form through…). Reminders added on a
  // client's record show here as to-dos too, so there's one list of everything to do.
  let diaryCache = null;
  const loadDiary = async () => (diaryCache = await get('diary'));
  const endOf = (start, mins) => { const [hh, mm] = start.split(':').map(Number); const t = hh * 60 + mm + Number(mins); return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  const mondayOf = (iso) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const plusDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const localToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const dayName = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
    const apptName = (x) => x.clientName || x.title;

  // Every to-do in one shape: diary to-dos and client-record reminders
  const todoItems = (d) => [
    ...(d.tasks || []).map((t) => ({ ...t, kind: 'task' })),
    ...(d.reminders || []).map((r) => ({ kind: 'reminder', id: r.id, title: r.text, due: r.due, time: '', who: '', ref: r.ref, clientName: r.clientName, clientPhone: r.clientPhone, notes: '', done: false })),
  ].sort((a, b) => `${a.due} ${a.time || '99'}`.localeCompare(`${b.due} ${b.time || '99'}`));

  async function tick(item) {
    if (item.kind === 'reminder') {
      const r = await api('update', { ref: item.ref, patch: { doneReminder: item.id } });
      syncIndex(r.app);
    } else await api('task-done', { id: item.id, done: !item.done });
    await loadDiary();
  }

  // Phone numbers in a to-do become tap-to-call links
  function withLinks(text) {
    const out = []; let last = 0; let m;
    const re = /(\+?\d[\d ]{8,15}\d)/g;
    while ((m = re.exec(text))) {
      const digits = m[1].replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) continue;
      out.push(text.slice(last, m.index), h('a', { href: `tel:${m[1].replace(/[^\d+]/g, '')}`, onclick: (e) => e.stopPropagation() }, m[1]));
      last = m.index + m[1].length;
    }
    out.push(text.slice(last));
    return out;
  }
  const photoUrl = (id) => `/office/api/photo?id=${encodeURIComponent(id)}`;
  // Full-size photo over the page (works inside the installed app, where new tabs can lose the sign-in)
  function showPhoto(url) {
    const close = () => { box.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const box = h('div', { class: 'photo-view', role: 'dialog', 'aria-label': 'Photo', onclick: (e) => { if (e.target === box) close(); } },
      h('img', { src: url, alt: 'Photo' }),
      h('div', { class: 'row' }, h('a', { class: 'btn small', href: url, download: 'photo.jpg' }, 'Save photo'), h('button', { class: 'btn primary small', onclick: close }, 'Close')));
    document.addEventListener('keydown', esc);
    document.body.append(box);
  }
  // Open to-dos in the order they were added (line 1 = the first one)
  const byDay = (a, b) => `${a.due} ${a.created || ''}`.localeCompare(`${b.due} ${b.created || ''}`);
  const openTodos = (d) => todoItems(d).filter((t) => !t.done && t.due <= localToday()).sort(byDay);

  // One line: tick box, number, text (tap to change), photo, delete. opts: { n, onChange }
  function todoRow(t, opts = {}) {
    const box = h('input', { type: 'checkbox', checked: t.done, 'aria-label': `Done: ${t.title}` });
    box.addEventListener('change', async () => {
      box.disabled = true;
      try { await tick(t); opts.onChange?.(); } catch (e) { box.checked = !box.checked; box.disabled = false; alert(e.message); }
    });
    let row;
    const edit = () => {
      if (t.kind !== 'task' || row.querySelector('.td-edit')) return;
      const f = contactFields(t);
      const title = h('input', { type: 'text', value: t.title, 'aria-label': 'What needs doing' });
      const save = async (btn) => {
        btn.disabled = true;
        try { await api('task-save', { id: t.id, title: title.value, ...f.values(), ...(t.photo ? { photo: t.photo } : {}) }); await loadDiary(); opts.onChange?.(); }
        catch (e) { btn.disabled = false; alert(e.message); }
      };
      row.replaceChildren(h('div', { class: 'td-edit stack', style: 'gap:8px;flex:1' }, title, f.box,
        h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { type: 'button', class: 'btn small', onclick: () => opts.onChange?.() }, 'Cancel'), h('button', { type: 'button', class: 'btn primary small', onclick: (e) => save(e.currentTarget) }, 'Save'))));
      title.focus();
    };
    const meta = [
      t.clientName ? (t.ref ? h('a', { href: `#app/${encodeURIComponent(t.ref)}` }, titleCase(t.clientName)) : titleCase(t.clientName)) : null,
      t.clientPhone && !String(t.title).replace(/\s/g, '').includes(t.clientPhone.replace(/\s/g, '')) ? h('a', { href: `tel:${t.clientPhone.replace(/[^\d+]/g, '')}`, onclick: (e) => e.stopPropagation() }, t.clientPhone) : null,
      t.clientEmail ? h('a', { href: `mailto:${t.clientEmail}`, onclick: (e) => e.stopPropagation() }, t.clientEmail) : null,
      opts.showDue ? dayName(t.due) : null,
      t.kind === 'reminder' ? 'from client record' : null,
    ].filter(Boolean);
    return row = h('li', { class: `td-item${t.done ? ' done' : ''}` }, box,
      opts.n ? h('span', { class: 'td-num' }, `${opts.n}.`) : null,
      h('div', { class: 'td-text', title: t.kind === 'task' ? 'Tap to change' : null, onclick: edit },
        h('div', {}, withLinks(t.title)),
        meta.length ? h('div', { class: 'small muted' }, meta.flatMap((x, i) => (i ? [' · ', x] : [x]))) : null,
        t.notes ? h('div', { class: 'small muted', style: 'white-space:pre-line' }, t.notes) : null),
      t.photo ? h('a', { href: photoUrl(t.photo), onclick: (e) => { e.preventDefault(); e.stopPropagation(); showPhoto(photoUrl(t.photo)); } }, h('img', { class: 'td-thumb', src: photoUrl(t.photo), alt: 'Photo', loading: 'lazy' })) : null,
      t.kind === 'task' && !t.done ? moveBtn(t, opts) : null,
      t.kind === 'task' ? h('button', { class: 'td-x', 'aria-label': `Delete: ${t.title}`, onclick: async () => {
        if (!confirm(`Delete “${t.title}”?`)) return;
        try { await api('task-delete', { id: t.id }); await loadDiary(); opts.onChange?.(); } catch (e) { alert(e.message); }
      } }, '×') : null);
  }

  // Optional name, phone, email and note for a to-do
  function contactFields(x = {}) {
    const name = h('input', { type: 'text', value: x.clientName || '', placeholder: 'Name', 'aria-label': 'Name', autocomplete: 'off' });
    const phone = h('input', { type: 'tel', value: x.clientPhone || '', placeholder: 'Phone', 'aria-label': 'Phone', autocomplete: 'off' });
    const email = h('input', { type: 'email', value: x.clientEmail || '', placeholder: 'Email', 'aria-label': 'Email', autocomplete: 'off' });
    const notes = h('textarea', { placeholder: 'Note (optional)', 'aria-label': 'Note', style: 'min-height:56px' }, x.notes || '');
    return { box: h('div', { class: 'stack', style: 'gap:8px' }, h('div', { class: 'fields' }, name, phone, email), notes),
      values: () => ({ clientName: name.value, clientPhone: phone.value, clientEmail: email.value, notes: notes.value }),
      set: (v) => { name.value = v.clientName || ''; phone.value = v.clientPhone || ''; email.value = v.clientEmail || ''; } };
  }

  // 📅 on a line: move it to another day
  function moveBtn(t, opts) {
    const pick = h('input', { type: 'date', value: t.due, 'aria-label': `Move “${t.title}” to another day`, class: 'td-date' });
    pick.addEventListener('change', async () => {
      if (!pick.value || pick.value === t.due) return;
      try { await api('task-save', { id: t.id, title: t.title, due: pick.value, ...(t.photo ? { photo: t.photo } : {}) }); await loadDiary(); opts.onChange?.(); } catch (e) { alert(e.message); }
    });
    return h('label', { class: 'td-move', title: 'Move to another day' }, '📅', pick);
  }

  // Make phone photos small enough to upload quickly
  async function shrinkPhoto(f) {
    try {
      const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' });
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.82);
    } catch {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error('This photo can’t be read here. Try a screenshot of it instead.');
      if (f.size > 4e6) throw new Error('That photo is too big.');
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Couldn’t read the photo.')); r.readAsDataURL(f); });
    }
  }

  // ---------- phone notifications ----------
  // Each phone/computer turns notifications on once and says whose it is (Raj or Sunita).
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.go) location.href = e.data.go; });
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const b64ToBytes = (b64) => { const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  async function currentSub() {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.getRegistration('/office/');
    return reg ? reg.pushManager.getSubscription() : null;
  }

  // compact: shown on Home only when this device hasn't turned them on yet
  function notifyCard(compact = false) {
    const sec = h('section', { class: 'card stack', style: 'gap:10px', hidden: true });
    const put = (el, ...kids) => { el.hidden = false; return putInto(el, ...kids); };
    const draw = async () => {
      if (!pushSupported()) {
        if (compact) return sec.remove();
        return put(sec, h('h2', {}, 'Phone notifications'), h('p', { class: 'muted small', style: 'margin:0' },
          isIos && !installed ? 'On an iPhone, first add the back office to your Home Screen (Safari › Share › Add to Home Screen), open it from there, then come back here.' : 'This browser can’t show notifications. Use Chrome, Edge or Safari, or the installed UVS Office app.'));
      }
      const sub = await currentSub().catch(() => null);
      if (sub && Notification.permission === 'granted') {
        const person = (await api('push-who', { endpoint: sub.endpoint }).catch(() => ({}))).person || '';
        if (compact) return sec.remove();
        return put(sec, h('h2', {}, 'Phone notifications'),
          h('p', { style: 'margin:0' }, '✅ On for ', h('strong', {}, person || 'everyone'), ' on this device.'),
          h('p', { class: 'muted small', style: 'margin:0' }, 'You’ll get new emails, phone messages, new applications, appointment reminders (30 minutes before) and the 8am summary.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await api('push-test', { endpoint: sub.endpoint }); alert(r.sent ? 'Test sent. It should pop up in a few seconds.' : 'Nothing was sent. Try turning notifications off and on again.'); } catch (x) { alert(x.message); } e.currentTarget.disabled = false; } }, 'Send a test'),
            h('button', { class: 'btn link small', onclick: async () => { await api('push-unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); draw(); } }, 'Turn off on this device')));
      }
      if (Notification.permission === 'denied') {
        return put(sec, h('h2', {}, 'Phone notifications'), h('p', { class: 'muted small', style: 'margin:0' }, 'Notifications are blocked for this site. Allow them in your phone’s settings for the UVS Office app (or the browser’s site settings), then come back here.'));
      }
      const people = (me?.settings?.diaryPeople || []).filter((p) => p.name).length ? me.settings.diaryPeople.filter((p) => p.name) : [{ name: 'Raj' }, { name: 'Sunita' }];
      const turnOn = async (name, btn) => {
        btn.disabled = true;
        try {
          if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications weren’t allowed. Tap Allow when your phone asks.');
          const reg = await navigator.serviceWorker.register('/office/sw.js', { scope: '/office/' });
          await navigator.serviceWorker.ready;
          const { key } = await get('push-key');
          let s2 = await reg.pushManager.getSubscription();
          if (s2) await s2.unsubscribe();
          s2 = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
          await api('push-subscribe', { subscription: s2.toJSON(), person: name });
          await api('push-test', { endpoint: s2.endpoint }).catch(() => {});
          compact = false; draw();
        } catch (x) { btn.disabled = false; alert(x.message); }
      };
      put(sec, h('h2', {}, '🔔 Turn on phone notifications'),
        h('p', { class: 'muted small', style: 'margin:0' }, 'Get a pop-up for new emails, phone messages, new applications, appointment reminders and the 8am summary. Whose phone is this?'),
        h('div', { class: 'row' }, people.map((p) => h('button', { class: 'btn primary', onclick: (e) => turnOn(p.name, e.currentTarget) }, p.name))));
    };
    draw();
    return sec;
  }

  // ---------- saved forms (clients who pressed "Save and finish later") ----------
  function draftsBox() {
    const sec = h('section', { class: 'card', hidden: true });
    get('drafts').then(({ drafts }) => {
      if (!drafts.length) return;
      sec.hidden = false;
      put(sec, h('h2', {}, 'Saved forms, not sent yet ', h('span', { class: 'muted' }, `(${drafts.length})`)),
        h('p', { class: 'muted small' }, 'Clients who pressed “Save and finish later” on a website form. Worth a call. They’re kept for 30 days.'),
        h('ul', { class: 'td-list' }, drafts.map((d) => h('li', { class: 'td-item' },
          h('div', { class: 'td-text', style: 'cursor:default' },
            h('div', {}, h('strong', {}, d.name || d.email), ' · ', d.formTitle),
            h('div', { class: 'small muted' }, [
              h('a', { href: `mailto:${d.email}` }, d.email),
              d.phone ? h('a', { href: `tel:${d.phone.replace(/[^\d+]/g, '')}` }, d.phone) : null,
              `saved ${fmtDateTime(d.saved)}`,
              d.documents ? `${d.documents} document${d.documents > 1 ? 's' : ''}` : 'no documents yet',
              d.people > 1 ? `${d.people} people` : null,
            ].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x])))),
          h('a', { class: 'btn small', href: `#todo`, onclick: () => { todoView.prefill = { title: `Call ${d.name || d.email} about their saved ${d.formTitle}`, clientName: d.name, clientPhone: d.phone, clientEmail: d.email }; } }, 'To do')))));
    }).catch(() => {});
    return sec;
  }

  // ---------- address book ----------
  // Read a contacts file: CSV from Zoho Mail, Google, Outlook, FreeAgent, or a vCard (.vcf) from a phone
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',' || c === ';' || c === '\t') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  function contactsFromFile(text) {
    text = text.replace(/^﻿/, '');
    if (/BEGIN:VCARD/i.test(text)) {
      return text.replace(/\r?\n[ \t]/g, '').split(/BEGIN:VCARD/i).slice(1).map((card) => {
        const val = (re) => { const m = card.match(re); return m ? m[1].replace(/\\,/g, ',').replace(/\;/g, ';').trim() : ''; };
        const all = (re) => [...card.matchAll(re)].map((m) => ({ type: m[1] || '', v: m[2].trim() }));
        const tels = all(/^TEL([^:]*):(.+)$/gim);
        const mob = tels.find((t) => /cell|mobile|iphone/i.test(t.type));
        const n = val(/^N[^:]*:(.+)$/im).split(';');
        return {
          name: val(/^FN[^:]*:(.+)$/im) || [n[1], n[0]].filter(Boolean).join(' '),
          company: val(/^ORG[^:]*:(.+)$/im).split(';')[0],
          email: val(/^EMAIL[^:]*:(.+)$/im),
          mobile: mob?.v || '', phone: tels.find((t) => t !== mob)?.v || '',
          address: val(/^ADR[^:]*:(.+)$/im).split(';').filter(Boolean).join(', '),
          notes: val(/^NOTE[^:]*:(.+)$/im),
        };
      });
    }
    const rows = parseCsv(text);
    if (rows.length < 2) return [];
    const head = rows[0].map((x) => x.toLowerCase().trim());
    const col = (...res) => { for (const re of res) { const i = head.findIndex((h0) => re.test(h0)); if (i >= 0) return i; } return -1; };
    const ci = {
      first: col(/^first ?name$/, /^given ?name$/, /^first$/), last: col(/^last ?name$/, /^family ?name$/, /^surname$/, /^last$/),
      full: col(/^(display ?name|full ?name|name|contact ?name)$/),
      company: col(/^(company|company ?name|organi[sz]ation( name| 1 - name)?|organisation_name)$/),
      email: col(/^(e-?mail ?address|email|e-?mail 1 - value|primary ?e-?mail|email ?id|e-?mail)$/, /e-?mail/),
      mobile: col(/^(mobile( ?phone)?|cell( ?phone)?|mobile ?number)$/, /mobile|cell/),
      phone: col(/^(phone|telephone|business ?phone|work ?phone|home ?phone|phone ?number|phone 1 - value|phone_number)$/, /phone|tel/),
      address: col(/^(address|business ?address|home ?address|address ?1|street|business ?street|home ?street|address 1 - formatted|mailing ?street|work ?street)$/, /^(?!.*e-?mail).*(address|street)/),
      city: col(/^(city|town|business ?city|home ?city)$/), postcode: col(/^(post ?code|postal ?code|zip|zip ?code|business ?postal code|home ?postal code)$/),
      notes: col(/^(notes?|description)$/),
    };
    const g = (r, k) => (ci[k] >= 0 ? String(r[ci[k]] || '').trim() : '');
    return rows.slice(1).map((r) => ({
      name: g(r, 'full') || [g(r, 'first'), g(r, 'last')].filter(Boolean).join(' '),
      company: g(r, 'company'), email: g(r, 'email'), phone: g(r, 'phone'), mobile: g(r, 'mobile'),
      address: [g(r, 'address'), g(r, 'city'), g(r, 'postcode')].filter(Boolean).join(', '), notes: g(r, 'notes'),
    }));
  }

  async function contactsView() {
    frame('contacts', h('p', { class: 'muted' }, 'Loading…'));
    let list;
    try { list = (await get('contacts')).contacts; } catch (e) { return frame('contacts', h('p', { class: 'msg err' }, e.message)); }
    const st = contactsView.st || (contactsView.st = { q: '', src: '', panel: '' });
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const ok = (t) => put(msg, h('p', { class: 'msg ok' }, t));
    const bad = (t) => put(msg, h('p', { class: 'msg err' }, t));
    const out = h('div');
    const panel = h('div');
    const sources = [...new Set(list.flatMap((c) => c.sources || []))];
    const tel = (n) => (n ? h('a', { href: `tel:${n.replace(/[^\d+]/g, '')}`, onclick: (e) => e.stopPropagation() }, n) : null);

    const editForm = (c = {}) => {
      const f = {};
      const field = (k, label, type = 'text') => h('label', { class: 'f' }, label, f[k] = h(type === 'textarea' ? 'textarea' : 'input', type === 'textarea' ? {} : { type, value: c[k] || '', autocomplete: 'off' }, type === 'textarea' ? (c[k] || '') : null));
      const save = async (btn) => {
        btn.disabled = true;
        try { await api('contact-save', { id: c.id, ...Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])) }); contactsView.flash = c.id ? 'Contact saved.' : 'Contact added.'; contactsView(); }
        catch (e) { btn.disabled = false; bad(e.message); }
      };
      return h('section', { class: 'card stack', style: 'gap:10px' }, h('h2', { style: 'margin:0' }, c.id ? 'Edit contact' : 'Add a contact'),
        h('div', { class: 'fields' }, field('name', 'Name'), field('company', 'Company'), field('email', 'Email', 'email'), field('phone', 'Phone', 'tel'), field('mobile', 'Mobile', 'tel'), field('address', 'Address')),
        field('notes', 'Notes', 'textarea'),
        c.sources?.length ? h('p', { class: 'small muted', style: 'margin:0' }, `From: ${c.sources.join(', ')}`) : null,
        h('div', { class: 'row', style: 'justify-content:space-between' },
          c.id ? h('button', { class: 'btn link small', onclick: async () => { if (!confirm(`Delete ${c.name || c.company || c.email}?`)) return; await api('contact-delete', { id: c.id }); contactsView.flash = 'Contact deleted.'; contactsView(); } }, 'Delete') : h('span'),
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { st.panel = ''; put(panel); } }, 'Cancel'), h('button', { class: 'btn primary', onclick: (e) => save(e.currentTarget) }, 'Save'))));
    };

    const importPanel = () => {
      const result = (r) => { contactsView.flash = `${r.added} added, ${r.updated} updated with new details${r.skipped ? `, ${r.skipped} already there` : ''}. ${r.total} contacts in total.`; st.panel = ''; contactsView(); };
      const fromApp = async (app, btn) => {
        const label = btn.textContent; btn.disabled = true; btn.textContent = 'Importing…';
        try { result(await api('contacts-import-app', { app })); } catch (e) { btn.disabled = false; btn.textContent = label; bad(e.message); }
      };
      const file = h('input', { type: 'file', accept: '.csv,.vcf,.txt,text/csv,text/vcard', class: 'sr' });
      file.addEventListener('change', async () => {
        const fl = file.files[0]; file.value = '';
        if (!fl) return;
        try {
          const rows = contactsFromFile(await fl.text()).filter((r) => r.name || r.company || r.email || r.phone || r.mobile);
          if (!rows.length) throw new Error('No contacts found in that file. Export it as CSV or vCard and try again.');
          if (!confirm(`Import ${rows.length} contact${rows.length > 1 ? 's' : ''} from ${fl.name}?`)) return;
          ok(`Importing ${rows.length} contacts…`);
          const source = /zoho/i.test(fl.name) || zohoBox.checked ? 'Zoho Mail' : 'Imported file';
          const sum = { added: 0, updated: 0, skipped: 0, total: 0 };
          for (let i = 0; i < rows.length; i += 500) {
            const r = await api('contacts-import', { rows: rows.slice(i, i + 500), source });
            sum.added += r.added; sum.updated += r.updated; sum.skipped += r.skipped; sum.total = r.total;
          }
          result(sum);
        } catch (e) { bad(e.message); }
      });
      const zohoBox = h('input', { type: 'checkbox' });
      const fa = me.connections?.freeagent?.connected, wave = me.connections?.wave?.connected;
      return h('section', { class: 'card stack', style: 'gap:12px' }, h('h2', { style: 'margin:0' }, 'Import contacts'),
        h('p', { class: 'small muted', style: 'margin:0' }, 'Nobody is added twice: the same email or phone number is merged into one contact, and missing details are filled in.'),
        h('div', { class: 'stack', style: 'gap:8px' },
          h('div', { class: 'row' }, h('button', { class: 'btn', disabled: !fa, onclick: (e) => fromApp('freeagent', e.currentTarget) }, 'From FreeAgent'), fa ? null : h('span', { class: 'small muted' }, 'Connect FreeAgent in Settings first')),
          h('div', { class: 'row' }, h('button', { class: 'btn', disabled: !wave, onclick: (e) => fromApp('wave', e.currentTarget) }, 'From Wave'), wave ? null : h('span', { class: 'small muted' }, 'Connect Wave in Settings first')),
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: (e) => fromApp('clients', e.currentTarget) }, 'Clients from website forms'))),
        h('div', { class: 'stack', style: 'gap:6px;border-top:1px solid var(--line);padding-top:12px' },
          h('strong', {}, 'Zoho Mail, Google, Outlook or your phone'),
          h('p', { class: 'small muted', style: 'margin:0' }, 'In Zoho Mail open Contacts, choose Export (under ⋯ or ⚙), pick All contacts and CSV or vCard, and save the file. Then upload it here.'),
          h('label', { class: 'row small', style: 'gap:6px' }, zohoBox, 'This file is from Zoho Mail'),
          h('div', {}, h('button', { class: 'btn primary', onclick: () => file.click() }, 'Upload a file (CSV or vCard)'), file)),
        h('div', {}, h('button', { class: 'btn link small', onclick: () => { st.panel = ''; put(panel); } }, 'Close')));
    };

    const draw = () => {
      const q = st.q.toLowerCase().replace(/\s+/g, ' ').trim();
      const qd = q.replace(/\D/g, '');
      const shown = list.filter((c) => (!st.src || (c.sources || []).includes(st.src)) && (!q
        || `${c.name} ${c.company} ${c.email} ${c.address} ${c.notes}`.toLowerCase().includes(q)
        || (qd.length >= 4 && `${c.phone} ${c.mobile}`.replace(/\D/g, '').includes(qd))));
      let letter = '';
      put(out, shown.length ? h('ul', { class: 'td-list' }, shown.slice(0, 400).flatMap((c) => {
        const first = ((c.name || c.company || c.email || '#')[0] || '#').toUpperCase();
        const headRow = first !== letter ? h('li', { class: 'small muted', style: 'padding:10px 0 2px;font-weight:700' }, (letter = first)) : null;
        return [headRow, h('li', { class: 'td-item', style: 'cursor:pointer', onclick: () => { st.panel = 'edit'; put(panel, editForm(c)); panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
          h('div', { class: 'td-text' },
            h('div', {}, h('strong', {}, c.name || c.company || c.email), c.name && c.company ? h('span', { class: 'muted' }, ` · ${c.company}`) : null),
            h('div', { class: 'small' }, [tel(c.mobile), tel(c.phone), c.email ? h('a', { href: `mailto:${c.email}`, onclick: (e) => e.stopPropagation() }, c.email) : null].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))),
            c.address ? h('div', { class: 'small muted' }, c.address) : null),
          h('span', { class: 'small muted', style: 'flex:none;text-align:right' }, (c.sources || []).join(', ')))];
      })) : null, shown.length > 400 ? h('p', { class: 'small muted' }, `Showing 400 of ${shown.length}. Search to narrow it down.`) : null, shown.length ? null : h('p', { class: 'muted' }, list.length ? 'No contacts match.' : 'No contacts yet. Use Import to bring in FreeAgent, Wave or your Zoho contacts.'));
    };
    const search = h('input', { type: 'search', placeholder: 'Search name, company, email or phone', 'aria-label': 'Search contacts', value: st.q, style: 'min-height:46px;font-size:16px' });
    search.addEventListener('input', () => { st.q = search.value; draw(); });
    const pill = (on, label, click) => h('button', { type: 'button', class: 'pill small', 'aria-pressed': String(on), onclick: click }, label);
    frame('contacts',
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Address book'), h('p', { class: 'muted' }, `${list.length} contact${list.length === 1 ? '' : 's'}`)),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { st.panel = 'import'; put(panel, importPanel()); } }, 'Import'), h('button', { class: 'btn primary', onclick: () => { st.panel = 'edit'; put(panel, editForm()); } }, '+ Add contact'))),
      msg, panel,
      h('section', { class: 'card stack', style: 'margin-top:12px' }, search,
        sources.length > 1 ? h('div', { class: 'pills' }, pill(!st.src, 'All', () => { st.src = ''; contactsView(); }), sources.map((x) => pill(st.src === x, x, () => { st.src = x; contactsView(); }))) : null,
        out));
    draw();
    if (st.panel === 'import') put(panel, importPanel());
    if (contactsView.flash) { ok(contactsView.flash); contactsView.flash = ''; }
  }

  // ---------- phone messages ----------
  // Take a message for Raj or Sunita (with a screenshot if you like). It stays here until it's ticked as dealt with.
  const nowLocal = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/London' }).slice(0, 16).replace(' ', 'T');
  const fmtWhen = (at) => { if (!at) return ''; const [d, t] = at.split('T'); return `${d === localToday() ? 'Today' : d === plusDays(localToday(), -1) ? 'Yesterday' : dayName(d)} ${t || ''}`.trim(); };

  function messageCard(m, onChange) {
    const box = h('input', { type: 'checkbox', checked: m.done, 'aria-label': `Dealt with: ${m.name || m.about}` });
    box.addEventListener('change', async () => {
      box.disabled = true;
      try { await api('message-done', { id: m.id, done: box.checked }); await countMsgs(); onChange(); } catch (e) { box.checked = !box.checked; box.disabled = false; alert(e.message); }
    });
    const tel = m.phone ? h('a', { href: `tel:${m.phone.replace(/[^\d+]/g, '')}` }, m.phone) : null;
    return h('li', { class: `td-item${m.done ? ' done' : ''}` }, box,
      h('div', { class: 'td-text', style: 'cursor:default' },
        h('div', {}, m.for ? h('span', { class: 'tag', style: 'margin-right:6px' }, `For ${m.for}`) : null, h('strong', {}, m.name || 'Caller'), tel ? [' · ', tel] : null),
        m.about ? h('div', {}, withLinks(m.about)) : null,
        m.notes ? h('div', { class: 'small muted', style: 'white-space:pre-line' }, m.notes) : null,
        h('div', { class: 'small muted' }, [fmtWhen(m.at), m.email ? h('a', { href: `mailto:${m.email}` }, m.email) : null, m.done && m.doneAt ? `dealt with ${fmtDateTime(m.doneAt)}` : null].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x])))),
      m.photo ? h('a', { href: photoUrl(m.photo), onclick: (e) => { e.preventDefault(); showPhoto(photoUrl(m.photo)); } }, h('img', { class: 'td-thumb', src: photoUrl(m.photo), alt: 'Screenshot', loading: 'lazy' })) : null,
      h('button', { class: 'td-x', 'aria-label': 'Delete message', onclick: async () => {
        if (!confirm(`Delete the message from ${m.name || 'this caller'}?`)) return;
        try { await api('message-delete', { id: m.id }); await countMsgs(); onChange(); } catch (e) { alert(e.message); }
      } }, '×'));
  }

  function messagesBox() {
    const sec = h('section', { class: 'card' }, h('h2', {}, 'Phone messages'), h('p', { class: 'muted small' }, 'Loading…'));
    const draw = async () => {
      let list = [];
      try { list = (await get('messages')).messages.filter((m) => !m.done); } catch { return put(sec, ''); }
      put(sec, h('h2', {}, 'Phone messages ', h('span', { class: 'muted' }, `(${list.length})`)),
        list.length ? h('ul', { class: 'td-list', style: 'margin-bottom:12px' }, list.slice(0, 10).map((m) => messageCard(m, () => { draw(); countMsgs(); }))) : h('p', { class: 'muted small' }, 'No messages waiting.'),
        h('a', { class: 'btn small', href: '#messages' }, '+ Take a message'));
    };
    draw();
    return sec;
  }

  async function messagesView() {
    frame('messages', h('p', { class: 'muted' }, 'Loading…'));
    let data;
    try { data = await get('messages'); } catch (e) { return frame('messages', h('p', { class: 'msg err' }, e.message)); }
    const st = messagesView.st || (messagesView.st = { show: '' });
    const people = data.people || [];
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const bad = (t) => put(msg, h('p', { class: 'msg err' }, t));
    let forWho = messagesView.lastFor ?? (people.find((p) => p.name !== 'Raj')?.name || '');
    const forBox = h('div', { class: 'pills' });
    const showFor = () => put(forBox, people.map((p) => h('button', { type: 'button', class: 'pill small', 'aria-pressed': String(forWho === p.name), onclick: () => { forWho = p.name; showFor(); } }, p.name)),
      h('button', { type: 'button', class: 'pill small', 'aria-pressed': String(!forWho), onclick: () => { forWho = ''; showFor(); } }, 'Either'));
    const f = {
      name: h('input', { type: 'text', placeholder: 'Caller’s name', 'aria-label': 'Caller’s name', autocomplete: 'off' }),
      phone: h('input', { type: 'tel', placeholder: 'Their number', 'aria-label': 'Their number', autocomplete: 'off' }),
      email: h('input', { type: 'email', placeholder: 'Email (optional)', 'aria-label': 'Email', autocomplete: 'off' }),
      about: h('input', { type: 'text', placeholder: 'Regarding, e.g. China visa, wants a call back', 'aria-label': 'Regarding' }),
      at: h('input', { type: 'datetime-local', value: nowLocal(), 'aria-label': 'Date and time of the call' }),
      notes: h('textarea', { placeholder: 'Message (optional)', 'aria-label': 'Message', style: 'min-height:56px' }),
    };
    let photo = null;
    const file = h('input', { type: 'file', accept: 'image/*', class: 'sr', 'aria-label': 'Choose a screenshot' });
    const pending = h('div');
    const showPending = () => put(pending, photo ? h('div', { class: 'td-pending' }, h('img', { src: photo, alt: '' }), 'Screenshot added.', h('button', { type: 'button', class: 'btn link small', onclick: () => { photo = null; showPending(); } }, 'Remove')) : null);
    file.addEventListener('change', async () => { const fl = file.files[0]; file.value = ''; if (!fl) return; try { photo = await shrinkPhoto(fl); showPending(); } catch (e) { bad(e.message); } });
    const saveBtn = h('button', { class: 'btn primary', type: 'button' }, 'Save message');
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        const photoId = photo ? (await api('photo-upload', { data: photo })).id : '';
        await api('message-save', { for: forWho, name: f.name.value, phone: f.phone.value, email: f.email.value, about: f.about.value, notes: f.notes.value, at: f.at.value, photo: photoId });
        messagesView.lastFor = forWho;
        messagesView.flash = `Message saved${forWho ? ` for ${forWho}` : ''}.`;
        await countMsgs(); messagesView();
      } catch (e) { saveBtn.disabled = false; bad(e.message); }
    });

    const shown = data.messages.filter((m) => !st.show || m.for === st.show || !m.for);
    const open = shown.filter((m) => !m.done);
    const done = shown.filter((m) => m.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
    const pill = (on, label, click) => h('button', { type: 'button', class: 'pill small', 'aria-pressed': String(on), onclick: click }, label);
    frame('messages',
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Phone messages'), h('p', { class: 'muted' }, open.length ? `${open.length} waiting` : 'No messages waiting'))),
      msg,
      h('section', { class: 'card stack', style: 'gap:10px' }, h('h2', { style: 'margin:0' }, 'Take a message'),
        h('div', { class: 'row small', style: 'gap:8px' }, h('span', { class: 'muted' }, 'For:'), forBox),
        h('div', { class: 'fields' }, f.name, f.phone), f.about,
        h('div', { class: 'fields' }, h('label', { class: 'f' }, 'When they called', f.at), f.email),
        f.notes, file, pending,
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, '📷 Add screenshot'), saveBtn)),
      h('div', { class: 'pills', style: 'margin:16px 0 10px' }, pill(!st.show, 'Everyone', () => { st.show = ''; messagesView(); }), people.map((p) => pill(st.show === p.name, p.name, () => { st.show = p.name; messagesView(); }))),
      h('section', { class: 'card stack' },
        open.length ? h('ul', { class: 'td-list' }, open.map((m) => messageCard(m, messagesView))) : h('p', { class: 'muted small', style: 'margin:0' }, 'No messages waiting.'),
        done.length ? h('details', {}, h('summary', { class: 'small muted', style: 'cursor:pointer' }, `Dealt with (${done.length})`), h('ul', { class: 'td-list' }, done.map((m) => messageCard(m, messagesView)))) : null));
    showFor();
    if (messagesView.flash) { put(msg, h('p', { class: 'msg ok' }, messagesView.flash)); messagesView.flash = ''; }
  }

  // ---------- to do: one simple list ----------
  async function todoView(arg) {
    frame('todo', h('p', { class: 'muted' }, 'Loading…'));
    let d;
    try { d = await loadDiary(); } catch (e) { return frame('todo', h('p', { class: 'msg err' }, e.message)); }
    const dateArg = /^@\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg.slice(1) : '';
    let client = arg && !dateArg ? apps.find((x) => x.ref === arg) || null : null;
    const t0 = localToday();
    let due = dateArg || todoView.due || t0;
    if (due < t0) due = t0;
    const QUICK = [['Today', 0], ['Tomorrow', 1], ['1 week', 7], ['2 weeks', 14], ['1 month', 28]];
    const dueBox = h('div', { class: 'pills' });
    const other = h('input', { type: 'date', min: t0, 'aria-label': 'Pick a date', class: 'td-other' });
    const showDue = () => {
      const isQuick = QUICK.some(([, n]) => plusDays(t0, n) === due);
      other.value = isQuick ? '' : due;
      put(dueBox, QUICK.map(([label, n]) => h('button', { type: 'button', class: 'pill small', 'aria-pressed': String(plusDays(t0, n) === due), onclick: () => { due = plusDays(t0, n); showDue(); } }, label)),
        h('label', { class: `pill small${isQuick ? '' : ' on'}`, style: 'display:inline-flex;align-items:center;gap:6px' }, isQuick ? '📅 Pick date' : `📅 ${dayName(due)}`, other));
    };
    other.addEventListener('change', () => { if (other.value) { due = other.value; showDue(); } });
    let photo = null;
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const bad = (t) => put(msg, h('p', { class: 'msg err' }, t));
    const text = h('input', { type: 'text', 'aria-label': 'New to-do', placeholder: 'Type a to-do…', enterkeyhint: 'done', autocomplete: 'off' });
    const file = h('input', { type: 'file', accept: 'image/*', class: 'sr', 'aria-label': 'Choose a photo' });
    const pending = h('div');
    const linked = h('div');
    const more = contactFields(client ? { clientName: titleCase(client.name), clientPhone: client.phone || '', clientEmail: client.email || '' } : {});
    const moreBox = h('div', { hidden: !client }, more.box);
    const moreBtn = h('button', { type: 'button', class: 'btn link small', style: 'align-self:flex-start', hidden: !!client, onclick: () => { moreBox.hidden = false; moreBtn.hidden = true; } }, '+ Phone, email, note');
    if (todoView.prefill) { const f = todoView.prefill; todoView.prefill = null; text.value = f.text || ''; if (!client) { more.set({ clientName: f.name || '', clientEmail: f.email || '' }); moreBox.hidden = false; moreBtn.hidden = true; } setTimeout(() => text.focus(), 0); }
    const showPending = () => put(pending, photo ? h('div', { class: 'td-pending' }, h('img', { src: photo, alt: '' }), 'Photo ready. Type a note if you like, then press Add.', h('button', { type: 'button', class: 'btn link small', onclick: () => { photo = null; showPending(); } }, 'Remove')) : null);
    const showLinked = () => put(linked, client ? h('p', { class: 'small muted', style: 'margin:0' }, 'For ', h('a', { href: `#app/${encodeURIComponent(client.ref)}` }, titleCase(client.name)), ' ', h('button', { type: 'button', class: 'btn link small', onclick: () => { client = null; more.set({}); showLinked(); } }, 'Not for this client')) : null);
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = '';
      if (!f) return;
      try { photo = await shrinkPhoto(f); showPending(); text.focus(); } catch (e) { bad(e.message); }
    });
    const addBtn = h('button', { class: 'btn primary', type: 'button' }, 'Add');
    const addIt = async () => {
      if (!text.value.trim() && !photo) return text.focus();
      addBtn.disabled = true;
      try {
        const photoId = photo ? (await api('photo-upload', { data: photo })).id : '';
        todoView.due = due === t0 ? '' : due;
        await api('task-save', { title: text.value, due, photo: photoId, ref: client?.ref || '', ...more.values() });
        if (arg) history.replaceState(null, '', '#todo');
        todoView.flash = `Added for ${due === t0 ? 'today' : dayName(due, { weekday: 'long', day: 'numeric', month: 'short' })}.`;
        todoView();
      } catch (e) { addBtn.disabled = false; bad(e.message); }
    };
    addBtn.addEventListener('click', addIt);
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addIt(); } });


    const open = todoItems(d).filter((t) => !t.done).sort(byDay);
    const groups = [];
    for (const t of open) {
      const key = t.due < t0 ? 'overdue' : t.due;
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push(g = { key, items: [], label: key === 'overdue' ? 'Overdue' : key === t0 ? 'Today' : key === plusDays(t0, 1) ? 'Tomorrow' : dayName(key, { weekday: 'long', day: 'numeric', month: 'long' }) });
      g.items.push(t);
    }
    const done = todoItems(d).filter((t) => t.done && (t.doneAt || '') >= plusDays(localToday(), -14)).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
    const redraw = () => todoView();
    frame('todo',
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'To do'), h('p', { class: 'muted' }, open.length ? `${open.length} to do` : 'All done 🎉'))),
      msg,
      h('section', { class: 'card stack', style: 'gap:10px' },
        h('div', { class: 'td-add' }, text, h('button', { type: 'button', class: 'btn td-cam', 'aria-label': 'Add a photo', title: 'Add a photo', onclick: () => file.click() }, '📷'), addBtn),
        h('div', { class: 'row small', style: 'gap:8px' }, h('span', { class: 'muted' }, 'When:'), dueBox),
        moreBtn, moreBox, file, pending, linked),
      h('div', { class: 'stack', style: 'margin-top:16px' },
        groups.length ? groups.map((g) => h('section', { class: 'card', style: `padding:14px 18px;${g.key === 'overdue' ? 'border-left:4px solid var(--red);' : g.key === t0 ? 'border-left:4px solid var(--gold);' : ''}` },
          h('h2', { style: 'margin:0 0 2px' }, g.label, ' ', h('span', { class: 'muted small' }, `(${g.items.length})`)),
          h('ol', { class: 'td-list' }, g.items.map((t, i) => todoRow(t, { n: i + 1, showDue: g.key === 'overdue', onChange: redraw })))))
          : h('section', { class: 'card' }, h('p', { class: 'muted small', style: 'margin:0' }, 'Nothing to do. Type above to add something.')),
        done.length ? h('details', {}, h('summary', { class: 'small muted', style: 'cursor:pointer' }, `Done (${done.length})`), h('ul', { class: 'td-list' }, done.map((t) => todoRow(t, { onChange: redraw })))) : null));
    showLinked(); showDue();
    if (todoView.prefill) { const pf = todoView.prefill; todoView.prefill = null; text.value = pf.title; more.set(pf); moreBox.hidden = false; moreBtn.hidden = true; text.focus(); }
    if (todoView.flash) { put(msg, h('p', { class: 'msg ok' }, todoView.flash)); todoView.flash = ''; }
    if (client) text.focus();
  }

  // Home: today's appointments and what needs doing
  function todayBox() {
    const sec = h('section', { class: 'card' }, h('h2', {}, 'Today'), h('p', { class: 'muted small' }, 'Loading…'));
    const draw = (d) => {
      const day = localToday();
      const appts = d.appts.filter((x) => x.date === day && x.status !== 'cancelled');
      const todos = openTodos(d);
      put(sec, h('h2', {}, 'Today ', h('span', { class: 'muted' }, `(${appts.length} appointment${appts.length === 1 ? '' : 's'}, ${todos.length} to do)`)),
        appts.length ? h('ul', { class: 'list', style: 'margin-bottom:12px' }, appts.map((x) => h('li', {}, h('strong', {}, `${x.start} `), apptName(x), h('span', { class: 'small muted' }, ` · ${x.who} · ${x.type}`)))) : h('p', { class: 'muted small' }, 'No appointments.'),
        todos.length ? h('ol', { class: 'td-list', style: 'margin-bottom:12px' }, todos.slice(0, 15).map((t, i) => todoRow(t, { n: i + 1, onChange: () => draw(diaryCache) }))) : h('p', { class: 'muted small' }, 'Nothing to do. 🎉'),
        h('div', { class: 'row' }, h('a', { class: 'btn small', href: '#todo' }, '+ To do'), h('a', { class: 'btn small', href: '#diary' }, 'Open diary')));
    };
    loadDiary().then(draw).catch(() => put(sec, h('h2', {}, 'Today'), h('p', { class: 'muted small' }, 'Couldn’t load the diary.')));
    return sec;
  }

  function clientAppointments(a) {
    const box = h('div', { class: 'stack', style: 'gap:6px' });
    const draw = (d) => {
      const mine = d.appts.filter((x) => x.status !== 'cancelled' && x.date >= localToday() && (x.ref === a.ref || (a.email && x.clientEmail === a.email)));
      put(box, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { class: 'small' }, 'Appointments'), h('a', { class: 'btn small', href: `#diary/new/${encodeURIComponent(a.ref)}` }, 'Book appointment')),
        mine.length ? h('ul', { class: 'list small' }, mine.map((x) => h('li', {}, `${fmtDate(x.date)} ${x.start} · ${x.who} · ${x.type}`))) : h('span', { class: 'small muted' }, 'None coming up.'));
    };
    (diaryCache ? Promise.resolve(diaryCache) : loadDiary()).then(draw).catch(() => put(box, ''));
    return box;
  }

  // Client record: this client's to-dos (they're on the main To do list too)
  function clientTodos(a, onReminderDone) {
    const sec = h('section', { class: 'card stack' }, h('h2', {}, 'To do'), h('p', { class: 'muted small' }, 'Loading…'));
    const draw = () => {
      const d = diaryCache;
      const legacy = (a.reminders || []).filter((r) => !r.done).map((r) => ({ kind: 'reminder', id: r.id, title: r.text, due: r.due, ref: a.ref, done: false }));
      const mine = [...(d?.tasks || []).filter((t) => t.ref === a.ref && !t.done).map((t) => ({ ...t, kind: 'task' })), ...legacy].sort((x, y) => String(x.created || x.due).localeCompare(String(y.created || y.due)));
      const text = h('input', { type: 'text', placeholder: 'e.g. Chase bank statements', 'aria-label': 'What needs doing' });
      const addIt = async (btn) => {
        if (!text.value.trim()) return text.focus();
        btn.disabled = true;
        try { await api('task-save', { title: text.value, ref: a.ref, clientName: titleCase(a.name), clientPhone: a.phone || '', clientEmail: a.email || '' }); await loadDiary(); draw(); }
        catch (ex) { alert(ex.message); btn.disabled = false; }
      };
      const addBtn = h('button', { class: 'btn small', onclick: (e) => addIt(e.currentTarget) }, 'Add');
      text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addIt(addBtn); } });
      put(sec, h('h2', {}, 'To do'),
        mine.length ? h('ol', { class: 'td-list' }, mine.map((t, i) => todoRow(t, { n: i + 1, onChange: () => { if (t.kind === 'reminder') onReminderDone(); else draw(); } }))) : h('p', { class: 'muted small', style: 'margin:0' }, 'Nothing to do for this client.'),
        h('div', { class: 'td-add' }, text, addBtn),
        h('p', { class: 'small muted', style: 'margin:0' }, 'These are on the main To do list too. ', h('a', { href: `#todo/${encodeURIComponent(a.ref)}` }, 'Add one with a photo')));
    };
    loadDiary().then(draw).catch(() => { diaryCache = null; draw(); });
    return sec;
  }

  function diaryPeopleCard(ok, bad) {
    const people = (me.settings.diaryPeople || []).concat([{ name: '', email: '' }]).slice(0, 4);
    const rows = people.map((p) => ({ name: h('input', { type: 'text', value: p.name, 'aria-label': 'Name' }), email: h('input', { type: 'email', value: p.email, 'aria-label': 'Email for calendar invites' }) }));
    return h('section', { class: 'card stack', style: 'margin-top:16px' }, h('h2', {}, 'Diary: who takes appointments'),
      h('p', { class: 'small muted', style: 'margin:0' }, 'Calendar invites go to these email addresses. Use the address of the calendar you use: your Zoho Mail address for Zoho Calendar, or a Gmail address for Google Calendar.'),
      rows.map((r) => h('div', { class: 'fields' }, h('label', { class: 'f' }, 'Name', r.name), h('label', { class: 'f' }, 'Email for invites', r.email))),
      h('button', { class: 'btn primary small', style: 'align-self:flex-start', onclick: async () => {
        try { me.settings = (await api('settings', { diaryPeople: rows.map((r) => ({ name: r.name.value, email: r.email.value })) })).settings; ok('Diary people saved'); } catch (e) { bad(e.message); }
      } }, 'Save'));
  }

  async function diaryView(arg) {
    frame('diary', h('p', { class: 'muted' }, 'Loading…'));
    let d;
    try { d = await loadDiary(); } catch (e) { return frame('diary', h('p', { class: 'msg err' }, e.message)); }
    const st = diaryView.st || (diaryView.st = { week: mondayOf(localToday()), who: '', view: 'week' });
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const ok = (t) => put(msg, h('p', { class: 'msg ok' }, t));
    const bad = (t) => put(msg, h('p', { class: 'msg err' }, t));
    const formBox = h('div');
    const noEmails = d.people.filter((p) => !p.email).map((p) => p.name);
    const clientTypes = d.clientTypes || ['In the office', 'Phone call', 'Video call'];
    const refresh = async (flash) => { if (flash) diaryView.flash = flash; await diaryView(); };

    const mailedNote = (m) => !m ? '' : m.error ? ` ${m.error}` : ` Invite sent to ${[m.staff ? 'the diary owner' : '', m.client ? 'the client' : ''].filter(Boolean).join(' and ') || 'nobody (no email addresses)'}.`;

    // "Find an existing client" box, used by both forms
    function clientFinder(onPick) {
      const find = h('input', { type: 'search', placeholder: 'Find an existing client (name, email or reference)', 'aria-label': 'Find a client' });
      const hits = h('div', { class: 'rows' });
      find.addEventListener('input', () => {
        const t = find.value.trim().toLowerCase();
        const list = t.length < 2 ? [] : apps.filter((a) => [a.name, a.email, a.ref, a.companyName].some((v) => String(v || '').toLowerCase().includes(t))).slice(0, 6);
        put(hits, list.map((a) => h('button', { type: 'button', class: 'chip', onclick: () => { onPick(a); put(hits); find.value = ''; } }, h('b', {}, titleCase(a.name)), a.email || a.ref)));
      });
      return [find, hits];
    }

    function openForm(existing, prefill = {}) {
      const x = existing || { who: prefill.who || st.who || d.people[0]?.name, date: prefill.date || localToday(), start: '10:00', minutes: 30, type: d.types[0], title: prefill.title || '', clientName: prefill.clientName || '', clientEmail: prefill.clientEmail || '', clientPhone: prefill.clientPhone || '', ref: prefill.ref || '', notes: '', emailClient: true };
      const f = {
        who: h('select', { 'aria-label': 'Whose appointment' }, d.people.map((p) => h('option', { value: p.name, selected: p.name === x.who }, p.name))),
        date: h('input', { type: 'date', value: x.date }), start: h('input', { type: 'time', step: '300', value: x.start }),
        minutes: h('select', {}, [15, 30, 45, 60, 90, 120, 180, 240, 480].map((m) => h('option', { value: m, selected: Number(x.minutes) === m }, m < 60 ? `${m} minutes` : m === 480 ? 'All day' : `${m / 60} hour${m > 60 ? 's' : ''}`))),
        type: h('select', {}, d.types.map((t) => h('option', { value: t, selected: t === x.type }, t))),
        title: h('input', { type: 'text', value: x.title === 'Appointment' || x.title === x.type ? '' : x.title }),
        clientName: h('input', { type: 'text', value: x.clientName }), clientEmail: h('input', { type: 'email', value: x.clientEmail }), clientPhone: h('input', { type: 'tel', value: x.clientPhone }),
        notes: h('textarea', {}, x.notes || ''),
        emailClient: h('input', { type: 'checkbox', checked: x.emailClient !== false, id: 'ap-mailc' }),
      };
      let ref = x.ref;
      const [find, hits] = clientFinder((a) => { f.clientName.value = titleCase(a.name); f.clientEmail.value = a.email || ''; f.clientPhone.value = a.phone || ''; ref = a.ref; if (!f.title.value) f.title.value = a.formTitle || ''; });
      const clientBits = h('div', { class: 'stack' }, find, hits,
        h('div', { class: 'fields' }, h('label', { class: 'f' }, 'Client name', f.clientName), h('label', { class: 'f' }, 'Client email', f.clientEmail), h('label', { class: 'f' }, 'Client phone', f.clientPhone)));
      const mailLine = h('label', { class: 'row small', for: 'ap-mailc', style: 'gap:8px' }, f.emailClient, existing ? 'Email the client about the change' : 'Email the client a confirmation and calendar invite');
      const aboutLabel = h('span', {}, 'About');
      const setType = () => {
        const withClient = clientTypes.includes(f.type.value);
        clientBits.hidden = !withClient; mailLine.hidden = !withClient;
        aboutLabel.textContent = withClient ? 'About' : 'What is it?';
        f.title.placeholder = withClient ? 'e.g. Spouse visa consultation' : f.type.value === 'Out of office' ? 'e.g. Holiday, dentist' : 'e.g. VFS drop-off for 3 clients';
      };
      f.type.addEventListener('change', setType); setType();
      const save = async (btn, allowClash = false) => {
        btn.disabled = true;
        const withClient = clientTypes.includes(f.type.value);
        const body = { who: f.who.value, date: f.date.value, start: f.start.value, minutes: Number(f.minutes.value), type: f.type.value, title: f.title.value,
          clientName: withClient ? f.clientName.value : '', clientEmail: withClient ? f.clientEmail.value : '', clientPhone: withClient ? f.clientPhone.value : '', notes: f.notes.value, ref: withClient ? ref : '', emailClient: withClient && f.emailClient.checked, allowClash };
        try {
          const r = existing ? await api('diary-change', { ...body, id: existing.id }) : await api('diary-book', body);
          st.week = mondayOf(r.appt.date);
          await refresh(`${existing ? 'Changed' : 'Booked'}: ${apptName(r.appt)}, ${fmtDate(r.appt.date)} at ${r.appt.start} with ${r.appt.who}.${mailedNote(r.mailed)}`);
        } catch (e) {
          btn.disabled = false;
          if (e.data?.clash && confirm(e.message)) return save(btn, true);
          bad(e.message);
        }
      };
      put(formBox, h('section', { class: 'card stack', style: 'margin-bottom:16px;border-left:4px solid var(--gold)' },
        h('h2', {}, existing ? 'Change appointment' : 'Book an appointment'),
        h('div', { class: 'fields' }, h('label', { class: 'f' }, 'With', f.who), h('label', { class: 'f' }, 'Date', f.date), h('label', { class: 'f' }, 'Time', f.start), h('label', { class: 'f' }, 'Length', f.minutes), h('label', { class: 'f' }, 'Type', f.type)),
        h('label', { class: 'f' }, aboutLabel, f.title),
        clientBits,
        h('label', { class: 'f' }, 'Notes (only you and Sunita see these)', f.notes),
        mailLine,
        h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'btn', onclick: () => put(formBox) }, 'Close'), h('button', { class: 'btn primary', onclick: (e) => save(e.currentTarget) }, existing ? 'Save changes' : 'Book appointment'))));
      formBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const today = localToday();
    const pill = (on, label, click) => h('button', { type: 'button', class: 'pill', 'aria-pressed': String(on), onclick: click }, label);
    const apptBox = (x) => h('div', { class: 'box', style: `padding:8px 10px;${clientTypes.includes(x.type) ? '' : 'background:#EEF0F2;'}` },
      h('div', { style: 'font-weight:600' }, x.minutes >= 480 ? 'All day' : `${x.start}–${endOf(x.start, x.minutes)}`),
      h('div', {}, apptName(x)), h('div', { class: 'small muted' }, `${x.who} · ${x.type}`), x.clientName && x.title && x.title !== 'Appointment' ? h('div', { class: 'small muted' }, x.title) : null,
      x.clientPhone && x.type === 'Phone call' ? h('a', { class: 'small', href: `tel:${x.clientPhone.replace(/[^\d+]/g, '')}` }, x.clientPhone) : null,
      h('div', { class: 'row', style: 'gap:2px;margin-top:4px' },
        x.ref ? h('a', { class: 'btn link small', href: `#app/${encodeURIComponent(x.ref)}` }, 'Record') : null,
        h('button', { class: 'btn link small', onclick: () => openForm(x) }, 'Change'),
        h('button', { class: 'btn link small', onclick: async () => {
          if (!confirm(`Cancel ${apptName(x)} on ${fmtDate(x.date)} at ${x.start}?${x.clientEmail && x.emailClient !== false ? ' The client will be emailed.' : ''}`)) return;
          try { const r = await api('diary-cancel', { id: x.id }); await refresh(`Cancelled.${mailedNote(r.mailed)}`); } catch (e) { bad(e.message); }
        } }, 'Cancel')));

    const days = Array.from({ length: 7 }, (_, i) => plusDays(st.week, i));
    const allTodos = todoItems(d);
    const dayTodos = (day) => allTodos.filter((t) => t.due === day && (t.done ? day <= today : true)).sort(byDay);
    const shown = d.appts.filter((x) => x.status !== 'cancelled' && (!st.who || x.who === st.who));
    const body = h('div', { class: 'week' }, days.map((day) => {
      const list = shown.filter((x) => x.date === day);
      return h('section', { class: 'card stack', style: `padding:14px;gap:8px;${day === today ? 'outline:2px solid var(--gold);' : ''}${day < today ? 'background:#FAFBFA;' : ''}` },
        h('strong', {}, dayName(day)),
        h('div', { class: 'row', style: 'gap:2px;margin-top:-6px' }, h('button', { class: 'btn link small', onclick: () => openForm(null, { date: day }) }, '+ Appt'), h('a', { class: 'btn link small', href: `#todo/@${day}` }, '+ To do')),
        list.map(apptBox),
        dayTodos(day).length ? h('ol', { class: 'td-list small', style: 'border-top:1px dashed var(--line)' }, dayTodos(day).map((t) => todoRow(t, { onChange: () => diaryView() }))) : null,
        !list.length && !dayTodos(day).length ? h('span', { class: 'small muted' }, '–') : null);
    }));

    frame('diary',
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Diary'), h('p', { class: 'muted' }, `Week of ${fmtDate(st.week)}`)),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '#todo' }, 'To do list'), h('button', { class: 'btn primary', onclick: () => openForm(null) }, '+ Appointment'))),
      noEmails.length ? h('p', { class: 'of-banner' }, `No email address saved for ${noEmails.join(' and ')}, so their calendar invites can’t be sent. `, h('a', { href: '#settings' }, 'Add it in Settings')) : null,
      msg, formBox,
      h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:12px' },
        h('div', { class: 'pills' },
          pill(!st.who, 'Everyone', () => { st.who = ''; diaryView(); }), d.people.map((p) => pill(st.who === p.name, p.name, () => { st.who = p.name; diaryView(); }))),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { st.week = plusDays(st.week, -7); diaryView(); } }, '‹ Previous'), h('button', { class: 'btn small', onclick: () => { st.week = mondayOf(localToday()); diaryView(); } }, 'This week'), h('button', { class: 'btn small', onclick: () => { st.week = plusDays(st.week, 7); diaryView(); } }, 'Next ›'))),
      body);
    if (diaryView.flash) { ok(diaryView.flash); diaryView.flash = ''; }
    const m = String(arg || '').match(/^new\/(.+)$/);
    if (m) {
      const a = apps.find((x) => x.ref === decodeURIComponent(m[1]));
      if (a) openForm(null, { clientName: titleCase(a.name), clientEmail: a.email || '', clientPhone: a.phone || '', ref: a.ref, title: a.formTitle || '' });
      history.replaceState(null, '', '#diary');
    }
  }

  const syncIndex = (a) => {
    const i = apps.findIndex((x) => x.ref === a.ref);
    const s = { ...apps[i], ...a, invoices: (a.invoices || []).map((v) => ({ status: v.status, total: v.total, company: v.company })), people: (a.people || []).length, openReminders: (a.reminders || []).filter((r) => !r.done).map((r) => ({ id: r.id, due: r.due, text: r.text })), nextReminder: (a.reminders || []).filter((r) => !r.done).sort((x, y) => x.due.localeCompare(y.due)).map((r) => ({ due: r.due, text: r.text }))[0] || null };
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
      ? applicantLines({ id: 1, name: titleCase(a.name || '') })
      : [{ kind: 'fee', description: `UVSUK fee${a.service ? ` – ${a.service}` : ''}`, amount: 0, vat: feeVat() }]);
    st.lines = defaultLines();
    if (st.company === 'tvh' && page && page.rows.length === 1) pickRow(page.rows[0]);
    function pickRow(r) {
      const e = st.lines.find((l) => l.kind === 'embassy'), f = st.lines.find((l) => l.kind === 'fee');
      const label = [r.service, r.detail].filter(Boolean).join(', ');
      st.lines.forEach((l) => {
        if (l.kind === 'embassy') { l.amount = amountOf(r.embassy); l.description = `Embassy fee – ${page.title}${label ? ` (${label})` : ''}`; }
        if (l.kind === 'fee' && l.person) { l.amount = amountOf(r.fee); l.description = `Travel Visa Help service fee – ${page.title}${label ? ` (${label})` : ''}`; }
      });
    }
    // Each applicant gets their own embassy fee line and service fee line, sharing one name.
    function applicantLines(person, copyFrom = []) {
      const e = copyFrom.find((l) => l.kind === 'embassy'), f = copyFrom.find((l) => l.kind === 'fee' && l.person);
      return [
        { kind: 'embassy', person, description: e ? e.description : `Embassy fee${page ? ` – ${page.title}` : ''}`, amount: e ? e.amount : 0, vat: e ? e.vat : 0 },
        { kind: 'fee', person, description: f ? f.description : 'Travel Visa Help service fee', amount: f ? f.amount : 0, vat: f ? f.vat : feeVat() },
      ];
    }
    const people = () => [...new Set(st.lines.filter((l) => l.person).map((l) => l.person))];
    function setApplicants(n) {
      const ps = people();
      if (n > ps.length) {
        const firstLines = ps.length ? st.lines.filter((l) => l.person === ps[0]) : [];
        const lastIdx = ps.length ? Math.max(...st.lines.map((l, i) => (l.person ? i : -1))) : -1;
        const add = [];
        for (let k = ps.length; k < n; k++) add.push(...applicantLines({ id: Date.now() + k, name: '' }, firstLines));
        st.lines.splice(lastIdx + 1, 0, ...add);
      } else if (n < ps.length) {
        const drop = new Set(ps.slice(n));
        st.lines = st.lines.filter((l) => !drop.has(l.person));
      }
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

      const lineRows = st.lines.map((l, i) => h('div', { class: l.person ? 'line has-name' : 'line' },
        h('input', { type: 'text', value: l.description, 'aria-label': `Line ${i + 1} description`, oninput: (e) => { l.description = e.target.value; } }),
        l.kind === 'embassy' && l.person ? h('input', { type: 'text', class: 'who', value: l.person.name || '', placeholder: 'Applicant name', 'aria-label': `Line ${i + 1} applicant name`, oninput: (e) => { l.person.name = e.target.value; card.querySelectorAll(`[data-person="${l.person.id}"]`).forEach((s) => { s.textContent = e.target.value || 'same applicant'; }); } })
          : l.person ? h('span', { class: 'who small muted', 'data-person': l.person.id, title: 'Name comes from the embassy fee line above' }, l.person.name || 'same applicant') : null,
        h('input', { type: 'number', class: 'amt', step: '0.01', min: '0', value: l.amount ? l.amount.toFixed(2) : '', placeholder: '0.00', 'aria-label': `Line ${i + 1} amount (£)`, oninput: (e) => { l.amount = Number(e.target.value) || 0; totals(); } }),
        h('select', { 'aria-label': `Line ${i + 1} VAT`, onchange: (e) => { l.vat = Number(e.target.value); totals(); } }, [0, 20].map((v) => h('option', { value: v, selected: Number(l.vat) === v }, v ? '+20% VAT' : 'No VAT'))),
        h('button', { type: 'button', class: 'btn link x', 'aria-label': `Remove line ${i + 1}`, title: 'Remove', onclick: () => { st.lines.splice(i, 1); draw(); } }, '✕')));
      const count = st.company === 'tvh' ? h('label', { class: 'f', style: 'max-width:220px' }, 'Number of applicants',
        h('select', { onchange: (e) => { setApplicants(Number(e.target.value)); draw(); } },
          Array.from({ length: 10 }, (_, k) => k + 1).map((n) => h('option', { value: n, selected: n === people().length }, n === 1 ? '1 applicant' : `${n} applicants`)))) : null;

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
        const unnamed = people().length > 1 && people().some((p) => !p.name.trim());
        if (unnamed && !confirm('Some applicants have no name. Carry on anyway?')) return;
        const missing = !billTo.name ? 'The invoice needs a name: add the company name in Client details.' : !billTo.email ? 'Add the client’s email in Client details first.' : '';
        if (missing) return flash(missing, true);
        const total = tot.textContent;
        const app = me.companies[st.company].appName;
        if (mode === 'send' && !confirm(`Create the invoice in ${app} and email it to ${billTo.email}?\n\n${billTo.name}\nTotal ${total}`)) return;
        if (mode === 'mark' && !confirm(`Create the invoice in ${app} and mark it as sent, without emailing the client?\n\nTotal ${total}`)) return;
        card.querySelectorAll('.inv-actions button').forEach((b) => { b.disabled = true; });
        btn.textContent = 'Working…';
        try {
          const r = await api('invoice', { ref: a.ref, invoice: { company: st.company, mode, billTo, lines: st.lines.map(({ description, person, amount, vat }) => ({ description: person && person.name.trim() ? `${description} – ${person.name.trim()}` : description, amount, vat })) } });
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
        count,
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
  // ---------- email ----------
  // Each person sees their own mailboxes plus the shared ones (hello@). Emails stay in Zoho:
  // the list comes from a quick saved copy first, then fresh from Zoho a moment later.
  const shortBox = (a) => (a ? a.email.split('@')[0] + '@' : '');
  const mailDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const byTag = (by) => !by ? null : by.replied ? h('span', { class: 'tag' }, `↩ Replied by ${by.replied}`) : by.opened ? h('span', { class: 'tag draft' }, `Opened by ${by.opened}`) : null;
  const clientByEmail = (email) => email ? apps.find((a) => String(a.email || '').toLowerCase() === email) : null;
  const fileToB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error(`Couldn’t read ${f.name}`)); r.readAsDataURL(f); });

  function mailNoAccess() {
    return h('section', { class: 'card stack' }, h('h2', {}, 'Email is private to each of you'),
      me.people?.length
        ? h('p', { style: 'margin:0' }, 'You’re signed in with the shared password, so email is hidden. Sign out and sign in with your own name and password to see your mailboxes.')
        : h('p', { style: 'margin:0' }, 'Set up your own passwords first: in Netlify › Site configuration › Environment variables, add OFFICE_PASSWORD_RAJ and OFFICE_PASSWORD_SUNITA (at least 8 characters each, tick “Contains secret values”), redeploy, then sign in with your name.'),
      h('button', { class: 'btn small', style: 'align-self:flex-start', onclick: async () => { await api('logout', {}); showLogin(); } }, 'Sign out'));
  }

  async function mailView(arg) {
    if (!me.user) return frame('mail', h('h1', {}, 'Email'), mailNoAccess());
    const [first, second] = String(arg || '').split('/');
    if (first === 'new') return mailCompose({});
    if (first && second) return mailMessage(first, Number(second));
    let filter = first || mailView.filter || '';
    const listBox = h('div', {}, h('p', { class: 'muted' }, 'Loading…'));
    const pills = h('div', { class: 'pills', style: 'margin-bottom:12px' });
    const status = h('span', { class: 'small muted' });
    const problems = h('div');
    let data = null;
    const draw = () => {
      const accs = data.accounts;
      if (!accs.length) {
        put(pills); put(problems);
        return put(listBox, h('section', { class: 'card stack' }, h('h2', {}, 'Add your mailboxes'), h('p', { style: 'margin:0' }, 'Go to Settings › Your email accounts and add each Zoho mailbox once. Then all your emails show up here.'), h('a', { class: 'btn primary small', href: '#settings', style: 'align-self:flex-start' }, 'Go to Settings')));
      }
      if (filter && !accs.some((a) => a.id === filter)) filter = '';
      const total = accs.reduce((n, a) => n + a.unread, 0);
      unreadMail = total; showMailBadge();
      const pill = (id, label, n, color) => h('button', { type: 'button', class: 'pill small', 'aria-pressed': String(filter === id), onclick: () => { filter = id; mailView.filter = id; history.replaceState(null, '', id ? `#mail/${id}` : '#mail'); draw(); } },
        color ? h('span', { class: 'dot', style: `background:${color}` }) : null, label, n ? h('span', { class: 'badge', style: 'margin-left:6px' }, String(n)) : null);
      put(pills, pill('', 'All', total), accs.map((a) => pill(a.id, `${shortBox(a)}${a.owner === 'shared' ? ' (shared)' : ''}`, a.unread, a.color)));
      put(problems, accs.filter((a) => a.problem || a.error).map((a) => h('p', { class: 'of-banner' }, h('strong', {}, `${a.email}: `), a.error || a.problem)));
      const accById = Object.fromEntries(accs.map((a) => [a.id, a]));
      const list = data.messages.filter((m) => !filter || m.acc === filter);
      if (!list.length) return put(listBox, h('p', { class: 'muted' }, 'No emails in this inbox.'));
      put(listBox, h('ul', { class: 'mail-list card' }, list.slice(0, 150).map((m) => {
        const a = accById[m.acc];
        const open = () => go(`mail/${m.acc}/${m.uid}`);
        return h('li', { class: `mail-row${m.seen ? '' : ' unread'}`, tabindex: '0', onclick: open, onkeydown: (e) => { if (e.key === 'Enter') open(); }, style: `border-left-color:${a?.color || 'var(--line)'}` },
          h('div', { class: 'mail-top' }, h('span', { class: 'mail-from' }, m.fromName || m.from || 'Unknown'), h('span', { class: 'mail-date' }, m.attach ? '📎 ' : '', mailDate(m.date))),
          h('div', { class: 'mail-subj' }, m.subject),
          h('div', { class: 'mail-meta' }, h('span', { class: 'small muted' }, shortBox(a)), m.answered && !m.by?.replied ? h('span', { class: 'tag' }, '↩ Replied') : null, byTag(m.by), clientByEmail(m.from) ? h('span', { class: 'tag new' }, 'Client') : null));
      })));
    };
    const load = async (fresh) => {
      put(status, fresh ? 'Checking Zoho…' : '');
      try { data = await get(`mail${fresh ? '?fresh=1' : ''}`); draw(); put(status, fresh ? `Up to date · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''); }
      catch (e) { if (!data) put(listBox, h('p', { class: 'msg err' }, e.message)); put(status, e.message); }
    };
    frame('mail',
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Email'), status),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => load(true) }, '↻ Check now'), h('a', { class: 'btn primary small', href: '#mail/new' }, '✏️ New email'))),
      problems, pills, listBox);
    await load(false);
    load(true);
  }

  async function mailMessage(acc, uid) {
    frame('mail', h('p', { class: 'muted' }, 'Opening…'));
    let m;
    try { m = (await get(`mail-read?acc=${encodeURIComponent(acc)}&uid=${uid}`)).message; }
    catch (e) { return frame('mail', h('p', {}, h('a', { href: '#mail' }, '← Back to email')), h('p', { class: 'msg err' }, e.message)); }
    countMail();
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const client = clientByEmail(m.from.email) || clientByEmail(m.replyTo?.email);
    const who = (x) => (x.name ? `${x.name} <${x.email}>` : x.email);
    const fileUrl = (x, view) => `/office/api/mail-file?acc=${encodeURIComponent(acc)}&uid=${uid}&n=${x.n}${view ? '&view=1' : ''}`;
    // The email is shown in a locked-down frame: no scripts, links open in a new tab
    let body;
    if (m.html) {
      const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:"><base target="_blank"><style>body{font-family:system-ui,sans-serif;font-size:15px;line-height:1.45;color:#1F2A24;margin:12px;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${m.html}</body></html>`;
      body = h('iframe', { class: 'mail-frame', sandbox: 'allow-popups allow-popups-to-escape-sandbox', title: 'Email', srcdoc: doc, referrerpolicy: 'no-referrer' });
    } else body = h('div', { class: 'mail-text' }, m.text || '(This email is empty.)');
    const files = m.attachments.filter((x) => !x.inline || !m.html);
    const quoteText = () => {
      const src = m.text || (m.html ? new DOMParser().parseFromString(m.html, 'text/html').body.innerText : '');
      const head = `On ${new Date(m.date || Date.now()).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}, ${who(m.from)} wrote:`;
      return `${head}\n${String(src).trim().split('\n').slice(0, 400).map((l) => `> ${l}`).join('\n')}`;
    };
    const reply = (all) => {
      const to = m.replyTo?.email || m.from.email;
      const mine = new Set([m.acc.email]);
      const cc = all ? [...m.to, ...m.cc].map((x) => x.email).filter((e) => e !== to && !mine.has(e)) : [];
      mailCompose({ acc: m.acc.id, to, cc: [...new Set(cc)].join(', '), subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`, replyUid: uid, inReplyTo: m.messageId, references: m.references, quote: quoteText(), back: `mail/${acc}/${uid}`, about: m });
    };
    const forward = () => mailCompose({ acc: m.acc.id, to: '', subject: /^fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`, forwardUid: files.length ? uid : 0, forwardFiles: files, quote: `---------- Forwarded message ----------\nFrom: ${who(m.from)}\nDate: ${new Date(m.date || Date.now()).toLocaleString('en-GB')}\nSubject: ${m.subject}\nTo: ${m.to.map(who).join(', ')}\n\n${(m.text || (m.html ? new DOMParser().parseFromString(m.html, 'text/html').body.innerText : '')).trim()}`, back: `mail/${acc}/${uid}`, about: m, forward: true });
    frame('mail',
      h('p', {}, h('a', { href: mailView.filter ? `#mail/${mailView.filter}` : '#mail' }, '← Back to email')),
      h('section', { class: 'card stack' },
        h('div', {}, h('h1', { style: 'font-size:20px' }, m.subject),
          h('div', { class: 'row small', style: 'gap:6px;margin-top:6px' }, h('span', { class: 'dot', style: `background:${m.acc.color}` }), h('span', { class: 'muted' }, `To ${m.acc.email}${m.acc.owner === 'shared' ? ' (shared)' : ''}`), byTag(m.by), m.answered && !m.by?.replied ? h('span', { class: 'tag' }, '↩ Replied') : null)),
        h('div', { class: 'small', style: 'line-height:1.6' },
          h('div', {}, h('strong', {}, m.from.name || m.from.email), m.from.name ? h('span', { class: 'muted' }, ` <${m.from.email}>`) : null),
          m.to.length ? h('div', { class: 'muted' }, 'To: ', m.to.map(who).join(', ')) : null,
          m.cc.length ? h('div', { class: 'muted' }, 'Cc: ', m.cc.map(who).join(', ')) : null,
          h('div', { class: 'muted' }, fmtDateTime(m.date)),
          client ? h('div', {}, '👤 Client: ', h('a', { href: `#app/${encodeURIComponent(client.ref)}` }, titleCase(client.name) || client.ref), client.formTitle ? h('span', { class: 'muted' }, ` · ${client.formTitle}`) : null) : null),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary small', onclick: () => reply(false) }, '↩ Reply'),
          m.to.length + m.cc.length > 1 ? h('button', { class: 'btn small', onclick: () => reply(true) }, 'Reply all') : null,
          h('button', { class: 'btn small', onclick: forward }, 'Forward'),
          h('button', { class: 'btn small', onclick: () => { todoView.prefill = { text: `Email from ${m.from.name || m.from.email}: ${m.subject}`.slice(0, 200), name: m.from.name, email: m.from.email }; go(client ? `todo/${client.ref}` : 'todo'); } }, '+ To do'),
          h('button', { class: 'btn small', onclick: async (e) => { e.currentTarget.disabled = true; try { await api('mail-seen', { acc, uid, seen: false }); go(mailView.filter ? `mail/${mailView.filter}` : 'mail'); } catch (x) { put(msg, h('p', { class: 'msg err' }, x.message)); } } }, 'Mark unread'),
          h('button', { class: 'btn small', onclick: async (e) => { if (!confirm('Move this email to the Trash folder in Zoho? You can get it back from there.')) return; e.currentTarget.disabled = true; try { await api('mail-trash', { acc, uid }); go(mailView.filter ? `mail/${mailView.filter}` : 'mail'); } catch (x) { put(msg, h('p', { class: 'msg err' }, x.message)); } } }, '🗑 Delete')),
        msg,
        files.length ? h('div', { class: 'rows' }, files.map((x) => h('span', { class: 'chip', style: 'cursor:default' }, h('b', {}, `📎 ${x.name}`), fmtSize(x.size), ' · ',
          /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/i.test(x.type) ? [h('a', { href: fileUrl(x, true), target: '_blank', rel: 'noopener' }, 'View'), ' · '] : null,
          h('a', { href: fileUrl(x, false) }, 'Download')))) : null,
        body));
  }

  // New email, reply or forward. o: { acc, to, cc, subject, replyUid, inReplyTo, references, quote, forwardUid, forwardFiles, back, about }
  async function mailCompose(o) {
    let accounts = [];
    try { accounts = (await get('mail-accounts')).accounts; } catch (e) { return frame('mail', h('p', { class: 'msg err' }, e.message)); }
    if (!accounts.length) return go('mail');
    const back = o.back || 'mail';
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const from = h('select', { disabled: !!o.replyUid }, accounts.map((a) => h('option', { value: a.id, selected: a.id === (o.acc || mailView.filter) }, `${a.email}${a.owner === 'shared' ? ' (shared)' : ''}`)));
    const to = h('input', { type: 'text', value: o.to || '', autocomplete: 'off', inputmode: 'email', placeholder: 'name@example.com' });
    const cc = h('input', { type: 'text', value: o.cc || '', autocomplete: 'off', inputmode: 'email', placeholder: 'Optional' });
    const subject = h('input', { type: 'text', value: o.subject || '' });
    const text = h('textarea', { rows: '10', style: 'min-height:220px', placeholder: 'Write your message…' });
    const files = h('input', { type: 'file', multiple: true });
    const sigNote = h('p', { class: 'small muted', style: 'margin:0' });
    const showSig = () => { const a = accounts.find((x) => x.id === from.value); put(sigNote, a?.signature ? `Your signature for ${a.email} is added at the end.` : h('span', {}, 'No signature for this mailbox yet. ', h('a', { href: '#settings' }, 'Add one in Settings'))); };
    from.addEventListener('change', showSig); showSig();
    const sendBtn = h('button', { class: 'btn primary', type: 'submit' }, 'Send');
    const form = h('form', { class: 'card stack', onsubmit: async (e) => {
      e.preventDefault(); sendBtn.disabled = true; put(msg, h('p', { class: 'msg ok' }, 'Sending…'));
      try {
        const attachments = [];
        for (const f of files.files) { if (f.size > 4.3 * 1048576) throw new Error(`${f.name} is too big (over 4 MB).`); attachments.push({ name: f.name, type: f.type, data: await fileToB64(f) }); }
        const r = await api('mail-send', { acc: from.value, to: to.value, cc: cc.value, subject: subject.value, text: text.value, replyUid: o.replyUid || 0, inReplyTo: o.inReplyTo || '', references: o.references || [], quote: o.quote || '', forwardUid: o.forwardUid || 0, forwardFrom: o.forwardUid ? o.acc : '', attachments });
        put(msg, h('p', { class: 'msg ok' }, `Sent from ${r.from} to ${r.to.join(', ')}.`));
        setTimeout(() => go(back), 900);
      } catch (x) { put(msg, h('p', { class: 'msg err' }, x.message)); sendBtn.disabled = false; }
    } },
      h('label', { class: 'f' }, 'From', from), sigNote,
      h('div', { class: 'fields' }, h('label', { class: 'f' }, 'To', to), h('label', { class: 'f' }, 'Cc', cc)),
      h('label', { class: 'f' }, 'Subject', subject),
      h('label', { class: 'f' }, 'Message', text),
      o.forwardFiles?.length ? h('p', { class: 'small muted', style: 'margin:0' }, `The original attachments go with it: ${o.forwardFiles.map((x) => x.name).join(', ')}.`) : null,
      h('label', { class: 'f' }, 'Attach files (up to about 4 MB in total)', files),
      o.quote ? h('details', {}, h('summary', { class: 'small muted' }, o.forward ? 'Forwarded email (included)' : 'Their email (included below your reply)'), h('div', { class: 'mail-text small muted' }, o.quote)) : null,
      msg,
      h('div', { class: 'row' }, sendBtn, h('a', { class: 'btn', href: `#${back}`, onclick: (e) => { if (text.value.trim() && !confirm('Discard this email?')) e.preventDefault(); else if (location.hash === `#${back}`) { e.preventDefault(); route(); } } }, 'Cancel')));
    frame('mail', h('p', {}, h('a', { href: `#${back}` }, '← Back')), h('h1', { style: 'margin-bottom:14px' }, o.replyUid ? 'Reply' : o.forward ? 'Forward' : 'New email'), form);
    (o.to ? text : to).focus();
  }

  // Settings › Your email accounts
  function mailSettingsCard() {
    const sec = h('section', { class: 'card stack', style: 'margin-bottom:16px' }, h('h2', {}, '✉️ Your email accounts'));
    if (!me.user) { sec.append(mailNoAccess()); return sec; }
    const msg = h('div', { role: 'status', 'aria-live': 'polite' });
    const listBox = h('div', { class: 'stack' });
    const draw = async () => {
      let d;
      try { d = await get('mail-accounts'); } catch (e) { return put(listBox, h('p', { class: 'msg err' }, e.message)); }
      const email = h('input', { type: 'email', placeholder: 'The full email address', autocomplete: 'off' });
      const pass = h('input', { type: 'password', placeholder: 'Paste the app password from Zoho', autocomplete: 'new-password' });
      const name = h('input', { type: 'text', value: 'Unique Visa Services' });
      const shared = h('input', { type: 'checkbox' });
      const addBtn = h('button', { class: 'btn primary small', type: 'submit' }, 'Add mailbox');
      put(listBox,
        d.accounts.length ? h('ul', { class: 'list' }, d.accounts.map((a) => {
          const nm = h('input', { type: 'text', value: a.name });
          const sig = h('textarea', { rows: '3', placeholder: `e.g.\n${me.user}\nUnique Visa Services` }, a.signature);
          const sh = h('input', { type: 'checkbox', checked: a.owner === 'shared' });
          const edit = h('div', { class: 'stack', hidden: true, style: 'margin-top:10px' },
            h('label', { class: 'f' }, 'Name clients see', nm), h('label', { class: 'f' }, 'Signature (added to the end of every email)', sig),
            h('label', { class: 'row small' }, sh, 'Shared with everyone (like hello@)'),
            h('div', { class: 'row' },
              h('button', { class: 'btn small primary', onclick: async () => { try { await api('mail-account-update', { id: a.id, name: nm.value, signature: sig.value, shared: sh.checked }); put(msg, h('p', { class: 'msg ok' }, 'Saved.')); draw(); } catch (x) { put(msg, h('p', { class: 'msg err' }, x.message)); } } }, 'Save'),
              h('button', { class: 'btn small', onclick: async () => { if (!confirm(`Remove ${a.email} from the back office? Nothing is deleted in Zoho.`)) return; try { await api('mail-account-remove', { id: a.id }); draw(); } catch (x) { put(msg, h('p', { class: 'msg err' }, x.message)); } } }, 'Remove')));
          return h('li', {}, h('div', { class: 'row', style: 'justify-content:space-between' },
            h('span', { class: 'row', style: 'gap:8px' }, h('span', { class: 'dot', style: `background:${a.color}` }), h('strong', {}, a.email), h('span', { class: 'tag draft' }, a.owner === 'shared' ? 'Shared' : `Only ${a.owner}`)),
            h('button', { class: 'btn link small', onclick: () => { edit.hidden = !edit.hidden; } }, 'Edit')),
            a.error ? h('p', { class: 'msg err small', style: 'margin:6px 0 0' }, a.error) : null, edit);
        })) : h('p', { class: 'muted small', style: 'margin:0' }, 'No mailboxes yet.'),
        h('form', { class: 'box stack', onsubmit: async (e) => {
          e.preventDefault(); addBtn.disabled = true; put(msg, h('p', { class: 'msg ok' }, 'Connecting to Zoho… (this takes a few seconds)'));
          try { const r = await api('mail-account-add', { email: email.value, pass: pass.value, name: name.value, shared: shared.checked }); put(msg, h('p', { class: 'msg ok' }, `${r.account.email} is connected.`)); draw(); countMail(); }
          catch (x) { put(msg, h('p', { class: 'msg err' }, x.message)); addBtn.disabled = false; }
        } },
          h('h3', { style: 'margin:0' }, 'Add a mailbox'),
          h('div', { class: 'fields' }, h('label', { class: 'f' }, 'Email address', email), h('label', { class: 'f' }, 'Zoho app password', pass), h('label', { class: 'f' }, 'Name clients see', name)),
          h('label', { class: 'row small' }, shared, 'Shared with everyone (tick this for hello@)'),
          h('details', { class: 'small' }, h('summary', {}, 'How to get an app password from Zoho'),
            h('ol', { style: 'margin:8px 0 0;padding-left:20px;line-height:1.6' },
              h('li', {}, 'Sign in to Zoho Mail on a computer as that mailbox.'),
              h('li', {}, 'Check IMAP is on: Settings (gear) › Mail Accounts › IMAP › tick IMAP Access.'),
              h('li', {}, 'Go to accounts.zoho.com › Security › App Passwords › Generate New Password. Call it “UVS back office”.'),
              h('li', {}, 'Copy the password Zoho shows and paste it here. Your normal Zoho password stays private and keeps working.'))),
          addBtn),
        h('p', { class: 'small muted', style: 'margin:0' }, `Only you can see mailboxes you add, unless you tick “Shared”. New emails pop up on your phone within about 3 minutes (7am–10pm), if phone notifications are on for ${me.user} below.`),
        d.hook ? h('details', { class: 'small' }, h('summary', { class: 'muted' }, 'Optional: instant notifications from Zoho'),
          h('p', {}, 'For a pop-up the moment an email lands (instead of within 3 minutes), in Zoho Mail go to Settings › Developer Space › Outgoing Webhooks, add one for new incoming emails, and paste this address as the URL:'),
          h('input', { type: 'text', readonly: true, value: d.hook, onclick: (e) => e.target.select() }),
          h('p', { class: 'muted' }, 'Keep this address private.')) : null);
    };
    sec.append(msg, listBox);
    draw();
    return sec;
  }

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
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Settings'), h('p', { class: 'muted small', style: 'margin:0' }, me.user ? `Signed in as ${me.user}.` : 'Signed in with the shared password.')), h('button', { class: 'btn', onclick: async () => { await api('logout', {}); showLogin('You’ve signed out.'); } }, 'Sign out')),
      msg,
      mailSettingsCard(),
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
      notifyCard(),
      diaryPeopleCard(ok, bad),
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
