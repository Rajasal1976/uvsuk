// Back office sign-in: one password, set in Netlify as OFFICE_PASSWORD
// (Site configuration > Environment variables). Until it is set, the back office stays locked.
//
// Signing in gives the browser a cookie that lasts 12 hours. It is signed with the password,
// so changing OFFICE_PASSWORD signs everyone out.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'uvs_office';
const HOURS = 12;

const key = () => createHash('sha256').update(`uvs-office:${process.env.OFFICE_PASSWORD || ''}:${process.env.OFFICE_SECRET || ''}`).digest();
const sign = (v) => createHmac('sha256', key()).update(v).digest('base64url');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export const passwordSet = () => String(process.env.OFFICE_PASSWORD || '').length >= 8;

export function checkPassword(given) {
  if (!passwordSet()) return false;
  // Compare hashes so the comparison takes the same time whatever the length
  const h = (s) => createHash('sha256').update(String(s)).digest('hex');
  return same(h(given), h(process.env.OFFICE_PASSWORD));
}

export function sessionCookie() {
  const exp = String(Date.now() + HOURS * 3600e3);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/office; HttpOnly; Secure; SameSite=Strict; Max-Age=${HOURS * 3600}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/office; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function signedIn(req) {
  if (!passwordSet()) return false;
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([\\w-]+)`));
  if (!m) return false;
  return Number(m[1]) > Date.now() && same(m[2], sign(m[1]));
}

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
