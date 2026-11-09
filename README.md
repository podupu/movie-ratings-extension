# Movie Ratings for Cinemas & Streaming (Chrome extension)

Shows an IMDb rating badge next to each movie title on cinema websites, and on the posters of films and TV series on streaming (OTT) platforms.

Cinemas (the badge appears next to the title):

| Site | Pages |
|---|---|
| Event Cinemas (eventcinemas.com.au) | Sessions |
| HOYTS (hoyts.com.au) | Movies list |
| Village Cinemas (villagecinemas.com.au) | Movies list |

Streaming platforms (the badge is pinned to the top-left of each poster):

| Region | Platforms |
|---|---|
| Global | Netflix, Prime Video (primevideo.com and amazon.*/gp/video), Disney+, HBO Max, Apple TV+, Hulu, Paramount+, Peacock, Tubi, MUBI, Crunchyroll |
| Australia | Stan, Binge, Foxtel, SBS On Demand, ABC iview |
| India | JioHotstar, ZEE5, SonyLIV, Aha, Sun NXT |

Streaming adapters find poster links by their URL shape (e.g. Netflix `/watch/…`, Prime Video `/detail/…`) rather than CSS class names, because those apps change their class names often. The title comes from the link's `aria-label`, its `title`, or the poster's `alt` text. On streaming sites, films and series from any year are matched. On cinema sites, matching still prefers recent films.

You can turn the streaming badges off in Settings.

Badge colours:

- **Green outline**: rating ≥ 7.0 and ≥ 10,000 votes (both configurable)
- **Pale yellow**: fewer votes than your minimum, so the rating may still move
- **Grey**: well below your minimum rating

Hover over a badge to see the vote count plus Rotten Tomatoes and Metacritic scores. Click it to open the film on IMDb.

## Setup (5 minutes)

1. **Get a free OMDb API key** at https://www.omdbapi.com/apikey.aspx (choose FREE, 1,000 requests/day) and activate it from the email.
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Click the extension's toolbar icon to open **Settings**, paste the key, click **Test key**, then **Save**.
5. Open e.g. https://www.eventcinemas.com.au/Sessions. Badges appear next to the titles.

Ratings are cached for 24 hours, so each film costs about 2 API calls per day. Titles are only looked up once they scroll into view. A streaming home page can still show 50–100 titles, so browsing for long periods can use a large share of the free 1,000 lookups/day.

## Project structure

```
manifest.json        Manifest V3 config: which sites the content script runs on
src/sites.js         Site adapters (CSS selector for each site's titles / poster links) + streaming title cleanup
src/content.js       Finds titles, inserts badges, watches for dynamically loaded content
src/background.js    Service worker: OMDb lookup, title matching, caching
src/badge.css        Badge styles
options/             Settings page (API key, thresholds)
icons/               Toolbar/store icons
scripts/             build-store.mjs: builds the Chrome Web Store zip
store/               Store listing text, privacy policy, screenshots
```

## Adding a new site

1. Open the site, right-click a movie title and choose **Inspect**. Find a CSS selector that matches every title (e.g. `.movie-card__title`).
2. Add an entry to `src/sites.js`:
   ```js
   {
     name: 'Reading Cinemas',
     host: /(^|\.)readingcinemas\.com\.au$/,
     title: '.movie-title'          // your selector
   }
   ```
3. Add the URL pattern to `content_scripts.matches` in `manifest.json`, e.g. `"https://*.readingcinemas.com.au/*"`.
4. Click the reload icon on the extension in `chrome://extensions` and refresh the site.

If the selector matches a hidden duplicate (some sites have separate mobile/desktop markup), make it more specific. Use `anchor` to put the badge after a different element than the title.

For a streaming site, use the `ott()` helper with the URL fragments its title pages use:

```js
ott('Kanopy', /(^|\.)kanopy\.com$/, ['/video/', '/product/'])
```

This matches `a[href*="/video/"]:has(img)` (poster links only, not the text link that duplicates it), reads the title from `aria-label`/`alt`, and overlays the badge on the poster.

### Troubleshooting streaming sites

- **No badges at all on one platform.** Its title URLs have changed, or it renders inside a shadow DOM that `querySelectorAll` can't see. Inspect a poster, check its link `href`, and update the fragments in `src/sites.js`.
- **Prime Video on amazon.com.** The content script is only injected when a page *loads* under `/gp/video/`. If you reached Prime Video by clicking through from another Amazon page, refresh once.
- **Wrong title matched.** The aria-label probably contains extra UI text (e.g. "Watch now", "New episodes"). Add the phrase to `MR_cleanOttTitle` in `src/sites.js`.

## How matching works

The site's title is cleaned (classification such as `MA15+` and bracketed text such as `(Hindi)` are removed). Then OMDb is searched, trying `Title - Subtitle` → `Title: Subtitle` → `Title`. An exact title match from the most recent year wins, because cinemas mostly show new releases.

On streaming sites, UI text is stripped first ("Play …", "…, Season 4", "… Select for details"). Then OMDb is searched across movies **and** series. An exact title wins (newest first). If there's no exact match, OMDb's top result is used when it starts with the title. There is no recent-years restriction, because streaming catalogues include older titles.

### When OMDb has no rating

OMDb lags behind IMDb for new releases, and it misses some titles that streaming apps show under an English name while OMDb stores the original one (e.g. the anime *Devils' Crest* / *Demonzu Kuresto*). If OMDb has no match or no rating, the extension asks IMDb's own title search for an **exact** title match, then reads the live rating from IMDb. On cinema sites the same cross-check runs when OMDb's match is more than 2 years old. That's usually a sign OMDb doesn't have the new film yet and matched an older title with the same name: for *Verity* it would pick a 2013 short instead of the 2026 film. These fallback results have no Rotten Tomatoes or Metacritic scores.

## Publishing to the Chrome Web Store

```
node scripts/build-store.mjs      # -> dist/movie-ratings-<version>.zip
```

The store build turns off the IMDb fallback and removes IMDb's host permissions. It also checks the manifest limits the store enforces. Listing text, permission justifications, privacy answers and a privacy policy are in [`store/LISTING.md`](store/LISTING.md) and [`store/privacy-policy.md`](store/privacy-policy.md). Screenshots and the promo tile are in `store/assets/`, and you can re-render them from `store/mock/*.html`.

## Before publishing / commercial use

- OMDb's free tier is for personal use. Check OMDb's terms and use a paid key if you publish this.
- The IMDb fallback calls IMDb's public web endpoints (`v3.sg.media-imdb.com` and `caching.graphql.imdb.com`). IMDb states their data is for limited, non-commercial use only. Remove the fallback in `src/background.js` before any public or commercial release.
- IMDb only allows its data to be used non-commercially without a licence, and it prohibits scraping IMDb pages. For a commercial product, license the data or switch to a source that permits it (e.g. TMDB's API with attribution, under a commercial agreement). The lookup lives entirely in `src/background.js`, so swapping the provider means changing one file.
- Cinema sites change their HTML. If badges stop appearing, update the selectors in `src/sites.js`.
