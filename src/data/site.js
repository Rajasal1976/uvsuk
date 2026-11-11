// Business details. Everyday details (phone, email, hours, review numbers...) are edited in the
// admin under "Business details" and stored in content/settings.json.
import s from '../../content/settings.json';

// "0161 956 2003" -> "+441619562003" for tap-to-call links
const intl = (phone) => { const d = phone.replace(/\D/g, ''); return d.startsWith('0') ? `+44${d.slice(1)}` : `+${d}`; };

export const site = {
  name: 'Unique Visa Services',
  legalName: 'Unique Visa Services Ltd',
  url: 'https://www.uvsuk.co.uk',
  phone: s.phone,
  phoneIntl: intl(s.phone),
  phoneLabel: s.phoneLabel || '',
  phone2: s.phone2 || '',
  phone2Intl: s.phone2 ? intl(s.phone2) : '',
  phone2Label: s.phone2Label || '',
  email: s.email,
  address: { line1: s.addressLine1, city: s.city, postcode: s.postcode },
  hours: s.hours,
  hoursSchema: s.hoursForGoogle,
  iaaRef: 'F200700144',
  iaaLevel: 'Level 1, Immigration', // your IAA authorisation level, shown in the footer
  iaaFinder: 'https://portal.immigrationadviceauthority.gov.uk/s/adviser-finder',
  since: 2008,
  yearsInPractice: s.yearsInPractice,
  applicationsHandled: s.applicationsHandled,
  googleRating: s.googleRating,
  googleReviewCount: s.googleReviewCount,
  googleReviewsUrl: s.googleReviewsUrl || '/contact-us/',
  trustpilotUrl: s.trustpilotUrl || '',
  trustpilotRating: s.trustpilotRating || '',
  trustpilotCount: s.trustpilotCount || '',
  companyNumber: s.companyNumber,
  bookingUrl: '/contact-us/',
  // Default image shown when a page is shared on WhatsApp/Facebook (Business details in the admin)
  shareImage: s.shareImage || '',
  // Passport return options for travel visas, and the single eVisa delivery charge (edited in the admin)
  delivery: s.delivery || [],
  evisaDelivery: s.evisaDelivery || '',
  // Social media links (edited in the admin under Business details). Empty ones are hidden.
  social: [
    ['Facebook', s.facebook], ['Instagram', s.instagram], ['LinkedIn', s.linkedin],
    ['X (Twitter)', s.x], ['TikTok', s.tiktok], ['YouTube', s.youtube], ['WhatsApp', s.whatsapp],
  ].filter(([, url]) => url && url.trim()).map(([name, url]) => ({ name, url: url.trim() })),
};
