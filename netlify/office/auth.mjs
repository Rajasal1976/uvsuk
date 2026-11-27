// Back office sign-in.
//
// Each person has their own password, set in Netlify (Site configuration > Environment variables):
//   OFFICE_PASSWORD_RAJ      Raj's password
//   OFFICE_PASSWORD_SUNITA   Sunita's password
// (any OFFICE_PASSWORD_<NAME> adds a person). Email is private to each person, so it only shows
// when you sign in with your own password. Everything else in the back office is shared.
//
// OFFICE_PASSWORD (the old shared password) still works and still keeps the sign-in cookies safe,
// so keep it set. Signing in with it opens everything except email.
//
// Signing in gives the browser a cookie that lasts 12 hours. It is signed with OFFICE_PASSWORD,
// so changing OFFICE_PASSWORD signs everyone out.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'uvs_office';
const HOURS = 12;

const key = () => createHash('sha256').update(`uvs-office:${process.env.OFFICE_PASSWORD || ''}:${process.env.OFFICE_SECRET || ''}`).digest();
const sign = (v) => createHmac('sha256', key()).update(v).digest('base64url');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const hash = (s) => createHash('sha256').update(String(s)).digest('hex');
const nice = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export const passwordSet = () => String(process.env.OFFICE_PASSWORD || '').length >= 8;

// People with their own password: [{ name: 'Raj', pw: '...' }]
function people() {
  return Object.entries(process.env)
    .filter(([k, v]) => /^OFFICE_PASSWORD_[A-Z]+$/.test(k) && String(v || '').length >= 8)
    .map(([k, v]) => ({ name: nice(k.slice('OFFICE_PASSWORD_'.length)), pw: String(v) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export const userNames = () => (passwordSet() ? people().map((p) => p.name) : []);

// Returns false, or { user } where user is '' for the shared password or the person's name
export function checkPassword(given, name) {
  if (!passwordSet()) return false;
  const p = name ? people().find((x) => x.name.toLowerCase() === String(name).toLowerCase()) : null;
  if (p) return same(hash(given), hash(p.pw)) ? { user: p.name } : false;
  // Compare hashes so the comparison takes the same time whatever the length
  return same(hash(given), hash(process.env.OFFICE_PASSWORD)) ? { user: '' } : false;
}

export function sessionCookie(user = '') {
  const exp = String(Date.now() + HOURS * 3600e3);
  const v = user ? `${exp}.${user}` : exp;
  return `${COOKIE}=${v}.${sign(v)}; Path=/office; HttpOnly; Secure; SameSite=Strict; Max-Age=${HOURS * 3600}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/office; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

// null if not signed in, otherwise { user } ('' = signed in with the shared password)
export function session(req) {
  if (!passwordSet()) return null;
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)(?:\\.([A-Za-z]+))?\\.([\\w-]+)`));
  if (!m) return null;
  const v = m[2] ? `${m[1]}.${m[2]}` : m[1];
  if (!(Number(m[1]) > Date.now() && same(m[3], sign(v)))) return null;
  // A person whose password has been removed no longer gets in as themselves
  if (m[2] && !userNames().includes(m[2])) return null;
  return { user: m[2] || '' };
}
export const signedIn = (req) => !!session(req);

// Slow down password guessing: 8 wrong tries in 15 minutes from one address locks it for 15 minutes.
export async function tooManyTries(store, ip) {
  const k = `security/login-${createHash('sha256').update(String(ip)).digest('hex').slice(0, 16)}`;
  const rec = (await store.get(k, { type: 'json' })) || { fails: [] };
  const recent = rec.fails.filter((t) => t > Date.now() - 15 * 60e3);
  return { locked: recent.length >= 8, async fail() { await store.setJSON(k, { fails: [...recent, Date.now()].slice(-20) }); }, async clear() { await store.delete(k); } };
}

// Lets the form-submitted function hand a new application to the back office function
// (which has the database connection). Derived from the password, so nothing extra to set up.
export const ingestToken = () => sign('ingest-v1');
export const ingestAllowed = (req) => passwordSet() && same(req.headers.get('x-office-ingest') || '', ingestToken());

// The secret address Zoho can call when a new email arrives (optional, see netlify/office/mail.mjs)
export const mailHookToken = () => sign('mail-hook-v1').slice(0, 32);
export const mailHookAllowed = (token) => passwordSet() && same(String(token || ''), mailHookToken());
