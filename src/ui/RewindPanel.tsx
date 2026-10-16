import type { Chapter } from '../engine/schema';
import { MIN_RATIONALE_WORDS } from './BriefingPanel';
import { useI18n } from './i18n';
import { Vellum } from './Vellum';

interface Props {
  chapter: Chapter;
  letter: string;
  issuedOption: string;
  optionId: string | null;
  rationale: string;
  onOption: (id: string) => void;
  onRationale: (s: string) => void;
  onCompare: () => void;
  onCancel: () => void;
}

export function RewindPanel({ chapter, letter, issuedOption, optionId, rationale, onOption, onRationale, onCompare, onCancel }: Props) {
  const { t } = useI18n();
  const base = `chapters.${chapter.id}`;
  const ready = optionId !== null && rationale.trim().split(/\s+/).filter(Boolean).length >= MIN_RATIONALE_WORDS;
  return (
    <Vellum x={820} y={70} w={580} rotate={1.1} className="rewind" label={t('ui.rewind.title', { letter })} testId="rewind" from="top">
      <div className="kicker mono">{t('ui.rewind.kicker', { letter })}</div>
      <h2 className="lbl">{t('ui.rewind.title', { letter })}</h2>
      <p className="mono voice">{t('ui.rewind.pick')}</p>
      <div className="options" role="radiogroup">
        {chapter.dilemma.options
          .filter((o) => o.id !== issuedOption)
          .map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={optionId === o.id} className={`opt ${optionId === o.id ? 'sel' : ''}`} onClick={() => onOption(o.id)} data-testid={`alt-${o.id}`}>
              <span className="opt-body">
                <span className="lbl">{t(`${base}.options.${o.id}.title`)}</span>
                <span className="mono line">
                  <b>{t('ui.briefing.optimizes')}</b> {t(`${base}.options.${o.id}.optimizes`)}
                </span>
                <span className="mono line">
                  <b>{t('ui.briefing.costs')}</b> {t(`${base}.options.${o.id}.costs`)}
                </span>
              </span>
            </button>
          ))}
      </div>
      {optionId && (
        <label className="rationale mono">
          <span>{t('ui.briefing.because')}</span>
          <input value={rationale} maxLength={280} onChange={(e) => onRationale(e.target.value)} placeholder={t('ui.briefing.rationalePlaceholder')} data-testid="alt-rationale" autoFocus />
        </label>
      )}
      <div className="actions">
        <button type="button" className="link mono" onClick={onCancel}>
          {t('ui.rewind.cancel')}
        </button>
        <button type="button" className="ink-button lbl" disabled={!ready} onClick={onCompare} data-testid="compare">
          {t('ui.rewind.compare')}
        </button>
      </div>
    </Vellum>
  );
}
