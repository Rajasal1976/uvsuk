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

const passportStep = (extra = []) => ({
  id: 'passport',
  title: 'Your passport',
  intro: 'Upload a photo of your passport photo page and we’ll fill in your details for you. Your passport is read on your own device.',
  passportScan: true,
  fields: [...passportFields, ...extra],
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

const china = {
  slug: 'china-visa',
  title: 'China visa application',
  country: 'China',
  code: 'CN',
  pageUrl: '/china-visa-application/',
  description: 'Apply for your China visa online. Upload your passport and we’ll fill in your details, then answer a few questions about your trip.',
  minutes: 15,
  notice: 'British passport holders can currently visit China visa-free for short trips. If you’re not sure you need a visa, call us before you apply.',
  steps: [
    passportStep([
      yesNo('otherNames', 'Have you ever used any other names?'),
      { name: 'otherNamesList', label: 'Other names used', type: 'text', required: true, showIf: { name: 'otherNames', is: 'Yes' } },
      { name: 'chineseName', label: 'Chinese name, if you have one (optional)', type: 'text' },
      yesNo('otherNationality', 'Do you have, or have you ever had, any other nationality?'),
      { name: 'otherNationalityList', label: 'Which nationality, and when?', type: 'text', required: true, showIf: { name: 'otherNationality', is: 'Yes' } },
      yesNo('otherResidence', 'Do you have permanent residence in any other country?'),
      { name: 'otherResidenceList', label: 'Which country?', type: 'country', required: true, showIf: { name: 'otherResidence', is: 'Yes' } },
      { name: 'nationalId', label: 'National ID number (optional)', type: 'text', hint: 'Only if your country issues one.' },
    ]),
    {
      id: 'trip',
      title: 'Your trip',
      fields: [
        { name: 'visaType', label: 'What is the main purpose of your trip?', type: 'select', required: true, options: ['Business (M visa)', 'Tourism (L visa)', 'Visiting family in China (Q2 / Q1 visa)', 'Visiting a foreigner living in China (S visa)', 'Work (Z visa)', 'Study (X visa)', 'Transit (G visa)', 'Crew (C visa)', 'Journalism (J visa)'] },
        { name: 'entries', label: 'Number of entries', type: 'radio', required: true, options: ['Single entry', 'Double entry', 'Multiple entries'] },
        { name: 'arrivalDate', label: 'Date you plan to arrive in China', type: 'date', required: true, half: true },
        { name: 'departureDate', label: 'Date you plan to leave China', type: 'date', required: true, half: true },
        { name: 'itinerary', label: 'Cities you plan to visit, in order', type: 'textarea', required: true, hint: 'For example: Shanghai 3–6 May, Guangzhou 6–10 May.' },
        { name: 'firstAddress', label: 'Address where you’ll stay first (hotel or host)', type: 'textarea', required: true },
        { name: 'inviterName', label: 'Name of the person or company inviting you', type: 'text', required: true, showIf: { name: 'visaType', is: ['Business (M visa)', 'Visiting family in China (Q2 / Q1 visa)', 'Visiting a foreigner living in China (S visa)', 'Work (Z visa)', 'Study (X visa)', 'Journalism (J visa)'] } },
        { name: 'inviterRelation', label: 'Your relationship to them', type: 'text', required: true, showIf: { name: 'visaType', is: ['Visiting family in China (Q2 / Q1 visa)', 'Visiting a foreigner living in China (S visa)'] } },
        { name: 'inviterAddress', label: 'Their address in China', type: 'textarea', required: true, showIf: { name: 'inviterName', filled: true } },
        { name: 'inviterPhone', label: 'Their phone number', type: 'tel', required: true, half: true, showIf: { name: 'inviterName', filled: true } },
        { name: 'inviterEmail', label: 'Their email (optional)', type: 'email', half: true, showIf: { name: 'inviterName', filled: true } },
        { name: 'payer', label: 'Who is paying for your trip?', type: 'radio', required: true, options: ['Myself', 'My employer', 'The person or company inviting me', 'Someone else'] },
        { name: 'payerDetails', label: 'Who is paying, and your relationship to them', type: 'text', required: true, showIf: { name: 'payer', is: 'Someone else' } },
        yesNo('travellingWithOthers', 'Is anyone travelling with you on the same passport or application?'),
        { name: 'companions', type: 'repeat', label: 'People travelling with you', addLabel: 'Add another person', max: 6, showIf: { name: 'travellingWithOthers', is: 'Yes' }, fields: [
          { name: 'name', label: 'Full name', type: 'text', required: true },
          { name: 'dob', label: 'Date of birth', type: 'date', required: true },
          { name: 'relation', label: 'Relationship to you', type: 'text', required: true },
        ] },
      ],
    },
    {
      id: 'work',
      title: 'Work and education',
      fields: [
        { name: 'occupation', label: 'What do you currently do?', type: 'select', required: true, options: ['Employed', 'Self-employed / business owner', 'Student', 'Retired', 'Not working', 'Other'] },
        { name: 'jobTitle', label: 'Job title', type: 'text', required: true, half: true, showIf: { name: 'occupation', is: ['Employed', 'Self-employed / business owner'] } },
        { name: 'employer', label: 'Employer or business name', type: 'text', required: true, half: true, showIf: { name: 'occupation', is: ['Employed', 'Self-employed / business owner'] } },
        { name: 'employerAddress', label: 'Employer or business address', type: 'textarea', required: true, showIf: { name: 'occupation', is: ['Employed', 'Self-employed / business owner'] } },
        { name: 'employerPhone', label: 'Employer phone number', type: 'tel', required: true, half: true, showIf: { name: 'occupation', is: ['Employed', 'Self-employed / business owner'] } },
        { name: 'supervisor', label: 'Your manager’s name', type: 'text', half: true, showIf: { name: 'occupation', is: 'Employed' } },
        { name: 'school', label: 'School, college or university', type: 'text', required: true, showIf: { name: 'occupation', is: 'Student' } },
        { name: 'occupationOther', label: 'Please describe', type: 'text', required: true, showIf: { name: 'occupation', is: 'Other' } },
        { name: 'previousJobs', type: 'repeat', label: 'Previous jobs in the last 5 years (optional)', addLabel: 'Add a previous job', max: 5, fields: [
          { name: 'employer', label: 'Employer', type: 'text', required: true },
          { name: 'jobTitle', label: 'Job title', type: 'text', required: true },
          { name: 'from', label: 'From', type: 'date', required: true },
          { name: 'to', label: 'To', type: 'date', required: true },
        ] },
        { name: 'education', label: 'Highest level of education', type: 'select', required: true, options: ['Secondary school', 'College / A levels', 'Bachelor’s degree', 'Master’s degree', 'Doctorate (PhD)', 'Other'] },
        { name: 'educationInstitution', label: 'Where did you study? (optional)', type: 'text' },
      ],
    },
    {
      id: 'family',
      title: 'Family',
      fields: [
        { name: 'maritalStatus', label: 'Marital status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Separated', 'Widowed', 'Civil partnership', 'Other'] },
        { name: 'spouseName', label: 'Spouse or partner’s full name', type: 'text', required: true, half: true, showIf: { name: 'maritalStatus', is: ['Married', 'Civil partnership', 'Separated'] } },
        { name: 'spouseNationality', label: 'Their nationality', type: 'country', required: true, half: true, showIf: { name: 'maritalStatus', is: ['Married', 'Civil partnership', 'Separated'] } },
        { name: 'spouseDob', label: 'Their date of birth', type: 'date', required: true, half: true, showIf: { name: 'maritalStatus', is: ['Married', 'Civil partnership', 'Separated'] } },
        { name: 'spouseOccupation', label: 'Their occupation', type: 'text', half: true, showIf: { name: 'maritalStatus', is: ['Married', 'Civil partnership', 'Separated'] } },
        { name: 'spouseBirthPlace', label: 'Their city and country of birth', type: 'text', required: true, showIf: { name: 'maritalStatus', is: ['Married', 'Civil partnership', 'Separated'] } },
        { name: 'fatherName', label: 'Father’s full name', type: 'text', required: true, half: true },
        { name: 'fatherNationality', label: 'Father’s nationality', type: 'country', required: true, half: true },
        { name: 'fatherDob', label: 'Father’s date of birth', type: 'date', half: true, hint: 'If not known, leave blank.' },
        { name: 'motherName', label: 'Mother’s full name', type: 'text', required: true, half: true },
        { name: 'motherNationality', label: 'Mother’s nationality', type: 'country', required: true, half: true },
        { name: 'motherDob', label: 'Mother’s date of birth', type: 'date', half: true, hint: 'If not known, leave blank.' },
        { name: 'children', type: 'repeat', label: 'Children (optional)', addLabel: 'Add a child', max: 8, fields: [
          { name: 'name', label: 'Full name', type: 'text', required: true },
          { name: 'nationality', label: 'Nationality', type: 'country', required: true },
          { name: 'dob', label: 'Date of birth', type: 'date', required: true },
        ] },
        yesNo('relativesInChina', 'Do you have any immediate relatives in China?'),
        details('relativesInChinaDetails', 'relativesInChina', 'Their names, relationship to you and status in China'),
        { name: 'emergencyName', label: 'Emergency contact name', type: 'text', required: true, half: true },
        { name: 'emergencyRelation', label: 'Relationship to you', type: 'text', required: true, half: true },
        { name: 'emergencyPhone', label: 'Emergency contact phone', type: 'tel', required: true, half: true },
      ],
    },
    contactStep(),
    {
      id: 'history',
      title: 'Travel history',
      fields: [
        yesNo('beenToChina', 'Have you been to China before?'),
        { name: 'lastChinaVisit', label: 'Date of your last visit', type: 'date', required: true, half: true, showIf: { name: 'beenToChina', is: 'Yes' } },
        yesNo('hadChinaVisa', 'Have you had a Chinese visa before?'),
        { name: 'lastChinaVisaDate', label: 'Date your last Chinese visa was issued', type: 'date', required: true, half: true, showIf: { name: 'hadChinaVisa', is: 'Yes' } },
        { name: 'lastChinaVisaNumber', label: 'Visa number (optional)', type: 'text', half: true, showIf: { name: 'hadChinaVisa', is: 'Yes' } },
        yesNo('fingerprints', 'Have your fingerprints been taken for a Chinese visa before?'),
        yesNo('chinaRefused', 'Have you ever been refused a Chinese visa, or refused entry to China?'),
        details('chinaRefusedDetails', 'chinaRefused'),
        yesNo('visaCancelled', 'Has a Chinese visa of yours ever been cancelled?'),
        details('visaCancelledDetails', 'visaCancelled'),
        yesNo('illegalStay', 'Have you ever entered or stayed in China illegally, or overstayed?'),
        details('illegalStayDetails', 'illegalStay'),
        { name: 'countriesLastYear', label: 'Countries you’ve visited in the last 12 months', type: 'textarea', hint: 'Leave blank if none.' },
        yesNo('otherVisasRefused', 'Have you been refused a visa or entry to any other country in the last 10 years?'),
        details('otherVisasRefusedDetails', 'otherVisasRefused'),
      ],
    },
    {
      id: 'declarations',
      title: 'A few more questions',
      intro: 'The Chinese visa form asks every applicant these questions. Most people answer No to all of them.',
      fields: [
        yesNo('criminalRecord', 'Do you have a criminal record in China or any other country?'),
        details('criminalRecordDetails', 'criminalRecord'),
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
        yesNo('ngo', 'Have you ever worked for, or been involved with, any professional, social or charitable organisation?'),
        details('ngoDetails', 'ngo', 'Organisation name and your role'),
        { name: 'anythingElse', label: 'Anything else we should know? (optional)', type: 'textarea' },
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
    { name: 'doc6', label: 'Copy of your previous Chinese visa', showIf: { name: 'hadChinaVisa', is: 'Yes' } },
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

const india = {
  slug: 'india-visa',
  title: 'India eVisa application',
  country: 'India',
  code: 'IN',
  pageUrl: '/indian-visa-application-uk/',
  description: 'Apply for your Indian eVisa online. Upload your passport and we’ll fill in your details, then answer the questions the Indian form asks.',
  minutes: 20,
  steps: [
    passportStep([
      yesNo('changedName', 'Have you ever changed your name?'),
      { name: 'previousName', label: 'Previous surname and given names', type: 'text', required: true, showIf: { name: 'changedName', is: 'Yes' } },
      { name: 'religion', label: 'Religion', type: 'select', required: true, options: ['Bahai', 'Buddhism', 'Christian', 'Hindu', 'Islam', 'Jainism', 'Judaism', 'Parsi', 'Sikh', 'Zoroastrian', 'Other', 'None'], hint: 'The Indian eVisa form asks every applicant this.' },
      { name: 'identityMarks', label: 'Visible identification marks', type: 'text', required: true, hint: 'For example a scar or mole. Write "None" if you have none.' },
      { name: 'education', label: 'Educational qualification', type: 'select', required: true, options: ['Below matriculation', 'Matriculation / GCSE', 'Higher secondary / A levels', 'Graduate', 'Post graduate', 'Doctorate', 'Professional', 'Other'] },
      { name: 'nationalityBy', label: 'Did you get your nationality by birth or naturalisation?', type: 'radio', required: true, options: ['By birth', 'By naturalisation'] },
      { name: 'previousNationality', label: 'Previous nationality', type: 'country', required: true, showIf: { name: 'nationalityBy', is: 'By naturalisation' } },
      yesNo('livedTwoYears', 'Have you lived in the UK for at least 2 years?'),
      { name: 'nationalId', label: 'National ID number (optional)', type: 'text' },
      yesNo('otherPassport', 'Do you have any other valid passport or identity certificate?'),
      { name: 'otherPassportDetails', label: 'Country, number, date and place of issue', type: 'textarea', required: true, showIf: { name: 'otherPassport', is: 'Yes' } },
    ]),
    {
      id: 'visa',
      title: 'Your visa and trip',
      fields: [
        { name: 'visaType', label: 'Which eVisa do you need?', type: 'select', required: true, options: ['e-Tourist visa (30 days)', 'e-Tourist visa (1 year)', 'e-Tourist visa (5 years)', 'e-Business visa', 'e-Medical visa', 'e-Medical Attendant visa', 'e-Conference visa'] },
        { name: 'arrivalDate', label: 'Expected date of arrival', type: 'date', required: true, half: true },
        { name: 'portArrival', label: 'Airport or port where you’ll arrive', type: 'select', required: true, options: indiaAirports, half: true },
        { name: 'portExit', label: 'Expected airport or port of exit', type: 'select', required: true, options: indiaAirports, half: true },
        { name: 'placesToVisit', label: 'Places you plan to visit', type: 'text', required: true },
        { name: 'stayAddress', label: 'Hotel or address where you’ll stay', type: 'textarea', required: true },
        { name: 'businessCompany', label: 'Name of the Indian company or organisation', type: 'text', required: true, showIf: { name: 'visaType', is: ['e-Business visa', 'e-Conference visa'] } },
        { name: 'businessAddress', label: 'Their address in India', type: 'textarea', required: true, showIf: { name: 'visaType', is: ['e-Business visa', 'e-Conference visa'] } },
        { name: 'businessPhone', label: 'Their phone number', type: 'tel', required: true, half: true, showIf: { name: 'visaType', is: ['e-Business visa', 'e-Conference visa'] } },
        { name: 'businessWebsite', label: 'Their website (optional)', type: 'text', half: true, showIf: { name: 'visaType', is: ['e-Business visa', 'e-Conference visa'] } },
        { name: 'hospital', label: 'Name and address of the hospital in India', type: 'textarea', required: true, showIf: { name: 'visaType', is: ['e-Medical visa', 'e-Medical Attendant visa'] } },
        { name: 'patientName', label: 'Name of the patient you’re accompanying', type: 'text', required: true, showIf: { name: 'visaType', is: 'e-Medical Attendant visa' } },
      ],
    },
    contactStep([
      yesNo('permanentSame', 'Is your permanent address the same as your present address?', { default: 'Yes' }),
      { name: 'permanentAddress', label: 'Permanent address', type: 'textarea', required: true, showIf: { name: 'permanentSame', is: 'No' } },
    ]),
    {
      id: 'family',
      title: 'Family',
      fields: [
        { name: 'fatherName', label: 'Father’s full name', type: 'text', required: true },
        { name: 'fatherNationality', label: 'Father’s nationality', type: 'country', required: true, half: true },
        { name: 'fatherPrevNationality', label: 'Father’s previous nationality (optional)', type: 'country', half: true },
        { name: 'fatherBirthPlace', label: 'Father’s place of birth', type: 'text', required: true, half: true },
        { name: 'fatherBirthCountry', label: 'Father’s country of birth', type: 'country', required: true, half: true },
        { name: 'motherName', label: 'Mother’s full name', type: 'text', required: true },
        { name: 'motherNationality', label: 'Mother’s nationality', type: 'country', required: true, half: true },
        { name: 'motherPrevNationality', label: 'Mother’s previous nationality (optional)', type: 'country', half: true },
        { name: 'motherBirthPlace', label: 'Mother’s place of birth', type: 'text', required: true, half: true },
        { name: 'motherBirthCountry', label: 'Mother’s country of birth', type: 'country', required: true, half: true },
        { name: 'maritalStatus', label: 'Marital status', type: 'radio', required: true, options: ['Single', 'Married'] },
        { name: 'spouseName', label: 'Spouse’s full name', type: 'text', required: true, showIf: { name: 'maritalStatus', is: 'Married' } },
        { name: 'spouseNationality', label: 'Spouse’s nationality', type: 'country', required: true, half: true, showIf: { name: 'maritalStatus', is: 'Married' } },
        { name: 'spousePrevNationality', label: 'Spouse’s previous nationality (optional)', type: 'country', half: true, showIf: { name: 'maritalStatus', is: 'Married' } },
        { name: 'spouseBirthPlace', label: 'Spouse’s place of birth', type: 'text', required: true, half: true, showIf: { name: 'maritalStatus', is: 'Married' } },
        { name: 'spouseBirthCountry', label: 'Spouse’s country of birth', type: 'country', required: true, half: true, showIf: { name: 'maritalStatus', is: 'Married' } },
        yesNo('pakistanHeritage', 'Were your grandparents (paternal or maternal) Pakistan nationals, or did they belong to an area now in Pakistan?'),
        details('pakistanHeritageDetails', 'pakistanHeritage'),
      ],
    },
    {
      id: 'work',
      title: 'Your work',
      fields: [
        { name: 'occupation', label: 'Present occupation', type: 'select', required: true, options: ['Employed (private sector)', 'Employed (government)', 'Self-employed / business', 'Student', 'Housewife / homemaker', 'Retired', 'Not working', 'Other'] },
        { name: 'employer', label: 'Employer or business name', type: 'text', required: true, half: true, showIf: { name: 'occupation', is: ['Employed (private sector)', 'Employed (government)', 'Self-employed / business'] } },
        { name: 'designation', label: 'Your job title', type: 'text', required: true, half: true, showIf: { name: 'occupation', is: ['Employed (private sector)', 'Employed (government)', 'Self-employed / business'] } },
        { name: 'employerAddress', label: 'Employer address', type: 'textarea', required: true, showIf: { name: 'occupation', is: ['Employed (private sector)', 'Employed (government)', 'Self-employed / business'] } },
        { name: 'employerPhone', label: 'Employer phone', type: 'tel', half: true, showIf: { name: 'occupation', is: ['Employed (private sector)', 'Employed (government)', 'Self-employed / business'] } },
        { name: 'spouseOrParentOccupation', label: 'Occupation of your spouse or parent', type: 'text', required: true, showIf: { name: 'occupation', is: ['Student', 'Housewife / homemaker', 'Not working'] }, hint: 'The Indian form asks for this when you aren’t working.' },
        { name: 'pastOccupation', label: 'Past occupation (optional)', type: 'text' },
        yesNo('military', 'Have you served in the military, police, intelligence or a similar organisation?'),
        { name: 'militaryDetails', label: 'Organisation, job title, rank and place of posting', type: 'textarea', required: true, showIf: { name: 'military', is: 'Yes' } },
      ],
    },
    {
      id: 'history',
      title: 'Previous visits and references',
      fields: [
        yesNo('visitedIndia', 'Have you visited India before?'),
        { name: 'prevIndiaAddress', label: 'Address where you stayed', type: 'textarea', required: true, showIf: { name: 'visitedIndia', is: 'Yes' } },
        { name: 'prevIndiaCities', label: 'Cities you visited', type: 'text', required: true, showIf: { name: 'visitedIndia', is: 'Yes' } },
        { name: 'prevVisaNumber', label: 'Last Indian visa number', type: 'text', required: true, half: true, showIf: { name: 'visitedIndia', is: 'Yes' } },
        { name: 'prevVisaType', label: 'Type of visa', type: 'text', required: true, half: true, showIf: { name: 'visitedIndia', is: 'Yes' } },
        { name: 'prevVisaPlace', label: 'Place of issue', type: 'text', required: true, half: true, showIf: { name: 'visitedIndia', is: 'Yes' } },
        { name: 'prevVisaDate', label: 'Date of issue', type: 'date', required: true, half: true, showIf: { name: 'visitedIndia', is: 'Yes' } },
        yesNo('refusedIndia', 'Have you ever been refused a visa for India, or an extension of one?'),
        details('refusedIndiaDetails', 'refusedIndia', 'When, and the reference number if you have it'),
        { name: 'countries10Years', label: 'Countries you’ve visited in the last 10 years', type: 'textarea', required: true, hint: 'The Indian form asks for this. Write "None" if none.' },
        yesNo('saarc', 'Have you visited any SAARC country (Afghanistan, Bangladesh, Bhutan, Maldives, Nepal, Pakistan, Sri Lanka) in the last 3 years?'),
        { name: 'saarcVisits', type: 'repeat', label: 'SAARC country visits', addLabel: 'Add another visit', max: 8, showIf: { name: 'saarc', is: 'Yes' }, fields: [
          { name: 'country', label: 'Country', type: 'select', required: true, options: ['Afghanistan', 'Bangladesh', 'Bhutan', 'Maldives', 'Nepal', 'Pakistan', 'Sri Lanka'] },
          { name: 'year', label: 'Year', type: 'number', required: true },
          { name: 'visits', label: 'Number of visits', type: 'number', required: true },
        ] },
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
        { name: 'anythingElse', label: 'Anything else we should know? (optional)', type: 'textarea' },
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
  },
  uploads: [
    { name: 'photo', label: 'Passport-style photo', hint: 'Square colour photo, plain white background, face centred, no glasses.', required: true },
    ...byVisa('doc1', {
      'e-Business visa': { label: 'Your business card', hint: 'A photo or scan of the front.', required: true },
      'e-Medical visa': { label: 'Letter from the hospital in India', hint: 'On the hospital’s letterhead, confirming your treatment.', required: true },
      'e-Medical Attendant visa': { label: 'Copy of the patient’s e-Medical visa', required: true },
      'e-Conference visa': { label: 'Conference invitation letter', required: true },
    }),
    ...byVisa('doc2', {
      'e-Business visa': { label: 'Invitation letter from the Indian company', hint: 'On their letterhead, with their address and contact details.', required: true },
      'e-Medical Attendant visa': { label: 'Letter from the hospital in India', required: true },
      'e-Conference visa': { label: 'Event or political clearance (if you have it)', hint: 'Usually provided by the conference organiser.' },
    }),
    { name: 'doc3', label: 'Your UK visa, BRP or eVisa share code page', hint: 'Because you’re not a British citizen.', showIf: { name: 'nationality', isNot: 'United Kingdom' } },
    { name: 'doc4', label: 'Flight booking (optional)' },
    { name: 'doc5', label: 'Hotel booking (optional)' },
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

export const applications = [china, india, sriLanka];
export const applicationBySlug = Object.fromEntries(applications.map((a) => [a.slug, a]));
export const declaration = declarationNote;
export const FILE_SLOTS = ['passport', 'photo', 'doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6', 'doc7', 'doc8'];
