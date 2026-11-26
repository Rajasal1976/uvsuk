// Diary: appointments and to-dos for Raj and Sunita.
//
// To-dos (call a client, put a visa form through, chase documents…) are kept in 'diary/tasks'.
//
// Booking, moving or cancelling an appointment emails a calendar invite (iCalendar) from the
// Zoho mailbox to whoever's appointment it is, and to the client. Zoho Calendar and Google
// Calendar both add these invites automatically and update them when the appointment changes,
// so nothing needs connecting.
import nodemailer from 'nodemailer';
import settingsJson from '../../content/settings.json' with { type: 'json' };

export const TYPES = ['In the office', 'Phone call', 'Video call', 'Embassy / visa centre', 'Meeting', 'Out of office'];
// Types that are with a client (the others are your own time, so no client is needed or emailed)
export const CLIENT_TYPES = ['In the office', 'Phone call', 'Video call'];
const clean = (v, max = 500) => String(v ?? '').replace(/[\r\u0000]/g, '').trim().slice(0, max);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
const validEmail = (e) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(e || '').trim());
const bad = (m) => Object.assign(new Error(m), { status: 400 });

// ---------- UK time ----------
// "2026-12-01" + "10:30" in London -> the same moment in UTC (handles GMT/BST)
export function londonToUtc(date, time) {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (shown - guess));
}
const icsTime = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const niceDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const endTime = (start, mins) => { const [h, m] = start.split(':').map(Number); const t = h * 60 + m + mins; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

// ---------- storage ----------
export async function readDiary(store) { return (await store.get('diary/list', { type: 'json' })) || []; }
async function saveDiary(store, list) { list.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)); await store.setJSON('diary/list', list); }

export function checkInput(input, people) {
  const who = clean(input.who, 60);
  if (!people.some((p) => p.name === who)) throw bad('Choose whose appointment it is.');
  if (!isDate(input.date)) throw bad('Choose a date.');
  if (!isTime(input.start)) throw bad('Choose a start time.');
  const minutes = Math.round(Number(input.minutes) || 0);
  if (minutes < 5 || minutes > 480) throw bad('Choose how long it is.');
  const clientEmail = clean(input.clientEmail, 200).toLowerCase();
  if (clientEmail && !validEmail(clientEmail)) throw bad('The client’s email doesn’t look right.');
  const type = TYPES.includes(input.type) ? input.type : TYPES[0];
  if (CLIENT_TYPES.includes(type) && !clean(input.clientName)) throw bad('Add the client’s name.');
  return {
    who, date: input.date, start: input.start, minutes, type,
    title: clean(input.title, 200) || (CLIENT_TYPES.includes(type) ? 'Appointment' : type),
    clientName: clean(input.clientName, 200), clientEmail, clientPhone: clean(input.clientPhone, 60),
    ref: clean(input.ref, 60), notes: clean(input.notes, 2000),
    emailClient: input.emailClient !== false && !!clientEmail && CLIENT_TYPES.includes(type),
  };
}

// Same person, overlapping times
export function clashes(list, a, ignoreId) {
  const s = londonToUtc(a.date, a.start).getTime(), e = s + a.minutes * 60e3;
  return list.filter((x) => x.id !== ignoreId && x.status !== 'cancelled' && x.who === a.who && x.date === a.date)
    .filter((x) => { const xs = londonToUtc(x.date, x.start).getTime(); return xs < e && xs + x.minutes * 60e3 > s; });
}

export async function book(store, input, people) {
  const a = checkInput(input, people);
  const list = await readDiary(store);
  const appt = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...a, status: 'booked', seq: 0, created: new Date().toISOString() };
  const clash = clashes(list, appt);
  if (clash.length && !input.allowClash) throw Object.assign(bad(`${a.who} already has ${clash[0].clientName || clash[0].title} at ${clash[0].start} that day. Book anyway?`), { clash: true });
  list.push(appt);
  await saveDiary(store, list);
  const mailed = await notify(appt, people, 'REQUEST');
  return { appt, mailed };
}

export async function change(store, id, input, people) {
  const list = await readDiary(store);
  const cur = list.find((x) => x.id === id);
  if (!cur) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  if (cur.status === 'cancelled') throw bad('That appointment was cancelled.');
  const next = { ...cur, ...checkInput({ ...cur, ...input }, people) };
  const clash = clashes(list, next, id);
  if (clash.length && !input.allowClash) throw Object.assign(bad(`${next.who} already has ${clash[0].clientName || clash[0].title} at ${clash[0].start} that day. Move anyway?`), { clash: true });
  const prevWho = cur.who, whoChanged = next.who !== cur.who;
  next.seq = (cur.seq || 0) + 1;
  next.updated = new Date().toISOString();
  Object.assign(cur, next);
  await saveDiary(store, list);
  // If it moved to the other person, cancel it in the first person's calendar
  if (whoChanged) await notify({ ...cur, who: prevWho, emailClient: false }, people, 'CANCEL').catch(() => {});
  const mailed = await notify(cur, people, 'REQUEST', true);
  return { appt: cur, mailed };
}

export async function cancel(store, id, people) {
  const list = await readDiary(store);
  const cur = list.find((x) => x.id === id);
  if (!cur) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  cur.status = 'cancelled'; cur.seq = (cur.seq || 0) + 1; cur.cancelled = new Date().toISOString();
  await saveDiary(store, list);
  const mailed = await notify(cur, people, 'CANCEL');
  return { appt: cur, mailed };
}

// ---------- invites ----------
const esc = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ` ${s.slice(74)}`; } out.push(s); return out.join('\r\n'); };

export function ics(appt, people, method) {
  const organiser = process.env.ZOHO_SMTP_USER || settingsJson.email || 'hello@uvsuk.com';
  const staff = people.find((p) => p.name === appt.who);
  const start = londonToUtc(appt.date, appt.start), end = new Date(start.getTime() + appt.minutes * 60e3);
  const where = appt.type === 'In the office' ? officeAddress() : appt.type;
  const attendees = [staff?.email && `ATTENDEE;CN=${esc(staff.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${staff.email}`,
    appt.clientEmail && `ATTENDEE;CN=${esc(appt.clientName)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${appt.clientEmail}`].filter(Boolean);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Unique Visa Services//Back office//EN', `METHOD:${method}`, 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${appt.id}@uvsuk.co.uk`, `SEQUENCE:${appt.seq || 0}`, `DTSTAMP:${icsTime(new Date())}`, `DTSTART:${icsTime(start)}`, `DTEND:${icsTime(end)}`,
    `SUMMARY:${esc(appt.clientName ? `${appt.title}: ${appt.clientName} (Unique Visa Services)` : appt.title)}`, `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc([`With ${appt.who}, Unique Visa Services`, appt.type, appt.clientPhone ? `Client phone: ${appt.clientPhone}` : '', appt.notes].filter(Boolean).join('\n'))}`,
    `ORGANIZER;CN=Unique Visa Services:mailto:${organiser}`, ...attendees, `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`, 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}

function officeAddress() {
  return [settingsJson.addressLine1, settingsJson.addressLine2, settingsJson.city, settingsJson.postcode].filter(Boolean).join(', ') || 'Unique Visa Services, Manchester';
}

// Emails the person whose appointment it is, and the client (unless switched off)
async function notify(appt, people, method, moved = false) {
  const user = process.env.ZOHO_SMTP_USER, pass = process.env.ZOHO_SMTP_PASS;
  if (!user || !pass) return { staff: false, client: false, error: 'Email isn’t set up (ZOHO_SMTP_USER / ZOHO_SMTP_PASS), so no invites were sent.' };
  const staff = people.find((p) => p.name === appt.who);
  const transport = nodemailer.createTransport({ host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com', port: 465, secure: true, auth: { user, pass } });
  const when = `${niceDate(appt.date)}, ${appt.start}–${endTime(appt.start, appt.minutes)}`;
  const where = appt.type === 'In the office' ? `At our office: ${officeAddress()}` : appt.type === 'Phone call' ? 'By phone: we’ll call you on the number you gave us.' : 'By video call: we’ll send you the link before the appointment.';
  const phone = settingsJson.phone || '0161 956 2003', mail = settingsJson.email || 'hello@uvsuk.com';
  const icalEvent = { method, filename: 'appointment.ics', content: ics(appt, people, method) };
  const result = { staff: false, client: false };
  const verb = method === 'CANCEL' ? 'Cancelled' : moved ? 'Changed' : 'New';
  if (staff?.email) {
    await transport.sendMail({ from: `"UVS back office" <${user}>`, to: staff.email, subject: `${verb} ${appt.clientName ? 'appointment' : 'diary entry'}: ${appt.clientName || appt.title}, ${niceDate(appt.date)} ${appt.start}`,
      text: [`${verb} appointment for ${appt.who}`, '', when, appt.type, appt.clientName ? `Client: ${appt.clientName}` : '', appt.clientPhone ? `Phone: ${appt.clientPhone}` : '', appt.clientEmail ? `Email: ${appt.clientEmail}` : '', appt.title !== 'Appointment' ? `About: ${appt.title}` : '', appt.notes ? `Notes: ${appt.notes}` : '', appt.ref ? `Record: https://www.uvsuk.co.uk/office/#app/${appt.ref}` : ''].filter((l) => l !== '').join('\n'),
      icalEvent });
    result.staff = true;
  }
  if (appt.emailClient && appt.clientEmail) {
    const first = appt.clientName.split(/\s+/)[0];
    const body = method === 'CANCEL'
      ? [`Dear ${first},`, '', `Your appointment with Unique Visa Services on ${when} has been cancelled.`, '', `If you’d like to book another time, reply to this email or call us on ${phone}.`]
      : [`Dear ${first},`, '', moved ? 'Your appointment with Unique Visa Services has changed. The new details are:' : 'Your appointment with Unique Visa Services is booked:', '', `When: ${when}`, `With: ${appt.who}`, where, '', 'The attached invite adds it to your calendar.', '', `If you need to change it, reply to this email or call us on ${phone}.`];
    await transport.sendMail({ from: `"Unique Visa Services" <${user}>`, replyTo: mail, to: appt.clientEmail,
      subject: method === 'CANCEL' ? `Appointment cancelled: ${niceDate(appt.date)}` : `${moved ? 'Appointment changed' : 'Your appointment'}: ${niceDate(appt.date)} at ${appt.start}`,
      text: [...body, '', 'Kind regards,', 'Unique Visa Services', `${phone} | ${mail} | uvsuk.co.uk`].join('\n'), icalEvent });
    result.client = true;
  }
  return result;
}

// ---------- to-dos ----------
// A simple one-line list. { id, title, due, time, who, ref, clientName, clientPhone, clientEmail, notes, photo, done, doneAt, created }
// photo = the id of a picture kept under 'photos/<id>' (e.g. a snap of a caller's number).
export async function readTasks(store) { return (await store.get('diary/tasks', { type: 'json' })) || []; }
async function saveTasks(store, list) {
  list.sort((a, b) => `${a.due} ${a.time || '99'}`.localeCompare(`${b.due} ${b.time || '99'}`));
  // Keep ticked-off to-dos for a year, then let them go
  const cutoff = new Date(Date.now() - 365 * 864e5).toISOString();
  await store.setJSON('diary/tasks', list.filter((t) => !t.done || (t.doneAt || '') > cutoff));
}

export async function saveTask(store, input, people) {
  const photo = /^p[a-z0-9]{6,30}$/.test(String(input.photo || '')) ? String(input.photo) : '';
  const title = clean(input.title, 300) || (photo ? 'Photo' : '');
  if (!title) throw bad('Type what needs doing.');
  const hadDue = isDate(input.due);
  const due = hadDue ? input.due : new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const time = clean(input.time, 5);
  if (time && !isTime(time)) throw bad('The time doesn’t look right.');
  const who = clean(input.who, 60);
  if (who && !people.some((p) => p.name === who)) throw bad('Choose who it’s for.');
  const fields = { title, due, time, who, ref: clean(input.ref, 60), clientName: clean(input.clientName, 200), clientPhone: clean(input.clientPhone, 60), clientEmail: clean(input.clientEmail, 200).toLowerCase(), notes: clean(input.notes, 2000) };
  if ('photo' in input) fields.photo = photo;
  const list = await readTasks(store);
  let task;
  if (input.id) {
    task = list.find((t) => t.id === input.id);
    if (!task) throw Object.assign(new Error('To-do not found'), { status: 404 });
    // Only change what was sent (a quick text edit keeps the date, client and photo)
    for (const k of Object.keys(fields)) if (k === 'title' || (k === 'due' ? hadDue : k in input)) task[k] = fields[k];
    task.updated = new Date().toISOString();
  } else {
    task = { id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...fields, done: false, created: new Date().toISOString() };
    list.push(task);
  }
  await saveTasks(store, list);
  return { task };
}

export async function setTaskDone(store, id, done) {
  const list = await readTasks(store);
  const task = list.find((t) => t.id === id);
  if (!task) throw Object.assign(new Error('To-do not found'), { status: 404 });
  task.done = !!done;
  task.doneAt = done ? new Date().toISOString() : '';
  await saveTasks(store, list);
  return { task };
}

export async function deleteTask(store, id) {
  const list = await readTasks(store);
  const gone = list.find((t) => t.id === id);
  if (gone?.photo) await store.delete(`photos/${gone.photo}`).catch(() => {});
  await saveTasks(store, list.filter((t) => t.id !== id));
  return { ok: true };
}

// ---------- photos (to-do pictures) ----------
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export async function savePhoto(store, dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw bad('That file isn’t a photo (JPEG, PNG or WebP).');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > 4.5 * 1024 * 1024) throw bad('That photo is too big. Please try a smaller one.');
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await store.set(`photos/${id}`, bytes, { metadata: { type: m[1], at: new Date().toISOString() } });
  return { id };
}
export async function readPhoto(store, id) {
  if (!/^p[a-z0-9]{6,30}$/.test(String(id || ''))) return null;
  const r = await store.getWithMetadata(`photos/${id}`, { type: 'arrayBuffer' });
  if (!r) return null;
  return { bytes: r.data, type: PHOTO_TYPES.includes(r.metadata?.type) ? r.metadata.type : 'image/jpeg' };
}
