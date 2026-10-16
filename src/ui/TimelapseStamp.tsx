import { useI18n } from './i18n';
import type { TimelapseState } from './timelapse';

// The rolling counter while the city grows in fast-forward.
export function TimelapseStamp({ state, startQuarter, quarters }: { state: TimelapseState; startQuarter: number; quarters: number }) {
  const { t } = useI18n();
  const totalMonths = quarters * 3;
  const month = Math.min(totalMonths, Math.round(state.quarterProgress * 3));
  const q = startQuarter + Math.min(quarters, Math.floor(state.quarterProgress + 1e-6));
  return (
    <div className="stamp" data-testid="timelapse-stamp" aria-live="polite">
      <div className="mono k">{t('ui.timelapse.stamp', { months: totalMonths })}</div>
      <div className="row">
        <span className="lbl big">{t('ui.quarter', { q: (q % 4) + 1, y: Math.floor(q / 4) + 1 })}</span>
        <span className="mono">{t('ui.timelapse.month', { m: month, total: totalMonths })}</span>
      </div>
      <div className="ticks" aria-hidden="true">
        {Array.from({ length: totalMonths }, (_, i) => (
          <i key={i} className={i < month ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
