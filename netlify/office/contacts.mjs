// Address book: everyone you deal with, from FreeAgent, Wave, Zoho Mail (exported file), the website
// forms, or added by hand. Kept as one list in the office store ('contacts').
// The same person from two places is merged: matched by email, then phone, then name.
// { id, name, company, email, phone, mobile, address, notes, sources: ['FreeAgent', ...], created, updated }
const clean = (v, max = 300) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const digits = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('44')) d = '0' + d.slice(2); return d.length >= 9 ? d : ''; };
const nameKey = (c) => `${clean(c.name).toLowerCase()}|${clean(c.company).toLowerCase()}`;
const SOURCES = ['FreeAgent', 'Wave', 'Zoho Mail', 'Imported file', 'Website forms', 'Added by hand'];

export async function readContacts(store) { return (await store.get('contacts', { type: 'json' })) || []; }
const saveAll = (store, list) => { list.sort((a, b) => (a.name || a.company || a.email).localeCompare(b.name || b.company || b.email, 'en', { sensitivity: 'base' })); return store.setJSON('contacts', list); };

function tidy(input, source) {
  const c = {
    name: clean(input.name, 120), company: clean(input.company, 160), email: clean(input.email, 200).toLowerCase(),
    phone: clean(input.phone, 40), mobile: clean(input.mobile, 40), address: clean(input.address, 400), notes: String(input.notes ?? '').trim().slice(0, 2000),
  };
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) c.email = '';
  if (c.mobile && digits(c.mobile) === digits(c.phone)) c.mobile = '';
  c.source = SOURCES.includes(source) ? source : 'Imported file';
  return c;
}

function findMatch(list, c) {
  if (c.email) { const m = list.find((x) => x.email === c.email); if (m) return m; }
  const ds = [digits(c.phone), digits(c.mobile)].filter(Boolean);
  if (ds.length) { const m = list.find((x) => ds.includes(digits(x.phone)) || ds.includes(digits(x.mobile))); if (m) return m; }
  if (c.name || c.company) { const k = nameKey(c); const m = list.find((x) => nameKey(x) === k && (!x.email || !c.email)); if (m) return m; }
  return null;
}

// Add many at once (imports). Fills gaps in existing contacts; never overwrites what's there.
export async function importContacts(store, rows, source) {
  const list = await readContacts(store);
  let added = 0, updated = 0, skipped = 0;
  const now = new Date().toISOString();
  for (const r of (rows || []).slice(0, 5000)) {
    const c = tidy(r, source);
    if (!c.name && !c.company && !c.email && !c.phone && !c.mobile) { skipped++; continue; }
    const m = findMatch(list, c);
    if (m) {
      let changed = false;
      for (const k of ['name', 'company', 'email', 'phone', 'mobile', 'address']) if (!m[k] && c[k]) { m[k] = c[k]; changed = true; }
      if (!m.sources.includes(c.source)) { m.sources.push(c.source); changed = true; }
      if (changed) { m.updated = now; updated++; } else skipped++;
    } else {
      const { source: s, ...rest } = c;
      list.push({ id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, ...rest, sources: [s], created: now, updated: now });
      added++;
    }
  }
  if (list.length > 10000) throw Object.assign(new Error('The address book is full (10,000 contacts).'), { status: 400 });
  await saveAll(store, list);
  return { added, updated, skipped, total: list.length };
}

export async function saveContact(store, input) {
  const list = await readContacts(store);
  const c = tidy(input, 'Added by hand');
  if (!c.name && !c.company && !c.email && !c.phone && !c.mobile) throw Object.assign(new Error('Add a name, company, email or phone number.'), { status: 400 });
  const now = new Date().toISOString();
  const { source, ...fields } = c;
  let contact;
  if (input.id) {
    contact = list.find((x) => x.id === input.id);
    if (!contact) throw Object.assign(new Error('Contact not found'), { status: 404 });
    Object.assign(contact, fields, { updated: now });
  } else {
    contact = { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, ...fields, sources: [source], created: now, updated: now };
    list.push(contact);
  }
  await saveAll(store, list);
  return { contact };
}

export async function deleteContact(store, id) {
  await saveAll(store, (await readContacts(store)).filter((x) => x.id !== id));
  return { ok: true };
}
