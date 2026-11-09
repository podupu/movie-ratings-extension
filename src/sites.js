// Site adapters: one entry per supported website.
//
// To support a new site:
//   1. Add an entry below.
//   2. Add the site's URL pattern to "content_scripts.matches" in manifest.json.
//   3. Reload the extension at chrome://extensions.
//
// Fields:
//   name     – label for logs
//   host     – regex tested against location.hostname
//   title    – CSS selector for the element that carries the movie title
//   kind     – 'cinema' (new releases, films only) or 'ott' (streaming catalogue:
//              films and series of any year). Defaults to 'cinema'.
//   overlay  – true: pin the badge on top of the poster instead of after the title
//   path     – (optional) regex tested against location.pathname, for sites that
//              share a host with non-video pages (e.g. amazon.com/gp/video)
//   getTitle – (optional) el => string; defaults to MR_readTitle
//   anchor   – (optional) element to put the badge after; defaults to the title element
//
// Streaming apps use generated CSS class names that change often, so their
// adapters match links by URL shape (e.g. "/detail/…") instead. ":has(img)"
// keeps the poster link and skips the plain-text link to the same title.

// Reads a title from a link/card: aria-label → title attribute → poster alt → text.
// eslint-disable-next-line no-unused-vars
function MR_readTitle(el) {
  const img = el.querySelector('img[alt]');
  const candidates = [
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    img && img.getAttribute('alt'),
    textWithoutBadges(el)
  ];
  for (const c of candidates) {
    const t = MR_cleanOttTitle(c || '');
    if (t) return t;
  }
  return '';
}

// The badge itself sits inside the link, so leave its text out.
function textWithoutBadges(el) {
  if (!el.querySelector('.mr-badge')) return el.textContent;
  const copy = el.cloneNode(true);
  copy.querySelectorAll('.mr-badge').forEach((b) => b.remove());
  return copy.textContent;
}

// Language / dub tags that streaming apps add to titles: "Scene (Tamil)",
// "Pushpa 2 [Hindi Dubbed]", "Kantara - Kannada".
const MR_LANG = 'tamil|telugu|hindi|malayalam|kannada|bengali|bangla|marathi|punjabi|gujarati|odia|oriya|' +
  'bhojpuri|assamese|urdu|sinhala|english|korean|japanese|chinese|mandarin|cantonese|thai|indonesian|' +
  'spanish|french|german|italian|portuguese|arabic|turkish|russian|' +
  'dubbed|dub|subbed|subtitled|subtitles|subs?|eng ?sub|dual audio|multi ?audio|audio|original|version|lang(uage)?';
const MR_LANG_IN_BRACKETS = new RegExp(`\\s*[([][^)\\]]*\\b(${MR_LANG})\\b[^)\\]]*[)\\]]`, 'gi');
const MR_LANG_ONLY = new RegExp(`^((${MR_LANG})[\\s,/&+-]*)+$`, 'i');

// Strips the UI copy streaming apps wrap around titles:
//   "Play Stranger Things"                     -> "Stranger Things"
//   "Andor. Select for details on this title." -> "Andor"
//   "The Boys, Season 4"                       -> "The Boys"
//   "Severance S2 E3"                          -> "Severance"
function MR_cleanOttTitle(raw) {
  let t = String(raw).replace(/\s+/g, ' ').trim();
  if (!t) return '';
  t = t.replace(MR_LANG_IN_BRACKETS, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(play|watch|resume|continue watching|more info(rmation)? (on|about)|details for)\s*:?\s+/i, '');
  // Trailing UI sentence after ". " / ", " / " - " / " | ".
  const ui = /^(select|press|click|tap|double tap|watch|play|resume|continue|more info|view|opens?|new|season|series|episode|ep|s\d+(e\d+)?|\d+ seasons?|\d+%|\d+ ?(min|m|h)|movie|film|tv|documentary|added|leaving|top \d+|trailer|rated|available|coming|premieres?|watched|progress|remaining|minutes|hours)(?![a-z])/i;
  const parts = t.split(/(?:\.\s+|,\s+|\s+[|•·]\s+|\s+-\s+)/);
  for (let i = 1; i < parts.length; i++) {
    if (ui.test(parts[i]) || MR_LANG_ONLY.test(parts[i].trim())) {
      t = t.slice(0, t.indexOf(parts[i])).replace(/[\s.,|•·-]+$/, '');
      break;
    }
  }
  return t
    .replace(/\s*\b((season|series) \d+|s\d+(\s*e\d+)?)(?![a-z0-9]).*$/i, '')
    .replace(/\s*\bepisode \d+.*$/i, '')
    .replace(/(\s*[([][^)\]]*[)\]])+\s*$/, '') // trailing "(2024)", "(Director's Cut)" …
    .replace(/[\s:.,-]+$/, '')
    .trim();
}

function ott(name, host, links, extra) {
  return {
    name,
    host,
    kind: 'ott',
    overlay: true,
    title: links.map((l) => `a[href*="${l}"]:has(img)`).join(', '),
    ...extra
  };
}

// eslint-disable-next-line no-unused-vars
const MR_SITES = [
  // ---- Cinemas ----
  {
    name: 'Event Cinemas',
    host: /(^|\.)eventcinemas\.com\.au$/,
    title: 'a.movie-title-link span.title',
    anchor: (el) => el.closest('a.movie-title-link')
  },
  {
    name: 'HOYTS',
    host: /(^|\.)hoyts\.com\.au$/,
    title: 'a.movies-list__link'
  },
  {
    name: 'Village Cinemas',
    host: /(^|\.)villagecinemas\.com\.au$/,
    title: '.movie-card__title'
  },

  // ---- Streaming (global) ----
  ott('Netflix', /(^|\.)netflix\.com$/, ['/watch/', '/title/']),
  ott('Prime Video', /(^|\.)primevideo\.com$/, ['/detail/']),
  ott('Prime Video (Amazon)', /(^|\.)amazon\.(com|com\.au|co\.uk|ca|de|in|co\.jp|fr|it|es)$/, ['/gp/video/detail/'], {
    path: /^\/gp\/video\//
  }),
  ott('Disney+', /(^|\.)disneyplus\.com$/, ['/browse/entity-', '/movies/', '/series/', '/video/']),
  ott('HBO Max', /(^|\.)(max|hbomax)\.com$/, ['/movie/', '/show/', '/movies/', '/shows/']),
  ott('Apple TV+', /^tv\.apple\.com$/, ['/movie/', '/show/']),
  ott('Hulu', /(^|\.)hulu\.com$/, ['/movie/', '/series/']),
  ott('Paramount+', /(^|\.)paramountplus\.com$/, ['/movies/', '/shows/']),
  ott('Peacock', /(^|\.)peacocktv\.com$/, ['/watch/asset/', '/movies/', '/tv/']),
  ott('Tubi', /(^|\.)tubitv\.com$/, ['/movies/', '/series/']),
  ott('MUBI', /(^|\.)mubi\.com$/, ['/films/']),
  ott('Crunchyroll', /(^|\.)crunchyroll\.com$/, ['/series/', '/watch/']),

  // ---- Streaming (Australia) ----
  ott('Stan', /(^|\.)stan\.com\.au$/, ['/programs/', '/watch/']),
  ott('Binge', /(^|\.)binge\.com\.au$/, ['/shows/', '/movies/', '/show/', '/movie/']),
  ott('Foxtel', /(^|\.)foxtel\.com\.au$/, ['/shows/', '/movies/', '/show/', '/movie/']),
  ott('SBS On Demand', /^www\.sbs\.com\.au$/, ['/ondemand/movie/', '/ondemand/tv-series/', '/ondemand/watch/'], {
    path: /^\/ondemand/
  }),
  ott('ABC iview', /^iview\.abc\.net\.au$/, ['/show/', '/video/']),

  // ---- Streaming (India) ----
  ott('JioHotstar', /(^|\.)(hotstar|jiohotstar)\.com$/, ['/movies/', '/shows/']),
  ott('ZEE5', /(^|\.)zee5\.com$/, ['/movies/details/', '/tv-shows/details/', '/web-series/details/']),
  ott('SonyLIV', /(^|\.)sonyliv\.com$/, ['/movies/', '/shows/']),
  ott('Aha', /(^|\.)aha\.video$/, ['/movie/', '/webseries/']),
  ott('Sun NXT', /(^|\.)sunnxt\.com$/, ['/movie/', '/tv/'])
];

if (typeof module !== 'undefined') module.exports = { MR_SITES, MR_readTitle, MR_cleanOttTitle };
