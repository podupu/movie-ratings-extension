// Looks up ratings via the OMDb API (https://www.omdbapi.com), which returns
// IMDb rating + vote count, plus Rotten Tomatoes and Metacritic when available.
// Results are cached in chrome.storage.local so each title is fetched once a day.
//
// OMDb lags behind IMDb for new releases and doesn't know some localised titles
// (e.g. anime listed under the original Japanese name). When OMDb has no match
// or no rating, we fall back to IMDb's own title search and rating endpoints.

// The IMDb fallback blocks (see the >>> / <<< marker comments) are cut out of
// the Chrome Web Store build by scripts/build-store.mjs: IMDb only allows its
// endpoints for limited, non-public, non-commercial use.

const OMDB_URL = 'https://www.omdbapi.com/';
// >>> IMDB-FALLBACK
const IMDB_SUGGEST_URL = 'https://v3.sg.media-imdb.com/suggestion/x/';
const IMDB_GRAPHQL_URL = 'https://caching.graphql.imdb.com/';
// <<< IMDB-FALLBACK
const TTL_FOUND = 24 * 60 * 60 * 1000;   // 1 day (ratings move while a film is new)
const TTL_MISSING = 6 * 60 * 60 * 1000;  // 6 hours
const inFlight = new Map();

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_RATING') {
    getRating(msg.title, msg.kind === 'ott' ? 'ott' : 'cinema')
      .then(sendResponse)
      .catch((err) => sendResponse({ error: String(err?.message || err) }));
    return true; // keep the channel open for the async response
  }
  if (msg?.type === 'TEST_KEY') {
    omdb({ t: 'Inception' }, msg.apiKey)
      .then((d) => sendResponse({ ok: d.Response === 'True', error: d.Error }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }
  if (msg?.type === 'CLEAR_CACHE') {
    chrome.storage.local.clear().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'OPEN_OPTIONS') chrome.runtime.openOptionsPage();
});

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .trim();
}

// "Ramayana - Rise of a Legend" -> also try "Ramayana: Rise of a Legend" and "Ramayana"
function titleVariants(title) {
  const v = [title];
  if (title.includes(' - ')) {
    v.push(title.replace(/ - /g, ': '));
    v.push(title.split(' - ')[0]);
  } else if (title.includes(':')) {
    v.push(title.split(':')[0]);
  }
  return [...new Set(v.map((s) => s.trim()).filter(Boolean))];
}

async function omdb(params, apiKey) {
  const url = new URL(OMDB_URL);
  Object.entries({ ...params, apikey: apiKey }).forEach(([k, val]) => url.searchParams.set(k, val));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);
  return res.json();
}

function toNumber(s) {
  if (!s || s === 'N/A') return null;
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Cinemas mostly show new films, so prefer an exact title match from recent years.
function pickBest(results, wanted, kind = 'cinema') {
  if (kind === 'ott') return pickBestOtt(results, wanted);
  const target = normalize(wanted);
  const thisYear = new Date().getFullYear();
  const year = (r) => parseInt(r.Year, 10) || 0;
  const exact = results.filter((r) => normalize(r.Title) === target);
  const pool = exact.length ? exact : results.filter((r) => year(r) >= thisYear - 2);
  return pool.sort((a, b) => year(b) - year(a))[0] || null;
}

// Streaming catalogues hold films and series of any age: prefer an exact title
// (newest first), otherwise trust OMDb's own relevance order.
function pickBestOtt(results, wanted) {
  const target = normalize(wanted);
  const year = (r) => parseInt(r.Year, 10) || 0;
  const pool = results.filter((r) => r.Type === 'movie' || r.Type === 'series');
  const exact = pool.filter((r) => normalize(r.Title) === target);
  if (exact.length) return exact.sort((a, b) => year(b) - year(a))[0];
  return pool.find((r) => normalize(r.Title).startsWith(target)) || null;
}

async function lookupOmdb(title, apiKey, kind = 'cinema') {
  for (const variant of titleVariants(title)) {
    const params = kind === 'ott' ? { s: variant } : { s: variant, type: 'movie' };
    const search = await omdb(params, apiKey);
    if (search.Response === 'False') {
      if (/api key/i.test(search.Error || '')) throw new Error(search.Error);
      continue;
    }
    const best = pickBest(search.Search || [], variant, kind);
    if (!best) continue;

    const d = await omdb({ i: best.imdbID }, apiKey);
    if (d.Response === 'False') throw new Error(d.Error || 'OMDb error');
    const rating = (src) => (d.Ratings || []).find((r) => r.Source === src)?.Value || null;
    return {
      imdbID: d.imdbID,
      title: d.Title,
      year: d.Year,
      type: d.Type,
      imdbRating: toNumber(d.imdbRating),
      imdbVotes: toNumber(d.imdbVotes),
      rottenTomatoes: rating('Rotten Tomatoes'),
      metacritic: rating('Metacritic')
    };
  }
  return { notFound: true };
}

// >>> IMDB-FALLBACK
// (store build replaces this whole block with:
//    async function lookup(title, apiKey, kind) { return lookupOmdb(title, apiKey, kind); })

const IMDB_TYPES = {
  cinema: ['movie'],
  ott: ['movie', 'tvSeries', 'tvMiniSeries', 'tvMovie', 'tvSpecial']
};

// IMDb's suggestion format is { id, l (title), qid (type), y (year) }. As a
// fallback this only accepts exact title matches (newest first), so a miss
// stays a miss instead of becoming a wrong rating.
function pickImdbSuggestion(items, wanted, kind = 'cinema') {
  const target = normalize(wanted);
  const exact = (items || []).filter((r) =>
    /^tt\d+$/.test(r.id) && IMDB_TYPES[kind].includes(r.qid) && normalize(r.l || '') === target);
  return exact.sort((a, b) => (b.y || 0) - (a.y || 0))[0] || null;
}

async function imdbSearch(title, kind) {
  for (const variant of titleVariants(title)) {
    const q = variant.toLowerCase().replace(/\//g, ' ').trim();
    if (!q) continue;
    const res = await fetch(IMDB_SUGGEST_URL + encodeURIComponent(q) + '.json');
    if (!res.ok) continue;
    const hit = pickImdbSuggestion((await res.json()).d, variant, kind);
    if (hit) return hit;
  }
  return null;
}

async function imdbRating(imdbID) {
  const res = await fetch(IMDB_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-imdb-client-name': 'imdb-web-next-localized' },
    body: JSON.stringify({
      query: `{ title(id: "${imdbID}") { ratingsSummary { aggregateRating voteCount } } }`
    })
  });
  if (!res.ok) return null;
  const r = (await res.json())?.data?.title?.ratingsSummary;
  return r && r.aggregateRating != null ? { rating: r.aggregateRating, votes: r.voteCount ?? null } : null;
}

function fromImdbHit(hit, live) {
  const series = /^tv(Mini)?Series$/.test(hit.qid);
  return {
    imdbID: hit.id,
    title: hit.l,
    year: hit.y ? String(hit.y) + (series ? '–' : '') : '',
    type: series ? 'series' : 'movie',
    imdbRating: live ? live.rating : null,
    imdbVotes: live ? live.votes : null,
    rottenTomatoes: null,
    metacritic: null
  };
}

// OMDb first (it adds Rotten Tomatoes / Metacritic), then a cross-check
// against IMDb when OMDb's answer looks incomplete or stale:
//   - no match, or a match with no rating (OMDb lags on new releases);
//   - on cinema sites, a match older than 2 years. OMDb may not have the new
//     film yet and returns an older one with the same name, e.g. "Verity"
//     (2013 short) instead of "Verity" (2026).
async function lookup(title, apiKey, kind = 'cinema') {
  const res = await lookupOmdb(title, apiKey, kind);
  const resYear = parseInt(res.year, 10) || 0;
  const stale = kind === 'cinema' && !res.notFound && resYear < new Date().getFullYear() - 2;
  if (!res.notFound && res.imdbRating != null && !stale) return res;
  try {
    const hit = await imdbSearch(title, kind);
    if (hit && hit.id !== res.imdbID) {
      const newer = (hit.y || 0) > resYear;
      if (res.notFound || newer || res.imdbRating == null) {
        const live = await imdbRating(hit.id);
        if (live || res.notFound || newer) return fromImdbHit(hit, live);
      }
    }
    if (!res.notFound && res.imdbRating == null) {
      const live = await imdbRating(res.imdbID);
      if (live) return { ...res, imdbRating: live.rating, imdbVotes: live.votes };
    }
  } catch {
    // the IMDb cross-check is best effort
  }
  return res;
}
// <<< IMDB-FALLBACK

async function getRating(title, kind = 'cinema') {
  // Separate cache namespaces: the two kinds match titles differently.
  const key = (kind === 'ott' ? 'o:' : 'r:') + normalize(title);
  const cached = (await chrome.storage.local.get(key))[key];
  const missing = cached && (cached.data.notFound || cached.data.imdbRating == null);
  if (cached && Date.now() - cached.at < (missing ? TTL_MISSING : TTL_FOUND)) {
    return cached.data;
  }

  const { omdbKey } = await chrome.storage.sync.get('omdbKey');
  if (!omdbKey) return { error: 'NO_KEY' };

  if (!inFlight.has(key)) {
    inFlight.set(
      key,
      lookup(title, omdbKey, kind)
        .then(async (data) => {
          await chrome.storage.local.set({ [key]: { at: Date.now(), data } });
          return data;
        })
        .finally(() => inFlight.delete(key))
    );
  }
  return inFlight.get(key);
}

if (typeof module !== 'undefined') module.exports = {
    pickBest, titleVariants, normalize, lookup,
    ...(typeof pickImdbSuggestion === 'function' ? { pickImdbSuggestion } : {})
  };
