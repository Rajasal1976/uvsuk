# Unique Visa Services website (Astro)

Converted from the Next.js build. Same pages, same URLs, same content and design,
plus the ILR absence calculator, the Skilled Worker salary checker, the China visa
chooser and the China business visa page.

## Run it on your computer
1. Install Node.js (LTS) from https://nodejs.org
2. In this folder run `npm install`, then `npm run dev`
3. Open http://localhost:4321

## Editing the website (no code)
Go to **https://www.uvsuk.co.uk/admin** (or uvsuk.netlify.app/admin) and log in with GitHub.
- **Visa & service pages**: headings, introductions, "Do you qualify?" points, documents lists, FAQs, Google title and description.
- **Pages with calculators**: FAQs and Google details for the ILR, Skilled Worker, China and China business pages.
- **Homepage**: main heading, photos, reviews, FAQs.
- **Business details**: phone, email, address, hours, review numbers. These update everywhere on the site.
Click **Publish**. The site rebuilds itself and the change is live in about a minute.

The text lives in the `content/` folder as simple files; the editor's settings are in `public/admin/config.yml`.

## Where things are in the code (for a developer)
| What | File |
| --- | --- |
| Which pages exist, their menu group and links between them | `src/data/structure.js` |
| Menu and dropdowns | `src/data/nav.js` |
| Old URLs redirected to new pages | `src/data/redirects.mjs` |
| Page template for all visa, hub and company pages | `src/pages/[slug].astro` |
| Homepage layout | `src/pages/index.astro` |
| ILR page (absence calculator) | `src/pages/indefinite-leave-to-remain-ilr.astro` |
| Skilled Worker page (salary checker) | `src/pages/skilled-worker-visa-formally-tier-t2-general.astro` |
| China visa page (visa chooser) and China business visa page | `src/pages/china-visa-application.astro`, `src/pages/china-business-visa.astro` |
| Contact page and enquiry form | `src/pages/contact-us.astro` |
| Online application forms: questions and documents | `src/data/applications.js` |
| How the application forms work | `src/lib/apply-form.js`, `src/lib/passport-ocr.js` |
| Calculator rules | `src/components/SalaryChecker.astro`, `src/components/AbsenceCalculator.astro` |
| Colours and styling | `src/styles/site.css`, `src/styles/apply.css` |

## Online application forms
- Pages: `/apply/` (list), `/apply/china-visa/`, `/apply/india-visa/`, `/apply/sri-lanka-eta/`.
- The client uploads a photo of their passport photo page and the form fills in their name, date of birth, sex,
  nationality, passport number and expiry by reading the two coded lines at the bottom of the page.
  This happens on the client's own device (the reader is in `/public/ocr`); nothing is sent until they press Send.
- Submissions arrive in Netlify under Forms, with the documents attached, and by email if you set up
  Form notifications. Each one has a reference like UVS-CN-AB12CD.
- To add a country, copy one of the forms in `src/data/applications.js` and add it to `applications`.
- The questions follow the official forms. Check them against the current official forms from time to time.
- Passport scans are sensitive personal data: download what you need, then delete submissions from Netlify
  regularly, and make sure your privacy policy covers online applications.

## Putting it live (Netlify, free to start)
1. Put this folder in a GitHub repository.
2. At netlify.com, choose "Add new site" › "Import an existing project" and pick the repository.
   Build command: `npm run build`. Publish directory: `dist`.
3. Test the site on the temporary address Netlify gives you.
4. In Netlify, go to Domain settings, add `www.uvsuk.co.uk`, and set the DNS records it shows at your domain registrar.
5. Submit `https://www.uvsuk.co.uk/sitemap-index.xml` in Google Search Console.

Redirects are real permanent (301) redirects. They're written automatically on every build
into `public/_redirects` (Netlify, Cloudflare Pages) and `vercel.json` (Vercel), so any of those hosts works.
