// The back office (/office/) talks to this function. Everything except signing in needs the
// sign-in cookie (see netlify/office/auth.mjs). Records are kept in Netlify Blobs (netlify/office/store.mjs).
import nodemailer from 'nodemailer';
import settingsJson from '../../content/settings.json' with { type: 'json' };
import { officeStore, secretStore, readIndex, getRecord, saveRecord, rebuildIndex, applyPatch, manualRecord, STATUSES, recordFromSubmission, groupRef, dataFromOldSubmission } from '../office/store.mjs';
import { checkPassword, passwordSet, sessionCookie, clearCookie, signedIn, tooManyTries, ingestAllowed } from '../office/auth.mjs';
import { readList, addSubscribers, setStatus as setSubStatus, removeSubscriber, parseContacts, readCampaigns, createCampaign, sendBatch, sendTest, summary as campaignSummary, validEmail } from '../office/newsletter.mjs';
import { COMPANIES, validateInvoice, createInvoice, connection, keysSet, waveCatalogue, disconnect } from '../office/accounts.mjs';

export const config = { path: '/office/api/*' };

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
const fail = (message, status = 400) => json({ error: message }, status);

const DEFAULT_SETTINGS = { paymentTermsDays: 0, waveProductMain: '', waveProductOther: '', waveVatTaxId: '', reminderDays: 90, tvhFeeVat: 0, uvsFeeVat: 0, newsletterDailyLimit: 200 };
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
    if (/^yes/i.test(String(data.newsletter || '')) && validEmail(data.email)) await addSubscribers(target, [{ email: data.email, name: data.applicant_name }], 'form');
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
        if ('newsletterDailyLimit' in body) s.newsletterDailyLimit = n(body.newsletterDailyLimit, 2000) || 200;
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
      case 'import-forms': {
        // Needs a Netlify personal access token saved as NETLIFY_API_TOKEN
        const token = process.env.NETLIFY_API_TOKEN;
        const siteId = context?.site?.id || process.env.SITE_ID;
        if (!token) return fail('Add a Netlify personal access token as NETLIFY_API_TOKEN first (see the steps on this page), then try again.');
        if (!siteId) return fail('Couldn’t work out which Netlify site this is.');
        let added = 0, skipped = 0;
        const index = await readIndex(store);
        const known = new Set(index.map((x) => x.ref));
        for (let page = 1; page <= 20; page++) {
          const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/submissions?per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'UVS back office' } });
          if (!res.ok) return fail(`Netlify said ${res.status}${res.status === 401 ? ': the access token isn’t right' : ''}`, 502);
          const list = await res.json();
          for (const sub of list.slice().reverse()) {
            const d = dataFromOldSubmission(sub);
            if (!d.reference || (/documents part (\d+) of/i.test(d.subject || '') && !/documents part 1 of/i.test(d.subject || ''))) continue;
            const ref = groupRef(d.reference);
            const existing = known.has(ref) ? await getRecord(store, ref) : null;
            const name = String(d.applicant_name || '').trim();
            if (existing && (existing.people || []).includes(name)) { skipped++; continue; }
            const rec = recordFromSubmission(d, existing);
            if (!existing) { rec.received = sub.created_at || rec.received; rec.source = 'website'; added++; }
            await store.setJSON(`apps/${rec.ref}`, rec);
            known.add(rec.ref);
          }
          if (list.length < 100) break;
        }
        await rebuildIndex(store);
        return json({ added, skipped });
      }
      case 'newsletter': {
        const [list, campaigns] = await Promise.all([readList(store), readCampaigns(store)]);
        return json({ list, campaigns: campaigns.map(campaignSummary) });
      }
      case 'newsletter-add': {
        // body.people = [{name,email}] or body.text = pasted contacts; body.agreed must be true
        if (body.agreed !== true) return fail('Please confirm these people are clients or have agreed to hear from you.');
        const people = Array.isArray(body.people) ? body.people : parseContacts(body.text);
        if (!people.length) return fail('No email addresses found.');
        if (people.length > 5000) return fail('That’s a lot at once: please add up to 5,000 at a time.');
        return json(await addSubscribers(store, people, body.source === 'record' ? 'client record' : people.length > 1 ? 'imported' : 'added by hand'));
      }
      case 'newsletter-status': {
        if (!['subscribed', 'unsubscribed'].includes(body.status)) return fail('Unknown status');
        return json({ ok: await setSubStatus(store, body.email, body.status) });
      }
      case 'newsletter-remove': { await removeSubscriber(store, body.email); return json({ ok: true }); }
      case 'newsletter-test': {
        const to = process.env.ZOHO_SMTP_USER;
        if (!String(body.subject || '').trim() || String(body.body || '').trim().length < 20) return fail('Add a subject and write the newsletter first.');
        await sendTest({ subject: String(body.subject).slice(0, 200), body: String(body.body).slice(0, 50000) }, to, new URL(req.url).origin);
        return json({ ok: true, to });
      }
      case 'newsletter-create': return json({ campaign: campaignSummary(await createCampaign(store, body)) });
      case 'newsletter-batch': {
        const s = await getSettings();
        return json(await sendBatch(store, String(body.id || ''), { dailyLimit: Number(s.newsletterDailyLimit) || 200, origin: new URL(req.url).origin }));
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
