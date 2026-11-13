// Structured data (schema.org) that helps Google understand the business and each service page.
// Built automatically from the business details and each page's content: nothing to edit here day to day.
import { site } from '../data/site.js';
import settings from '../../content/settings.json';
import { pageBySlug } from '../data/pages.js';
import { visaFinder } from '../data/finder.js';

const abs = (path) => new URL(path, site.url).href;
// Google Maps listing for the Manchester office (from the business's Google listing)
export const mapsUrl = 'https://maps.google.com/?cid=4573925117991144242';
export const BUSINESS_ID = `${site.url}/#business`;

export function businessSchema() {
  const sameAs = [settings.facebook, settings.instagram, settings.linkedin, settings.x, settings.youtube, settings.tiktok, settings.trustpilotUrl, mapsUrl]
    .filter((u) => u && String(u).trim());
  const phones = [{ '@type': 'ContactPoint', telephone: site.phoneIntl, contactType: 'customer service', areaServed: 'GB', availableLanguage: ['English'] }];
  if (site.phone2Intl) phones.push({ '@type': 'ContactPoint', telephone: site.phone2Intl, contactType: 'customer service', areaServed: 'GB' });
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': BUSINESS_ID,
    name: site.legalName,
    alternateName: site.name,
    url: site.url,
    logo: abs(settings.siteLogo || '/favicon.svg'),
    image: abs(site.shareImage || settings.siteLogo || '/favicon.svg'),
    description: 'IAA-regulated immigration advisers in Manchester: UK visas, settlement, citizenship, sponsor licences, worldwide travel visas and document legalisation.',
    telephone: site.phoneIntl,
    email: site.email,
    foundingDate: String(site.since),
    priceRange: '££',
    address: { '@type': 'PostalAddress', streetAddress: site.address.line1, addressLocality: site.address.city, addressRegion: 'Greater Manchester', postalCode: site.address.postcode, addressCountry: 'GB' },
    hasMap: mapsUrl,
    openingHours: site.hoursSchema,
    contactPoint: phones,
    areaServed: [{ '@type': 'City', name: 'Manchester' }, { '@type': 'AdministrativeArea', name: 'Greater Manchester' }, { '@type': 'Country', name: 'United Kingdom' }],
    hasCredential: { '@type': 'EducationalOccupationalCredential', credentialCategory: `Immigration Advice Authority registration (${site.iaaLevel}), ref ${site.iaaRef}`, recognizedBy: { '@type': 'Organization', name: 'Immigration Advice Authority', url: 'https://www.gov.uk/government/organisations/immigration-advice-authority' } },
    sameAs,
  };
}

const hubFor = { uk: ['UK Visas', '/uk-visa-services/'], employer: ['Employers', '/hire-foreign-nationals-uk/'], worldwide: ['Worldwide Visas', '/worldwide-visas/'] };
const amount = (v) => { const m = String(v || '').replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/); return m ? Number(m[1]) : null; };

// Breadcrumb trail (Home › Worldwide Visas › China › China business visa) and Service details for a page
export function pageSchemas(slug, content = null) {
  // Pages with their own design file (e.g. China business visa) aren't in the site structure,
  // so they fall back to their content file.
  const p = pageBySlug[slug] || (content && content.h1 && slug
    ? { ...content, slug, type: 'service', group: content.country && content.country !== 'UK' ? 'worldwide' : 'uk' }
    : null);
  if (!p) return [];
  const out = [];
  const crumbs = [['Home', '/']];
  const hub = hubFor[p.group];
  if (hub && hub[1] !== `/${slug}/`) crumbs.push(hub);
  if (p.group === 'worldwide') {
    const row = visaFinder.find((r) => r[0] === p.country);
    if (row && row[1] !== `/${slug}/` && row[1] !== hub?.[1]) crumbs.push([p.country, row[1]]);
  }
  crumbs.push([p.h1 || p.title, `/${slug}/`]);
  out.push({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(url) })),
  });
  if (['uk', 'employer', 'worldwide'].includes(p.group) && (p.type === 'service' || p.type === 'hub')) {
    const service = {
      '@context': 'https://schema.org', '@type': 'Service',
      name: p.h1 || p.title,
      serviceType: p.focusKeyword || p.purposeLabel || p.h1,
      description: p.description,
      url: abs(`/${slug}/`),
      provider: { '@id': BUSINESS_ID },
      areaServed: p.group === 'worldwide' ? { '@type': 'Country', name: 'United Kingdom' } : [{ '@type': 'City', name: 'Manchester' }, { '@type': 'Country', name: 'United Kingdom' }],
    };
    const totals = (p.prices || [])
      .map((r) => (amount(r.fee) !== null && amount(r.processingFee) !== null ? amount(r.fee) + amount(r.processingFee) : null))
      .filter((n) => n !== null && n > 0);
    if (totals.length) {
      service.offers = { '@type': 'AggregateOffer', priceCurrency: 'GBP', lowPrice: Math.min(...totals).toFixed(2), highPrice: Math.max(...totals).toFixed(2), offerCount: totals.length, url: abs(`/${slug}/`) };
    }
    out.push(service);
  }
  return out;
}
