// Sends invoices from the back office to the accounting software:
//   Travel Visa Help      -> FreeAgent  (https://dev.freeagent.com/docs)
//   Unique Visa Services  -> Wave       (https://developer.waveapps.com)
//
// Each needs a free "developer app" made once, with its keys added in Netlify
// (Site configuration > Environment variables):
//   FREEAGENT_CLIENT_ID, FREEAGENT_CLIENT_SECRET
//   WAVE_CLIENT_ID, WAVE_CLIENT_SECRET
// Then press "Connect" in the back office (Settings) and sign in once. The sign-in is kept
// in the office-secrets store and renewed automatically.
import { secretStore } from './store.mjs';

const UA = 'UVS back office (uvsuk.co.uk)';
export const COMPANIES = {
  tvh: { name: 'Travel Visa Help', app: 'freeagent', appName: 'FreeAgent' },
  uvs: { name: 'Unique Visa Services', app: 'wave', appName: 'Wave' },
};

const money = (n) => Math.round(Number(n || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

// ---------- sign-in (OAuth) ----------

const PROVIDERS = {
  freeagent: {
    id: () => process.env.FREEAGENT_CLIENT_ID, secret: () => process.env.FREEAGENT_CLIENT_SECRET,
    authorize: 'https://api.freeagent.com/v2/approve_app',
    token: 'https://api.freeagent.com/v2/token_endpoint',
    scope: '',
    basicAuth: true,
  },
  wave: {
    id: () => process.env.WAVE_CLIENT_ID, secret: () => process.env.WAVE_CLIENT_SECRET,
    authorize: 'https://api.waveapps.com/oauth2/authorize/',
    token: 'https://api.waveapps.com/oauth2/token/',
    scope: 'business:read customer:* invoice:* product:read sales_tax:read user:read',
    basicAuth: false,
  },
};

export const keysSet = (app) => Boolean(PROVIDERS[app]?.id() && PROVIDERS[app]?.secret());

export function authorizeUrl(app, redirectUri, state) {
  const p = PROVIDERS[app];
  const q = new URLSearchParams({ client_id: p.id(), response_type: 'code', redirect_uri: redirectUri, state });
  if (p.scope) q.set('scope', p.scope);
  return `${p.authorize}?${q}`;
}

async function tokenRequest(app, params) {
  const p = PROVIDERS[app];
  const body = new URLSearchParams(params);
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': UA };
  if (p.basicAuth) headers.Authorization = `Basic ${Buffer.from(`${p.id()}:${p.secret()}`).toString('base64')}`;
  else { body.set('client_id', p.id()); body.set('client_secret', p.secret()); }
  const res = await fetch(p.token, { method: 'POST', headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`${app === 'wave' ? 'Wave' : 'FreeAgent'} sign-in failed (${json.error_description || json.error || res.status})`);
  return json;
}

export async function finishConnect(app, code, redirectUri) {
  const t = await tokenRequest(app, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const rec = { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (Number(t.expires_in) || 3600) * 1000, connected: new Date().toISOString() };
  if (app === 'wave' && t.businessId) rec.businessId = t.businessId;
  await secretStore().setJSON(app, rec);
  // Remember the account details shown in Settings
  if (app === 'freeagent') {
    const c = await faRequest('GET', '/company').catch(() => null);
    if (c?.company) await secretStore().setJSON('freeagent', { ...rec, subdomain: c.company.subdomain, companyName: c.company.name });
  } else {
    const b = await waveBusiness().catch(() => null);
    if (b) await secretStore().setJSON('wave', { ...(await secretStore().get('wave', { type: 'json' })), businessId: b.id, companyName: b.name });
  }
}

export async function disconnect(app) { await secretStore().delete(app); }

export async function connection(app) {
  const r = await secretStore().get(app, { type: 'json' });
  return r ? { connected: true, since: r.connected, companyName: r.companyName || '' } : { connected: false };
}

async function accessToken(app) {
  const store = secretStore();
  const rec = await store.get(app, { type: 'json' });
  if (!rec) throw new Error(`${app === 'wave' ? 'Wave' : 'FreeAgent'} isn’t connected yet. Go to Settings and press Connect.`);
  if (rec.expires_at > Date.now() + 60e3) return rec.access_token;
  const t = await tokenRequest(app, { grant_type: 'refresh_token', refresh_token: rec.refresh_token });
  const next = { ...rec, access_token: t.access_token, refresh_token: t.refresh_token || rec.refresh_token, expires_at: Date.now() + (Number(t.expires_in) || 3600) * 1000 };
  await store.setJSON(app, next);
  return next.access_token;
}

// ---------- FreeAgent ----------

async function faRequest(method, path, body) {
  const res = await fetch(`https://api.freeagent.com/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken('freeagent')}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`FreeAgent: ${(json.errors && [].concat(json.errors).map((e) => e.message || JSON.stringify(e)).join('; ')) || res.status}`);
  return json;
}

const splitName = (full) => { const parts = String(full || '').trim().split(/\s+/); return parts.length > 1 ? { first_name: parts.slice(0, -1).join(' '), last_name: parts.at(-1) } : { first_name: parts[0] || 'Client', last_name: '-' }; };

async function faContact(bill) {
  const email = bill.email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { contacts = [] } = await faRequest('GET', `/contacts?view=all&per_page=100&page=${page}`);
    const hit = contacts.find((c) => String(c.email || '').toLowerCase() === email
      && (bill.isCompany ? String(c.organisation_name || '').toLowerCase() === bill.name.toLowerCase() : !c.organisation_name));
    if (hit) return hit.url;
    if (contacts.length < 100) break;
  }
  const contact = { email: bill.email, phone_number: bill.phone || undefined, address1: bill.address || undefined, country: 'United Kingdom' };
  if (bill.isCompany) Object.assign(contact, { organisation_name: bill.name }, bill.contactName ? splitName(bill.contactName) : {});
  else Object.assign(contact, splitName(bill.name));
  const { contact: made } = await faRequest('POST', '/contacts', { contact });
  return made.url;
}

async function faInvoice(inv, settings) {
  const contactUrl = await faContact(inv.billTo);
  const { invoice } = await faRequest('POST', '/invoices', {
    invoice: {
      contact: contactUrl,
      dated_on: today(),
      payment_terms_in_days: Number(settings.paymentTermsDays ?? 0),
      currency: 'GBP',
      comments: [inv.reference ? `Your reference: ${inv.reference}` : '', inv.billTo.isCompany && inv.billTo.companyNumber ? `Company number: ${inv.billTo.companyNumber}` : ''].filter(Boolean).join('\n') || undefined,
      invoice_items: inv.lines.map((l) => ({ item_type: 'Services', description: l.description, quantity: 1, price: money(l.amount).toFixed(2), ...(Number(l.vat) ? { sales_tax_rate: String(Number(l.vat)) } : {}) })),
    },
  });
  const id = String(invoice.url).split('/').pop();
  let status = 'draft';
  if (inv.mode === 'send') {
    await faRequest('POST', `/invoices/${id}/send_email`, { invoice: { email: { to: inv.billTo.email, subject: `Invoice ${invoice.reference || ''} from Travel Visa Help`.replace(/\s+/g, ' '), body: emailBody(inv, 'Travel Visa Help') } } });
    status = 'sent';
  } else if (inv.mode === 'mark') {
    await faRequest('PUT', `/invoices/${id}/transitions/mark_as_sent`);
    status = 'marked sent';
  }
  const conn = await secretStore().get('freeagent', { type: 'json' });
  return { id, number: invoice.reference || '', status, total: money(invoice.total_value ?? total(inv.lines)), openUrl: conn?.subdomain ? `https://${conn.subdomain}.freeagent.com/invoices/${id}` : 'https://login.freeagent.com/' };
}

// ---------- Wave ----------

async function waveQuery(query, variables) {
  const res = await fetch('https://gql.waveapps.com/graphql/public', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken('wave')}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors?.length) throw new Error(`Wave: ${json.errors?.map((e) => e.message).join('; ') || res.status}`);
  return json.data;
}
const waveCheck = (out, what) => { if (!out?.didSucceed) throw new Error(`Wave couldn’t ${what}: ${(out?.inputErrors || []).map((e) => e.message).join('; ') || 'unknown error'}`); return out; };

async function waveBusiness() {
  const rec = await secretStore().get('wave', { type: 'json' });
  if (rec?.businessId && rec?.companyName) return { id: rec.businessId, name: rec.companyName };
  const d = await waveQuery('query { businesses(page: 1, pageSize: 20) { edges { node { id name isPersonal isArchived } } } }');
  const list = d.businesses.edges.map((e) => e.node).filter((b) => !b.isArchived);
  const pick = (rec?.businessId && list.find((b) => b.id === rec.businessId)) || list.find((b) => !b.isPersonal) || list[0];
  if (!pick) throw new Error('Wave: no business found on this account');
  return pick;
}

// Products and taxes, for choosing in Settings which Wave product each invoice line uses.
export async function waveCatalogue() {
  const b = await waveBusiness();
  const d = await waveQuery(`query ($id: ID!) { business(id: $id) {
    products(page: 1, pageSize: 100) { edges { node { id name unitPrice isArchived } } }
    salesTaxes(page: 1, pageSize: 50) { edges { node { id name rate } } } } }`, { id: b.id });
  return {
    business: b.name,
    products: d.business.products.edges.map((e) => e.node).filter((p) => !p.isArchived).map((p) => ({ id: p.id, name: p.name })),
    taxes: d.business.salesTaxes.edges.map((e) => ({ id: e.node.id, name: e.node.name, rate: e.node.rate })),
  };
}

async function waveCustomer(businessId, bill) {
  const email = bill.email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const d = await waveQuery(`query ($id: ID!, $page: Int!) { business(id: $id) { customers(page: $page, pageSize: 100) {
      pageInfo { totalPages } edges { node { id name email } } } } }`, { id: businessId, page });
    const c = d.business.customers;
    const hit = c.edges.map((e) => e.node).find((n) => String(n.email || '').toLowerCase() === email && String(n.name || '').toLowerCase() === bill.name.toLowerCase());
    if (hit) return hit.id;
    if (page >= (c.pageInfo.totalPages || 1)) break;
  }
  const d = await waveQuery(`mutation ($input: CustomerCreateInput!) { customerCreate(input: $input) { didSucceed inputErrors { message path } customer { id } } }`, {
    input: { businessId, name: bill.name, email: bill.email, phone: bill.phone || undefined, address: bill.address ? { addressLine1: bill.address.slice(0, 250), countryCode: 'GB' } : undefined },
  });
  return waveCheck(d.customerCreate, 'add the customer').customer.id;
}

// ---------- contacts for the address book ----------
export async function faAllContacts() {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const { contacts = [] } = await faRequest('GET', `/contacts?view=all&per_page=100&page=${page}`);
    for (const c of contacts) out.push({
      name: [c.first_name, c.last_name].filter((x) => x && x !== '-').join(' '), company: c.organisation_name || '', email: c.email || c.billing_email || '',
      phone: c.phone_number || '', mobile: c.mobile || '', address: [c.address1, c.address2, c.address3, c.town, c.region, c.postcode, c.country].filter(Boolean).join(', '),
    });
    if (contacts.length < 100) break;
  }
  return out;
}
export async function waveAllCustomers() {
  const b = await waveBusiness();
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const d = await waveQuery(`query ($id: ID!, $page: Int!) { business(id: $id) { customers(page: $page, pageSize: 100) {
      pageInfo { totalPages } edges { node { name firstName lastName email phone mobile address { addressLine1 addressLine2 city postalCode } } } } } }`, { id: b.id, page });
    const c = d.business.customers;
    for (const { node: n } of c.edges) {
      const person = [n.firstName, n.lastName].filter(Boolean).join(' ');
      out.push({ name: person || n.name, company: person && n.name !== person ? n.name : '', email: n.email || '', phone: n.phone || '', mobile: n.mobile || '',
        address: [n.address?.addressLine1, n.address?.addressLine2, n.address?.city, n.address?.postalCode].filter(Boolean).join(', ') });
    }
    if (page >= (c.pageInfo.totalPages || 1)) break;
  }
  return out;
}

async function waveInvoice(inv, settings) {
  const b = await waveBusiness();
  const mainProduct = settings.waveProductMain, otherProduct = settings.waveProductOther || settings.waveProductMain;
  if (!mainProduct) throw new Error('Choose which Wave product to use for invoice lines first (Settings › Wave).');
  const customerId = await waveCustomer(b.id, inv.billTo);
  const memo = [inv.reference ? `Your reference: ${inv.reference}` : '', inv.billTo.isCompany && inv.billTo.companyNumber ? `Company number: ${inv.billTo.companyNumber}` : ''].filter(Boolean).join('\n');
  const d = await waveQuery(`mutation ($input: InvoiceCreateInput!) { invoiceCreate(input: $input) { didSucceed inputErrors { message path } invoice { id invoiceNumber viewUrl total { value } } } }`, {
    input: {
      businessId: b.id, customerId, invoiceDate: today(), memo: memo || undefined,
      items: inv.lines.map((l, i) => ({
        productId: i === 0 ? mainProduct : otherProduct, description: l.description, quantity: 1, unitPrice: money(l.amount).toFixed(2),
        ...(Number(l.vat) && settings.waveVatTaxId ? { taxes: [{ salesTaxId: settings.waveVatTaxId }] } : {}),
      })),
    },
  });
  const invoice = waveCheck(d.invoiceCreate, 'create the invoice').invoice;
  let status = 'draft';
  if (inv.mode === 'mark') {
    const a = await waveQuery('mutation ($input: InvoiceApproveInput!) { invoiceApprove(input: $input) { didSucceed inputErrors { message } } }', { input: { invoiceId: invoice.id } });
    waveCheck(a.invoiceApprove, 'approve the invoice');
    const m = await waveQuery('mutation ($input: InvoiceMarkSentInput!) { invoiceMarkSent(input: $input) { didSucceed inputErrors { message } } }', { input: { invoiceId: invoice.id, sendMethod: 'MARKED_SENT' } });
    waveCheck(m.invoiceMarkSent, 'mark the invoice as sent');
    status = 'marked sent';
  }
  if (inv.mode === 'send') {
    const a = await waveQuery('mutation ($input: InvoiceApproveInput!) { invoiceApprove(input: $input) { didSucceed inputErrors { message } } }', { input: { invoiceId: invoice.id } });
    waveCheck(a.invoiceApprove, 'approve the invoice');
    const s = await waveQuery('mutation ($input: InvoiceSendInput!) { invoiceSend(input: $input) { didSucceed inputErrors { message } } }', {
      input: { invoiceId: invoice.id, to: [inv.billTo.email], subject: `Invoice ${invoice.invoiceNumber} from Unique Visa Services`, message: emailBody(inv, 'Unique Visa Services'), attachPDF: true },
    });
    waveCheck(s.invoiceSend, 'email the invoice');
    status = 'sent';
  }
  return { id: invoice.id, number: invoice.invoiceNumber || '', status, total: money(invoice.total?.value ?? total(inv.lines)), openUrl: invoice.viewUrl || 'https://next.waveapps.com/' };
}

// ---------- shared ----------

export const total = (lines) => money(lines.reduce((a, l) => a + money(l.amount) * (1 + (Number(l.vat) || 0) / 100), 0));

function emailBody(inv, from) {
  const first = String(inv.billTo.contactName || inv.billTo.name || '').split(/\s+/)[0];
  return [`Dear ${first || 'client'},`, '', `Please find your invoice from ${from} attached${inv.reference ? ` for your application ${inv.reference}` : ''}.`, '', 'If you have any questions, just reply to this email or call us on 0161 956 2003.', '', 'Kind regards,', from].join('\n');
}

// Check what the screen sent before anything goes to the accounting software.
class InputError extends Error { constructor(m) { super(m); this.status = 400; } }
export function validateInvoice(inv) {
  if (!COMPANIES[inv.company]) throw new InputError('Choose which company is billing.');
  const b = inv.billTo || {};
  if (!String(b.name || '').trim()) throw new InputError('The invoice needs a name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email || '').trim())) throw new InputError('The invoice needs a valid email address.');
  const lines = (inv.lines || []).map((l) => ({ description: String(l.description || '').trim().slice(0, 300), amount: money(l.amount), vat: [0, 5, 20].includes(Number(l.vat)) ? Number(l.vat) : 0 })).filter((l) => l.description && l.amount !== 0);
  if (!lines.length) throw new InputError('Add at least one line with an amount.');
  if (lines.some((l) => !Number.isFinite(l.amount) || Math.abs(l.amount) > 100000)) throw new InputError('One of the amounts doesn’t look right.');
  return {
    company: inv.company, mode: ['send', 'mark'].includes(inv.mode) ? inv.mode : 'draft', reference: String(inv.reference || '').slice(0, 60),
    billTo: { name: String(b.name).trim().slice(0, 200), email: String(b.email).trim(), phone: String(b.phone || '').slice(0, 60), address: String(b.address || '').slice(0, 500), companyNumber: String(b.companyNumber || '').slice(0, 60), isCompany: !!b.isCompany, contactName: String(b.contactName || '').slice(0, 200) },
    lines,
  };
}

export async function createInvoice(inv, settings) {
  return COMPANIES[inv.company].app === 'freeagent' ? faInvoice(inv, settings) : waveInvoice(inv, settings);
}
