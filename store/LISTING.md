# Chrome Web Store submission – copy & paste sheet

Everything the developer dashboard asks for, in the order it asks.

## 0. Before you start

1. **Developer account:** https://chrome.google.com/webstore/devconsole. Sign in, pay the one-time US$5 fee, and verify your contact email (Account tab). Publishing is blocked until the email is verified.
2. **Privacy policy URL:** the store needs a public link to `store/privacy-policy.md`. The quickest option is https://gist.github.com: paste the file, name it `privacy-policy.md`, choose **Create public gist**, and copy the URL. A Google Doc shared via *File → Share → Publish to web* also works.
3. **Rebuild the zip** after any code change: `node scripts/build-store.mjs` → `dist/movie-ratings-<version>.zip`. Bump `version` in `manifest.json` for every new upload.

## 1. Upload

Dashboard → **Items** → **+ New item** → upload `dist/movie-ratings-1.0.0.zip`.

## 2. Store listing tab

| Field | Value |
|---|---|
| Description | the block below |
| Category | Lifestyle → **Entertainment** |
| Language | English |
| Store icon (128×128) | `icons/icon128.png` |
| Screenshots (1280×800) | `store/assets/screenshot-1-streaming.png`, `screenshot-2-cinema.png`, `screenshot-3-settings.png` |
| Small promo tile (440×280) | `store/assets/promo-small-440x280.png` |
| Official URL / Homepage | leave empty (or your GitHub repo if you publish one) |
| Support URL | optional: a GitHub issues page or the gist's comments |

**Description:**

```
See the IMDb rating of every film before you book a session or press play.

Movie Ratings adds a small IMDb badge next to each movie title on cinema websites, and on the posters of films and TV series on streaming services.

★ WHERE IT WORKS
• Cinema websites: next to each film in session and movie listings
• Streaming websites: on the poster of each film and TV series

★ BADGES THAT TELL YOU AT A GLANCE
• Green outline – meets your "worth watching" thresholds (default: rating 7.0+ and 10,000+ votes)
• Pale yellow – too few votes yet, the rating may still move
• Grey – well below your minimum rating
Hover a badge to see the vote count, Rotten Tomatoes and Metacritic scores. Click it to open the title on IMDb.

★ SMART TITLE MATCHING
Strips classifications (MA15+), language tags such as "(Tamil)" or "[Hindi Dubbed]", and streaming UI text like "Season 4" before searching. Matches both films and TV series.

★ LIGHT ON YOUR QUOTA, RESPECTFUL OF YOUR PRIVACY
Titles are only looked up once they scroll into view, and ratings are cached for a day. No tracking, no analytics, no servers: titles go straight from your browser to the OMDb API.

SETUP (2 minutes)
Ratings come from the OMDb API, which needs a free personal key:
1. Get a free key at omdbapi.com/apikey.aspx (1,000 lookups/day) and activate it from the email.
2. Click the extension's toolbar icon, paste the key, click "Test key", then "Save".

You can change the rating/vote thresholds or switch off streaming sites in Settings.

Not affiliated with or endorsed by IMDb, OMDb, or any of the cinema or streaming services listed. All trademarks belong to their owners.
```

## 3. Privacy practices tab

**Single purpose description:**

```
Shows the IMDb rating of films and TV series next to their titles on cinema and streaming websites, so users can decide what to watch.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Stores the user's OMDb API key and display settings (minimum rating, minimum votes, streaming on/off), and caches ratings for up to 24 hours so the same title isn't looked up repeatedly. |
| Host permission `https://www.omdbapi.com/*` | The background service worker sends movie titles to the OMDb API, using the user's own API key, to get each title's IMDb rating and vote count. |
| Content script sites (cinema and streaming domains) | The content script runs only on the listed cinema and streaming sites. It reads the movie and TV titles shown on the page and inserts a rating badge next to each one. It reads no other page content and does nothing on other sites. |

**Remote code:** select **No, I am not using remote code**.

**Data usage**, under "What user data do you plan to collect…?":

- Tick **Website content**, because the extension reads movie titles from supported pages and sends them to OMDb to look up ratings.
- Leave every other type unticked: personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity.

Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** the gist or doc URL from step 0.2.

**Test instructions for the reviewer:** look for a reviewer test-instructions field. It's on the Privacy practices or Distribution tab, depending on the dashboard version. If there's no such field, paste this at the end of the description for the first submission and remove it in the next version.

```
The extension needs a free OMDb API key to show ratings. Without one, each badge shows "IMDb: add API key" (clicking it opens Settings).

To test:
1. Get a free key at https://www.omdbapi.com/apikey.aspx (choose FREE; the key arrives by email and must be activated from the link in that email).
2. Click the extension's toolbar icon, paste the key, click "Test key", then "Save".
3. Open https://www.hoyts.com.au/movies or https://www.eventcinemas.com.au/Sessions. A yellow "IMDb ★ x.x" badge appears next to each movie title. Hover for vote counts; click to open the film on IMDb.
4. Streaming sites (e.g. https://www.netflix.com/browse) need a subscriber login; badges appear on the top-left of each poster.
```

To save the reviewer step 1, you can add a line with your own key: `Test key: xxxxxxxx`. Only do this if you're happy for the reviewer to use it; it counts against your 1,000 lookups/day.

## 4. Distribution tab

- Payments: **Free**
- Visibility: **Public**. Choose **Unlisted** if you'd rather share it by link only at first.
- Regions: all regions, or just Australia / India if you prefer.

## 5. Submit

Click **Submit for review**. Because the extension runs on many websites, expect an in-depth review: anywhere from a few days to a couple of weeks. You'll get an email when it's approved or if the reviewer has questions.

## Notes / known review risks

- **Smoke-test the exact store build first.** In `chrome://extensions`, remove (or turn off) your development copy, click **Load unpacked**, and pick `dist/store/`. Check there are no errors on the extension card. Then add your key and confirm badges appear on HOYTS or Event Cinemas and on one streaming site. Re-enable your development copy afterwards.
- **Keyword spam (rejected once: "Yellow Argon").** Don't name cinema chains or streaming services anywhere in the store metadata. That covers the manifest description, the store description, screenshot captions and the promo tile. Describe them generically ("cinema and streaming websites"). The supported domains already show to users as the extension's site access. `scripts/build-store.mjs` fails the build if a supported site's name shows up in the manifest description, the settings page or the description block above.
- **Trademarks.** The badge says "IMDb" and uses a yellow similar to IMDb's. Naming the services to describe compatibility is normally accepted. If a reviewer objects, rename the badge text to "★ 8.1" and change the colour in `src/badge.css`.
- **Data source.** Ratings come from OMDb, which sources them from IMDb. Every user has their own personal OMDb key, and the listing is free and non-commercial. If you ever charge for it or add ads, you'll need licensed data (OMDb paid tier / IMDb licence).
- **IMDb fallback.** It is not in the store build: `scripts/build-store.mjs` turns it off and removes the IMDb host permissions. Store users won't see ratings for titles OMDb doesn't have yet (e.g. *Devils' Crest*, a new *Verity*). Your unpacked development copy still has the fallback.
