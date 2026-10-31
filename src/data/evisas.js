// eVisa countries by continent: used by the eVisas menu and the /e-visa/ page.
// type: what the country calls it. page: our own page for that country, if there is one.
// To add a country, add a line in the right continent. To remove one, delete its line.
const c = (name, type = 'eVisa', page) => ({ name, type, page, id: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') });

export const evisaContinents = [
  { id: 'africa', name: 'Africa', countries: [
    c('Angola'), c('Benin'), c('Côte d’Ivoire'), c('Djibouti'), c('Ethiopia'), c('Gabon'), c('Guinea-Bissau'),
    c('Kenya', 'eTA'), c('Rwanda'), c('Tanzania'), c('Uganda'), c('Zambia'), c('Zimbabwe'),
  ] },
  { id: 'asia', name: 'Asia', countries: [
    c('Azerbaijan'), c('Cambodia'), c('India', 'eVisa', '/indian-visa-application-uk/'), c('Myanmar'), c('Pakistan'),
    c('Sri Lanka', 'ETA', '/sri-lanka-visa-services/'), c('Tajikistan'),
  ] },
  { id: 'middle-east', name: 'Middle East', countries: [
    c('Bahrain'), c('Kuwait'), c('Oman'), c('Saudi Arabia', 'eVisa', '/saudi-arabia-visa-uk/'), c('Turkey'),
  ] },
  { id: 'americas-oceania', name: 'Americas & Oceania', countries: [
    c('USA', 'ESTA', '/usa-visa-services/'), c('Papua New Guinea'),
  ] },
];

export const evisaLink = (k) => k.page || `/e-visa/#${k.id}`;
