// Checks the email inboxes for new emails every 3 minutes (7am to 10pm UK time) and sends a phone
// notification for each one. Quiet at night to save Netlify credits: anything that arrives overnight
// is picked up at 7am. See netlify/office/mail.mjs.
import { checkNew } from '../office/mail.mjs';
import { userNames } from '../office/auth.mjs';

export const config = { schedule: '*/3 * * * *' };

export default async () => {
  const hour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }));
  if (hour < 7 || hour >= 22) return new Response('night');
  const r = await checkNew(userNames());
  return new Response(JSON.stringify(r));
};
