// Turns a page's "Documents table" (edited in the admin) into upload boxes on its online form.
// Used by the form in the browser (src/lib/apply-form.js) and by scripts/check-page-docs.mjs.
//
// How it works:
// - Each visa page has a Documents table and an Apply button link, e.g.
//   /apply/evisa/?destination=Kenya&visaType=Business. When a client fills in that form
//   with the same destination and visa type, the form asks for the documents on that page's table.
// - Documents the form already asks for (passport, photo, flights, hotel, bank statements and so on)
//   aren't asked for twice. "We prepare" rows (things we do for the client) are skipped.
// - "Needed" in the table sets the box: Required = must upload, If not British = must upload
//   unless the client is British, If applicable / Optional = optional.

// Groups of documents that mean the same thing, so a table row isn't asked for twice.
const GROUPS = [
  // Rows that are information we collect in the form's questions, not a document to upload
  ['info', /details$|^details of|^email|^address|^other documents|^supporting documents|^any other|original documents/],
  ['photo', /\bphoto(graph)?s?\b|\bpicture\b/],
  ['appform', /application form|visa form|ds-?160/],
  ['ukstatus', /\bbrp\b|evisa share|share code|residence permit|uk visa|immigration status|uk residen|residence (status|evidence)|proof of (uk )?residen|right to (live|reside)|leave to remain|not british/],
  ['prevvisa', /(previous|last|old|earlier) .*visas?\b/],
  ['passport', /passport/],
  ['flight', /flight|\btickets?\b|itinerar/],
  ['hotel', /hotel|accommodation/],
  ['invitation', /invitation|invite/],
  ['bank', /bank|financial|funds|statement/],
  ['employer', /employer|employment|payslip|pay slip|no.?objection/],
  ['insurance', /insurance/],
  ['yellowfever', /yellow fever|vaccinat/],
  ['relationship', /birth certificate|marriage certificate|proof of relationship/],
];
const SKIP_ALWAYS = new Set(['passport', 'appform', 'info']);

const norm = (t) => String(t || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
// Every group a document belongs to, e.g. "Hotel booking, or invitation letter" -> hotel, invitation
export const docGroups = (label) => {
  const t = norm(label);
  const out = GROUPS.filter(([, re]) => re.test(t)).map(([g]) => g);
  // "Passport photo" is a photo, not the passport
  return out.includes('photo') ? out.filter((g) => g !== 'passport') : out;
};

// Pick the page table that matches the client's answers. The page they came from wins (if its
// link still matches what they've chosen); otherwise the most specific matching link. A link with
// no destination or visa type (e.g. /apply/saudi-visa/) is only used for clients who came from that page,
// because several pages can share it.
export function pickPageDocs(pageDocs = [], answers = {}, fromPage = '') {
  let best = null;
  for (const entry of pageDocs) {
    const keys = Object.entries(entry.match || {});
    if (!keys.every(([k, v]) => answers[k] === v)) continue;
    if (fromPage && entry.page === fromPage) return entry;
    if (!keys.length) continue;
    if (!best || keys.length > Object.keys(best.match).length) best = entry;
  }
  return best;
}

// Upload boxes to add for a page table. `existing` = the form's own uploads that are showing.
// Slots list1 ... list12 are registered for Netlify in forms-register.astro.
export const LIST_SLOTS = Array.from({ length: 12 }, (_, i) => `list${i + 1}`);
export function pageDocUploads(entry, existing = []) {
  if (!entry) return [];
  const haveGroups = new Set(existing.flatMap((u) => docGroups(u.label)));
  const haveLabels = new Set(existing.map((u) => norm(u.label)));
  const out = [];
  entry.rows.forEach((r, i) => {
    if (!r || !r.document || i >= LIST_SLOTS.length) return;
    const needed = r.needed || 'Required';
    if (needed === 'We prepare') return;
    const gs = docGroups(r.document);
    if (gs.some((g) => SKIP_ALWAYS.has(g) || haveGroups.has(g))) return;
    if (haveLabels.has(norm(r.document))) return;
    const u = { name: LIST_SLOTS[i], label: r.document, hint: r.details || '', required: needed === 'Required' || needed === 'If not British', fromList: true };
    if (needed === 'If not British') u.showIf = { name: 'nationality', isNot: 'United Kingdom' };
    if (gs.includes('ukstatus')) u.example = 'ukStatus';
    out.push(u);
  });
  return out;
}

// Build time: read every page's Documents table and group them by the form their Apply button opens.
// pages: [{ slug, applyButton, documentsTable }]  ->  { 'evisa': [{ match: { destination: 'Kenya' }, rows }] }
export function collectPageDocs(pages) {
  const byForm = {};
  for (const p of pages) {
    const link = String(p?.applyButton || '');
    const rows = (p?.documentsTable || []).filter((r) => r && r.document);
    const m = link.match(/^\/apply\/([^/?#]+)\/?(?:\?([^#]*))?/);
    if (!m || !rows.length) continue;
    const match = {};
    for (const [k, v] of new URLSearchParams(m[2] || '')) if (k === 'destination' || k === 'visaType') match[k] = v;
    (byForm[m[1]] ||= []).push({ page: p.slug || '', match, rows: rows.map(({ document, details, needed }) => ({ document, details, needed })) });
  }
  return byForm;
}
