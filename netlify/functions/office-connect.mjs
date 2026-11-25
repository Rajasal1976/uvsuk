// Connects FreeAgent or Wave to the back office (Settings › Connect).
//   /office/connect/freeagent            sends you to FreeAgent to approve
//   /office/connect/freeagent/callback   FreeAgent sends you back here
// The callback address to give each developer app is:
//   https://www.uvsuk.co.uk/office/connect/freeagent/callback
//   https://www.uvsuk.co.uk/office/connect/wave/callback
import { randomBytes } from 'node:crypto';
import { signedIn } from '../office/auth.mjs';
import { authorizeUrl, finishConnect, keysSet } from '../office/accounts.mjs';

export const config = { path: ['/office/connect/:app', '/office/connect/:app/callback'] };

const page = (title, msg) => new Response(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 20px;color:#1F2A24"><h1 style="color:#14532D;font-size:24px">${title}</h1><p>${msg}</p><p><a href="/office/#settings" style="color:#14532D;font-weight:600">Back to the back office</a></p></body>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async (req, context) => {
  const url = new URL(req.url);
  const app = context.params?.app;
  const name = app === 'wave' ? 'Wave' : 'FreeAgent';
  if (!['freeagent', 'wave'].includes(app)) return new Response('Not found', { status: 404 });
  const isCallback = url.pathname.endsWith('/callback');
  // The sign-in cookie isn't sent when FreeAgent/Wave send you back (it's "strict"), so the
  // callback is checked with the one-time state cookie instead, which only a signed-in user gets.
  if (!isCallback && !signedIn(req)) return Response.redirect(`${url.origin}/office/`, 302);
  if (!keysSet(app)) return page(`${name} isn’t set up yet`, `Add the ${name} developer app keys in Netlify first (${app === 'wave' ? 'WAVE_CLIENT_ID and WAVE_CLIENT_SECRET' : 'FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET'}), then redeploy.`);
  const redirectUri = `${url.origin}/office/connect/${app}/callback`;

  if (!isCallback) {
    const state = randomBytes(16).toString('hex');
    return new Response(null, { status: 302, headers: { Location: authorizeUrl(app, redirectUri, state), 'Set-Cookie': `uvs_oauth=${state}; Path=/office/connect; HttpOnly; Secure; SameSite=Lax; Max-Age=600` } });
  }

  const cookieState = ((req.headers.get('cookie') || '').match(/(?:^|;\s*)uvs_oauth=([a-f0-9]+)/) || [])[1];
  if (!cookieState || cookieState !== url.searchParams.get('state')) return page('Connection didn’t work', 'The sign-in link had expired. Please press Connect again.');
  if (url.searchParams.get('error')) return page(`${name} wasn’t connected`, `${name} said: ${esc(url.searchParams.get('error_description') || url.searchParams.get('error'))}`);
  try {
    await finishConnect(app, url.searchParams.get('code'), redirectUri);
    return page(`${name} is connected`, `Invoices for ${app === 'wave' ? 'Unique Visa Services' : 'Travel Visa Help'} will now go to ${name}.`);
  } catch (e) {
    return page('Connection didn’t work', esc(e.message));
  }
};
