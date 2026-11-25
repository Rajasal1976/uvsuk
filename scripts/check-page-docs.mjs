// Lists which documents from each page's Documents table the online form will ask for,
// on top of the form's own document list. Run: node scripts/check-page-docs.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'vite';

// The form definitions use Vite features, so load them through Vite.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { applications } = await vite.ssrLoadModule('/src/data/applications.js');
const { collectPageDocs, pageDocUploads } = await vite.ssrLoadModule('/src/lib/doc-match.js');

const dir = new URL('../content/pages/', import.meta.url);
const pages = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ slug: f.replace('.json', ''), ...JSON.parse(readFileSync(new URL(f, dir), 'utf8')) }));
const byForm = collectPageDocs(pages);

// Rough version of the form's showIf: conditions on answers we don't know count as showing.
const shows = (u, answers) => {
  const c = u.showIf;
  if (!c || !(c.name in answers)) return true;
  const v = answers[c.name];
  if (c.isNot !== undefined) return v !== c.isNot;
  return Array.isArray(c.is) ? c.is.includes(v) : v === c.is;
};

for (const a of applications) {
  for (const entry of byForm[a.slug] || []) {
    const answers = { nationality: 'Ethiopia', ...entry.match };
    const own = (a.uploads || []).filter((u) => shows(u, answers));
    const added = pageDocUploads(entry, own);
    if (added.length) console.log(`${entry.page} (${a.slug}${Object.keys(entry.match).length ? ' ' + JSON.stringify(entry.match) : ''}):\n  ` + added.map((u) => `${u.label}${u.required ? '' : ' (optional)'}`).join('\n  '));
  }
}
await vite.close();
