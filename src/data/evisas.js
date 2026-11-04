import { isShown, isListed } from './pages.js';
// eVisa countries by continent: used by the eVisas menu and the /e-visa/ page.
// type: what the country calls it. page: our own page for that country, if there is one.
// To add a country, add a line in the right continent. To remove one, delete its line.
const c = (name, type = 'eVisa', page) => ({ name, type, page, id: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') });

const allContinents = [
  { id: 'africa', name: 'Africa', countries: [
    c('Angola', 'eVisa', '/angola-visa-uk/'), c('Benin', 'eVisa', '/benin-visa-uk/'), c('Côte d’Ivoire', 'eVisa', '/ivory-coast-visa-uk/'), c('Djibouti', 'eVisa', '/djibouti-visa-uk/'), c('Ethiopia', 'eVisa', '/ethiopia-visa-uk/'), c('Gabon', 'eVisa', '/gabon-visa-uk/'), c('Guinea-Bissau', 'eVisa', '/guinea-bissau-visa-uk/'),
    c('Kenya', 'eTA', '/kenya-eta-uk/'), c('Nigeria', 'eVisa', '/nigeria-visa-uk/'), c('Rwanda', 'eVisa', '/rwanda-visa-uk/'), c('Tanzania', 'eVisa', '/tanzania-visa-uk/'), c('Uganda', 'eVisa', '/uganda-visa-uk/'), c('Zambia', 'eVisa', '/zambia-visa-uk/'), c('Zimbabwe', 'eVisa', '/zimbabwe-visa-uk/'),
  ] },
  { id: 'asia', name: 'Asia', countries: [
    c('Azerbaijan', 'eVisa', '/azerbaijan-visa-uk/'), c('Cambodia', 'eVisa', '/cambodia-visa-uk/'), c('India', 'eVisa', '/indian-visa-application-uk/'), c('Myanmar', 'eVisa', '/myanmar-visa-uk/'), c('Pakistan', 'eVisa', '/pakistan-visa-uk/'),
    c('Sri Lanka', 'ETA', '/sri-lanka-visa-services/'), c('Tajikistan', 'eVisa', '/tajikistan-visa-uk/'), c('Thailand', 'eVisa', '/thailand-visa-uk/'),
  ] },
  { id: 'middle-east', name: 'Middle East', countries: [
    c('Bahrain', 'eVisa', '/bahrain-visa-uk/'), c('Kuwait', 'eVisa', '/kuwait-visa-uk/'), c('Oman', 'eVisa', '/oman-visa-uk/'), c('Saudi Arabia', 'eVisa', '/saudi-arabia-visa-uk/'), c('Turkey', 'eVisa', '/turkey-visa-uk/'),
  ] },
  { id: 'americas-oceania', name: 'Americas & Oceania', countries: [
    c('Australia', 'eVisitor / ETA', '/australia-eta-evisitor-uk/'), c('Canada', 'eTA', '/canada-eta-uk/'), c('New Zealand', 'NZeTA', '/new-zealand-nzeta-uk/'), c('USA', 'ESTA', '/usa-visa-services/'), c('Papua New Guinea', 'eVisa', '/papua-new-guinea-visa-uk/'),
  ] },
];

// Links to the country's page, or to the eVisa page if that page has been hidden in the admin
export const evisaLink = (k) => (k.page && isShown(k.page) ? k.page : `/e-visa/#${k.id}`);

// Countries whose page is in the bin, deleted, or set to "Remove from menus and drop-downs"
// are left out of the eVisa menu, the eVisa page list and the eVisa form.
export const evisaContinents = allContinents
  .map((k) => ({ ...k, countries: k.countries.filter((x) => !x.page || isListed(x.page)) }))
  .filter((k) => k.countries.length > 0);
