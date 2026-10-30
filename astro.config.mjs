import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.uvsuk.co.uk',
  trailingSlash: 'always', // the old site's URLs all end in "/", so keep them exactly the same
  integrations: [
    sitemap({ filter: (url) => !url.includes('/search/') && !url.includes('/thank-you/') && !url.includes('/forms-register/') }),
  ],
});
