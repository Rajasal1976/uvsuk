// Reads the two machine-readable lines at the bottom of a passport photo page (ICAO 9303, "TD3").
// Uses the check digits to fix common OCR mistakes (O/0, I/1, S/5, B/8 ...) and to confirm the result.

const WEIGHTS = [7, 3, 1];
const charValue = (c) => (c === '<' ? 0 : /\d/.test(c) ? +c : c.charCodeAt(0) - 55);
export const checkDigit = (s) => String([...s].reduce((sum, c, i) => sum + charValue(c) * WEIGHTS[i % 3], 0) % 10);

const TO_DIGIT = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', T: '1', Z: '2', S: '5', B: '8', G: '6', A: '4' };
const TO_ALPHA = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 8: 'B', 6: 'G', 4: 'A' };
const digits = (s) => [...s].map((c) => TO_DIGIT[c] ?? c).join('');
const alpha = (s) => [...s].map((c) => TO_ALPHA[c] ?? c).join('');

// Clean one OCR'd line: keep MRZ characters only, normalise look-alikes of "<".
function cleanLine(raw) {
  return raw
    .toUpperCase()
    .replace(/[«‹(\[{]/g, '<')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9<]/g, '');
}

// Find the two MRZ lines in OCR text.
export function findMrzLines(text) {
  const lines = text.split('\n').map(cleanLine).filter((l) => l.length >= 30);
  // Line 1 starts with P (passport); line 2 follows it.
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^P[A-Z<]/.test(lines[i]) && lines[i].includes('<')) return [lines[i], lines[i + 1]];
  }
  if (lines.length >= 2) return lines.slice(-2);
  return null;
}

const fit = (s) => (s + '<'.repeat(44)).slice(0, 44);

// Try to make a numeric field pass its check digit, fixing look-alike letters.
function fixField(value, check, { numeric }) {
  const v = numeric ? digits(value) : value;
  const c = digits(check);
  if (checkDigit(v) === c) return { value: v, ok: true };
  // passport numbers can contain letters: try swapping single look-alikes
  if (!numeric) {
    for (let i = 0; i < v.length; i++) {
      const alt = TO_DIGIT[v[i]] ?? TO_ALPHA[v[i]];
      if (!alt) continue;
      const t = v.slice(0, i) + alt + v.slice(i + 1);
      if (checkDigit(t) === c) return { value: t, ok: true };
    }
  }
  return { value: v, ok: false };
}

function toDate(yymmdd, { future }) {
  if (!/^\d{6}$/.test(yymmdd)) return '';
  const yy = +yymmdd.slice(0, 2), mm = yymmdd.slice(2, 4), dd = yymmdd.slice(4, 6);
  const nowYY = new Date().getFullYear() % 100;
  // Birth dates: assume 19xx if the 20xx year would be in the future. Expiry dates: 20xx.
  const century = future ? 2000 : yy > nowYY ? 1900 : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

const names = (s) => s.replace(/<+$/, '').split('<').filter(Boolean).join(' ');

// Some OCR runs read the "<" filler as "K". If a name ends in a run of K's, treat it as filler.
function fixFiller(line1) {
  return line1.replace(/K{3,}$/, (m) => '<'.repeat(m.length)).replace(/([A-Z])KK([A-Z])/g, '$1<<$2');
}

export function parseMrz(rawLine1, rawLine2) {
  const l1 = fit(fixFiller(rawLine1));
  const l2 = fit(rawLine2);

  const docNo = fixField(l2.slice(0, 9), l2[9], { numeric: false });
  const nationality = alpha(l2.slice(10, 13));
  const dob = fixField(l2.slice(13, 19), l2[19], { numeric: true });
  const sexRaw = l2[20];
  const expiry = fixField(l2.slice(21, 27), l2[27], { numeric: true });

  const issuer = alpha(l1.slice(2, 5));
  const nameField = alpha(l1.slice(5));
  const [surnamePart, givenPart = ''] = nameField.split('<<');

  const checks = { passportNumber: docNo.ok, dateOfBirth: dob.ok, expiry: expiry.ok };
  const okCount = Object.values(checks).filter(Boolean).length;
  const composite = checkDigit(docNo.value + digits(l2[9]) + l2.slice(10, 13) + dob.value + digits(l2[19]) + l2[20] + expiry.value + digits(l2[27]) + l2.slice(28, 43)) === digits(l2[43]);

  // Line 1 has no check digit, so judge how believable it looks.
  const nameOk = /^[A-Z]+(<[A-Z]+)*<<[A-Z]+(<[A-Z]+)*<*$/.test(nameField) || /^[A-Z]+(<[A-Z]+)*<*$/.test(nameField);
  const fillerTail = (nameField.match(/<+$/) || [''])[0].length;
  const line1Score = (l1[0] === 'P' ? 0.5 : 0) + (issuer.replace(/</g, '') === nationality.replace(/</g, '') ? 0.5 : 0) + (nameOk ? 1 : 0) + (fillerTail >= 3 ? 0.5 : 0);

  return {
    valid: okCount === 3 && nameOk,
    line2Valid: okCount === 3,
    nameOk,
    score: okCount * 2 + (composite ? 1 : 0) + line1Score,
    confidence: okCount / 3,
    checks,
    surname: names(surnamePart),
    givenNames: names(givenPart),
    passportNumber: docNo.value.replace(/<+$/, ''),
    nationality: nationality.replace(/</g, ''),
    issuingCountry: issuer.replace(/</g, ''),
    dateOfBirth: toDate(dob.value, { future: false }),
    sex: sexRaw === 'M' ? 'Male' : sexRaw === 'F' ? 'Female' : '',
    passportExpiry: toDate(expiry.value, { future: true }),
    raw: [l1, l2],
  };
}

// ICAO 3-letter codes → country names used in the forms (common ones; unknown codes fall back to the code).
export const COUNTRY_CODES = {
  GBR: 'United Kingdom', GBD: 'United Kingdom', GBN: 'United Kingdom', GBO: 'United Kingdom',
  IND: 'India', PAK: 'Pakistan', BGD: 'Bangladesh', LKA: 'Sri Lanka', CHN: 'China', NGA: 'Nigeria',
  GHA: 'Ghana', USA: 'United States', IRL: 'Ireland', FRA: 'France', DEU: 'Germany', D: 'Germany',
  ITA: 'Italy', ESP: 'Spain', PRT: 'Portugal', NLD: 'Netherlands', BEL: 'Belgium', POL: 'Poland',
  ROU: 'Romania', BGR: 'Bulgaria', GRC: 'Greece', TUR: 'Turkey', RUS: 'Russia', UKR: 'Ukraine',
  ZAF: 'South Africa', KEN: 'Kenya', UGA: 'Uganda', ZWE: 'Zimbabwe', EGY: 'Egypt', SAU: 'Saudi Arabia',
  ARE: 'United Arab Emirates', IRN: 'Iran', IRQ: 'Iraq', AFG: 'Afghanistan', NPL: 'Nepal', PHL: 'Philippines',
  MYS: 'Malaysia', SGP: 'Singapore', IDN: 'Indonesia', THA: 'Thailand', VNM: 'Vietnam', JPN: 'Japan',
  KOR: 'South Korea', HKG: 'Hong Kong', AUS: 'Australia', NZL: 'New Zealand', CAN: 'Canada', BRA: 'Brazil',
  MEX: 'Mexico', JAM: 'Jamaica', SOM: 'Somalia', ETH: 'Ethiopia', SDN: 'Sudan', ERI: 'Eritrea', MAR: 'Morocco',
  DZA: 'Algeria', TUN: 'Tunisia', LBY: 'Libya', SYR: 'Syria', JOR: 'Jordan', LBN: 'Lebanon', ISR: 'Israel',
};
export const countryName = (code) => COUNTRY_CODES[code] ?? code;
