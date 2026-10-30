// Turns src/data/redirects.mjs into permanent (301) redirects your host understands.
// Runs automatically before every build.
//   Netlify / Cloudflare Pages read public/_redirects
//   Vercel reads vercel.json
import { writeFileSync } from 'node:fs';
import { redirects } from '../src/data/redirects.mjs';

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
