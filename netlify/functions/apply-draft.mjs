// "Save and finish later" for the online application forms.
//
// The client presses the button, gives their email, and we keep their answers and the documents
// they've added so far. We email them a private link (/apply/<form>/?resume=<code>) that brings it all
// back. Saved forms are kept for 30 days, then deleted (office-notify.mjs clears them out).
//
//   POST /apply-draft/start   { form, email }                    -> { token }
//   POST /apply-draft/file    ?t=<token>&k=<key>  (the file itself, with X-Name / X-Type headers)
//   POST /apply-draft/save    { token, email, form, formTitle, name, state }  -> saves and emails the link
//   GET  /apply-draft/load    ?t=<token>                         -> { form, state }
//   GET  /apply-draft/file    ?t=<token>&k=<key>                 -> the file
//   POST /apply-draft/delete  { token }                          (after the form is sent)
import { getStore } from '@netlify/blobs';
import nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import settings from '../../content/settings.json' with { type: 'json' };

export const config = { path: '/apply-draft/*' };

const SITE = 'https://www.uvsuk.co.uk';
const DAYS = 30;
const MAX_FILE = 6 * 1024 * 1024;
const MAX_TOTAL = 120 * 1024 * 1024;
const MAX_FILES = 120;
const store = () => getStore({ name: 'drafts', consistency: 'strong' });
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (msg, status = 400) => json({ error: msg }, status);
const okToken = (t) => /^[a-f0-9]{48}$/.test(String(t || ''));
const okKey = (k) => /^[a-z0-9]{8,40}$/.test(String(k || ''));
const okForm = (f) => /^[a-z0-9-]{2,60}$/.test(String(f || ''));
const okEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '')) && String(e).length <= 200;
const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function readDraft(s, token) {
  const d = await s.get(`d/${token}`, { type: 'json' });
  if (!d || d.expires < new Date().toISOString()) return null;
  return d;
}

// A few new saved forms per person per day is plenty; stops the button being used to send spam
async function tooMany(s, ip) {
  const key = `rate/${new Date().toISOString().slice(0, 10)}/${String(ip).replace(/[^\w.:-]/g, '')}`;
  const n = Number(await s.get(key)) || 0;
  if (n >= 15) return true;
  await s.set(key, String(n + 1));
  return false;
}

async function sendLink(d, token) {
  const user = process.env.ZOHO_SMTP_USER, pass = process.env.ZOHO_SMTP_PASS;
  if (!user || !pass) return false;
  const link = `${SITE}/apply/${d.form}/?resume=${token}`;
  const until = new Date(d.expires).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
  const first = (d.name || '').split(/\s+/)[0];
  const phone = settings.phone || '0161 956 2003';
  const what = d.formTitle || 'application';
  const subject = `Finish your ${what} – Unique Visa Services`;
  const text = [`Dear ${first || 'client'},`, '', `We’ve saved your ${what}, including any documents you added.`, '', 'When you’re ready, open this link to carry on where you left off:', link, '',
    `The link works until ${until}. Please keep it private: anyone with it can see your application.`, '', `Any questions, call us on ${phone}.`, '', 'Unique Visa Services'].join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1F2A24;max-width:560px;line-height:1.5">
<p>Dear ${esc(first || 'client')},</p><p>We’ve saved your ${esc(what)}, including any documents you added.</p>
<p>When you’re ready, press the button to carry on where you left off:</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#14532D;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px">Finish my application</a></p>
<p style="color:#5B6660;font-size:14px">The link works until ${esc(until)}. Please keep it private: anyone with it can see your application.</p>
<p>Any questions, call us on <a href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a>.</p><p>Unique Visa Services</p></div>`;
  const transport = nodemailer.createTransport({ host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com', port: 465, secure: true, auth: { user, pass } });
  await transport.sendMail({ from: `"Unique Visa Services" <${user}>`, replyTo: settings.email || user, to: d.email, subject, text, html });
  return true;
}

export default async (req, context) => {
  const s = store();
  const url = new URL(req.url);
  const action = url.pathname.replace(/^\/apply-draft\/?/, '').replace(/\/$/, '');
  const t = url.searchParams.get('t');
  const k = url.searchParams.get('k');

  if (req.method === 'GET') {
    if (!okToken(t)) return fail('That link isn’t right.', 404);
    const d = await readDraft(s, t);
    if (!d) return fail('This saved application has expired or has already been sent.', 404);
    if (action === 'load') return json({ form: d.form, state: d.state });
    if (action === 'file' && okKey(k) && d.files?.[k]) {
      const f = await s.get(`f/${t}/${k}`, { type: 'arrayBuffer' });
      if (!f) return fail('File not found', 404);
      return new Response(f, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    return fail('Not found', 404);
  }
  if (req.method !== 'POST' || req.headers.get('x-apply') !== '1') return fail('Not allowed', 403);

  if (action === 'file') {
    if (!okToken(t) || !okKey(k)) return fail('Not allowed', 403);
    const d = await readDraft(s, t);
    if (!d) return fail('This saved application has expired.', 404);
    const bytes = await req.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_FILE) return fail('That file is too big to save.');
    const files = d.files || {};
    const total = Object.values(files).reduce((n, f) => n + (f.size || 0), 0) + bytes.byteLength;
    if (Object.keys(files).length >= MAX_FILES || total > MAX_TOTAL) return fail('There are too many documents to save. Please send the application instead.');
    await s.set(`f/${t}/${k}`, bytes);
    files[k] = { size: bytes.byteLength, name: clean(req.headers.get('x-name'), 150), type: clean(req.headers.get('x-type'), 80) };
    await s.setJSON(`d/${t}`, { ...d, files });
    return json({ ok: true });
  }

  const body = await req.json().catch(() => ({}));
  if (action === 'start') {
    if (!okForm(body.form)) return fail('Not allowed');
    if (!okEmail(body.email)) return fail('Please enter a valid email address.');
    if (await tooMany(s, context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown')) return fail('Too many saved applications today. Please try again tomorrow or call us.', 429);
    const token = randomBytes(24).toString('hex');
    const now = new Date();
    await s.setJSON(`d/${token}`, { form: body.form, email: clean(body.email).toLowerCase(), created: now.toISOString(), expires: new Date(now.getTime() + DAYS * 864e5).toISOString(), files: {} });
    return json({ token });
  }
  if (action === 'save') {
    if (!okToken(body.token)) return fail('Not allowed', 403);
    const d = await readDraft(s, body.token);
    if (!d) return fail('This saved application has expired. Please save it again.', 404);
    if (!okEmail(body.email)) return fail('Please enter a valid email address.');
    const state = JSON.stringify(body.state || {});
    if (state.length > 400000) return fail('This application is too big to save.');
    const now = new Date();
    const saved = { ...d, email: clean(body.email).toLowerCase(), formTitle: clean(body.formTitle, 120), name: clean(body.name, 120), state: JSON.parse(state),
      saved: now.toISOString(), expires: new Date(now.getTime() + DAYS * 864e5).toISOString() };
    await s.setJSON(`d/${body.token}`, saved);
    let emailed = false;
    try { emailed = await sendLink(saved, body.token); } catch (e) { console.error('Saved-form email failed:', e.message); }
    return json({ ok: true, emailed, expires: saved.expires, link: `/apply/${saved.form}/?resume=${body.token}` });
  }
  if (action === 'delete') {
    if (!okToken(body.token)) return json({ ok: true });
    await deleteDraft(s, body.token);
    return json({ ok: true });
  }
  return fail('Not found', 404);
};

export async function deleteDraft(s, token) {
  const { blobs } = await s.list({ prefix: `f/${token}/` });
  await Promise.all(blobs.map((b) => s.delete(b.key)));
  await s.delete(`d/${token}`);
}

// Called once a day by office-notify.mjs: removes saved forms older than 30 days
export async function purgeDrafts() {
  const s = store();
  const now = new Date().toISOString();
  const { blobs } = await s.list({ prefix: 'd/' });
  let n = 0;
  for (const b of blobs) {
    const d = await s.get(b.key, { type: 'json' }).catch(() => null);
    if (!d || d.expires < now) { await deleteDraft(s, b.key.slice(2)); n++; }
  }
  const { blobs: rates } = await s.list({ prefix: 'rate/' });
  const today = now.slice(0, 10);
  await Promise.all(rates.filter((r) => !r.key.startsWith(`rate/${today}`)).map((r) => s.delete(r.key)));
  return n;
}
