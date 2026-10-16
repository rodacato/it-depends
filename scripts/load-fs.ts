import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LocaleBundle } from '../src/i18n/messages';
import { flatten } from '../src/i18n/messages';
import type { RawContent } from '../src/content/validate';

const root = join(import.meta.dirname, '..', 'src');
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

export function readRawContent(): RawContent {
  const dir = join(root, 'content', 'chapters');
  return {
    company: readJson(join(root, 'content', 'company.json')),
    sources: readJson(join(root, 'content', 'sources.json')),
    chapters: readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => readJson(join(dir, f))),
  };
}

export function readLocales(): LocaleBundle[] {
  const dir = join(root, 'i18n', 'locales');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const files = readdirSync(join(dir, d.name)).filter((f) => f.endsWith('.json'));
      const messages = Object.assign({}, ...files.map((f) => flatten(readJson(join(dir, d.name, f)) as never)));
      return { locale: d.name, messages };
    })
    .sort((a, b) => (a.locale === 'en' ? -1 : b.locale === 'en' ? 1 : a.locale.localeCompare(b.locale)));
}
