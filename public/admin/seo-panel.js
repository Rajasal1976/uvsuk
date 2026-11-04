/* SEO panel for the website editor (like Rank Math in WordPress).
   Shows a live SEO score, a Google preview and a checklist beside the page you're editing.
   Loaded by /admin/index.html after the editor. */
(function () {
  var CMS = window.CMS, h = window.h, createClass = window.createClass;
  if (!CMS || !h || !createClass) return;

  var SITE = 'www.uvsuk.co.uk';

  // ---------- helpers ----------
  function toJS(v) { return v && v.toJS ? v.toJS() : v; }
  // Text as plain lowercase-able ASCII: accents removed so "fiancé" matches "fiance"
  function str(v) { return typeof v === 'string' ? v.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : ''; }
  function words(text) { return (text.toLowerCase().match(/[a-z0-9£'’]+(?:-[a-z0-9£'’]+)*/g) || []); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Matches the keyword as a phrase, allowing plurals ("visa" ~ "visas") and hyphens/spaces.
  function kwRegex(kw) {
    var parts = words(kw).map(function (w) { return esc(w.replace(/(es|s)$/, '')) + '(?:s|es)?'; });
    if (!parts.length) return null;
    return new RegExp('(^|[^a-z0-9])' + parts.join('[\\s/-]+') + '(?=$|[^a-z0-9])', 'gi');
  }
  function has(text, kw) { var r = kwRegex(kw); return !!(r && str(text) && r.test(text)); }
  function count(text, kw) { var r = kwRegex(kw); if (!r) return 0; var m = str(text).match(r); return m ? m.length : 0; }

  // Collect the readable text of a page from its fields.
  function pageText(d, isHome) {
    var out = [];
    out.push(isHome ? str(d.heroHeading) : str(d.h1));
    out.push(isHome ? str(d.heroIntro) : str(d.intro));
    if (isHome) out.push(str(d.advisersIntro));
    (d.eligibility || []).forEach(function (x) { out.push(str(x)); });
    (d.documents || []).forEach(function (x) { out.push(str(x)); });
    (d.body || []).forEach(function (x) { out.push(str(x)); });
    (d.sections || []).forEach(function (s) { if (s) { out.push(str(s.heading)); out.push(str(s.text)); } });
    (d.faqs || []).forEach(function (f) { if (f) { out.push(str(f.q)); out.push(str(f.a)); } });
    return out.join(' \n ');
  }

  // ---------- the checks (worth 100 points in total) ----------
  function analyse(d, slug, isHome) {
    var kw = str(d.focusKeyword).trim();
    var title = str(d.title), desc = str(d.description);
    var h1 = isHome ? str(d.heroHeading) : str(d.h1);
    var intro = isHome ? str(d.heroIntro) : str(d.intro);
    var text = pageText(d, isHome);
    var total = words(text).length;
    var headings = (d.sections || []).map(function (s) { return s ? str(s.heading) : ''; })
      .concat((d.faqs || []).map(function (f) { return f ? str(f.q) : ''; })).join(' | ');
    var faqs = (d.faqs || []).filter(function (f) { return f && f.q && f.a; }).length;
    var occurrences = kw ? count(text, kw) : 0;
    var density = total ? (occurrences / total) * 100 : 0;
    var urlWords = slug.replace(/-/g, ' ');
    var r = kwRegex(kw);
    var titlePos = -1;
    if (r) { r.lastIndex = 0; var m = r.exec(title.toLowerCase()); titlePos = m ? m.index : -1; }

    var checks = [];
    function add(points, ok, good, bad, partial) {
      checks.push({ points: points, got: ok === true ? points : ok === 'half' ? Math.round(points / 2) : 0, ok: ok, text: ok === true ? good : (ok === 'half' && partial ? partial : bad) });
    }
    if (!kw) return { kw: '', score: 0, checks: [], total: total, faqs: faqs };

    add(10, has(title, kw), 'Focus keyword is in the Google title.', 'Add the focus keyword to the Google title.');
    add(5, titlePos >= 0 && titlePos <= title.length / 2, 'Focus keyword is near the start of the title.', 'Move the focus keyword nearer the start of the title.');
    add(10, has(desc, kw), 'Focus keyword is in the Google description.', 'Add the focus keyword to the Google description.');
    add(8, isHome ? true : has(urlWords, kw) ? true : words(kw).some(function (w) { return has(urlWords, w); }) ? 'half' : false,
      isHome ? 'Homepage address is fine.' : 'Focus keyword is in the page address (URL).',
      'The page address (URL) doesn’t contain the keyword. Only your developer can change addresses, so this is just for information.',
      'Part of the focus keyword is in the page address (URL).');
    add(10, has(h1, kw), 'Focus keyword is in the page heading.', 'Add the focus keyword to the page heading.');
    add(8, has(intro, kw), 'Focus keyword is in the introduction.', 'Use the focus keyword in the introduction (the text under the heading).');
    add(7, has(headings, kw), 'Focus keyword is in a guide heading or FAQ question.', 'Use the focus keyword in at least one guide section heading or FAQ question.');
    add(10, total >= 600 ? true : total >= 300 ? 'half' : false,
      'Content length is good (' + total + ' words).',
      'Content is short (' + total + ' words). Aim for at least 600 words, for example by adding guide sections.',
      'Content is ' + total + ' words. Aim for 600 or more.');
    add(8, density >= 0.5 && density <= 2.5 ? true : occurrences > 0 ? 'half' : false,
      'Keyword density is good (' + density.toFixed(1) + '%, used ' + occurrences + ' times).',
      'The focus keyword isn’t used in the page text yet.',
      density > 2.5 ? 'Keyword used too often (' + density.toFixed(1) + '%). Google may see it as stuffing; aim for 0.5–2.5%.'
        : 'Keyword density is low (' + density.toFixed(1) + '%). Use it a few more times naturally; aim for 0.5–2.5%.');
    add(6, title.length >= 30 && title.length <= 60 ? true : title.length > 0 && title.length <= 65 ? 'half' : false,
      'Title length is good (' + title.length + ' characters).',
      'Title is ' + title.length + ' characters. Aim for 30–60 so Google shows it in full.',
      'Title is ' + title.length + ' characters. 30–60 is ideal.');
    add(6, desc.length >= 120 && desc.length <= 160 ? true : desc.length >= 50 ? 'half' : false,
      'Description length is good (' + desc.length + ' characters).',
      'Description is ' + desc.length + ' characters. Aim for 120–160.',
      'Description is ' + desc.length + ' characters. 120–160 is ideal.');
    add(6, faqs >= 3 ? true : faqs >= 1 ? 'half' : false, faqs + ' FAQs. Google can show these in search results.', 'Add at least 3 FAQs. Google can show them in search results.', 'Only ' + faqs + ' FAQ' + (faqs === 1 ? '' : 's') + '. Add a few more (3 or more).');
    add(6, !!d.shareImage, 'This page has its own social sharing image.', 'No social sharing image for this page (the default one will be used). Optional.');

    var score = checks.reduce(function (a, c) { return a + c.got; }, 0);
    return { kw: kw, score: score, checks: checks, total: total, faqs: faqs };
  }

  // ---------- the panel ----------
  function makePanel(isHome) {
    return createClass({
      render: function () {
        var entry = this.props.entry;
        var d = toJS(entry.get('data')) || {};
        var slug = isHome ? '' : (entry.get('slug') || '');
        var res = analyse(d, slug, isHome);
        var colour = res.score >= 80 ? 'good' : res.score >= 50 ? 'ok' : 'bad';
        var title = str(d.title), desc = str(d.description);
        var shortTitle = title.length > 60 ? title.slice(0, 58) + '…' : title;
        var shortDesc = desc.length > 160 ? desc.slice(0, 157) + '…' : desc;
        var url = SITE + (slug ? ' › ' + slug.replace(/-/g, '-') : '');

        return h('div', { className: 'seo' },
          h('div', { className: 'seo-head' },
            h('div', { className: 'seo-score ' + (res.kw ? colour : 'none') },
              h('strong', {}, res.kw ? String(res.score) : '–'), h('span', {}, '/100')),
            h('div', {},
              h('h2', {}, 'SEO score'),
              h('p', {}, res.kw ? 'Focus keyword: “' + res.kw + '”' : 'Add a focus keyword (in the SEO fields near the bottom) to see your score.'))),

          h('h3', {}, 'Google preview'),
          h('div', { className: 'serp' },
            h('div', { className: 'serp-url' }, url),
            h('div', { className: 'serp-title' }, shortTitle || 'Add a Google title'),
            h('div', { className: 'serp-desc' }, shortDesc || 'Add a Google description.')),
          h('p', { className: 'seo-small' }, 'Title ' + title.length + '/60 characters · Description ' + desc.length + '/160 characters'),

          d.noindex ? h('p', { className: 'seo-warn' }, 'This page is hidden from Google (“hide this page from Google” is switched on).') : null,

          res.kw ? h('h3', {}, 'Checklist') : null,
          res.kw ? h('ul', { className: 'checks' }, res.checks.map(function (c, i) {
            var cls = c.ok === true ? 'pass' : c.ok === 'half' ? 'half' : 'fail';
            var icon = c.ok === true ? '✓' : c.ok === 'half' ? '!' : '✕';
            return h('li', { key: i, className: cls }, h('span', { className: 'ic' }, icon), h('span', {}, c.text));
          })) : null,

          h('p', { className: 'seo-small' }, 'Tip: write for people first. Use the keyword naturally — in the title, description, heading, introduction and a guide section — and keep each page focused on one main search.'));
      },
    });
  }

  CMS.registerPreviewStyle(
    'body{font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#1F2A24;margin:0;padding:24px;background:#fff}' +
    '.seo h2{margin:0;font-size:20px}.seo h3{margin:24px 0 10px;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#4A5A51}' +
    '.seo-head{display:flex;align-items:center;gap:16px}.seo-head p{margin:4px 0 0;color:#4A5A51}' +
    '.seo-score{width:84px;height:84px;border-radius:50%;display:flex;align-items:baseline;justify-content:center;padding-top:22px;box-sizing:border-box;color:#fff;flex:none}' +
    '.seo-score strong{font-size:30px;line-height:1}.seo-score span{font-size:12px;opacity:.85;margin-left:2px}' +
    '.seo-score.good{background:#1E8E3E}.seo-score.ok{background:#E37400}.seo-score.bad{background:#C5221F}.seo-score.none{background:#9AA5A0}' +
    '.serp{border:1px solid #E3E7E4;border-radius:10px;padding:14px 16px;font-family:Arial,sans-serif;max-width:600px}' +
    '.serp-url{font-size:13px;color:#202124}.serp-title{font-size:20px;color:#1A0DAB;margin:4px 0;line-height:1.3}.serp-desc{font-size:14px;color:#4D5156;line-height:1.5}' +
    '.seo-small{font-size:13px;color:#6B7A72}.seo-warn{background:#FFF4E5;border-left:4px solid #E37400;padding:10px 12px;border-radius:6px}' +
    '.checks{list-style:none;margin:0;padding:0}.checks li{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #EEF1EF;font-size:14px;line-height:1.45}' +
    '.ic{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex:none;margin-top:1px}' +
    '.pass .ic{background:#1E8E3E}.half .ic{background:#E37400}.fail .ic{background:#C5221F}',
    { raw: true }
  );
  // ---------- Password field with a "Generate password" button (Client forms) ----------
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  function newPassword() {
    var bytes = new Uint32Array(12); window.crypto.getRandomValues(bytes);
    var out = ''; for (var i = 0; i < 12; i++) { out += ALPHABET[bytes[i] % ALPHABET.length]; if (i === 3 || i === 7) out += '-'; }
    return out;
  }
  CMS.registerWidget('password', createClass({
    render: function () {
      var self = this, value = this.props.value || '';
      return h('div', { className: this.props.classNameWrapper, style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
        h('input', { id: this.props.forID, type: 'text', value: value, autoComplete: 'off', style: { flex: '1 1 220px', fontFamily: 'monospace', fontSize: '16px', border: 0, outline: 'none', background: 'transparent' },
          onChange: function (e) { self.props.onChange(e.target.value); } }),
        h('button', { type: 'button', style: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #14532D', background: '#14532D', color: '#fff', cursor: 'pointer' },
          onClick: function () { self.props.onChange(newPassword()); } }, 'Generate password'),
        value ? h('button', { type: 'button', style: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #14532D', background: '#fff', color: '#14532D', cursor: 'pointer' },
          onClick: function () { try { navigator.clipboard.writeText(value); } catch (e) {} } }, 'Copy') : null);
    },
  }), createClass({ render: function () { return h('span', {}, this.props.value ? '••••••••' : '(no password)'); } }));

  CMS.registerPreviewTemplate('pages', makePanel(false));
  CMS.registerPreviewTemplate('blog', makePanel(false));
  CMS.registerPreviewTemplate('home', makePanel(true));
  CMS.registerPreviewTemplate('homepage', makePanel(true));
})();
