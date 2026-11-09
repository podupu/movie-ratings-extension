// Builds the Chrome Web Store package: dist/movie-ratings-<version>.zip
//
//   node scripts/build-store.mjs
//
// Differences from the unpacked development copy:
//   - The IMDb fallback code (between the ">>> IMDB-FALLBACK" / "<<< IMDB-FALLBACK"
//     markers in src/background.js) is removed, and IMDb's hosts are dropped from
//     host_permissions. IMDb's endpoints are only allowed for limited, non-public
//     use. Ratings come from OMDb alone.
//   - Only the files the extension needs are included (no README, scripts, store assets).

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'store');
const FILES = ['manifest.json', 'src', 'options', 'icons'];

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) cpSync(join(root, f), join(out, f), { recursive: true, filter: (p) => !p.endsWith('.DS_Store') });

// 1. Cut out the IMDb fallback. The first block holds constants; the second
//    holds the fallback functions and the wrapping lookup().
const bgPath = join(out, 'src', 'background.js');
const bg = readFileSync(bgPath, 'utf8');
const blocks = bg.match(/\/\/ >>> IMDB-FALLBACK[\s\S]*?\/\/ <<< IMDB-FALLBACK\n/g) || [];
if (blocks.length !== 2) fail(`expected 2 IMDB-FALLBACK blocks in src/background.js, found ${blocks.length}`);
writeFileSync(bgPath, bg
  .replace(blocks[0], '')
  .replace(blocks[1], "async function lookup(title, apiKey, kind = 'cinema') {\n  return lookupOmdb(title, apiKey, kind);\n}\n"));

// 2. Drop IMDb hosts from the manifest.
const manifestPath = join(out, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.host_permissions = manifest.host_permissions.filter((h) => !/imdb\.com/.test(h));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// 3. Checks that would otherwise only surface as store rejections.
if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (manifest.name.length > 75) fail(`name is ${manifest.name.length} chars (max 75)`);
if (manifest.description.length > 132) fail(`description is ${manifest.description.length} chars (max 132)`);
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) fail(`invalid version "${manifest.version}"`);
const referenced = [
  manifest.background.service_worker,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap((c) => [...(c.js || []), ...(c.css || [])])
];
for (const f of referenced) if (!existsSync(join(out, f))) fail(`manifest references missing file ${f}`);
for (const f of ['src/background.js', 'src/content.js', 'src/sites.js', 'options/options.js']) {
  const code = readFileSync(join(out, f), 'utf8');
  const hit = ['media-imdb.com', 'graphql.imdb.com', 'x-imdb-client', 'IMDB-FALLBACK'].find((x) => code.includes(x));
  if (hit) fail(`${f} still contains "${hit}"`);
}
if (manifest.host_permissions.some((h) => /imdb/.test(h))) fail('IMDb host permission still present');
for (const f of manifest.content_scripts[0].js.concat(manifest.background.service_worker)) {
  execFileSync(process.execPath, ['--check', join(out, f)]);
}

// 4. Zip (files at the zip root, as the store expects).
const zip = join(root, 'dist', `movie-ratings-${manifest.version}.zip`);
rmSync(zip, { force: true });
execFileSync('zip', ['-rqX', zip, '.', '-x', '*.DS_Store'], { cwd: out });

console.log(`✓ ${manifest.name} v${manifest.version}`);
console.log(`✓ IMDb fallback code removed; host_permissions: ${manifest.host_permissions.join(', ')}`);
console.log(`✓ ${zip}`);
