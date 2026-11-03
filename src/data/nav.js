// Menu structure, shared by the header and footer.
import { evisaContinents, evisaLink } from './evisas.js';

export const menu = [
  {
    label: 'UK Visas',
    href: '/uk-visa-services/',
    items: [
      ['Spouse & Partner Visas', '/uk-spouse-visas/'],
      ['Skilled Worker Visa', '/skilled-worker-visa-formally-tier-t2-general/'],
      ['Student Visa', '/student-visa-uk/'],
      ['Graduate Visa', '/post-study-work-visa/'],
      ['Indefinite Leave to Remain', '/indefinite-leave-to-remain-ilr/'],
      ['British Citizenship', '/british-citizenship/'],
      ['UK Visitor Visa', '/uk-visit-visa/'],
    ],
  },
  {
    label: 'Employers',
    href: '/hire-foreign-nationals-uk/',
    items: [
      ['Sponsor Licence', '/sponsor-licence-application/'],
      ['Skilled Worker Visa', '/skilled-worker-visa-formally-tier-t2-general/'],
      ['Corporate Clients', '/corporate-clients/'],
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
];
