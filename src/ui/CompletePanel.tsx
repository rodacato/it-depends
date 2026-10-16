import type { Forces } from '../engine/schema';
import { FORCE_IDS } from '../engine/schema';
import { useI18n } from './i18n';
import type { RevisionRow } from './TitleBlock';
import { Vellum } from './Vellum';

interface Props {
  rows: RevisionRow[];
  start: Forces;
  end: Forces;
  onClose: () => void;
  onNewCampaign: () => void;
}

// The last sheet: the whole revision history, and where the forces ended up. Still no score.
export function CompletePanel({ rows, start, end, onClose, onNewCampaign }: Props) {
  const { t } = useI18n();
  return (
    <Vellum x={640} y={52} w={766} rotate={-0.8} className="complete" label={t('ui.complete.title')} testId="complete" from="top">
      <div className="kicker mono">{t('ui.complete.kicker', { n: rows.length })}</div>
      <h2 className="lbl">{t('ui.complete.title')}</h2>
      <p className="mono voice">{t('ui.complete.voice')}</p>
      <ol className="history mono">
        {rows.map((r) => (
          <li key={r.letter}>
            <b className="lbl">{r.letter}</b>
            <span className="q">{r.issued}</span>
            <span>{r.description}</span>
          </li>
        ))}
      </ol>
      <dl className="forces mono">
        {FORCE_IDS.map((f) => (
          <div key={f}>
            <dt>{t(`ui.forces.${f}`)}</dt>
            <dd>
              {Math.round(start[f])} → <b>{Math.round(end[f])}</b>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mono dim">{t('ui.complete.rewind')}</p>
      <p className="closing lbl">{t('ui.review.closing')}</p>
      <div className="actions">
        <button type="button" className="link mono" onClick={onNewCampaign} data-testid="complete-new">
          {t('ui.cover.newCampaign')}
        </button>
        <button type="button" className="ink-button lbl" onClick={onClose}>
          {t('ui.complete.close')}
        </button>
      </div>
    </Vellum>
  );
}
