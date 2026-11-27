// Email in the back office: reads your Zoho mailboxes (IMAP) and sends replies through them (SMTP).
//
// Mailboxes are added in the back office (Settings › Your email accounts) with a Zoho "app password"
// for each. Each mailbox belongs to one person (only they see it) or is shared (e.g. hello@).
// The emails themselves stay in Zoho: the back office only keeps a short list of the latest
// ones per mailbox so the inbox opens quickly, plus who opened/replied to shared emails.
//
// Kept in Netlify Blobs:
//   office-secrets  mail-accounts      the mailboxes and their app passwords (never sent to the browser)
//   office-mail     list/<id>          latest emails in each inbox
//                   seen/<id>          the newest email already notified about
//                   meta/<id>          for shared mailboxes: who opened / replied to each email
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { secretStore } from './store.mjs';
import { push } from './notify.mjs';

export const SHARED = 'shared';
const LIST_SIZE = 50;
const mailStore = () => getStore({ name: 'office-mail', consistency: 'strong' });
const clean = (v, max = 300) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
const err = (message, status = 400) => Object.assign(new Error(message), { status });

// ---------- mailboxes ----------
const readAccounts = async () => (await secretStore().get('mail-accounts', { type: 'json' })) || [];
const saveAccounts = (list) => secretStore().setJSON('mail-accounts', list);
const canSee = (acc, user) => !!user && (acc.owner === SHARED || acc.owner === user);
const publicAcc = (a) => ({ id: a.id, email: a.email, owner: a.owner, name: a.name, signature: a.signature || '', color: a.color, added: a.added, error: a.error || '' });

export async function accountsFor(user) { return (await readAccounts()).filter((a) => canSee(a, user)).map(publicAcc); }
async function accountFor(user, id) {
  const a = (await readAccounts()).find((x) => x.id === id);
  if (!a || !canSee(a, user)) throw err('That mailbox isn’t one of yours.', 403);
  return a;
}

// Zoho's server names depend on the account type and the region it's in. Work out the right one
// by trying them when a mailbox is added.
function zohoHosts(kind) {
  const m = String(process.env.ZOHO_SMTP_HOST || '').match(/zoho\.([a-z.]+)$/);
  const tlds = [...new Set([m ? m[1] : 'com', 'com', 'eu', 'in', 'com.au'])];
  return tlds.flatMap((t) => [`${kind}pro.zoho.${t}`, `${kind}.zoho.${t}`]);
}
const imapClient = (a, host = a.imapHost) => {
  const c = new ImapFlow({ host, port: 993, secure: true, auth: { user: a.email, pass: a.pass }, logger: false, connectionTimeout: 6000, greetingTimeout: 5000, socketTimeout: 15000 });
  c.on('error', (e) => console.error(`IMAP ${a.email}:`, e.message)); // a dropped connection must never crash the function
  return c;
};

// Business mailboxes (own domain) use imappro/smtppro, personal ones imap/smtp, so a wrong password
// is only reported once both of the first pair have said no.
const isAuthFail = (e) => e?.authenticationFailed || e?.responseCode === 535 || /auth|invalid credentials|login/i.test(e?.responseText || e?.response || e?.message || '');
async function findImapHost(a) {
  let last, authFails = 0;
  for (const host of zohoHosts('imap')) {
    const c = imapClient(a, host);
    try { await c.connect(); await c.logout(); return host; }
    catch (e) { last = e; if (isAuthFail(e) && ++authFails >= 2) break; }
  }
  if (authFails) throw err('Zoho didn’t accept that email address and app password. Check them, and that IMAP access is turned on in Zoho Mail (Settings › Mail Accounts › IMAP).');
  throw err(`Couldn’t reach Zoho’s mail server (${last?.message || 'no answer'}).`, 502);
}
async function findSmtpHost(a) {
  let last, authFails = 0;
  const pro = a.imapHost.startsWith('imappro.');
  const tld = a.imapHost.replace(/^imap(pro)?\.zoho\./, '');
  for (const host of [...new Set([`smtp${pro ? 'pro' : ''}.zoho.${tld}`, ...zohoHosts('smtp')])]) {
    try { await nodemailer.createTransport({ host, port: 465, secure: true, auth: { user: a.email, pass: a.pass }, connectionTimeout: 6000 }).verify(); return host; }
    catch (e) { last = e; if (isAuthFail(e) && ++authFails >= 2) break; }
  }
  throw err(`Zoho wouldn’t let this mailbox send email (${last?.response || last?.message || 'no answer'}).`, 502);
}

const COLORS = ['#14532D', '#7C3AED', '#B45309', '#0E7490', '#BE185D', '#4D7C0F', '#1D4ED8', '#9F1239', '#475569'];

export async function addAccount(user, input) {
  if (!user) throw err('Sign in with your own password to add a mailbox.', 403);
  const email = clean(input.email, 200).toLowerCase();
  const pass = String(input.pass || '').replace(/\s+/g, '');
  if (!validEmail(email)) throw err('Enter the full email address.');
  if (pass.length < 6) throw err('Paste the app password from Zoho.');
  const owner = input.shared ? SHARED : user;
  const list = await readAccounts();
  const existing = list.find((x) => x.email === email);
  if (existing && !canSee(existing, user)) throw err('That mailbox has already been added by someone else.', 409);
  const a = { id: existing?.id || randomBytes(5).toString('hex'), email, pass, owner, name: clean(input.name, 80) || 'Unique Visa Services', signature: clean(input.signature, 1500), color: existing?.color || COLORS[list.length % COLORS.length], added: existing?.added || new Date().toISOString() };
  a.imapHost = await findImapHost(a);
  a.smtpHost = await findSmtpHost(a);
  await saveAccounts([...list.filter((x) => x.id !== a.id), a]);
  // Start from now, so you aren't sent a notification for every old email
  const c = imapClient(a);
  try { await c.connect(); const s = await c.status('INBOX', { uidNext: true }); await mailStore().setJSON(`seen/${a.id}`, { uid: s.uidNext - 1 }); } finally { await c.logout().catch(() => {}); }
  await refreshList(a).catch(() => {});
  return publicAcc(a);
}

export async function updateAccount(user, id, input) {
  const a = await accountFor(user, id);
  if ('name' in input) a.name = clean(input.name, 80) || 'Unique Visa Services';
  if ('signature' in input) a.signature = clean(input.signature, 1500);
  if ('shared' in input) a.owner = input.shared ? SHARED : user;
  await saveAccounts([...(await readAccounts()).filter((x) => x.id !== id), a]);
  return publicAcc(a);
}

export async function removeAccount(user, id) {
  await accountFor(user, id);
  await saveAccounts((await readAccounts()).filter((x) => x.id !== id));
  const s = mailStore();
  await Promise.all(['list', 'seen', 'meta'].map((k) => s.delete(`${k}/${id}`).catch(() => {})));
  return { ok: true };
}

// ---------- reading ----------
const hasAttachment = (node) => !!node && (node.disposition === 'attachment' || (node.childNodes || []).some(hasAttachment));
const row = (m) => {
  const f = m.envelope?.from?.[0] || {};
  return { uid: m.uid, fromName: clean(f.name, 120), from: clean(f.address, 200).toLowerCase(), subject: clean(m.envelope?.subject, 300) || '(no subject)', date: (m.envelope?.date || m.internalDate || new Date()).toISOString?.() || String(m.internalDate), seen: m.flags?.has('\\Seen') || false, answered: m.flags?.has('\\Answered') || false, attach: hasAttachment(m.bodyStructure) };
};

// Read the latest emails in one inbox from Zoho and keep them as the quick list
export async function refreshList(a) {
  const c = imapClient(a);
  await c.connect();
  const lock = await c.getMailboxLock('INBOX', { readOnly: true });
  const out = [];
  let uidNext = 0;
  try {
    const total = c.mailbox.exists;
    uidNext = c.mailbox.uidNext;
    if (total) for await (const m of c.fetch(`${Math.max(1, total - LIST_SIZE + 1)}:*`, { uid: true, envelope: true, flags: true, bodyStructure: true, internalDate: true })) out.push(row(m));
  } finally { lock.release(); await c.logout().catch(() => {}); }
  out.sort((x, y) => y.uid - x.uid);
  const list = { at: new Date().toISOString(), uidNext, messages: out };
  await mailStore().setJSON(`list/${a.id}`, list);
  if (a.error) { a.error = ''; await saveAccounts([...(await readAccounts()).filter((x) => x.id !== a.id), a]); }
  return list;
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Zoho took too long to answer')), ms))]);

// The inbox screen: the latest emails across every mailbox this person can see.
// fresh = ask Zoho now (falls back to the saved list if Zoho is slow)
export async function inbox(user, { fresh = false } = {}) {
  const accs = (await readAccounts()).filter((a) => canSee(a, user));
  const s = mailStore();
  const lists = await Promise.all(accs.map(async (a) => {
    let list = null, problem = '';
    if (fresh) { try { list = await withTimeout(refreshList(a), 8000); } catch (e) { problem = e.authenticationFailed ? 'Zoho didn’t accept the app password. Add the mailbox again in Settings.' : e.message; } }
    if (!list) list = (await s.get(`list/${a.id}`, { type: 'json' })) || { messages: [] };
    const meta = a.owner === SHARED ? (await s.get(`meta/${a.id}`, { type: 'json' })) || {} : {};
    return { acc: publicAcc(a), at: list.at, problem, messages: list.messages.map((m) => ({ ...m, acc: a.id, ...(meta[m.uid] ? { by: meta[m.uid] } : {}) })) };
  }));
  return {
    accounts: lists.map((l) => ({ ...l.acc, at: l.at, problem: l.problem, unread: l.messages.filter((m) => !m.seen).length })),
    messages: lists.flatMap((l) => l.messages).sort((x, y) => String(y.date).localeCompare(String(x.date))),
  };
}

async function noteBy(a, uid, user, what) {
  if (a.owner !== SHARED) return;
  const s = mailStore();
  const meta = (await s.get(`meta/${a.id}`, { type: 'json' })) || {};
  const cur = meta[uid] || {};
  if (what === 'opened' && cur.opened) return;
  meta[uid] = { ...cur, [what]: user, [`${what}At`]: new Date().toISOString() };
  // keep the record small: only the latest 300 emails
  const keys = Object.keys(meta).map(Number).sort((x, y) => y - x);
  for (const k of keys.slice(300)) delete meta[k];
  await s.setJSON(`meta/${a.id}`, meta);
}

// Update the saved list after something changes (read, replied, deleted) without asking Zoho again
async function patchList(a, uid, fn) {
  const s = mailStore();
  const list = await s.get(`list/${a.id}`, { type: 'json' });
  if (!list) return;
  list.messages = list.messages.map((m) => (m.uid === uid ? fn(m) : m)).filter(Boolean);
  await s.setJSON(`list/${a.id}`, list);
}

async function withInbox(a, fn) {
  const c = imapClient(a);
  await c.connect();
  const lock = await c.getMailboxLock('INBOX');
  try { return await fn(c); } finally { lock.release(); await c.logout().catch(() => {}); }
}

async function parsed(a, uid) {
  return withInbox(a, async (c) => {
    const m = await c.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
    if (!m?.source) throw err('That email isn’t in the inbox any more (it may have been moved or deleted in Zoho).', 404);
    return { mail: await simpleParser(m.source, { skipImageLinks: true }) };
  });
}

export async function readMessage(user, id, uid) {
  const a = await accountFor(user, id);
  uid = Number(uid);
  const msg = await withInbox(a, async (c) => {
    const m = await c.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
    if (!m?.source) throw err('That email isn’t in the inbox any more (it may have been moved or deleted in Zoho).', 404);
    if (!m.flags?.has('\\Seen')) await c.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
    return { mail: await simpleParser(m.source, { skipImageLinks: true }), answered: m.flags?.has('\\Answered') || false };
  });
  await Promise.all([noteBy(a, uid, user, 'opened'), patchList(a, uid, (m) => ({ ...m, seen: true }))]);
  const { mail } = msg;
  const addrs = (x) => (x?.value || []).map((v) => ({ name: clean(v.name, 120), email: clean(v.address, 200).toLowerCase() })).filter((v) => v.email);
  const meta = a.owner === SHARED ? ((await mailStore().get(`meta/${a.id}`, { type: 'json' })) || {})[uid] || null : null;
  return {
    acc: publicAcc(a), uid, answered: msg.answered, by: meta,
    subject: clean(mail.subject, 500) || '(no subject)', date: mail.date?.toISOString() || '',
    from: addrs(mail.from)[0] || { name: '', email: '' }, replyTo: addrs(mail.replyTo)[0] || null, to: addrs(mail.to), cc: addrs(mail.cc),
    messageId: mail.messageId || '', references: [].concat(mail.references || []).slice(-10),
    text: String(mail.text || '').slice(0, 200000),
    html: mail.html ? String(mail.html).slice(0, 1500000) : '',
    attachments: (mail.attachments || []).map((x, n) => ({ n, name: clean(x.filename, 200) || `attachment-${n + 1}`, type: x.contentType, size: x.size, inline: x.contentDisposition === 'inline' && !!x.cid, cid: x.cid || '' })),
  };
}

export async function attachment(user, id, uid, n) {
  const a = await accountFor(user, id);
  const { mail } = await parsed(a, Number(uid));
  const x = (mail.attachments || [])[Number(n)];
  if (!x) throw err('Attachment not found', 404);
  return { name: clean(x.filename, 200) || `attachment-${Number(n) + 1}`, type: x.contentType || 'application/octet-stream', bytes: x.content };
}

export async function setSeen(user, id, uid, seen) {
  const a = await accountFor(user, id);
  uid = Number(uid);
  await withInbox(a, (c) => (seen ? c.messageFlagsAdd : c.messageFlagsRemove).call(c, String(uid), ['\\Seen'], { uid: true }));
  await patchList(a, uid, (m) => ({ ...m, seen }));
  return { ok: true };
}

// Moves the email to the mailbox's Trash folder in Zoho (it can be restored from there)
export async function trash(user, id, uid) {
  const a = await accountFor(user, id);
  uid = Number(uid);
  await withInbox(a, async (c) => {
    const folders = await c.list();
    const bin = folders.find((f) => f.specialUse === '\\Trash') || folders.find((f) => /^(trash|deleted items|bin)$/i.test(f.name));
    if (!bin) throw err('Couldn’t find the Trash folder in this mailbox.');
    await c.messageMove(String(uid), bin.path, { uid: true });
  });
  await patchList(a, uid, () => null);
  return { ok: true };
}

// ---------- sending ----------
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const addrList = (v) => String(v || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => { const m = s.match(/<([^>]+)>/); return (m ? m[1] : s).trim().toLowerCase(); });

// body: { acc, to, cc, subject, text, replyUid?, inReplyTo?, references?, quote?, attachments: [{ name, type, data(base64) }] }
export async function send(user, body) {
  const a = await accountFor(user, String(body.acc || ''));
  const to = addrList(body.to), cc = addrList(body.cc);
  if (!to.length) throw err('Who is it to? Add an email address.');
  const bad = [...to, ...cc].find((e) => !validEmail(e));
  if (bad) throw err(`“${bad}” doesn’t look like an email address.`);
  if (to.length + cc.length > 20) throw err('That’s a lot of people: please send to 20 or fewer at a time.');
  const subject = clean(body.subject, 300);
  const text = String(body.text || '').replace(/\u0000/g, '').slice(0, 100000);
  if (!subject && !text.trim()) throw err('Write a message first.');
  const files = (Array.isArray(body.attachments) ? body.attachments : []).slice(0, 10).map((f) => ({ filename: clean(f.name, 200) || 'file', contentType: clean(f.type, 100) || undefined, content: Buffer.from(String(f.data || ''), 'base64') }));
  if (files.reduce((n, f) => n + f.content.length, 0) > 4.3 * 1024 * 1024) throw err('Attachments are too big: keep them under about 4 MB in total.');
  // Forwarding: the original email's attachments go with it (read straight from Zoho)
  if (Number(body.forwardUid)) {
    const src = await accountFor(user, String(body.forwardFrom || a.id));
    const { mail } = await parsed(src, Number(body.forwardUid));
    for (const x of mail.attachments || []) files.push({ filename: clean(x.filename, 200) || 'attachment', contentType: x.contentType, content: x.content });
    if (files.reduce((n, f) => n + f.content.length, 0) > 20 * 1024 * 1024) throw err('The attachments are too big to forward from here (over 20 MB). Forward it from Zoho instead.');
  }
  const sig = a.signature ? `\n\n${a.signature}` : '';
  const quote = String(body.quote || '').slice(0, 60000);
  const fullText = `${text}${sig}${quote ? `\n\n${quote}` : ''}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${esc(text + sig).replace(/\n/g, '<br>')}${quote ? `<br><br><blockquote style="margin:0 0 0 6px;padding-left:10px;border-left:2px solid #ccc;color:#555">${esc(quote.replace(/^> ?/gm, '')).replace(/\n/g, '<br>')}</blockquote>` : ''}</div>`;
  const transport = nodemailer.createTransport({ host: a.smtpHost, port: 465, secure: true, auth: { user: a.email, pass: a.pass } });
  const inReplyTo = clean(body.inReplyTo, 500);
  const refs = [...(Array.isArray(body.references) ? body.references : []), inReplyTo].map((r) => clean(r, 500)).filter(Boolean).slice(-10);
  const info = await transport.sendMail({ from: { name: a.name || 'Unique Visa Services', address: a.email }, to, cc: cc.length ? cc : undefined, subject: subject || '(no subject)', text: fullText, html, attachments: files, ...(inReplyTo ? { inReplyTo, references: refs } : {}) });
  const replyUid = Number(body.replyUid) || 0;
  if (replyUid) {
    await withInbox(a, (c) => c.messageFlagsAdd(String(replyUid), ['\\Answered', '\\Seen'], { uid: true })).catch((e) => console.error('Marking replied failed:', e.message));
    await Promise.all([noteBy(a, replyUid, user, 'replied'), patchList(a, replyUid, (m) => ({ ...m, answered: true, seen: true }))]);
  }
  return { ok: true, id: info.messageId, to, from: a.email };
}

// ---------- new email notifications ----------
// Asks each mailbox for the number its next email will get (cheap), and only reads the inbox when
// something new has arrived. Each new email sends a phone notification to the mailbox's owner
// (or both of you for a shared one).
export async function checkNew(peopleNames = []) {
  const accs = await readAccounts();
  const s = mailStore();
  let found = 0;
  await Promise.all(accs.map(async (a) => {
    try {
      const seen = (await s.get(`seen/${a.id}`, { type: 'json' })) || null;
      const c = imapClient(a);
      let uidNext;
      try { await c.connect(); uidNext = (await c.status('INBOX', { uidNext: true })).uidNext; } finally { await c.logout().catch(() => {}); }
      if (!seen) return s.setJSON(`seen/${a.id}`, { uid: uidNext - 1 });
      if (uidNext - 1 <= seen.uid) return;
      const list = await refreshList(a);
      const fresh = list.messages.filter((m) => m.uid > seen.uid && !m.seen).sort((x, y) => x.uid - y.uid);
      await s.setJSON(`seen/${a.id}`, { uid: uidNext - 1 });
      if (!fresh.length) return;
      found += fresh.length;
      const who = a.owner === SHARED ? (peopleNames.length ? peopleNames : null) : [a.owner];
      if (!who) return;
      const short = a.email.split('@')[0] + '@';
      if (fresh.length > 3) {
        await push(who, { title: `${fresh.length} new emails to ${short}`, body: fresh.slice(-3).map((m) => `${m.fromName || m.from}: ${m.subject}`).join('\n'), url: `/office/#mail/${a.id}`, tag: `mail-${a.id}` }, { strict: true });
      } else {
        for (const m of fresh) await push(who, { title: `${m.fromName || m.from} → ${short}`, body: m.subject, url: `/office/#mail/${a.id}/${m.uid}`, tag: `mail-${a.id}-${m.uid}` }, { strict: true });
      }
    } catch (e) {
      console.error(`Mail check ${a.email}:`, e.message);
      if (e.authenticationFailed && !a.error) {
        a.error = 'Zoho stopped accepting the app password. Add the mailbox again in Settings.';
        await saveAccounts([...(await readAccounts()).filter((x) => x.id !== a.id), a]);
        await push(a.owner === SHARED ? null : [a.owner], { title: `Email problem: ${a.email}`, body: a.error, url: '/office/#settings', tag: `mailerr-${a.id}` }, { strict: a.owner !== SHARED });
      }
    }
  }));
  return { mailboxes: accs.length, found };
}
