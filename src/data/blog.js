// Blog posts, edited in the admin under "Blog posts" (files in content/blog).
// Newest first, counting a post's "Updated" date, so an updated news story moves back to the top.
const files = import.meta.glob('../../content/blog/*.json', { eager: true, import: 'default' });
export const posts = Object.entries(files)
  .map(([path, d]) => ({ ...d, slug: path.split('/').pop().replace('.json', ''), latest: d.updated && String(d.updated) > String(d.date) ? d.updated : d.date }))
  .filter((p) => !p.draft)
  .sort((a, b) => String(b.latest).localeCompare(String(a.latest)) || String(b.date).localeCompare(String(a.date)));
export const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
// Date line for lists: "Updated 25 November 2026" for updated posts, otherwise the publish date
export const listDate = (p) => (p.latest !== p.date ? `Updated ${fmtDate(p.latest)}` : fmtDate(p.date));
