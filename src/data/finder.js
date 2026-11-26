// Visa finder data: every country with its visa types and page links. Used by the homepage
// visa search and the visa bar under each page banner. Built automatically from the pages.
import { pages as allPages } from './pages.js';
// "Check your visa requirements": choose a country, then the visa type. Built automatically from
// the pages on the site, so new country or visa-type pages appear here without any changes.
const notCountries = new Set(['UK', 'Document legalisation', 'Worldwide visas overview', 'Employers', 'Company pages']);
const shortLabel = (pg, country) => pg.purposeLabel || (pg.h1 || '').replace(/ from the UK.*$/i, '').replace(new RegExp('^' + country + '\\s+', 'i'), '').replace(/^(?!e-)\w/, (c) => c.toUpperCase());
const byCountry = {};
for (const pg of allPages) {
  if (pg.group !== 'worldwide' || !pg.country || notCountries.has(pg.country) || pg.hideFromMenus) continue;
  (byCountry[pg.country] ??= []).push(pg);
}
// A country whose main page is removed from menus is left out of the finder altogether
const offMenuCountries = new Set(allPages.filter((pg) => pg.type === 'hub' && pg.hideFromMenus).map((pg) => pg.country));
export const visaFinder = Object.entries(byCountry).filter(([country]) => !offMenuCountries.has(country)).map(([country, list]) => {
  const hub = list.find((x) => x.type === 'hub');
  const main = hub || list[0];
  // Use the order set on the country's main page, then any other pages for that country
  const ordered = hub ? [...(hub.children || []).map((c) => list.find((x) => x.slug === c)).filter(Boolean), ...list.filter((x) => x !== hub && !(hub.children || []).includes(x.slug))] : list.filter((x) => x !== main);
  const types = ordered.map((x) => [shortLabel(x, country), `/${x.slug}/`]);
  // China: every visa type, each with its own page.
  if (country === 'China') {
    return [country, `/${main.slug}/`, [
      ['Business visa (M)', '/china-business-visa/'],
      ['Tourist visa (L)', '/china-tourist-visa/'],
      ['Family visit visa (Q1 / Q2)', '/china-family-visit/'],
      ['Visiting family working in China (S1 / S2)', '/china-s-visa/'],
      ['Work visa (Z)', '/china-work-visa-for-uk-citizens/'],
      ['Student visa (X1 / X2)', '/china-student-visa/'],
      ['Transit visa (G)', '/china-transit-visa/'],
      ['Crew visa (C)', '/china-crew-visa/'],
      ['Journalist visa (J1 / J2)', '/china-journalist-visa/'],
      ['Exchange visit visa (F)', '/china-non-business-f-visa/'],
    ]];
  }
  return [country, `/${main.slug}/`, types, (main.h1 || '').replace(/ from the UK.*$/i, '')];
}).sort((a, b) => a[0].localeCompare(b[0]));
const ukTypes = allPages.filter((x) => x.group === 'uk' && x.type === 'service').map((x) => [x.h1.replace(/^UK /, '').replace(/^\w/, (c) => c.toUpperCase()), `/${x.slug}/`]);
visaFinder.unshift(['UK visas', '/uk-visa-services/', ukTypes]);
