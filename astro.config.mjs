import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';

// Pages switched to "hide this page from Google" in the editor are left out of the sitemap.
const hidden = readdirSync('./content/pages')
  .filter((f) => f.endsWith('.json'))
  .filter((f) => { try { return JSON.parse(readFileSync(`./content/pages/${f}`, 'utf8')).noindex === true; } catch { return false; } })
  .map((f) => `/${f.replace(/\.json$/, '')}/`);

export default defineConfig({
  site: 'https://www.uvsuk.co.uk',
  trailingSlash: 'always', // the old site's URLs all end in "/", so keep them exactly the same
  integrations: [
    sitemap({ filter: (url) => !hidden.some((h) => url.endsWith(h)) && !url.includes('/search/') && !url.includes('/thank-you/') && !url.includes('/forms-register/') }),
  ],
});
