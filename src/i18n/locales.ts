import type { LocaleBundle, Messages } from './messages';
import { flatten } from './messages';

// Adding a locale is adding a folder with the same files; nothing here changes.
const files = import.meta.glob<{ default: Record<string, never> }>('./locales/*/*.json', { eager: true });

export const SOURCE_LOCALE = 'en';

function collect(): Record<string, Messages> {
  const out: Record<string, Messages> = {};
  for (const [path, mod] of Object.entries(files)) {
    const locale = path.split('/')[2];
    if (!locale) continue;
    out[locale] = { ...(out[locale] ?? {}), ...flatten(mod.default) };
  }
  return out;
}

export const MESSAGES = collect();
export const LOCALES = Object.keys(MESSAGES).sort((a, b) => (a === SOURCE_LOCALE ? -1 : b === SOURCE_LOCALE ? 1 : a.localeCompare(b)));

export function bundles(): LocaleBundle[] {
  return LOCALES.map((locale) => ({ locale, messages: MESSAGES[locale] ?? {} }));
}

// English first, then any locale whose language matches the browser's (es, es-AR → es-MX).
export function detectLocale(preferred: readonly string[]): string {
  for (const tag of preferred) {
    if (LOCALES.includes(tag)) return tag;
    const lang = tag.split('-')[0]?.toLowerCase();
    const match = LOCALES.find((l) => l.split('-')[0] === lang);
    if (match) return match;
  }
  return SOURCE_LOCALE;
}
