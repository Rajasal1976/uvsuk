// Menu structure, shared by the header and footer.
import { evisaContinents, evisaLink } from './evisas.js';
import { isListed } from './pages.js';

const fullMenu = [
  {
    // Two columns: visas for people, and sponsor licences for businesses
    label: 'UK Visas',
    href: '/uk-visa-services/',
    columns: true,
    groups: [
      {
        label: 'For individuals',
        href: '/uk-visa-services/',
        items: [
          ['Spouse & Partner Visas', '/uk-spouse-visas/'],
          ['Skilled Worker Visa', '/skilled-worker-visa-formally-tier-t2-general/'],
          ['Skilled Worker Visa Extension', '/skilled-worker-visa-extension-uk/'],
          ['Student Visa', '/student-visa-uk/'],
          ['Graduate Visa', '/post-study-work-visa/'],
          ['UK Ancestry Visa', '/uk-ancestry-visa/'],
          ['Indefinite Leave to Remain', '/indefinite-leave-to-remain-ilr/'],
          ['British Citizenship', '/british-citizenship/'],
          ['UK Visitor Visa', '/uk-visit-visa/'],
        ],
      },
      {
        label: 'For employers',
        href: '/hire-foreign-nationals-uk/',
        items: [
          ['Sponsor Licence', '/sponsor-licence-application/'],
          ['Sponsor Licence Compliance', '/sponsor-licence-compliance/'],
          ['Sponsor Licence by Industry', '/sponsor-licence-by-industry/'],
          ['Hiring from overseas', '/hire-foreign-nationals-uk/'],
        ],
      },
    ],
  },
  {
    label: 'Worldwide Visas',
    href: '/worldwide-visas/',
    items: [
      ['Apply online', '/apply/'],
      ['India Visa & eVisa', '/indian-visa-application-uk/'],
      ['China Visa', '/china-visa-application/'],
      ['Schengen Visa', '/schengen-visa-application/'],
      ['USA Visa & ESTA', '/usa-visa-services/'],
      ['Saudi Arabia Visa', '/saudi-arabia-visa-uk/'],
      ['Ghana Visa', '/ghana-visa-services/'],
      ['Japan Visa', '/japan-visa-services/'],
      ['Russia Visa', '/russian-visa-services-from-uk/'],
      ['Sri Lanka Visa', '/sri-lanka-visa-services/'],
      ['Thailand Visa', '/thailand-visa-uk/'],
      ['Document Legalisation', '/document-legalisation/'],
      ['All countries', '/worldwide-visas/'],
    ],
  },
  {
    // Grouped by continent. The countries come from src/data/evisas.js
    label: 'eVisas',
    href: '/e-visa/',
    groups: evisaContinents.map((g) => ({
      label: g.name,
      href: `/e-visa/#${g.id}`,
      items: g.countries.map((k) => [k.name, evisaLink(k)]),
    })),
  },
  {
    label: 'About us',
    href: '/about-us/',
    items: [
      ['About us', '/about-us/'],
      ['Blog', '/blog/'],
      ['Corporate Clients', '/corporate-clients/'],
      ['Partner with us', '/partner-with-us/'],
    ],
  },
];

// Menu without links to pages hidden in the admin
const listedOnly = (items) => items.filter(([, href]) => isListed(href));
export const menu = fullMenu.map((m) => (Array.isArray(m.items)
  ? { ...m, items: listedOnly(m.items) }
  : m.columns ? { ...m, groups: m.groups.map((g) => ({ ...g, items: listedOnly(g.items) })) } : m));
