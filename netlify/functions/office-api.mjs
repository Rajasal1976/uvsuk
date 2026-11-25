// The back office (/office/) talks to this function. Everything except signing in needs the
// sign-in cookie (see netlify/office/auth.mjs). Records are kept in Netlify Blobs (netlify/office/store.mjs).
import nodemailer from 'nodemailer';
import settingsJson from '../../content/settings.json' with { type: 'json' };
import { officeStore, secretStore, readIndex, getRecord, saveRecord, rebuildIndex, applyPatch, manualRecord, STATUSES, recordFromSubmission, groupRef } from '../office/store.mjs';
import { checkPassword, passwordSet, sessionCookie, clearCookie, signedIn, tooManyTries, ingestAllowed } from '../office/auth.mjs';
import { COMPANIES, validateInvoice, createInvoice, connection, keysSet, waveCatalogue, disconnect } from '../office/accounts.mjs';

export const config = { path: '/office/api/*' };

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
const fail = (message, status = 400) => json({ error: message }, status);

const DEFAULT_SETTINGS = { paymentTermsDays: 0, waveProductMain: '', waveProductOther: '', waveVatTaxId: '', reminderDays: 90, tvhFeeVat: 0, uvsFeeVat: 0 };
const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...((await secretStore().get('settings', { type: 'json' })) || {}) });

export default async (req, context) => {
  const preview = context?.deploy?.context && context.deploy.context !== 'production';
  const store = officeStore(preview);
  const action = new URL(req.url).pathname.replace(/^\/office\/api\/?/, '').replace(/\/$/, '');

  // Requests that change something must come from the back office page itself
  if (req.method === 'POST' && req.headers.get('x-office') !== '1') return fail('Not allowed', 403);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

  if (action === 'login' && req.method === 'POST') {
    if (!passwordSet()) return fail('The back office password hasn’t been set yet. Add OFFICE_PASSWORD (at least 8 characters) in Netlify › Site configuration › Environment variables, then redeploy.', 503);
    const guard = await tooManyTries(store, context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown');
    if (guard.locked) return fail('Too many wrong passwords. Please wait 15 minutes and try again.', 429);
    if (!checkPassword(body.password)) { await guard.fail(); return fail('That password isn’t right.', 401); }
    await guard.clear();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie() });
  }
  // A new application from the website forms (sent by submission-created.mjs)
  if (action === 'ingest' && req.method === 'POST') {
    if (!ingestAllowed(req)) return fail('Not allowed', 403);
    const data = body.data || {};
    if (!data.reference) return fail('No reference');
    const target = officeStore(!!body.preview);
    const existing = await getRecord(target, groupRef(data.reference));
    const saved = await saveRecord(target, recordFromSubmission(data, existing));
    return json({ ok: true, ref: saved.ref });
  }
  if (action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });

  if (!signedIn(req)) return fail('Please sign in.', 401);

  try {
    switch (action) {
      case 'me': {
        const [fa, wave] = await Promise.all([connection('freeagent'), connection('wave')]);
        return json({ ok: true, preview, statuses: STATUSES, companies: COMPANIES, connections: { freeagent: { ...fa, keys: keysSet('freeagent') }, wave: { ...wave, keys: keysSet('wave') } }, settings: await getSettings() });
      }
      case 'apps': return json({ apps: await readIndex(store) });
      case 'app': {
        const a = await getRecord(store, new URL(req.url).searchParams.get('ref'));
        return a ? json({ app: a }) : fail('Record not found', 404);
      }
      case 'update': {
        const a = await getRecord(store, body.ref);
        if (!a) return fail('Record not found', 404);
        return json({ app: await saveRecord(store, applyPatch(a, body.patch)) });
      }
      case 'create': {
        if (!String(body.name || '').trim()) return fail('Enter the client’s name.');
        return json({ app: await saveRecord(store, manualRecord(body)) });
      }
      case 'invoice': {
        const a = await getRecord(store, body.ref);
        if (!a) return fail('Record not found', 404);
        const inv = validateInvoice({ ...body.invoice, reference: a.ref });
        const made = await createInvoice(inv, await getSettings());
        a.invoices = [...(a.invoices || []), { ...made, company: inv.company, app: COMPANIES[inv.company].app, at: new Date().toISOString(), billedTo: inv.billTo.name, lines: inv.lines, test: !!preview }];
        a.notes = [{ at: new Date().toISOString(), text: `Invoice ${made.number || ''} ${made.status === 'sent' ? 'emailed to ' + inv.billTo.email : made.status === 'marked sent' ? 'saved and marked as sent (not emailed)' : 'saved as a draft'} in ${COMPANIES[inv.company].appName} (£${made.total.toFixed(2)}).`.replace(/\s+/g, ' ') }, ...(a.notes || [])];
        return json({ app: await saveRecord(store, a), invoice: made });
      }
      case 'remind-email': {
        const a = await getRecord(store, body.ref);
        if (!a) return fail('Record not found', 404);
        if (!a.email || !a.visaExpiry) return fail('This record needs an email address and a visa expiry date.');
        await sendExpiryEmail(a);
        a.expiryReminded = new Date().toISOString();
        a.notes = [{ at: a.expiryReminded, text: `Visa expiry reminder emailed to ${a.email}.` }, ...(a.notes || [])];
        return json({ app: await saveRecord(store, a) });
      }
      case 'settings': {
        const s = { ...(await getSettings()) };
        const n = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
        if ('paymentTermsDays' in body) s.paymentTermsDays = n(body.paymentTermsDays, 120);
        if ('reminderDays' in body) s.reminderDays = n(body.reminderDays, 365) || 90;
        for (const k of ['tvhFeeVat', 'uvsFeeVat']) if (k in body) s[k] = [0, 20].includes(Number(body[k])) ? Number(body[k]) : 0;
        for (const k of ['waveProductMain', 'waveProductOther', 'waveVatTaxId']) if (k in body) s[k] = String(body[k] || '').slice(0, 200);
        await secretStore().setJSON('settings', s);
        return json({ settings: s });
      }
      case 'wave-catalogue': return json(await waveCatalogue());
      case 'disconnect': {
        if (!['freeagent', 'wave'].includes(body.app)) return fail('Unknown app');
        await disconnect(body.app);
        return json({ ok: true });
      }
      case 'rebuild': return json({ count: await rebuildIndex(store) });
      default: return fail('Unknown request', 404);
    }
  } catch (e) {
    console.error(`office-api ${action}:`, e.message);
    return fail(e.message || 'Something went wrong', e.status || 502);
  }
};

async function sendExpiryEmail(a) {
  const user = process.env.ZOHO_SMTP_USER, pass = process.env.ZOHO_SMTP_PASS;
  if (!user || !pass) throw new Error('Email isn’t set up: add ZOHO_SMTP_USER and ZOHO_SMTP_PASS in Netlify.');
  const first = String(a.name || '').split(/\s+/)[0].toLowerCase().replace(/(^|[-'])\p{L}/gu, (c) => c.toUpperCase());
  const date = new Date(`${a.visaExpiry}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const phone = settingsJson.phone || '0161 956 2003', email = settingsJson.email || 'hello@uvsuk.com';
  const text = [`Dear ${first || 'client'},`, '', `Our records show that your ${a.service || 'visa'} expires on ${date}.`, '', 'If you need to extend it, switch to another visa or apply for settlement, it’s best to start early so there’s time to gather your documents. We’d be happy to help.', '', `Just reply to this email or call us on ${phone} to book a time.`, '', 'Kind regards,', 'Unique Visa Services', `${phone} | ${email} | uvsuk.co.uk`, '', 'You’re receiving this because we helped you with your visa. If you’d rather not get reminders, reply with "no reminders" and we’ll remove you.'].join('\n');
  const transport = nodemailer.createTransport({ host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com', port: 465, secure: true, auth: { user, pass } });
  await transport.sendMail({ from: `"Unique Visa Services" <${user}>`, replyTo: email, to: a.email, subject: `Your visa expires on ${date}`, text });
}
