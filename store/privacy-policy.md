# Privacy Policy – Movie Ratings for Cinemas & Streaming

_Last updated: 9 November 2026_

Movie Ratings for Cinemas & Streaming ("the extension") shows IMDb ratings next to film and TV titles on supported cinema and streaming websites. This policy explains what data the extension handles.

## What the extension reads

On the cinema and streaming websites it supports (listed as the extension's site access in `chrome://extensions`), the extension reads the **titles of the films and TV series shown on the page**, and only those titles. It does not read your account details, viewing history, messages, payment details, or any other page content. It does nothing on other websites.

## What is sent, and to whom

Each title is sent to the **OMDb API (omdbapi.com)** so the extension can look up its rating. The request contains the title and **your own OMDb API key**. It contains no personal information. OMDb's handling of these requests is covered by OMDb's own terms and privacy policy.

No other third party receives any data. The developer runs no servers and receives no data from the extension.

## What is stored

- **In Chrome sync storage:** your OMDb API key and your settings (minimum rating, minimum votes, and whether badges show on streaming sites). If Chrome sync is on, Google syncs these between your signed-in browsers, like other extension settings.
- **In local Chrome storage:** a cache of ratings (title, IMDb ID, rating, vote count) to avoid repeat lookups. Entries expire after 6–24 hours. You can clear the cache at any time from the extension's Settings page.

Uninstalling the extension removes all of this data.

## What the extension does not do

- No analytics, tracking, advertising or fingerprinting.
- No selling or transferring of data to anyone.
- No use of data for any purpose other than showing ratings, including creditworthiness or lending decisions.
- No remotely hosted code.

## Changes

If this policy changes, the updated version will be published at this address with a new "Last updated" date.

## Contact

Use the support link on the extension's Chrome Web Store page.

_Movie Ratings for Cinemas & Streaming is not affiliated with or endorsed by IMDb, OMDb, or any of the cinema or streaming services it supports._
