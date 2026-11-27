// Optional: the secret address Zoho Mail can call the moment an email arrives (Zoho Mail ›
// Settings › Developer Space › Outgoing webhooks), so the notification comes straight away instead
// of at the next 3-minute check. The address is shown in the back office under Settings › Email.
import { checkNew } from '../office/mail.mjs';
import { mailHookAllowed, userNames } from '../office/auth.mjs';

export const config = { path: '/office/mail-hook/:token' };

export default async (req, context) => {
  if (!mailHookAllowed(context.params?.token)) return new Response('Not found', { status: 404 });
  // Zoho checks the address with a GET first
  if (req.method !== 'POST') return new Response('ok');
  const r = await checkNew(userNames()).catch((e) => ({ error: e.message }));
  return new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json' } });
};
