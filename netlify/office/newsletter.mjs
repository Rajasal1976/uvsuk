// Newsletter: subscriber list, unsubscribe links and sending through the Zoho mailbox.
//
// People join by ticking the box on an application form, being added in the back office
// (one at a time, from a client's record, or by pasting contacts), and leave with the
// unsubscribe link in every newsletter (/newsletter/unsubscribe).
//
// Zoho limits how many emails a mailbox can send a day, so newsletters go out in small
// batches while the back office page is open, up to a daily limit set in Settings.
import { createHmac, createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import settingsJson from '../../content/settings.json' with { type: 'json' };

const SITE = 'https://www.uvsuk.co.uk';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const validEmail = (e) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(e || '').trim());
const norm = (e) => String(e || '').trim().toLowerCase();

// ---------- unsubscribe links ----------
const key = () => createHash('sha256').update(`uvs-newsletter:${process.env.OFFICE_PASSWORD || ''}:${process.env.OFFICE_SECRET || ''}`).digest();
export const unsubToken = (email) => createHmac('sha256', key()).update(norm(email)).digest('base64url').slice(0, 24);
export const unsubUrl = (email, origin = SITE) => `${origin}/newsletter/unsubscribe?e=${encodeURIComponent(norm(email))}&t=${unsubToken(email)}`;

// ---------- the list ----------
export async function readList(store) { return (await store.get('newsletter/list', { type: 'json' })) || []; }
async function saveList(store, list) { await store.setJSON('newsletter/list', list); return list; }

// Add people. Someone who unsubscribed is only added back if they asked again themselves (a form tick).
export async function addSubscribers(store, people, source) {
  const list = await readList(store);
  let added = 0, again = 0, skipped = 0;
  for (const p of people) {
    const email = norm(p.email);
    if (!validEmail(email)) { skipped++; continue; }
    const cur = list.find((x) => x.email === email);
    if (!cur) { list.push({ email, name: String(p.name || '').trim().slice(0, 120), source, added: new Date().toISOString(), status: 'subscribed' }); added++; continue; }
    if (cur.status === 'unsubscribed') {
      if (source === 'form') { cur.status = 'subscribed'; cur.resubscribed = new Date().toISOString(); again++; } else skipped++;
      continue;
    }
    if (!cur.name && p.name) cur.name = String(p.name).trim().slice(0, 120);
    skipped++;
  }
  await saveList(store, list);
  return { added, again, skipped, total: list.filter((x) => x.status === 'subscribed').length };
}

export async function setStatus(store, email, status) {
  const list = await readList(store);
  const cur = list.find((x) => x.email === norm(email));
  if (!cur) return false;
  cur.status = status;
  if (status === 'unsubscribed') cur.unsubscribed = new Date().toISOString();
  await saveList(store, list);
  return true;
}

export async function removeSubscriber(store, email) {
  const list = await readList(store);
  await saveList(store, list.filter((x) => x.email !== norm(email)));
}

// "Name <email>", "email, name", "name, email" or just "email" per line (CSV exports work too)
export function parseContacts(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const angle = line.match(/^(.*)<([^>]+)>/);
    if (angle) { out.push({ name: angle[1].replace(/["',]/g, '').trim(), email: angle[2].trim() }); continue; }
    const cells = line.split(/[,;\t]/).map((c) => c.replace(/^"|"$/g, '').trim());
    const email = cells.find((c) => validEmail(c));
    if (!email) continue;
    const name = cells.filter((c) => c && c !== email && !validEmail(c) && !/^\+?[\d\s()-]{6,}$/.test(c)).slice(0, 2).join(' ');
    out.push({ name, email });
  }
  return out;
}

// ---------- newsletters ----------
export async function readCampaigns(store) { return (await store.get('newsletter/campaigns', { type: 'json' })) || []; }
async function saveCampaigns(store, list) { await store.setJSON('newsletter/campaigns', list); }

export async function createCampaign(store, { subject, body }) {
  subject = String(subject || '').trim().slice(0, 200);
  body = String(body || '').trim().slice(0, 50000);
  if (!subject) throw Object.assign(new Error('Add a subject line.'), { status: 400 });
  if (body.length < 20) throw Object.assign(new Error('Write the newsletter first.'), { status: 400 });
  const recipients = (await readList(store)).filter((x) => x.status === 'subscribed').map((x) => x.email);
  if (!recipients.length) throw Object.assign(new Error('There’s nobody on the list yet.'), { status: 400 });
  const c = { id: Date.now().toString(36), subject, body, created: new Date().toISOString(), recipients, sent: [], failed: [], status: 'sending' };
  const all = await readCampaigns(store);
  await saveCampaigns(store, [c, ...all].slice(0, 100));
  return c;
}

const today = () => new Date().toISOString().slice(0, 10);

// Send the next few emails of a newsletter. Called again and again by the back office page.
export async function sendBatch(store, id, { dailyLimit = 200, size = 8, origin = SITE } = {}) {
  const all = await readCampaigns(store);
  const c = all.find((x) => x.id === id);
  if (!c) throw Object.assign(new Error('Newsletter not found'), { status: 404 });
  const counter = (await store.get('newsletter/sent-today', { type: 'json' })) || {};
  const sentToday = counter.day === today() ? counter.count : 0;
  const unsub = new Set((await readList(store)).filter((x) => x.status !== 'subscribed').map((x) => x.email));
  const done = new Set([...c.sent, ...c.failed.map((f) => f.email)]);
  const queue = c.recipients.filter((e) => !done.has(e) && !unsub.has(e));
  const room = Math.max(0, dailyLimit - sentToday);
  if (!queue.length) { c.status = 'sent'; c.finished = c.finished || new Date().toISOString(); await saveCampaigns(store, all); return { campaign: summary(c), remaining: 0, paused: false }; }
  if (!room) { c.status = 'paused'; await saveCampaigns(store, all); return { campaign: summary(c), remaining: queue.length, paused: true }; }
  const batch = queue.slice(0, Math.min(size, room));
  const transport = mailer();
  let count = 0;
  for (const email of batch) {
    try { await transport.sendMail(message(c, email, origin)); c.sent.push(email); count++; }
    catch (e) { c.failed.push({ email, error: String(e.message).slice(0, 200) }); }
  }
  transport.close?.();
  await store.setJSON('newsletter/sent-today', { day: today(), count: sentToday + batch.length }); // failed tries count too: Zoho counts them
  const remaining = queue.length - batch.length;
  c.status = remaining ? 'sending' : 'sent';
  if (!remaining) c.finished = new Date().toISOString();
  await saveCampaigns(store, all);
  return { campaign: summary(c), remaining, paused: false };
}

export const summary = (c) => ({ id: c.id, subject: c.subject, created: c.created, finished: c.finished || '', status: c.status, total: c.recipients.length, sent: c.sent.length, failed: c.failed.length, failures: c.failed.slice(0, 10) });

export async function sendTest(c, to, origin = SITE) {
  const transport = mailer();
  await transport.sendMail({ ...message(c, to, origin), subject: `[Test] ${c.subject}` });
  transport.close?.();
}

function mailer() {
  const user = process.env.ZOHO_SMTP_USER, pass = process.env.ZOHO_SMTP_PASS;
  if (!user || !pass) throw Object.assign(new Error('Email isn’t set up: add ZOHO_SMTP_USER and ZOHO_SMTP_PASS in Netlify.'), { status: 400 });
  return nodemailer.createTransport({ host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com', port: 465, secure: true, pool: true, maxConnections: 1, auth: { user, pass } });
}

// Plain writing to email: blank line = new paragraph, "- " = bullet, links become clickable.
export function bodyHtml(body) {
  const link = (t) => esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" style="color:#14532D">$1</a>');
  return String(body).trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) return `<ul style="margin:0 0 16px;padding-left:20px">${lines.map((l) => `<li style="margin:4px 0">${link(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
    if (lines.length === 1 && /^#\s+/.test(lines[0])) return `<h2 style="font-size:18px;color:#14532D;margin:20px 0 8px">${link(lines[0].replace(/^#\s+/, ''))}</h2>`;
    return `<p style="margin:0 0 16px">${lines.map(link).join('<br>')}</p>`;
  }).join('\n');
}

export function message(c, email, origin = SITE) {
  const user = process.env.ZOHO_SMTP_USER;
  const phone = settingsJson.phone || '0161 956 2003', mail = settingsJson.email || 'hello@uvsuk.com';
  const address = [settingsJson.addressLine1, settingsJson.city, settingsJson.postcode].filter(Boolean).join(', ');
  const off = unsubUrl(email, origin);
  const why = 'You’re receiving this because you’re a client of Unique Visa Services or asked to hear from us.';
  const text = `${c.body.trim()}\n\n--\nUnique Visa Services\n${phone} | ${mail} | uvsuk.co.uk\n${address}\n\n${why}\nUnsubscribe: ${off}`;
  const html = `<!doctype html><html><body style="margin:0;background:#F4F7F5;font-family:Arial,Helvetica,sans-serif;color:#1F2A24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:#14532D;padding:20px 28px;color:#fff;font-size:20px;font-weight:bold">Unique Visa Services</td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.55">${bodyHtml(c.body)}</td></tr>
<tr><td style="padding:18px 28px;background:#F7FBF8;font-size:13px;color:#4A5A51;line-height:1.5">
${esc(phone)} · <a href="mailto:${esc(mail)}" style="color:#14532D">${esc(mail)}</a> · <a href="${SITE}" style="color:#14532D">uvsuk.co.uk</a><br>${esc(address)}<br><br>
${esc(why)} <a href="${esc(off)}" style="color:#14532D">Unsubscribe</a><br>
Unique Visa Services is regulated by the Immigration Advice Authority (ref F200700144).
</td></tr></table></td></tr></table></body></html>`;
  return {
    from: `"Unique Visa Services" <${user}>`, replyTo: mail, to: email, subject: c.subject, text, html,
    headers: { 'List-Unsubscribe': `<${off}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}
