// Runs every 15 minutes on the live site (Netlify scheduled function):
//  - appointment reminders: a phone notification about 30 minutes before each appointment
//  - the morning summary at 8am (UK time): today's appointments, to-dos and waiting phone
//    messages, as a phone notification and an email to each person in Settings › Diary people
import { officeStore, secretStore, readIndex } from '../office/store.mjs';
import { readDiary, readTasks, readMessages } from '../office/diary.mjs';
import { push, email } from '../office/notify.mjs';

export const config = { schedule: '*/15 * * * *' };

const london = () => {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/London' }); // "2026-11-27 08:15:00"
  return { date: s.slice(0, 10), time: s.slice(11, 16), mins: Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16)) };
};
const toMins = (t) => Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5));
const PEOPLE = [{ name: 'Raj', email: '' }, { name: 'Sunita', email: '' }];

export default async () => {
  const store = officeStore(false);
  const secrets = secretStore();
  const people = (await secrets.get('settings', { type: 'json' }))?.diaryPeople || PEOPLE;
  const now = london();
  const appts = (await readDiary(store)).filter((a) => a.status !== 'cancelled' && a.date === now.date);

  // 1) Appointment reminders, ~30 minutes before (sent once each)
  const sentKey = `notify/reminded-${now.date}`;
  const reminded = (await store.get(sentKey, { type: 'json' })) || [];
  const due = appts.filter((a) => !reminded.includes(a.id) && toMins(a.start) - now.mins > 0 && toMins(a.start) - now.mins <= 40);
  for (const a of due) {
    await push(a.who ? [a.who] : [], { title: `${a.start} ${a.clientName || a.title || 'Appointment'}`, body: [`In about ${toMins(a.start) - now.mins} minutes`, a.type, a.who ? `with ${a.who}` : '', a.clientPhone].filter(Boolean).join(' · '), url: '/office/#diary', tag: `appt-${a.id}` });
    reminded.push(a.id);
  }
  if (due.length) await store.setJSON(sentKey, reminded);

  // 2) Morning summary at 8am, once a day
  if (now.mins < 8 * 60 || now.mins >= 9 * 60) return new Response('ok');
  const doneKey = `notify/summary-${now.date}`;
  if (await store.get(doneKey)) return new Response('already sent');
  await store.set(doneKey, new Date().toISOString());

  const tasks = (await readTasks(store)).filter((t) => !t.done && t.due <= now.date);
  const oldReminders = (await readIndex(store)).flatMap((r) => (r.openReminders || []).filter((x) => x.due <= now.date).map((x) => ({ title: `${x.text} (${r.name})`, due: x.due, who: '' })));
  const msgs = (await readMessages(store)).filter((m) => !m.done);

  for (const p of people) {
    const mine = (x) => !x.who || x.who === p.name;
    const myAppts = appts.filter(mine);
    const myTodos = [...tasks, ...oldReminders].filter(mine);
    const myMsgs = msgs.filter((m) => !m.for || m.for === p.name);
    if (!myAppts.length && !myTodos.length && !myMsgs.length) continue;
    const parts = [myAppts.length && `${myAppts.length} appointment${myAppts.length > 1 ? 's' : ''}`, myTodos.length && `${myTodos.length} to do`, myMsgs.length && `${myMsgs.length} message${myMsgs.length > 1 ? 's' : ''} waiting`].filter(Boolean);
    await push([p.name], { title: `Good morning ${p.name}`, body: `Today: ${parts.join(', ')}`, url: '/office/#home', tag: `summary-${now.date}` });
    const text = [
      `Good morning ${p.name}, here’s today (${now.date.split('-').reverse().join('/')}).`,
      '', 'APPOINTMENTS', ...(myAppts.length ? myAppts.map((a) => `- ${a.start} ${a.clientName || a.title}${a.type ? ` (${a.type})` : ''}${a.clientPhone ? ` · ${a.clientPhone}` : ''}`) : ['- None']),
      '', 'TO DO', ...(myTodos.length ? myTodos.map((t) => `- ${t.title}${t.clientPhone ? ` · ${t.clientPhone}` : ''}${t.due < now.date ? ' (overdue)' : ''}`) : ['- Nothing']),
      '', 'PHONE MESSAGES WAITING', ...(myMsgs.length ? myMsgs.map((m) => `- ${m.name || 'Caller'}${m.phone ? ` · ${m.phone}` : ''}${m.about ? ` · ${m.about}` : ''}${m.for ? '' : ' (for either of you)'}`) : ['- None']),
    ].join('\n');
    await email(people, [p.name], `Today: ${parts.join(', ')}`, text);
  }
  return new Response('summary sent');
};
