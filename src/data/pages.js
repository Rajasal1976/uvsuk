// Combines the site structure (src/data/structure.js) with the page text from src/content,
// which is what you edit in the admin at /admin.
import { structure } from './structure.js';

const load = (files) => Object.fromEntries(Object.entries(files).map(([path, data]) => [path.split('/').pop().replace('.json', ''), data]));
const content = load(import.meta.glob('../../content/pages/*.json', { eager: true, import: 'default' }));
const special = load(import.meta.glob('../../content/special/*.json', { eager: true, import: 'default' }));

export const pages = structure.map((s) => {
  if (content[s.slug]) return { ...s, ...content[s.slug] };
  const sp = special[s.slug];
  return { ...s, ...sp, h1: sp?.name ?? s.slug };
});
export const pageBySlug = Object.fromEntries(pages.map((p) => [p.slug, p]));
