import type { I18n } from './i18n';

export function quarterLabel(i18n: I18n, quarter: number): string {
  return i18n.t('ui.quarter', { q: (quarter % 4) + 1, y: Math.floor(quarter / 4) + 1 });
}
