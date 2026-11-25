// The back office database (Netlify Blobs). Shared by the office functions.
//
// Two stores:
//   office          the live records (production site)
//   office-preview  test records made on deploy previews, so testing never touches real clients
// Accounting connections (FreeAgent / Wave sign-in tokens) live in "office-secrets", shared by both,
// so connecting once on the live site also works on a preview.
import { getStore } from '@netlify/blobs';

export const STATUSES = ['New', 'Documents received', 'Waiting for client', 'Submitted', 'Visa issued', 'Collected or posted', 'Closed'];

export const officeStore = (preview) => getStore({ name: preview ? 'office-preview' : 'office', consistency: 'strong' });
export const secretStore = () => getStore({ name: 'office-secrets', consistency: 'strong' });

const clean = (v, max = 2000) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
export const normEmail = (e) => clean(e, 200).toLowerCase();

// Applications in several parts or for several people share one record, keyed by the group reference.
export function groupRef(ref) { return clean(ref, 60).replace(/-P\d+$/i, ''); }

// The short version of each record kept in one "index" list, so the back office loads in one read.
export function summarise(a) {
  const openReminders = (a.reminders || []).filter((r) => !r.done).sort((x, y) => String(x.due).localeCompare(String(y.due)));
  return {
    ref: a.ref, name: a.name, email: a.email, phone: a.phone, service: a.service, formTitle: a.formTitle,
    companyName: a.companyName, status: a.status, received: a.received, updated: a.updated,
    visaExpiry: a.visaExpiry || '', expiryReminded: a.expiryReminded || '',
    nextReminder: openReminders[0] ? { due: openReminders[0].due, text: openReminders[0].text } : null,
    invoices: (a.invoices || []).map((i) => ({ status: i.status, total: i.total, company: i.company })),
    people: (a.people || []).length,
  };
}

export async function readIndex(store) { return (await store.get('index', { type: 'json' })) || []; }

export async function saveRecord(store, a) {
  a.updated = new Date().toISOString();
  await store.setJSON(`apps/${a.ref}`, a);
  const index = await readIndex(store);
  const i = index.findIndex((x) => x.ref === a.ref);
  if (i >= 0) index[i] = summarise(a); else index.unshift(summarise(a));
  index.sort((x, y) => String(y.received).localeCompare(String(x.received)));
  await store.setJSON('index', index);
  return a;
}

export async function getRecord(store, ref) { return store.get(`apps/${clean(ref, 60)}`, { type: 'json' }); }

// Rebuild the index from every record (Settings > "Rebuild list"), in case it ever gets out of step.
export async function rebuildIndex(store) {
  const { blobs } = await store.list({ prefix: 'apps/' });
  const all = [];
  for (const b of blobs) { const a = await store.get(b.key, { type: 'json' }); if (a) all.push(summarise(a)); }
  all.sort((x, y) => String(y.received).localeCompare(String(x.received)));
  await store.setJSON('index', all);
  return all.length;
}

// Turn a Netlify Forms submission into a record (or add a person to an existing group record).
export function recordFromSubmission(data, existing) {
  const ref = groupRef(data.reference);
  const person = clean(data.applicant_name, 200);
  if (existing) {
    if (person && !(existing.people || []).includes(person)) existing.people = [...(existing.people || []), person];
    return existing;
  }
  const isCo = /company/i.test(data.invoice_to || '');
  return {
    ref,
    source: 'website',
    form: clean(data['form-name'] || data.form_name, 80),
    formTitle: clean(data.form_title, 200) || clean(String(data.subject || '').split(':')[0], 200),
    pageUrl: clean(data.page_url, 200),
    service: clean(data.visa_type, 200),
    received: new Date().toISOString(),
    name: person,
    people: person ? [person] : [],
    email: normEmail(data.email),
    phone: clean(data.phone, 60),
    address: clean(data.address, 500),
    invoiceTo: isCo ? 'Company' : 'Personal',
    companyName: clean(data.company_name, 200),
    companyNumber: clean(data.company_number, 60),
    companyAddress: clean(data.company_address, 500),
    status: 'New',
    notes: [],
    reminders: [],
    visaExpiry: '',
    invoices: [],
  };
}

// A record typed in by hand in the back office (phone enquiries, UK immigration clients).
export function manualRecord(input) {
  const ref = `UVS-M-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  return {
    ...recordFromSubmission({ reference: ref, applicant_name: input.name, email: input.email, phone: input.phone, address: input.address, invoice_to: input.invoiceTo, company_name: input.companyName, company_number: input.companyNumber, company_address: input.companyAddress, visa_type: input.service, form_title: input.service || 'Client record' }),
    source: 'manual',
  };
}

// Changes allowed from the back office screen.
export function applyPatch(a, patch = {}) {
  const now = new Date().toISOString();
  if (patch.status && STATUSES.includes(patch.status)) a.status = patch.status;
  if ('visaExpiry' in patch) a.visaExpiry = /^\d{4}-\d{2}-\d{2}$/.test(patch.visaExpiry || '') ? patch.visaExpiry : '';
  for (const k of ['name', 'phone', 'address', 'companyName', 'companyNumber', 'companyAddress', 'service']) if (k in patch) a[k] = clean(patch[k], 500);
  if ('email' in patch) a.email = normEmail(patch.email);
  if (patch.invoiceTo === 'Company' || patch.invoiceTo === 'Personal') a.invoiceTo = patch.invoiceTo;
  if (patch.addNote && clean(patch.addNote)) a.notes = [{ at: now, text: clean(patch.addNote, 4000) }, ...(a.notes || [])];
  if (patch.addReminder && clean(patch.addReminder.text) && /^\d{4}-\d{2}-\d{2}$/.test(patch.addReminder.due || '')) {
    a.reminders = [...(a.reminders || []), { id: Date.now().toString(36), due: patch.addReminder.due, text: clean(patch.addReminder.text, 500), done: false }];
  }
  if (patch.doneReminder) a.reminders = (a.reminders || []).map((r) => (r.id === patch.doneReminder ? { ...r, done: true } : r));
  if (patch.deleteNote) a.notes = (a.notes || []).filter((n) => n.at !== patch.deleteNote);
  return a;
}
