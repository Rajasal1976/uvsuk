// The unsubscribe link in every newsletter: /newsletter/unsubscribe?e=email&t=token
// Opening the link shows a button (so email scanners that open links don't unsubscribe people);
// pressing it, or an email app's one-click unsubscribe, removes the person from the list.
import { officeStore } from '../office/store.mjs';
import { unsubToken, setStatus } from '../office/newsletter.mjs';

export const config = { path: '/newsletter/unsubscribe' };

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const page = (title, inner) => new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#F4F7F5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1F2A24"><main style="max-width:520px;margin:60px auto;background:#fff;border-radius:12px;padding:28px 24px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<p style="margin:0 0 6px;font-weight:700;color:#14532D">Unique Visa Services</p><h1 style="font-size:22px;margin:0 0 14px">${title}</h1>${inner}</main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

export default async (req, context) => {
  const url = new URL(req.url);
  const email = String(url.searchParams.get('e') || '').trim().toLowerCase();
  const token = String(url.searchParams.get('t') || '');
  if (!email || token !== unsubToken(email)) return page('This link doesn’t work', '<p>The unsubscribe link looks incomplete. Reply to any of our emails with “unsubscribe” and we’ll remove you.</p>');
  const store = officeStore(context?.deploy?.context && context.deploy.context !== 'production');
  if (req.method === 'POST') {
    await setStatus(store, email, 'unsubscribed');
    return page('You’ve been unsubscribed', `<p>${esc(email)} won’t get our newsletter any more.</p><p>You’ll still get emails about any application you have with us.</p>`);
  }
  return page('Unsubscribe from our newsletter?', `<p>Stop sending the Unique Visa Services newsletter to <strong>${esc(email)}</strong>?</p>
<form method="post"><button type="submit" style="min-height:46px;padding:12px 22px;border:0;border-radius:10px;background:#14532D;color:#fff;font:inherit;font-weight:600;cursor:pointer">Unsubscribe</button></form>`);
};
