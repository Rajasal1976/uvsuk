// Phone notifications (web push) and alert emails for the back office.
//
// Phone notifications: each phone or computer turns them on once in the back office (Settings or Home)
// and says whose it is (Raj or Sunita). The keys that sign notifications are made automatically the first
// time and kept in the office-secrets store, so there's nothing to set up in Netlify.
// Emails go through the Zoho mailbox (ZOHO_SMTP_USER / ZOHO_SMTP_PASS) to the addresses in
// Settings › Diary people.
import webpush from 'web-push';
import nodemailer from 'nodemailer';
import { secretStore } from './store.mjs';

const SITE = 'https://www.uvsuk.co.uk';
const clean = (v, max = 300) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);

async function keys() {
  const s = secretStore();
  let k = await s.get('push-keys', { type: 'json' });
  if (!k?.publicKey) { k = webpush.generateVAPIDKeys(); await s.setJSON('push-keys', k); }
  return k;
}
export async function publicKey() { return (await keys()).publicKey; }

const readSubs = async () => (await secretStore().get('push-subs', { type: 'json' })) || [];
const saveSubs = (list) => secretStore().setJSON('push-subs', list);

export async function subscribe(sub, person) {
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw Object.assign(new Error('That subscription isn’t valid.'), { status: 400 });
  const list = (await readSubs()).filter((s) => s.endpoint !== sub.endpoint);
  list.push({ endpoint: clean(sub.endpoint, 1000), keys: { p256dh: clean(sub.keys.p256dh, 200), auth: clean(sub.keys.auth, 100) }, person: clean(person, 60), at: new Date().toISOString() });
  await saveSubs(list.slice(-30));
  return { ok: true };
}
export async function unsubscribe(endpoint) {
  await saveSubs((await readSubs()).filter((s) => s.endpoint !== endpoint));
  return { ok: true };
}
export async function whoIs(endpoint) { return (await readSubs()).find((s) => s.endpoint === endpoint)?.person || ''; }

// names: ['Sunita'] or [] / null for everyone. note: { title, body, url, tag }
// strict: only phones set up for those exact people (used for private email notifications, so a
// phone that hasn't said whose it is never shows someone else's email)
export async function push(names, note, { strict = false } = {}) {
  const lower = (names || []).map((n) => String(n).toLowerCase());
  const subs = (await readSubs()).filter((s) => strict
    ? !!s.person && (!lower.length || lower.includes(String(s.person).toLowerCase()))
    : !names?.length || names.includes(s.person) || !s.person);
  if (!subs.length) return { sent: 0 };
  const k = await keys();
  webpush.setVapidDetails('mailto:hello@uvsuk.com', k.publicKey, k.privateKey);
  const payload = JSON.stringify({ title: clean(note.title, 120), body: clean(note.body, 400), url: note.url || '/office/#home', tag: note.tag || '' });
  const dead = [];
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 6 * 3600, urgency: 'high' }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint); else console.error('Push failed:', e.statusCode || e.message); }
  }));
  if (dead.length) await saveSubs((await readSubs()).filter((s) => !dead.includes(s.endpoint)));
  return { sent };
}

// Email the named people (or everyone with an address in Settings › Diary people)
export async function email(people, names, subject, text, attachments = []) {
  const user = process.env.ZOHO_SMTP_USER, pass = process.env.ZOHO_SMTP_PASS;
  const to = (people || []).filter((p) => p.email && (!names?.length || names.includes(p.name)));
  if (!user || !pass || !to.length) return { sent: 0 };
  const transport = nodemailer.createTransport({ host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com', port: 465, secure: true, auth: { user, pass } });
  let sent = 0;
  for (const p of to) {
    try { await transport.sendMail({ from: `"UVS back office" <${user}>`, to: p.email, subject, text: `${text}\n\nOpen the back office: ${SITE}/office/`, attachments }); sent++; }
    catch (e) { console.error('Alert email failed:', e.message); }
  }
  return { sent };
}

// Both at once; never lets a failed alert break what the person was doing
export async function alert(people, names, note, emailText, attachments) {
  try { await Promise.all([push(names, note), emailText ? email(people, names, note.title, emailText, attachments) : null]); }
  catch (e) { console.error('Alert failed:', e.message); }
}

// ---------- the alerts themselves ----------
export function messageAlert(people, m, photo) {
  const who = m.for ? [m.for] : [];
  const line = [m.name || 'Caller', m.phone].filter(Boolean).join(' · ');
  return alert(people, who, { title: `Phone message${m.for ? ` for ${m.for}` : ''}: ${m.name || m.phone || 'caller'}`, body: [line, m.about].filter(Boolean).join('\n'), url: '/office/#messages', tag: `msg-${m.id}` },
    [`New phone message${m.for ? ` for ${m.for}` : ''}.`, '', `Caller: ${m.name || '–'}`, `Number: ${m.phone || '–'}`, m.email ? `Email: ${m.email}` : '', `Regarding: ${m.about || '–'}`, m.notes ? `Message: ${m.notes}` : '', `When: ${String(m.at || '').replace('T', ' ')}`, m.photo ? 'The screenshot is attached.' : ''].filter((l) => l !== '').join('\n'),
    photo ? [{ filename: `screenshot.${photo.type.split('/')[1] === 'jpeg' ? 'jpg' : photo.type.split('/')[1]}`, content: Buffer.from(photo.bytes), contentType: photo.type }] : []);
}

export function applicationAlert(people, rec) {
  const name = String(rec.name || 'New client').toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());
  const what = rec.formTitle || rec.service || 'application';
  return alert(people, [], { title: `New application: ${name}`, body: `${what} · Ref ${rec.ref}`, url: `/office/#app/${encodeURIComponent(rec.ref)}`, tag: `app-${rec.ref}` },
    [`A new application has come in from the website.`, '', `Name: ${name}`, `Form: ${what}`, `Reference: ${rec.ref}`, rec.phone ? `Phone: ${rec.phone}` : '', rec.email ? `Email: ${rec.email}` : ''].filter(Boolean).join('\n'));
}
