// Turns src/data/redirects.mjs into permanent (301) redirects your host understands.
// Runs automatically before every build.
//   Netlify / Cloudflare Pages read public/_redirects
//   Vercel reads vercel.json
import { writeFileSync } from 'node:fs';
import { redirects as fixed } from '../src/data/redirects.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { structure } from '../src/data/structure.js';

// Pages hidden or deleted in the admin: send their old address to the page above them
const hiddenOrGone = structure.filter((s) => {
  const f = `content/pages/${s.slug}.json`;
  if (!existsSync(f)) return !existsSync(`content/special/${s.slug}.json`);
  try { return JSON.parse(readFileSync(f, 'utf8')).hidden === true; } catch { return false; }
});
const gone = new Set(hiddenOrGone.map((s) => s.slug));
const parentOf = (slug) => {
  const hub = structure.find((x) => x.children?.includes(slug) && !gone.has(x.slug));
  if (hub) return `/${hub.slug}/`;
  const g = structure.find((x) => x.slug === slug)?.group;
  return g === 'worldwide' ? '/worldwide-visas/' : g === 'uk' ? '/uk-visa-services/' : g === 'employer' ? '/hire-foreign-nationals-uk/' : '/';
};
const redirects = [...fixed, ...hiddenOrGone.map((s) => [`/${s.slug}/`, parentOf(s.slug)])];

const lines = redirects.flatMap(([from, to]) => [
  `${from}  ${to}  301`,
  `${from.replace(/\/$/, '')}  ${to}  301`, // also catch the old URL typed without the final slash
]);
writeFileSync('public/_redirects', lines.join('\n') + '\n');

writeFileSync('vercel.json', JSON.stringify({
  trailingSlash: true,
  redirects: redirects.map(([source, destination]) => ({ source, destination, permanent: true })),
}, null, 2) + '\n');

console.log(`Wrote ${redirects.length} redirects.`);
