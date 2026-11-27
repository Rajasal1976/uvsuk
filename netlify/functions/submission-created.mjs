// Sends the client a "thank you, we've received your application" email.
//
// Netlify runs this automatically every time a form is submitted (the file name
// "submission-created" is what tells Netlify to do that). Spam is filtered out first.
//
// Emails are sent through your Zoho mailbox. In Netlify go to
// Site configuration > Environment variables and add:
//   ZOHO_SMTP_USER   your Zoho address, e.g. hello@uvsuk.com
//   ZOHO_SMTP_PASS   an app password made in Zoho (not your normal password)
//   ZOHO_SMTP_HOST   optional: smtp.zoho.com (default) or smtp.zoho.eu if your Zoho account is on zoho.eu
// Until those are set, nothing is sent and forms work exactly as before.
//
// Which forms send an email: the online application forms and client forms (anything with
// a reference number). The contact form doesn't.
import nodemailer from 'nodemailer';
import { connectLambda } from '@netlify/blobs';
import settings from '../../content/settings.json' with { type: 'json' };
import { officeStore, secretStore, getRecord, saveRecord, recordFromSubmission, groupRef } from '../office/store.mjs';
import { applicationAlert } from '../office/notify.mjs';
import { ingestToken } from '../office/auth.mjs';

const SITE = 'https://www.uvsuk.co.uk';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Pull a numbered list out of the summary the form sends, e.g. the "DOCUMENTS ATTACHED" section.
function section(summary, heading) {
  const lines = String(summary || '').split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) return [];
  const out = [];
  for (const l of lines.slice(start + 1)) {
    if (/^[A-Z][A-Z ]{3,}$/.test(l.trim())) break; // next heading
    const m = l.match(/^\d+\.\s+(.+)/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

export function buildEmail(data) {
  const reference = String(data.reference || '').trim();
  const name = String(data.applicant_name || '').trim();
  // Names read from passports are in capitals: "HENOK" -> "Henok"
  const first = (name.split(/\s+/)[0] || '').toLowerCase().replace(/(^|[-'])\p{L}/gu, (c) => c.toUpperCase());
  const subjectLine = String(data.subject || '');
  const title = subjectLine.includes(':') ? subjectLine.split(':')[0].trim() : 'Application';
  // "Document legalisation request" -> "document legalisation request", but keep "China visa application"
  const formTitle = /^(Document|Second|Transfer|Online|Application|Client)\b/.test(title) ? title.charAt(0).toLowerCase() + title.slice(1) : title;
  const groupRef = (String(data.summary || '').match(/Group reference: (\S+)/) || [])[1] || '';
  const ref = groupRef || reference;
  const sent = section(data.summary, 'DOCUMENTS ATTACHED');
  const missing = section(data.summary, 'DOCUMENTS STILL TO SEND');
  const phone = settings.phone || '0161 956 2003';
  const email = settings.email || 'hello@uvsuk.com';
  const address = [settings.addressLine1, settings.city, settings.postcode].filter(Boolean).join(', ');
  const hours = settings.hours || '';

  const subject = `We've received your ${formTitle} (${ref})`;
  const text = [
    `Dear ${first || 'client'},`,
    '',
    `Thank you for sending your ${formTitle} to Unique Visa Services. We've received it safely.`,
    '',
    `Your reference: ${ref}`,
    groupRef ? 'This covers everyone on your application.' : '',
    '',
    'WHAT HAPPENS NEXT',
    'An adviser will check your application and documents and contact you within one working day about the next steps and our fee.',
    '',
    sent.length ? 'DOCUMENTS WE RECEIVED' : '',
    ...sent.map((d) => `- ${d}`),
    sent.length ? '' : '',
    missing.length ? 'STILL TO SEND (IF YOU HAVE THEM)' : '',
    ...missing.map((d) => `- ${d}`),
    missing.length ? 'You can reply to this email with these, quoting your reference.' : '',
    missing.length ? '' : '',
    'Any questions? Just reply to this email, or call us.',
    '',
    'Kind regards,',
    'Unique Visa Services',
    `${phone} | ${email} | ${SITE.replace('https://', '')}`,
    address,
    hours ? `Office hours: ${hours}` : '',
    '',
    'Unique Visa Services is a private visa agency, regulated by the Immigration Advice Authority (ref F200700144). We are not an embassy or government office.',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

  const li = (items) => `<ul style="margin:6px 0 16px;padding-left:20px">${items.map((d) => `<li style="margin:3px 0">${esc(d)}</li>`).join('')}</ul>`;
  const html = `<!doctype html><html><body style="margin:0;background:#F4F7F5;font-family:Arial,Helvetica,sans-serif;color:#1F2A24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:#14532D;padding:20px 28px;color:#fff;font-size:20px;font-weight:bold">Unique Visa Services</td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.55">
<p style="margin:0 0 14px">Dear ${esc(first || 'client')},</p>
<p style="margin:0 0 14px">Thank you for sending your ${esc(formTitle)} to Unique Visa Services. We've received it safely.</p>
<p style="margin:0 0 18px;padding:14px 16px;background:#FFF8E8;border-left:4px solid #C9A227;border-radius:6px">Your reference: <strong>${esc(ref)}</strong>${groupRef ? '<br><span style="font-size:14px">This covers everyone on your application.</span>' : ''}</p>
<h2 style="font-size:17px;color:#14532D;margin:0 0 6px">What happens next</h2>
<p style="margin:0 0 16px">An adviser will check your application and documents and contact you <strong>within one working day</strong> about the next steps and our fee.</p>
${sent.length ? `<h2 style="font-size:17px;color:#14532D;margin:0 0 4px">Documents we received</h2>${li(sent)}` : ''}
${missing.length ? `<h2 style="font-size:17px;color:#14532D;margin:0 0 4px">Still to send (if you have them)</h2>${li(missing)}<p style="margin:0 0 16px">You can reply to this email with these, quoting your reference.</p>` : ''}
<p style="margin:0 0 16px">Any questions? Just reply to this email, or call us on <a href="tel:${esc(phone.replace(/\s/g, ''))}" style="color:#14532D">${esc(phone)}</a>.</p>
<p style="margin:0">Kind regards,<br><strong>Unique Visa Services</strong></p>
</td></tr>
<tr><td style="padding:18px 28px;background:#F7FBF8;font-size:13px;color:#4A5A51;line-height:1.5">
${esc(phone)} · <a href="mailto:${esc(email)}" style="color:#14532D">${esc(email)}</a> · <a href="${SITE}" style="color:#14532D">uvsuk.co.uk</a><br>
${esc(address)}${hours ? `<br>Office hours: ${esc(hours)}` : ''}<br><br>
Unique Visa Services is a private visa agency, regulated by the Immigration Advice Authority (ref F200700144). We are not an embassy or government office.
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

// Only the first submission of each application gets an email: big applications arrive in
// several parts, and group applications as one submission per person.
export function shouldSend(data) {
  if (!data || !data.reference || !data.email) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) return false;
  if (/documents part (\d+) of/i.test(data.subject || '') && !/documents part 1 of/i.test(data.subject || '')) return false;
  if (/-P(\d+)$/.test(data.reference) && !/-P1$/.test(data.reference)) return false;
  return true;
}

// Submissions made on a test copy of the site (deploy-preview-1--uvsuk.netlify.app) go to the test records.
export const isPreviewSubmission = (data) => { try { return new URL(String(data.referrer || '')).hostname.includes('--'); } catch { return false; } };

// Saves the application in the back office (/office/). Only applications with a reference;
// extra document parts are skipped, extra people are added to the same record.
// Netlify doesn't always give this function the database connection, so normally it hands the
// application to the back office function (/office/api/ingest), which has it.
async function saveToOffice(event, data) {
  if (!data.reference || /documents part (\d+) of/i.test(data.subject || '') && !/documents part 1 of/i.test(data.subject || '')) return;
  const preview = isPreviewSubmission(data);
  if (event.blobs) {
    connectLambda(event);
    const store = officeStore(preview);
    const existing = await getRecord(store, groupRef(data.reference));
    const saved = await saveRecord(store, recordFromSubmission(data, existing));
    if (!existing && !preview) await applicationAlert((await secretStore().get('settings', { type: 'json' }))?.diaryPeople || [], saved);
    return;
  }
  // Only ever send to this site: a test copy's own address, or the live site
  const previewOrigin = preview ? new URL(data.referrer).origin : '';
  const base = process.env.OFFICE_INGEST_URL || (/^https:\/\/[a-z0-9-]+--uvsuk\.netlify\.app$/.test(previewOrigin) ? previewOrigin : 'https://www.uvsuk.co.uk');
  const res = await fetch(`${base.replace(/\/$/, '')}/office/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Office': '1', 'X-Office-Ingest': ingestToken() },
    body: JSON.stringify({ data, preview }),
  });
  if (!res.ok) throw new Error(`back office answered ${res.status}: ${await res.text()}`);
}

export const handler = async (event) => {
  let data = {};
  try {
    const payload = JSON.parse(event.body || '{}')?.payload || {};
    data = payload.data || {};
    await saveToOffice(event, data);
  } catch (e) {
    console.error('Saving to the back office failed:', e.message);
  }
  try {
    if (!shouldSend(data)) return { statusCode: 200, body: 'No email needed' };
    const user = process.env.ZOHO_SMTP_USER, pass = process.env.ZOHO_SMTP_PASS;
    if (!user || !pass) { console.log('Client email not sent: ZOHO_SMTP_USER / ZOHO_SMTP_PASS not set in Netlify'); return { statusCode: 200, body: 'Email not set up' }; }
    const transport = nodemailer.createTransport({ host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com', port: 465, secure: true, auth: { user, pass } });
    const { subject, text, html } = buildEmail(data);
    await transport.sendMail({ from: `"Unique Visa Services" <${user}>`, replyTo: settings.email || user, to: String(data.email).trim(), subject, text, html });
    console.log(`Client email sent for ${data.reference}`);
    return { statusCode: 200, body: 'Sent' };
  } catch (e) {
    // Never block the submission itself: it's already saved in Netlify
    console.error('Client email failed:', e.message);
    return { statusCode: 200, body: 'Email failed' };
  }
};
