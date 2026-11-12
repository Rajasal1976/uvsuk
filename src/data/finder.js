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
  // China: every visa type. Those without their own page open the China page with that type selected.
  if (country === 'China') {
    return [country, `/${main.slug}/`, [
      ['Business visa (M)', '/china-business-visa/'],
      ['Tourist visa (L)', '/china-tourist-visa/'],
      ['Family visit visa (Q / S)', '/china-visa-application/#vc-family'],
      ['Work visa (Z)', '/china-work-visa-for-uk-citizens/'],
      ['Student visa (X)', '/china-visa-application/#vc-study'],
      ['Transit visa (G)', '/china-visa-application/#vc-transit'],
      ['Crew visa (C)', '/china-visa-application/#vc-crew'],
      ['Journalist visa (J)', '/china-visa-application/#vc-journalist'],
    ]];
  }
  return [country, `/${main.slug}/`, types, (main.h1 || '').replace(/ from the UK.*$/i, '')];
}).sort((a, b) => a[0].localeCompare(b[0]));
const ukTypes = allPages.filter((x) => x.group === 'uk' && x.type === 'service').map((x) => [x.h1.replace(/^UK /, '').replace(/^\w/, (c) => c.toUpperCase()), `/${x.slug}/`]);
visaFinder.unshift(['UK visas', '/uk-visa-services/', ukTypes]);
