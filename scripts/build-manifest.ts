import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCampaign } from '../src/content/validate';
import { buildManifest } from '../src/host/manifest';
import { readLocales, readRawContent } from './load-fs';

// Writes the Dojo scroll manifest next to index.html, generated from the content so it never drifts.
const campaign = parseCampaign(readRawContent());
const locales = Object.fromEntries(readLocales().map((l) => [l.locale, l.messages]));
const manifest = buildManifest(campaign, locales);
const out = join(import.meta.dirname, '..', 'public', 'scroll.json');
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${out}: ${manifest.units.length} units, locales ${manifest.locales.join(', ')}`);
