import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { interpolate } from '../i18n/messages';
import { MESSAGES, SOURCE_LOCALE } from '../i18n/locales';

export interface I18n {
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  has: (key: string) => boolean;
  terms: (key: string) => string[];
  number: (n: number) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function makeI18n(locale: string): I18n {
  const messages = MESSAGES[locale] ?? MESSAGES[SOURCE_LOCALE] ?? {};
  const fallback = MESSAGES[SOURCE_LOCALE] ?? {};
  const format = new Intl.NumberFormat(locale);
  return {
    locale,
    t: (key, vars) => interpolate(messages[key] ?? fallback[key] ?? key, vars),
    has: (key) => key in messages,
    terms: (key) => (messages[key] ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    number: (n) => format.format(n),
  };
}

export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const value = useMemo(() => makeI18n(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
