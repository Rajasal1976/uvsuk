// Blog posts, edited in the admin under "Blog posts" (files in content/blog). Newest first.
const files = import.meta.glob('../../content/blog/*.json', { eager: true, import: 'default' });
export const posts = Object.entries(files)
  .map(([path, d]) => ({ ...d, slug: path.split('/').pop().replace('.json', '') }))
  .filter((p) => !p.draft)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));
export const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
