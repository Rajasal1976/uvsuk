import { evisaContinents } from './evisas.js';
// Online application forms. Each form is a list of steps; each step a list of questions.
// The questions follow what the official application asks, so we can transfer the answers.
// CHECK these against the current official forms from time to time, as embassies change them.
//
// Question types: text, email, tel, date, number, textarea, select, radio, yesno, country, repeat
//   required: true      -> must be answered
//   showIf: { name: 'x', is: 'Yes' }  (or is: ['A','B']) -> only shown when another answer matches
//   autofill: 'surname' -> filled in from the passport scan
//   half: true          -> sits beside the next question on wide screens
//   repeat: a list of rows (e.g. children) with `fields`, `addLabel`, `max`
// Uploads: { name, label, hint, required, showIf } — `name` must be one of the file slots in
// src/pages/forms-register.astro (passport, photo, doc1 ... doc8).

const yesNo = (name, label, extra = {}) => ({ name, label, type: 'yesno', required: true, ...extra });
const details = (name, onField, label = 'Please give details') => ({ name, label, type: 'textarea', required: true, showIf: { name: onField, is: 'Yes' } });

// One upload slot that asks for a different document depending on the visa chosen.
// map: { 'Visa option': { label, hint, required } }
const byVisa = (name, map) => Object.entries(map).map(([visa, u]) => ({ name, ...u, showIf: { name: 'visaType', is: visa } }));

// ---------- Shared steps ----------

const passportFields = [
  { name: 'surname', label: 'Surname (family name)', type: 'text', required: true, autofill: 'surname', half: true },
  { name: 'givenNames', label: 'Given names', type: 'text', required: true, autofill: 'givenNames', half: true, hint: 'Exactly as in your passport, including middle names.' },
  { name: 'sex', label: 'Sex', type: 'radio', options: ['Male', 'Female'], required: true, autofill: 'sex' },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true, autofill: 'dateOfBirth', half: true },
  { name: 'placeOfBirth', label: 'Town or city of birth', type: 'text', required: true, half: true },
  { name: 'countryOfBirth', label: 'Country of birth', type: 'country', required: true, half: true },
  { name: 'nationality', label: 'Current nationality', type: 'country', required: true, autofill: 'nationality', half: true },
  { name: 'passportNumber', label: 'Passport number', type: 'text', required: true, autofill: 'passportNumber', half: true },
  { name: 'passportIssuingCountry', label: 'Country that issued your passport', type: 'country', required: true, autofill: 'issuingCountry', half: true },
  { name: 'passportIssueDate', label: 'Passport date of issue', type: 'date', required: true, half: true },
  { name: 'passportExpiry', label: 'Passport expiry date', type: 'date', required: true, autofill: 'passportExpiry', half: true },
  { name: 'passportPlaceOfIssue', label: 'Place of issue', type: 'text', required: true, hint: 'As shown in your passport, for example "HMPO" for UK passports.' },
];

// Only the details read automatically from the passport scan. We take the rest
// (place of birth, issue date, place of issue) from the uploaded passport ourselves.
const passportScanFields = passportFields.filter((f) => f.autofill);

const passportStep = (extra = [], base = passportFields) => ({
  id: 'passport',
  title: 'Your passport',
  intro: 'Upload a photo of your passport photo page and we’ll fill in your details for you. Your passport is read on your own device.',
  passportScan: true,
  fields: [...base, ...extra],
});

const contactStep = (extra = []) => ({
  id: 'contact',
  title: 'Contact details',
  fields: [
    { name: 'email', label: 'Email address', type: 'email', required: true, half: true },
    { name: 'phone', label: 'Mobile number', type: 'tel', required: true, half: true },
    { name: 'addressLine1', label: 'Home address', type: 'text', required: true },
    { name: 'addressLine2', label: 'Address line 2 (optional)', type: 'text' },
    { name: 'city', label: 'Town or city', type: 'text', required: true, half: true },
    { name: 'postcode', label: 'Postcode', type: 'text', required: true, half: true },
    { name: 'country', label: 'Country you live in', type: 'country', required: true, default: 'United Kingdom' },
    { name: 'ukStatus', label: 'Your status in the UK', type: 'select', required: true, options: ['British citizen', 'Indefinite leave to remain / settled', 'EU Settlement Scheme', 'Skilled Worker or other work visa', 'Student visa', 'Spouse or family visa', 'Other'], showIf: { name: 'nationality', isNot: 'United Kingdom' } },
    { name: 'ukStatusExpiry', label: 'When does your UK permission expire?', type: 'date', showIf: { name: 'ukStatus', is: ['Skilled Worker or other work visa', 'Student visa', 'Spouse or family visa', 'Other'] } },
    ...extra,
  ],
});

const declarationNote = 'I confirm the information I’ve given is true and complete. I understand Unique Visa Services will use it to prepare my application, and that false information can lead to a refusal.';

// ---------- China ----------
// Kept short on purpose: trip dates, inviter details and passport details are taken
// from the uploaded documents by our team.

const married = { name: 'maritalStatus', is: 'Married' };

const china = {
  slug: 'china-visa',
  title: 'China visa application',
  country: 'China',
  code: 'CN',
  pageUrl: '/china-visa-application/',
  description: 'Apply for your China visa online. Upload your passport and documents, answer a few questions, and we’ll do the rest.',
  minutes: 8,
  notice: 'British passport holders can currently visit China visa-free for short trips. If you’re not sure you need a visa, call us before you apply.',
  steps: [
    passportStep([], passportScanFields),
    contactStep(),
    {
      id: 'family',
      title: 'Family',
      fields: [
        { name: 'parentRelation', label: 'Which parent will you give us details for?', type: 'radio', required: true, options: ['Mother', 'Father'] },
        { name: 'parentName', label: 'Their full name', type: 'text', required: true, half: true },
        { name: 'parentDob', label: 'Their date of birth', type: 'date', required: true, half: true },
        { name: 'maritalStatus', label: 'Your marital status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed', 'Other'] },
        { name: 'spouseName', label: 'Husband or wife’s full name', type: 'text', required: true, showIf: married },
        { name: 'spouseNationality', label: 'Their nationality', type: 'country', required: true, half: true, showIf: married },
        { name: 'spouseDob', label: 'Their date of birth', type: 'date', required: true, half: true, showIf: married },
        { name: 'spouseBirthPlace', label: 'Their place of birth', type: 'text', required: true, hint: 'Town or city, and country.', showIf: married },
      ],
    },
    {
      id: 'history',
      title: 'Your trip and travel history',
      fields: [
        { name: 'visaType', label: 'What is the main purpose of your trip?', type: 'select', required: true, hint: 'This tells us which documents to ask you for.', options: ['Business (M visa)', 'Tourism (L visa)', 'Visiting family in China (Q2 / Q1 visa)', 'Visiting a foreigner living in China (S visa)', 'Work (Z visa)', 'Study (X visa)', 'Transit (G visa)', 'Crew (C visa)', 'Journalism (J visa)'] },
        yesNo('beenToChina', 'Have you been to China before?', { hint: 'If your last Chinese visa is in your current passport, you’ll be asked for a photo of it in the Documents step.' }),
        { name: 'countriesLastYear', label: 'Which countries have you visited in the last 12 months?', type: 'textarea', required: true, hint: 'List each country and roughly when. Write “None” if you haven’t travelled.' },
      ],
    },
    {
      id: 'declarations',
      title: 'A few more questions',
      intro: 'The Chinese visa form asks every applicant these questions. Most people answer No to all of them.',
      fields: [
        yesNo('criminalRecord', 'Do you have a criminal record in China or any other country?'),
        details('criminalRecordDetails', 'criminalRecord'),
        yesNo('chinaRefused', 'Have you ever been refused a Chinese visa, or refused entry to China?'),
        details('chinaRefusedDetails', 'chinaRefused'),
        yesNo('visaCancelled', 'Has a Chinese visa of yours ever been cancelled?'),
        details('visaCancelledDetails', 'visaCancelled'),
        yesNo('illegalStay', 'Have you ever entered or stayed in China illegally, or overstayed?'),
        details('illegalStayDetails', 'illegalStay'),
        yesNo('otherVisasRefused', 'Have you been refused a visa or entry to any other country in the last 10 years?'),
        details('otherVisasRefusedDetails', 'otherVisasRefused'),
        yesNo('diseases', 'Do you have any serious mental disorder or infectious disease (for example infectious tuberculosis)?'),
        details('diseasesDetails', 'diseases'),
        yesNo('epidemicVisit', 'Have you visited a country or area with an epidemic outbreak in the last 30 days?'),
        details('epidemicVisitDetails', 'epidemicVisit'),
        yesNo('specialSkills', 'Do you have specialised skills or training in firearms, explosives, nuclear, biological or chemical matters?'),
        details('specialSkillsDetails', 'specialSkills'),
        yesNo('militaryService', 'Are you serving, or have you served, in the military?'),
        details('militaryServiceDetails', 'militaryService', 'Country, branch, rank and dates'),
        yesNo('paramilitary', 'Have you ever served in or been part of a paramilitary, militia or armed organisation?'),
        details('paramilitaryDetails', 'paramilitary'),
      ],
    },
  ],
  // What each visa needs. Shown at the top of the Documents step.
  docsIntro: {
    'Business (M visa)': 'For a business visa you’ll need an invitation letter from the Chinese company or trade fair, plus your travel bookings if you have them.',
    'Tourism (L visa)': 'For a tourist visa you’ll need your return flights and hotel bookings for the whole trip.',
    'Visiting family in China (Q2 / Q1 visa)': 'For a family visit you’ll need an invitation letter from your relative, a copy of their ID and proof of how you’re related.',
    'Visiting a foreigner living in China (S visa)': 'You’ll need an invitation letter from the person you’re visiting, a copy of their passport and residence permit, and proof of how you’re related.',
    'Work (Z visa)': 'For a work visa you’ll need the Work Permit Notification issued by the Chinese authorities.',
    'Study (X visa)': 'For a student visa you’ll need your JW201 or JW202 form and your admission letter.',
    'Transit (G visa)': 'For a transit visa you’ll need your onward ticket to a third country, and a visa for that country if it requires one.',
    'Crew (C visa)': 'For a crew visa you’ll need a letter from your employer.',
    'Journalism (J visa)': 'For a journalist visa you’ll need the visa notification letter and a letter from your media organisation.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', hint: 'Recent colour photo on a white background, no glasses, face fully visible.', required: true },
    { name: 'doc1', label: 'Your UK visa, BRP or eVisa share code page', hint: 'Because you’re not a British citizen.', required: true, showIf: { name: 'nationality', isNot: 'United Kingdom' } },
    ...byVisa('doc2', {
      'Business (M visa)': { label: 'Invitation letter from the Chinese company or trade fair', hint: 'On their letterhead, with your trip dates and their contact details.', required: true },
      'Visiting family in China (Q2 / Q1 visa)': { label: 'Invitation letter from your family member in China', hint: 'Signed by them, with your trip dates and their address.', required: true },
      'Visiting a foreigner living in China (S visa)': { label: 'Invitation letter from the person you’re visiting', hint: 'Signed by them, with your trip dates and their address.', required: true },
      'Work (Z visa)': { label: 'Work Permit Notification', hint: 'Issued by the Chinese authorities through your employer.', required: true },
      'Study (X visa)': { label: 'JW201 or JW202 form', hint: 'Visa application form for study in China, from your school.', required: true },
      'Crew (C visa)': { label: 'Letter from your employer', hint: 'Confirming your role and the journey.', required: true },
      'Journalism (J visa)': { label: 'Journalist visa notification letter', hint: 'Issued by the Chinese foreign affairs office.', required: true },
    }),
    ...byVisa('doc3', {
      'Business (M visa)': { label: 'Flight booking (optional)', hint: 'A reservation is fine; you don’t need to have paid yet.' },
      'Tourism (L visa)': { label: 'Return flight booking', hint: 'A reservation is fine; you don’t need to have paid yet.', required: true },
      'Visiting family in China (Q2 / Q1 visa)': { label: 'Flight booking (optional)' },
      'Visiting a foreigner living in China (S visa)': { label: 'Flight booking (optional)' },
      'Work (Z visa)': { label: 'Flight booking (optional)' },
      'Study (X visa)': { label: 'Flight booking (optional)' },
      'Transit (G visa)': { label: 'Onward flight ticket to a third country', hint: 'Showing you’re leaving China for another country.', required: true },
      'Crew (C visa)': { label: 'Flight or voyage details (optional)' },
      'Journalism (J visa)': { label: 'Flight booking (optional)' },
    }),
    ...byVisa('doc4', {
      'Business (M visa)': { label: 'Hotel booking (optional)' },
      'Tourism (L visa)': { label: 'Hotel bookings for your whole stay', hint: 'One document or several pages combined into a PDF.', required: true },
      'Transit (G visa)': { label: 'Hotel booking, if you’re staying overnight (optional)' },
    }),
    ...byVisa('doc5', {
      'Visiting family in China (Q2 / Q1 visa)': { label: 'Proof of relationship', hint: 'For example a birth certificate or marriage certificate.', required: true },
      'Visiting a foreigner living in China (S visa)': { label: 'Proof of relationship', hint: 'For example a birth certificate or marriage certificate.', required: true },
      'Work (Z visa)': { label: 'Invitation letter from your employer in China (if you have one)' },
      'Study (X visa)': { label: 'Admission letter from your school or university', required: true },
      'Journalism (J visa)': { label: 'Letter from your media organisation', required: true },
    }),
    { name: 'doc6', label: 'Your last Chinese visa (optional)', hint: 'If it’s in your current passport, please add a photo of that page. If it’s in an old passport you no longer have, you can leave this.', showIf: { name: 'beenToChina', is: 'Yes' } },
    ...byVisa('doc7', {
      'Visiting family in China (Q2 / Q1 visa)': { label: 'Copy of your relative’s Chinese ID card', hint: 'Or their passport and Chinese residence permit if they’re not Chinese.', required: true },
      'Visiting a foreigner living in China (S visa)': { label: 'Copy of their passport and Chinese residence permit', required: true },
      'Transit (G visa)': { label: 'Visa for your onward destination (if it needs one)' },
    }),
    { name: 'doc8', label: 'Any other supporting document (optional)' },
  ],
};

// ---------- India ----------

const indiaAirports = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad', 'Ahmedabad', 'Amritsar', 'Goa (Dabolim)', 'Goa (Mopa)', 'Kochi', 'Thiruvananthapuram', 'Kozhikode (Calicut)', 'Jaipur', 'Lucknow', 'Pune', 'Chandigarh', 'Varanasi', 'Gaya', 'Bagdogra', 'Guwahati', 'Mangaluru', 'Madurai', 'Tiruchirappalli', 'Coimbatore', 'Nagpur', 'Port Blair', 'Bhubaneswar', 'Indore', 'Kannur', 'Vishakhapatnam', 'Seaport / other'];
const indiaWorking = ['Employed (private sector)', 'Employed (government)', 'Self-employed / business'];

const india = {
  slug: 'india-visa',
  title: 'India eVisa application',
  country: 'India',
  code: 'IN',
  pageUrl: '/indian-visa-application-uk/',
  description: 'Apply for your Indian eVisa online. Upload your passport and we’ll fill in your details, then answer a few questions about your trip.',
  minutes: 12,
  steps: [
    {
      id: 'eligibility',
      title: 'Before you start',
      fields: [
        yesNo('pakistanOrigin', 'Were you, or any of your parents or grandparents, born in Pakistan or ever a Pakistani national?'),
        { name: 'pakistanStop', type: 'stop', label: 'You can’t apply for an Indian eVisa', showIf: { name: 'pakistanOrigin', is: 'Yes' }, text: [
          'Indian rules don’t allow an eVisa for anyone whose parents or grandparents were born in, lived permanently in, or were nationals of Pakistan. This applies even if you hold a British passport.',
          'You’ll need to apply for a regular (paper) visa instead.',
        ] },
      ],
    },
    passportStep([
      { name: 'nationalityBy', label: 'Did you get your nationality by birth or naturalisation?', type: 'radio', required: true, options: ['By birth', 'By naturalisation'] },
      { name: 'previousNationality', label: 'Previous nationality', type: 'country', required: true, showIf: { name: 'nationalityBy', is: 'By naturalisation' } },
      { name: 'religion', label: 'Religion', type: 'select', required: true, options: ['Bahai', 'Buddhism', 'Christian', 'Hindu', 'Islam', 'Jainism', 'Judaism', 'Parsi', 'Sikh', 'Zoroastrian', 'Other', 'None'], hint: 'The Indian eVisa form asks every applicant this.' },
    ], passportScanFields),
    contactStep(),
    {
      id: 'family',
      title: 'Family',
      fields: [
        { name: 'fatherName', label: 'Father’s full name', type: 'text', required: true },
        { name: 'fatherNationality', label: 'Father’s nationality', type: 'country', required: true, half: true },
        { name: 'fatherBirthPlace', label: 'Father’s place of birth', type: 'text', required: true, half: true, hint: 'Town or city, and country.' },
        { name: 'motherName', label: 'Mother’s full name', type: 'text', required: true },
        { name: 'motherNationality', label: 'Mother’s nationality', type: 'country', required: true, half: true },
        { name: 'motherBirthPlace', label: 'Mother’s place of birth', type: 'text', required: true, half: true, hint: 'Town or city, and country.' },
        { name: 'maritalStatus', label: 'Your marital status', type: 'radio', required: true, options: ['Single', 'Married'] },
        { name: 'spouseName', label: 'Husband or wife’s full name', type: 'text', required: true, showIf: married },
        { name: 'spouseNationality', label: 'Their nationality', type: 'country', required: true, half: true, showIf: married },
        { name: 'spouseBirthPlace', label: 'Their place of birth', type: 'text', required: true, half: true, hint: 'Town or city, and country.', showIf: married },
      ],
    },
    {
      id: 'work',
      title: 'Your work',
      fields: [
        { name: 'occupation', label: 'Present occupation', type: 'select', required: true, options: [...indiaWorking, 'Student', 'Housewife / homemaker', 'Retired', 'Not working', 'Other'] },
        { name: 'employer', label: 'Employer or business name', type: 'text', required: true, half: true, showIf: { name: 'occupation', is: indiaWorking } },
        { name: 'designation', label: 'Your job title', type: 'text', required: true, half: true, showIf: { name: 'occupation', is: indiaWorking } },
        { name: 'employerAddress', label: 'Employer address', type: 'textarea', required: true, showIf: { name: 'occupation', is: indiaWorking } },
        { name: 'spouseOrParentOccupation', label: 'Occupation of your spouse or parent', type: 'text', required: true, showIf: { name: 'occupation', is: ['Student', 'Housewife / homemaker', 'Not working'] }, hint: 'The Indian form asks for this when you aren’t working.' },
        { name: 'occupationOther', label: 'Please describe', type: 'text', required: true, showIf: { name: 'occupation', is: 'Other' } },
      ],
    },
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'visaType', label: 'Which eVisa do you need?', type: 'select', required: true, options: ['e-Tourist visa (30 days)', 'e-Tourist visa (1 year)', 'e-Tourist visa (5 years)', 'e-Business visa', 'e-Medical visa', 'e-Medical Attendant visa', 'e-Conference visa', 'e-Student visa', 'e-Student Dependent visa', 'e-Transit visa'] },
        { name: 'arrivalDate', label: 'Date you’ll travel to India', type: 'date', required: true },
        { name: 'portArrival', label: 'Airport you’ll arrive at', type: 'select', required: true, options: indiaAirports, half: true },
        { name: 'portExit', label: 'Airport you’ll leave from', type: 'select', required: true, options: indiaAirports, half: true },
        { name: 'businessCompany', label: 'Name of the Indian company or organisation', type: 'text', required: true, showIf: { name: 'visaType', is: ['e-Business visa', 'e-Conference visa'] } },
        { name: 'businessAddress', label: 'Their address in India', type: 'textarea', required: true, showIf: { name: 'visaType', is: ['e-Business visa', 'e-Conference visa'] } },
        { name: 'businessPhone', label: 'Their phone number', type: 'tel', required: true, half: true, showIf: { name: 'visaType', is: ['e-Business visa', 'e-Conference visa'] } },
        { name: 'hospital', label: 'Name and address of the hospital in India', type: 'textarea', required: true, showIf: { name: 'visaType', is: ['e-Medical visa', 'e-Medical Attendant visa'] } },
        { name: 'patientName', label: 'Name of the patient you’re accompanying', type: 'text', required: true, showIf: { name: 'visaType', is: 'e-Medical Attendant visa' } },
        yesNo('visitedIndia', 'Have you been to India before?', { hint: 'If you have your last Indian visa, you can add it in the Documents step.' }),
        { name: 'prevIndiaCities', label: 'Cities you visited', type: 'text', required: true, showIf: { name: 'visitedIndia', is: 'Yes' } },
        { name: 'prevIndiaAddress', label: 'Address where you stayed', type: 'textarea', required: true, showIf: { name: 'visitedIndia', is: 'Yes' } },
        { name: 'prevVisaNumber', label: 'Last Indian visa number (optional)', type: 'text', showIf: { name: 'visitedIndia', is: 'Yes' } },
        { name: 'refIndiaName', label: 'Reference in India: name', type: 'text', required: true, half: true, hint: 'A hotel, friend, family member or business contact.' },
        { name: 'refIndiaPhone', label: 'Their phone', type: 'tel', required: true, half: true },
        { name: 'refIndiaAddress', label: 'Their address', type: 'textarea', required: true },
        { name: 'refUkName', label: 'Reference in the UK: name', type: 'text', required: true, half: true, hint: 'Someone who knows you, not travelling with you.' },
        { name: 'refUkPhone', label: 'Their phone', type: 'tel', required: true, half: true },
        { name: 'refUkAddress', label: 'Their address', type: 'textarea', required: true },
      ],
    },
    {
      id: 'declarations',
      title: 'A few more questions',
      intro: 'The Indian eVisa form asks every applicant these questions. Most people answer No to all of them.',
      fields: [
        yesNo('refusedIndia', 'Have you ever been refused a visa for India, or an extension of one?'),
        details('refusedIndiaDetails', 'refusedIndia', 'When, and the reference number if you have it'),
        yesNo('saarc', 'Have you visited any SAARC country (Afghanistan, Bangladesh, Bhutan, Maldives, Nepal, Pakistan, Sri Lanka) in the last 3 years?'),
        { name: 'saarcVisits', type: 'repeat', label: 'SAARC country visits', addLabel: 'Add another visit', max: 8, showIf: { name: 'saarc', is: 'Yes' }, fields: [
          { name: 'country', label: 'Country', type: 'select', required: true, options: ['Afghanistan', 'Bangladesh', 'Bhutan', 'Maldives', 'Nepal', 'Pakistan', 'Sri Lanka'] },
          { name: 'year', label: 'Year', type: 'number', required: true },
          { name: 'visits', label: 'Number of visits', type: 'number', required: true },
        ] },
        yesNo('military', 'Have you served in the military, police, intelligence or a similar organisation?'),
        details('militaryDetails', 'military', 'Organisation, job title, rank and place of posting'),
        yesNo('q_arrested', 'Have you ever been arrested, prosecuted or convicted by a court of law in any country?'),
        details('q_arrestedDetails', 'q_arrested'),
        yesNo('q_refusedEntry', 'Have you ever been refused entry to, or deported from, any country, including India?'),
        details('q_refusedEntryDetails', 'q_refusedEntry'),
        yesNo('q_trafficking', 'Have you ever been involved in human trafficking, drug trafficking, child abuse, crimes against women, economic offences or financial fraud?'),
        details('q_traffickingDetails', 'q_trafficking'),
        yesNo('q_cyber', 'Have you ever been involved in cyber crime, terrorist activities, sabotage, espionage, genocide, political killing or other acts of violence?'),
        details('q_cyberDetails', 'q_cyber'),
        yesNo('q_views', 'Have you ever, by any means or medium, expressed views that justify or glorify terrorist violence?'),
        details('q_viewsDetails', 'q_views'),
        yesNo('q_asylum', 'Have you sought asylum (political or otherwise) in any country?'),
        details('q_asylumDetails', 'q_asylum'),
      ],
    },
  ],
  docsIntro: {
    'e-Tourist visa (30 days)': 'For a tourist eVisa you only need your passport and photo. Flight and hotel bookings are helpful but optional.',
    'e-Tourist visa (1 year)': 'For a tourist eVisa you only need your passport and photo. Flight and hotel bookings are helpful but optional.',
    'e-Tourist visa (5 years)': 'For a tourist eVisa you only need your passport and photo. Flight and hotel bookings are helpful but optional.',
    'e-Business visa': 'For a business eVisa you’ll need your business card and an invitation letter from the Indian company.',
    'e-Medical visa': 'For a medical eVisa you’ll need a letter from the hospital in India.',
    'e-Medical Attendant visa': 'For a medical attendant eVisa you’ll need a copy of the patient’s e-Medical visa and the hospital letter.',
    'e-Conference visa': 'For a conference eVisa you’ll need the conference invitation and, if you have it, the event clearance.',
    'e-Student visa': 'For a student eVisa you’ll need your admission letter from the Indian institution and proof you can pay your fees and living costs.',
    'e-Student Dependent visa': 'You’ll need a copy of the student’s e-Student visa and proof of your relationship to them.',
    'e-Transit visa': 'For a transit eVisa you’ll need your onward ticket, and a visa for your final destination if it needs one.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', hint: 'Square colour photo, plain white background, face centred, no glasses.', required: true },
    ...byVisa('doc1', {
      'e-Business visa': { label: 'Your business card', hint: 'A photo or scan of the front.', required: true },
      'e-Medical visa': { label: 'Letter from the hospital in India', hint: 'On the hospital’s letterhead, confirming your treatment.', required: true },
      'e-Medical Attendant visa': { label: 'Copy of the patient’s e-Medical visa', required: true },
      'e-Conference visa': { label: 'Conference invitation letter', required: true },
      'e-Student visa': { label: 'Admission letter from the Indian institution', required: true },
      'e-Student Dependent visa': { label: 'Copy of the student’s e-Student visa', required: true },
      'e-Transit visa': { label: 'Onward flight ticket to your final destination', required: true },
    }),
    ...byVisa('doc2', {
      'e-Business visa': { label: 'Invitation letter from the Indian company', hint: 'On their letterhead, with their address and contact details.', required: true },
      'e-Medical Attendant visa': { label: 'Letter from the hospital in India', required: true },
      'e-Conference visa': { label: 'Event or political clearance (if you have it)', hint: 'Usually provided by the conference organiser.' },
      'e-Student visa': { label: 'Proof of funds for your fees and living costs', hint: 'Bank statements or a sponsor letter.', required: true },
      'e-Student Dependent visa': { label: 'Proof of relationship, e.g. marriage or birth certificate', required: true },
      'e-Transit visa': { label: 'Visa for your final destination (if it needs one)' },
    }),
    { name: 'doc3', label: 'Your UK visa, BRP or eVisa share code page', hint: 'Because you’re not a British citizen.', showIf: { name: 'nationality', isNot: 'United Kingdom' } },
    { name: 'doc4', label: 'Flight booking (optional)' },
    { name: 'doc5', label: 'Hotel booking (optional)' },
    { name: 'doc6', label: 'Your last Indian visa (optional)', hint: 'A photo of the visa page or your old eVisa email.', showIf: { name: 'visitedIndia', is: 'Yes' } },
    { name: 'doc8', label: 'Any other supporting document (optional)' },
  ],
};

// ---------- Sri Lanka ----------

const sriLanka = {
  slug: 'sri-lanka-eta',
  title: 'Sri Lanka ETA application',
  country: 'Sri Lanka',
  code: 'LK',
  pageUrl: '/sri-lanka-visa-services/',
  description: 'Apply for your Sri Lanka ETA online. It takes about 5 minutes: upload your passport and we’ll fill in most of it for you.',
  minutes: 5,
  steps: [
    passportStep([
      { name: 'title', label: 'Title', type: 'select', required: true, options: ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Rev', 'Other'] },
    ]),
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'visaType', label: 'Purpose of your visit', type: 'radio', required: true, options: ['Tourism', 'Business', 'Transit'] },
        { name: 'occupation', label: 'Your occupation', type: 'text', required: true },
        { name: 'arrivalDate', label: 'Intended date of arrival', type: 'date', required: true, half: true },
        { name: 'stayDays', label: 'How many days will you stay?', type: 'number', required: true, half: true },
        { name: 'departureCountry', label: 'Country you’re flying from', type: 'country', required: true, half: true, default: 'United Kingdom' },
        { name: 'flight', label: 'Airline and flight number (optional)', type: 'text', half: true },
        { name: 'addressSriLanka', label: 'Address in Sri Lanka (hotel or host)', type: 'textarea', required: true },
        { name: 'businessDetails', label: 'Company you’re visiting and the reason', type: 'textarea', required: true, showIf: { name: 'visaType', is: 'Business' } },
        yesNo('residenceVisa', 'Do you currently have a valid residence visa for Sri Lanka?'),
        yesNo('inSriLanka', 'Are you currently in Sri Lanka with a valid ETA or visa?'),
        yesNo('multipleEntry', 'Do you have a multiple-entry visa for Sri Lanka?'),
        yesNo('children', 'Are any children under 16 travelling on your passport?'),
        { name: 'childList', type: 'repeat', label: 'Children on your passport', addLabel: 'Add a child', max: 6, showIf: { name: 'children', is: 'Yes' }, fields: [
          { name: 'name', label: 'Full name', type: 'text', required: true },
          { name: 'dob', label: 'Date of birth', type: 'date', required: true },
          { name: 'sex', label: 'Sex', type: 'select', required: true, options: ['Male', 'Female'] },
        ] },
      ],
    },
    contactStep(),
  ],
  docsIntro: {
    Tourism: 'For a tourist ETA no documents are required. Flight and hotel bookings are helpful but optional.',
    Business: 'For a business ETA you’ll need an invitation letter from the company in Sri Lanka.',
    Transit: 'For a transit ETA you’ll need your onward flight ticket.',
  },
  uploads: [
    ...byVisa('doc1', {
      Tourism: { label: 'Return flight booking (optional)' },
      Business: { label: 'Return flight booking (optional)' },
      Transit: { label: 'Onward flight ticket', hint: 'Showing your flight out of Sri Lanka.', required: true },
    }),
    ...byVisa('doc2', {
      Tourism: { label: 'Hotel booking (optional)' },
      Business: { label: 'Hotel booking (optional)' },
    }),
    { name: 'doc3', label: 'Invitation letter from the company in Sri Lanka', required: true, showIf: { name: 'visaType', is: 'Business' } },
    { name: 'doc8', label: 'Any other supporting document (optional)' },
  ],
};


// ======================================================================
// More travel forms. Kept short in the same style: a few key questions,
// then the documents for the visa chosen. Our team reads the remaining
// details from the uploaded documents.
// ======================================================================

const stay = (extra = []) => [
  { name: 'arrivalDate', label: 'Date you plan to arrive', type: 'date', required: true, half: true },
  { name: 'departureDate', label: 'Date you plan to leave', type: 'date', required: true, half: true },
  ...extra,
];
const work = {
  id: 'work',
  title: 'Your work',
  fields: [
    { name: 'occupation', label: 'What do you currently do?', type: 'select', required: true, options: ['Employed', 'Self-employed / business owner', 'Student', 'Retired', 'Not working'] },
    { name: 'employer', label: 'Employer or business name', type: 'text', required: true, half: true, showIf: { name: 'occupation', is: ['Employed', 'Self-employed / business owner'] } },
    { name: 'jobTitle', label: 'Job title', type: 'text', required: true, half: true, showIf: { name: 'occupation', is: ['Employed', 'Self-employed / business owner'] } },
  ],
};
const ukStatusDoc = (name) => ({ name, label: 'Your UK residence permit, BRP or eVisa share code page', hint: 'Because you’re not a British citizen.', required: true, showIf: { name: 'nationality', isNot: 'United Kingdom' } });
const other = { name: 'doc8', label: 'Any other supporting document (optional)' };
const bankDocs = (name, req = true) => ({ name, label: 'Bank statements for the last 3 months', hint: 'Showing your name and address. PDFs from online banking are fine.', required: req });

// ---------- Schengen ----------
const schengenCountries = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland'];
const schengen = {
  slug: 'schengen-visa',
  title: 'Schengen visa application',
  country: 'Schengen area',
  code: 'SC',
  pageUrl: '/schengen-visa-application/',
  description: 'Apply for your Schengen visa online. Upload your passport, tell us about your trip and add your documents. We prepare everything for your visa centre appointment.',
  minutes: 10,
  notice: 'British citizens don’t need a Schengen visa for visits of up to 90 days. This form is for UK residents travelling on other passports.',
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'visaType', label: 'Main purpose of your trip', type: 'select', required: true, options: ['Tourism', 'Visiting family or friends', 'Business', 'Other'] },
        { name: 'mainCountry', label: 'Country where you’ll spend the most time', type: 'select', required: true, options: schengenCountries, hint: 'You apply to this country’s visa centre.' },
        { name: 'otherCountries', label: 'Other Schengen countries you’ll visit (optional)', type: 'text' },
        ...stay(),
        { name: 'purposeOther', label: 'Please describe the purpose', type: 'text', required: true, showIf: { name: 'visaType', is: 'Other' } },
        yesNo('previousSchengen', 'Have you had a Schengen visa in the last 5 years?'),
      ],
    },
    work,
    contactStep(),
  ],
  docsIntro: {
    Tourism: 'For a tourist visa you’ll need your flights, hotel bookings, travel insurance and proof of funds.',
    'Visiting family or friends': 'For a family visit you’ll need an invitation from your host with a copy of their ID or residence permit, plus your flights, insurance and proof of funds.',
    Business: 'For a business visa you’ll need an invitation from the company you’re visiting and a letter from your employer.',
    Other: 'Add the documents that explain your trip. We’ll tell you if anything else is needed.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', hint: 'Recent colour photo, light background, 35 × 45 mm.', required: true },
    ukStatusDoc('doc1'),
    bankDocs('doc2'),
    { name: 'doc3', label: 'Payslips for the last 3 months and an employer letter', hint: 'The letter should confirm your job, salary and approved holiday.', required: true, showIf: { name: 'occupation', is: 'Employed' } },
    { name: 'doc4', label: 'Return flight booking', hint: 'A reservation is fine; you don’t need to have paid yet.', required: true },
    ...byVisa('doc5', {
      Tourism: { label: 'Hotel bookings for your whole stay', required: true },
      'Visiting family or friends': { label: 'Invitation letter and a copy of your host’s ID or residence permit', required: true },
      Business: { label: 'Invitation letter from the company you’re visiting', required: true },
      Other: { label: 'Accommodation booking or invitation', required: true },
    }),
    { name: 'doc6', label: 'Travel medical insurance', hint: 'At least €30,000 of cover for your whole trip. We can tell you where to get it if you don’t have it yet.' },
    { name: 'doc7', label: 'Previous Schengen visas (optional)', showIf: { name: 'previousSchengen', is: 'Yes' } },
    other,
  ],
};

// ---------- USA ----------
const usa = {
  slug: 'usa-visa',
  title: 'USA ESTA or visa application',
  country: 'USA',
  code: 'US',
  pageUrl: '/usa-visa-services/',
  description: 'Apply for your US ESTA or visitor visa. Upload your passport, answer a few questions, and we’ll prepare your ESTA or DS-160 form.',
  minutes: 8,
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'visaType', label: 'What do you need?', type: 'radio', required: true, options: ['ESTA', 'Visitor visa (B1/B2)', 'Not sure'], hint: 'Most British citizens use an ESTA. We’ll confirm the right one.' },
        { name: 'purpose', label: 'Purpose of your trip', type: 'select', required: true, options: ['Tourism', 'Visiting family or friends', 'Business', 'Transit', 'Other'] },
        ...stay([{ name: 'usAddress', label: 'Where you’ll stay in the USA', type: 'textarea', required: true }]),
        yesNo('restrictedTravel', 'Have you been to Iran, Iraq, Syria, Sudan, Libya, Somalia, Yemen, North Korea or Cuba since 2011?', { hint: 'This can affect whether you can use an ESTA.' }),
        details('restrictedTravelDetails', 'restrictedTravel', 'Which countries, when and why'),
        yesNo('arrests', 'Have you ever been arrested, cautioned or convicted, even if it is now spent?'),
        details('arrestsDetails', 'arrests', 'Please give details. We treat this in confidence.'),
        yesNo('refusedUS', 'Have you ever been refused an ESTA, a US visa or entry to the USA?'),
        details('refusedUSDetails', 'refusedUS'),
      ],
    },
    work,
    contactStep(),
  ],
  docsIntro: {
    ESTA: 'For an ESTA you only need your passport. We’ll check your answers before submitting.',
    'Visitor visa (B1/B2)': 'For a visitor visa you’ll need a photo and documents showing your ties to the UK. You’ll also attend an interview at the US Embassy.',
    'Not sure': 'Add your passport and anything you think is relevant. We’ll tell you which you need.',
  },
  uploads: [
    { name: 'photo', label: 'Digital photo', hint: 'Square, white background, taken in the last 6 months, no glasses.', required: true, showIf: { name: 'visaType', is: ['Visitor visa (B1/B2)', 'Not sure'] } },
    ukStatusDoc('doc1'),
    { name: 'doc2', label: 'Letter from your employer or proof of your business', showIf: { name: 'visaType', is: ['Visitor visa (B1/B2)', 'Not sure'] } },
    { ...bankDocs('doc3', false), showIf: { name: 'visaType', is: ['Visitor visa (B1/B2)', 'Not sure'] } },
    { name: 'doc4', label: 'Previous US visas (optional)' },
    { name: 'doc5', label: 'Court or police documents', hint: 'Only if you answered Yes about arrests or convictions.', showIf: { name: 'arrests', is: 'Yes' } },
    other,
  ],
};

// ---------- Saudi Arabia ----------
const saudi = {
  slug: 'saudi-visa',
  title: 'Saudi Arabia visa application',
  country: 'Saudi Arabia',
  code: 'SA',
  pageUrl: '/saudi-arabia-visa-uk/',
  description: 'Apply for your Saudi tourist eVisa, Umrah, business or work visa. Upload your passport and documents and we’ll handle the rest.',
  minutes: 8,
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'visaType', label: 'Which visa do you need?', type: 'select', required: true, options: ['Tourist eVisa', 'Umrah (tourist eVisa)', 'Business visit', 'Family visit', 'Work visa'] },
        ...stay(),
        { name: 'employerSaudi', label: 'Name of your employer in Saudi Arabia', type: 'text', required: true, showIf: { name: 'visaType', is: 'Work visa' } },
        { name: 'hostSaudi', label: 'Name of the company or person you’re visiting', type: 'text', required: true, showIf: { name: 'visaType', is: ['Business visit', 'Family visit'] } },
        { name: 'religion', label: 'Religion', type: 'select', options: ['Islam', 'Christian', 'Hindu', 'Sikh', 'Other', 'Prefer not to say'], required: true, showIf: { name: 'visaType', is: 'Umrah (tourist eVisa)' }, hint: 'The Saudi form asks this for Umrah applicants.' },
      ],
    },
    contactStep(),
  ],
  docsIntro: {
    'Tourist eVisa': 'For a tourist eVisa you usually only need your passport and photo.',
    'Umrah (tourist eVisa)': 'Umrah is allowed on the tourist eVisa outside the Hajj season. You usually only need your passport and photo.',
    'Business visit': 'For a business visit you’ll need an invitation from the Saudi company and a letter from your employer.',
    'Family visit': 'For a family visit you’ll need an invitation from your relative in Saudi Arabia and proof of your relationship.',
    'Work visa': 'For a work visa you’ll need your visa authorisation from your employer, attested degree certificate, police certificate and medical report. We can arrange the attestation.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', hint: 'Colour photo, white background.', required: true },
    ukStatusDoc('doc1'),
    ...byVisa('doc2', {
      'Business visit': { label: 'Invitation letter from the Saudi company', required: true },
      'Family visit': { label: 'Invitation from your relative and a copy of their Saudi ID (Iqama)', required: true },
      'Work visa': { label: 'Visa authorisation (wakala) or employment contract from your employer', required: true },
    }),
    ...byVisa('doc3', {
      'Business visit': { label: 'Letter from your UK employer' },
      'Family visit': { label: 'Proof of relationship, e.g. birth or marriage certificate', required: true },
      'Work visa': { label: 'Degree certificate', hint: 'We arrange the apostille and attestation if needed.', required: true },
    }),
    ...byVisa('doc4', { 'Work visa': { label: 'Police certificate (ACRO or DBS)', required: true } }),
    ...byVisa('doc5', { 'Work visa': { label: 'Medical report (if you already have it)' } }),
    other,
  ],
};

// ---------- Ghana ----------
const ghana = {
  slug: 'ghana-visa',
  title: 'Ghana visa application',
  country: 'Ghana',
  code: 'GH',
  pageUrl: '/ghana-visa-services/',
  description: 'Apply for your Ghana tourist or business visa. Upload your passport and documents, including your yellow fever certificate.',
  minutes: 8,
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'visaType', label: 'Purpose of your trip', type: 'radio', required: true, options: ['Tourism', 'Visiting family or friends', 'Business'] },
        { name: 'entries', label: 'Number of entries', type: 'radio', required: true, options: ['Single entry', 'Multiple entries'] },
        ...stay([{ name: 'ghanaAddress', label: 'Address in Ghana (hotel or host)', type: 'textarea', required: true }]),
        yesNo('visitedGhana', 'Have you been to Ghana before?'),
      ],
    },
    work,
    contactStep(),
  ],
  docsIntro: {
    Tourism: 'For a tourist visa you’ll need your flights, hotel booking and yellow fever certificate.',
    'Visiting family or friends': 'You’ll need an invitation from your host with a copy of their ID, your flights and yellow fever certificate.',
    Business: 'You’ll need an invitation from the Ghanaian company, a letter from your employer and your yellow fever certificate.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', required: true },
    ukStatusDoc('doc1'),
    { name: 'doc2', label: 'Return flight booking', required: true },
    ...byVisa('doc3', {
      Tourism: { label: 'Hotel booking', required: true },
      'Visiting family or friends': { label: 'Invitation letter and a copy of your host’s ID', required: true },
      Business: { label: 'Invitation letter from the Ghanaian company', required: true },
    }),
    ...byVisa('doc4', { Business: { label: 'Letter from your UK employer', required: true } }),
    { name: 'doc5', label: 'Yellow fever vaccination certificate', hint: 'Ghana requires this for entry.', required: true },
    { ...bankDocs('doc6', false), label: 'Bank statements (optional)' },
    other,
  ],
};

// ---------- Russia ----------
const russia = {
  slug: 'russia-visa',
  title: 'Russian visa application',
  country: 'Russia',
  code: 'RU',
  pageUrl: '/russian-visa-services-from-uk/',
  description: 'Apply for your Russian tourist, business, private or work visa. Upload your passport and visa support documents.',
  minutes: 10,
  notice: 'The UK Foreign, Commonwealth and Development Office currently advises against all travel to Russia. Please read the latest advice on GOV.UK before you apply.',
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'visaType', label: 'Which visa do you need?', type: 'select', required: true, options: ['Tourist', 'Business', 'Private (visiting family or friends)', 'Work'] },
        { name: 'entries', label: 'Number of entries', type: 'radio', required: true, options: ['Single entry', 'Double entry', 'Multiple entries'] },
        ...stay([{ name: 'cities', label: 'Cities you’ll visit', type: 'text', required: true }]),
        yesNo('hasSupport', 'Do you already have your visa support document (invitation or tourist voucher)?'),
      ],
    },
    work,
    contactStep(),
  ],
  docsIntro: {
    Tourist: 'For a tourist visa you’ll need a tourist voucher and confirmation from a Russian tour operator or hotel, plus travel insurance.',
    Business: 'For a business visa you’ll need an invitation from the Russian company and travel insurance.',
    'Private (visiting family or friends)': 'For a private visa you’ll need an official invitation arranged by your relative or friend in Russia, plus travel insurance.',
    Work: 'For a work visa you’ll need the invitation and work permit arranged by your employer in Russia.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', required: true },
    ukStatusDoc('doc1'),
    { name: 'doc2', label: 'Visa support document (invitation or tourist voucher)', hint: 'If you don’t have one yet, leave this empty and we’ll explain how to get it.', required: false },
    { name: 'doc3', label: 'Travel medical insurance valid in Russia', required: true, showIf: { name: 'visaType', isNot: 'Work' } },
    { name: 'doc4', label: 'Letter from your UK employer (optional)' },
    other,
  ],
};

// ---------- India regular visa (Employment and others) ----------
const indiaRegular = {
  slug: 'india-regular-visa',
  title: 'India Employment and regular visa application',
  country: 'India',
  code: 'IR',
  pageUrl: '/employment-visa-india/',
  description: 'Apply for an India Employment visa or other regular (paper) visa. Upload your passport and documents and we’ll prepare your application.',
  minutes: 10,
  notice: 'For tourism and short business trips most British citizens can use the quicker eVisa instead. Use this form for Employment visas, or if you can’t use the eVisa.',
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'trip',
      title: 'Your visa',
      fields: [
        { name: 'visaType', label: 'Which visa do you need?', type: 'select', required: true, options: ['Employment visa', 'Business visa (regular)', 'Tourist visa (regular)', 'Other'] },
        { name: 'whyRegular', label: 'Why can’t you use the eVisa?', type: 'select', required: true, options: ['I’m of Pakistani origin or hold a Pakistani passport', 'My trip is longer than the eVisa allows', 'Other reason'], showIf: { name: 'visaType', is: ['Business visa (regular)', 'Tourist visa (regular)'] } },
        { name: 'indianEmployer', label: 'Name of your employer in India', type: 'text', required: true, showIf: { name: 'visaType', is: 'Employment visa' } },
        { name: 'salary', label: 'Annual salary in India (approximate)', type: 'text', showIf: { name: 'visaType', is: 'Employment visa' } },
        { name: 'arrivalDate', label: 'Date you plan to arrive', type: 'date', required: true, half: true },
        { name: 'duration', label: 'How long will you stay?', type: 'text', required: true, half: true },
      ],
    },
    contactStep(),
  ],
  docsIntro: {
    'Employment visa': 'For an Employment visa you’ll need your contract or appointment letter, your qualifications, and registration documents from your Indian employer.',
    'Business visa (regular)': 'You’ll need an invitation from the Indian company and a letter from your employer.',
    'Tourist visa (regular)': 'You’ll need your travel plans and proof of address. People of Pakistani origin also need extra details, which we’ll help with.',
    Other: 'Add the documents that explain your trip. We’ll tell you if anything else is needed.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', hint: 'Square, white background.', required: true },
    ukStatusDoc('doc1'),
    ...byVisa('doc2', {
      'Employment visa': { label: 'Employment contract or appointment letter', required: true },
      'Business visa (regular)': { label: 'Invitation letter from the Indian company', required: true },
    }),
    ...byVisa('doc3', {
      'Employment visa': { label: 'Degree certificates and CV', required: true },
      'Business visa (regular)': { label: 'Letter from your UK employer' },
    }),
    ...byVisa('doc4', { 'Employment visa': { label: 'Registration documents of the Indian employer', hint: 'Your employer can provide these.' } }),
    { name: 'doc5', label: 'Proof of UK address', hint: 'A recent utility bill or council tax bill.', required: true },
    { name: 'doc6', label: 'Previous Indian passport or visa (if you have one)' },
    other,
  ],
};

// ---------- eVisas for other countries ----------
// Countries in the general eVisa form: every eVisa country except those with their own form.
const ownForm = new Set(['India', 'Sri Lanka', 'Saudi Arabia', 'USA']);
const evisaCountries = evisaContinents.flatMap((k) => k.countries).filter((x) => !ownForm.has(x.name)).map((x) => x.name);
const evisa = {
  slug: 'evisa',
  title: 'eVisa application',
  country: 'other countries',
  code: 'EV',
  pageUrl: '/e-visa/',
  description: 'Apply for an eVisa for Kenya, Turkey, Cambodia, Tanzania and many more countries. Upload your passport and we’ll complete and check your application.',
  minutes: 5,
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'destination', label: 'Which country is the eVisa for?', type: 'select', required: true, options: evisaCountries },
        { name: 'visaType', label: 'Purpose of your trip', type: 'radio', required: true, options: ['Tourism', 'Business', 'Transit'] },
        ...stay([{ name: 'address', label: 'Hotel or address where you’ll stay', type: 'textarea', required: true }]),
      ],
    },
    contactStep(),
  ],
  docsIntro: {
    Tourism: 'Most tourist eVisas only need your passport and a photo. Flight and hotel bookings help.',
    Business: 'Business eVisas usually also need an invitation letter from the company you’re visiting.',
    Transit: 'Transit eVisas usually need your onward ticket.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', hint: 'Colour photo, plain light background.', required: true },
    { name: 'doc1', label: 'Flight booking (optional)' },
    { name: 'doc2', label: 'Hotel booking (optional)' },
    ...byVisa('doc3', {
      Business: { label: 'Invitation letter from the company you’re visiting', required: true },
      Transit: { label: 'Onward flight ticket', required: true },
    }),
    ukStatusDoc('doc4'),
    other,
  ],
};

// ---------- Document legalisation ----------
const legalisation = {
  slug: 'document-legalisation',
  title: 'Document legalisation request',
  country: 'documents',
  code: 'DL',
  pageUrl: '/document-legalisation/',
  description: 'Tell us which documents you need apostilled or legalised and where they’ll be used. Upload copies and we’ll confirm the price and what to send.',
  minutes: 5,
  noPassport: true,
  steps: [
    {
      id: 'documents-needed',
      title: 'Your documents',
      fields: [
        { name: 'givenNames', label: 'Your first name', type: 'text', required: true, half: true },
        { name: 'surname', label: 'Your surname', type: 'text', required: true, half: true },
        { name: 'companyName', label: 'Company name (if the documents are for a business)', type: 'text' },
        { name: 'useCountry', label: 'Country where the documents will be used', type: 'country', required: true },
        { name: 'visaType', label: 'What do you need?', type: 'radio', required: true, options: ['Apostille only', 'Apostille and embassy legalisation', 'Not sure'] },
        { name: 'documentList', type: 'repeat', label: 'Documents', addLabel: 'Add another document', max: 8, fields: [
          { name: 'type', label: 'Document', type: 'select', required: true, options: ['Degree certificate', 'Transcript', 'Police certificate (DBS/ACRO)', 'Birth certificate', 'Marriage certificate', 'Death certificate', 'Company document', 'Power of attorney', 'Medical or employment letter', 'Other'] },
          { name: 'description', label: 'Details (optional)', type: 'text' },
          { name: 'copies', label: 'How many copies?', type: 'number', required: true },
        ] },
        { name: 'speed', label: 'How quickly do you need them?', type: 'radio', required: true, options: ['Standard', 'Urgent'] },
      ],
    },
    { ...contactStep(), fields: contactStep().fields.filter((f) => !['ukStatus', 'ukStatusExpiry'].includes(f.name)) },
  ],
  docsIntro: {
    'Apostille only': 'Upload a clear copy of each document so we can check it can be apostilled as it is, or needs certifying first.',
    'Apostille and embassy legalisation': 'Upload a clear copy of each document. We’ll check the embassy’s rules and tell you what to send us.',
    'Not sure': 'Upload a clear copy of each document and we’ll tell you exactly what’s needed for the country.',
  },
  uploads: [
    { name: 'doc1', label: 'Copy of document 1', required: true },
    { name: 'doc2', label: 'Copy of document 2 (optional)' },
    { name: 'doc3', label: 'Copy of document 3 (optional)' },
    { name: 'doc4', label: 'Copy of document 4 (optional)' },
    { name: 'doc5', label: 'Copy of document 5 (optional)' },
    { name: 'doc6', label: 'Letter or instructions from the organisation abroad (optional)' },
    other,
  ],
};

// ---------- Indian passport, surrender certificate and OCI ----------
const indianPassport = {
  slug: 'indian-passport-oci',
  title: 'Indian passport, surrender certificate and OCI request',
  country: 'Indian passport services',
  code: 'IP',
  pageUrl: '/indian-passport-services/',
  description: 'Renew your Indian passport, get a surrender certificate or apply for OCI. Upload your passport and documents and we’ll prepare your application.',
  minutes: 8,
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'service',
      title: 'What you need',
      fields: [
        { name: 'visaType', label: 'Which service do you need?', type: 'select', required: true, options: ['Indian passport renewal', 'Surrender certificate', 'New OCI card', 'OCI update (new passport)', 'Lost or damaged Indian passport'] },
        { name: 'britishSince', label: 'When did you become a British citizen?', type: 'date', required: true, showIf: { name: 'visaType', is: ['Surrender certificate', 'New OCI card'] } },
        yesNo('usedIndianPassport', 'Have you travelled on your Indian passport since becoming British?', { showIf: { name: 'visaType', is: 'Surrender certificate' } }),
      ],
    },
    contactStep(),
  ],
  docsIntro: {
    'Indian passport renewal': 'You’ll need your current Indian passport, proof of UK address and your UK visa or BRP.',
    'Surrender certificate': 'You’ll need your Indian passport, your British passport and your naturalisation certificate.',
    'New OCI card': 'You’ll need your British passport, your surrender certificate and proof of Indian origin.',
    'OCI update (new passport)': 'You’ll need your new passport, your old passport and your current OCI card.',
    'Lost or damaged Indian passport': 'You’ll need a police report and any copy of the old passport you have.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', hint: 'Square, white background.', required: true },
    ...byVisa('doc1', {
      'Indian passport renewal': { label: 'All pages of your current Indian passport', required: true },
      'Surrender certificate': { label: 'All pages of your Indian passport', required: true },
      'New OCI card': { label: 'Surrender certificate', required: true },
      'OCI update (new passport)': { label: 'Your current OCI card', required: true },
      'Lost or damaged Indian passport': { label: 'Police report', required: true },
    }),
    ...byVisa('doc2', {
      'Surrender certificate': { label: 'British naturalisation certificate', required: true },
      'New OCI card': { label: 'Proof of Indian origin, e.g. old Indian passport or parents’ documents', required: true },
      'OCI update (new passport)': { label: 'Your old passport', required: true },
      'Lost or damaged Indian passport': { label: 'Copy of the lost passport (if you have one)' },
    }),
    ...byVisa('doc3', { 'Indian passport renewal': { label: 'UK visa, BRP or eVisa share code page', required: true } }),
    { name: 'doc4', label: 'Proof of UK address', hint: 'A recent utility bill or council tax bill.', required: true },
    other,
  ],
};

// ---------- Second UK passport ----------
const secondPassport = {
  slug: 'second-uk-passport',
  title: 'Second British passport application',
  country: 'second UK passport',
  code: 'SP',
  pageUrl: '/second-uk-passport/',
  description: 'Apply for a second British passport if you travel often for work. Upload your current passport and your employer’s letter.',
  minutes: 5,
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'reason',
      title: 'Why you need a second passport',
      fields: [
        { name: 'visaType', label: 'Main reason', type: 'radio', required: true, options: ['I travel often for work and need to travel while my passport is at a visa centre', 'I travel to countries with conflicting entry rules', 'Other'] },
        { name: 'employer', label: 'Employer or business name', type: 'text', required: true },
        { name: 'tripsPerYear', label: 'Roughly how many work trips abroad a year?', type: 'number', required: true },
        { name: 'reasonDetails', label: 'Anything else we should know?', type: 'textarea' },
      ],
    },
    { ...contactStep(), fields: contactStep().fields.filter((f) => !['ukStatus', 'ukStatusExpiry'].includes(f.name)) },
  ],
  uploads: [
    { name: 'photo', label: 'Passport photo', hint: 'Recent colour photo, plain light grey or cream background.', required: true },
    { name: 'doc1', label: 'Letter from your employer explaining why you need a second passport', hint: 'We can send you a template.', required: true },
    { name: 'doc2', label: 'Evidence of recent or planned travel (optional)', hint: 'For example visas or travel bookings.' },
    other,
  ],
};

// ---------- India eVisa transfer to a new passport ----------
const indiaTransfer = {
  slug: 'india-evisa-transfer',
  title: 'Transfer your India eVisa to a new passport',
  country: 'India',
  code: 'IT',
  pageUrl: '/transfer-india-evisa-new-passport/',
  description: 'Move your valid India eVisa onto your new passport. Upload your new passport and tell us about your current eVisa. We’ll check whether you need a transfer at all.',
  minutes: 4,
  notice: 'If you still have your old passport, you usually don’t need a transfer: you can travel on your new passport as long as you carry the old one too.',
  steps: [
    { ...passportStep([], passportScanFields), title: 'Your new passport', intro: 'Upload a photo of your NEW passport photo page and we’ll fill in your details. Your passport is read on your own device.' },
    {
      id: 'current-evisa',
      title: 'Your current eVisa',
      fields: [
        { name: 'visaType', label: 'Which eVisa do you have?', type: 'select', required: true, options: ['e-Tourist visa (1 year)', 'e-Tourist visa (5 years)', 'e-Business visa (1 year)', 'e-Tourist visa (30 days)', 'Other eVisa', 'Not sure'] },
        { name: 'etaNumber', label: 'eVisa / ETA reference number', type: 'text', hint: 'On your eVisa approval email. Leave blank if you can’t find it.' },
        { name: 'evisaExpiry', label: 'When does your eVisa expire?', type: 'date', half: true },
        { name: 'oldPassportNumber', label: 'Old passport number', type: 'text', required: true, half: true },
        { name: 'reason', label: 'Why don’t you have your old passport?', type: 'radio', required: true, options: ['It was lost', 'It was stolen', 'It wasn’t returned to me', 'I still have it'] },
        { name: 'travelDate', label: 'When are you next travelling to India?', type: 'date', half: true },
      ],
    },
    { ...contactStep(), fields: contactStep().fields.filter((f) => !['ukStatus', 'ukStatusExpiry'].includes(f.name)) },
  ],
  docsIntro: {
    'e-Tourist visa (1 year)': 'Add a photo and your current eVisa. We’ll submit the transfer on India’s eVisa portal.',
    'e-Tourist visa (5 years)': 'Add a photo and your current eVisa. We’ll submit the transfer on India’s eVisa portal.',
    'e-Business visa (1 year)': 'Add a photo and your current eVisa. We’ll submit the transfer on India’s eVisa portal.',
    'e-Tourist visa (30 days)': '30-day eVisas don’t currently appear to be transferable. Add your documents and we’ll check, or apply for a new eVisa for you.',
    'Other eVisa': 'Add your documents and we’ll check whether your eVisa can be transferred.',
    'Not sure': 'Add your current eVisa if you have it, and we’ll work out which type it is.',
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', hint: 'Square colour photo, plain white background.', required: true },
    { name: 'doc1', label: 'Your current eVisa / ETA approval', hint: 'The email or PDF you received when it was granted.' },
    { name: 'doc2', label: 'Copy of your old passport (if you have one)' },
    { name: 'doc3', label: 'Police report (if your passport was stolen)', showIf: { name: 'reason', is: 'It was stolen' } },
    { name: 'doc8', label: 'Any other supporting document (optional)' },
  ],
};

// ---------- Japan ----------
const japan = {
  slug: 'japan-visa',
  title: 'Japan visa application',
  country: 'Japan',
  code: 'JP',
  pageUrl: '/japan-visa-services/',
  description: 'Apply for your Japan visa from the UK. Upload your passport, tell us about your trip and add your documents. We prepare everything for your Embassy appointment.',
  minutes: 8,
  notice: 'British citizens don’t need a visa for short visits to Japan. This form is for UK residents travelling on other passports.',
  steps: [
    passportStep([], passportScanFields),
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'visaType', label: 'Purpose of your trip', type: 'radio', required: true, options: ['Tourism', 'Visiting family or friends', 'Business'] },
        { name: 'arrivalDate', label: 'Date you plan to arrive', type: 'date', required: true, half: true },
        { name: 'departureDate', label: 'Date you plan to leave', type: 'date', required: true, half: true },
        { name: 'cities', label: 'Cities you plan to visit', type: 'text', required: true },
        { name: 'hostName', label: 'Name of the person or company you’re visiting', type: 'text', required: true, showIf: { name: 'visaType', is: ['Visiting family or friends', 'Business'] } },
        yesNo('visitedJapan', 'Have you been to Japan before?'),
      ],
    },
    work,
    contactStep(),
  ],
  docsIntro: {
    Tourism: 'For a tourist visa you’ll need your flights, hotel bookings and proof of funds. We prepare your schedule of stay for you.',
    'Visiting family or friends': 'You’ll need an invitation letter from your host in Japan and a copy of their residence card or passport.',
    Business: 'You’ll need an invitation letter from the Japanese company and a letter from your employer.',
  },
  uploads: [
    { name: 'photo', label: 'Passport photo (45mm × 35mm)', hint: 'Recent colour photo, plain background.', required: true },
    ukStatusDoc('doc1'),
    { name: 'doc2', label: 'Flight reservation', required: true },
    ...byVisa('doc3', {
      Tourism: { label: 'Hotel bookings for your whole stay', required: true },
      'Visiting family or friends': { label: 'Invitation letter from your host in Japan', required: true },
      Business: { label: 'Invitation letter from the Japanese company', required: true },
    }),
    ...byVisa('doc4', {
      'Visiting family or friends': { label: 'Copy of your host’s residence card or passport', required: true },
      Business: { label: 'Letter from your UK employer', required: true },
    }),
    bankDocs('doc5'),
    other,
  ],
};

export const applications = [china, india, indiaTransfer, sriLanka, japan, schengen, usa, saudi, ghana, russia, indiaRegular, evisa, legalisation, indianPassport, secondPassport];
export const applicationBySlug = Object.fromEntries(applications.map((a) => [a.slug, a]));
export const declaration = declarationNote;
export const FILE_SLOTS = ['passport', 'photo', 'doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6', 'doc7', 'doc8'];
