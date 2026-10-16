import { describe, expect, it } from 'vitest';
import { readLocales, readRawContent } from '../../scripts/load-fs';
import { parseCampaign } from '../content/validate';
import { buildManifest } from './manifest';

describe('course manifest', () => {
  const campaign = parseCampaign(readRawContent());
  const manifest = buildManifest(campaign, Object.fromEntries(readLocales().map((l) => [l.locale, l.messages])));

  it('follows the Dojo scroll manifest shape', () => {
    expect(manifest.id).toMatch(/^[a-z0-9][a-z0-9-]{0,62}$/);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(manifest.protocol).toBe(0);
    expect(manifest.capabilities.every((c) => ['progress', 'run', 'llm'].includes(c))).toBe(true);
  });

  it('has a title and description in every locale, and unique unit ids with titles', () => {
    for (const l of manifest.locales) {
      expect(manifest.title[l]).toBeTruthy();
      expect(manifest.description[l]).toBeTruthy();
    }
    const ids = manifest.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of manifest.units) for (const l of manifest.locales) expect(u.title[l]).toBeTruthy();
  });

  it('declares progress as required and llm as optional', () => {
    expect(manifest.requiredCapabilities).toEqual(['progress']);
    expect(manifest.optionalCapabilities).toEqual(['llm']);
  });
});
