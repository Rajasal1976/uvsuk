// Combines the site structure (src/data/structure.js) with the page text from content/pages,
// which is what you edit in the admin at /admin.
// Pages switched to "Hide this page" in the admin, or deleted there, are left out everywhere:
// menus, page cards, the visa finder, search and the sitemap. Their old addresses redirect
// to the page above them (see scripts/make-redirects.mjs).
import { structure } from './structure.js';

const load = (files) => Object.fromEntries(Object.entries(files).map(([path, data]) => [path.split('/').pop().replace('.json', ''), data]));
const content = load(import.meta.glob('../../content/pages/*.json', { eager: true, import: 'default' }));
const special = load(import.meta.glob('../../content/special/*.json', { eager: true, import: 'default' }));

const all = structure
  .filter((s) => content[s.slug] || special[s.slug])
  .map((s) => {
    if (content[s.slug]) return { ...s, ...content[s.slug] };
    const sp = special[s.slug];
    return { ...s, ...sp, h1: sp?.name ?? s.slug };
  });
const visible = new Set(all.filter((p) => p.hidden !== true).map((p) => p.slug));

export const pages = all
  .filter((p) => visible.has(p.slug))
  .map((p) => ({
    ...p,
    ...(p.children ? { children: p.children.filter((c) => visible.has(c)) } : {}),
    ...(p.related ? { related: p.related.filter((r) => visible.has(r)) } : {}),
  }));
export const pageBySlug = Object.fromEntries(pages.map((p) => [p.slug, p]));
// true if a site address like "/kenya-eta-uk/" is a page that is currently shown
const structural = new Set(structure.map((s) => s.slug));
export const isShown = (href) => {
  const slug = (href || '').replace(/^\/|\/$/g, '').split(/[?#]/)[0];
  return !structural.has(slug) || visible.has(slug);
};
