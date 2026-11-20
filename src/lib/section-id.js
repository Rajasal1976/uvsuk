// Turns a heading into a link-friendly id, e.g. "Fees and timescales" -> "fees-and-timescales".
// Used by guide sections and the "On this page" box so the two always match.
export const sectionId = (h = '') => h.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
