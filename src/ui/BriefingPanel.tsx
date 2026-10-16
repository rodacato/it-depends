import type { CityModel } from '../city/layout';
import type { Chapter, Context } from '../engine/schema';
import { useI18n } from './i18n';
import { OptionThumb } from './OptionThumb';
import { Vellum } from './Vellum';

interface Props {
  chapter: Chapter;
  totalSheets: number;
  quarterLabel: string;
  context: Context;
  current: CityModel;
  previews: Record<string, CityModel>;
  selected: string | null;
  hovered: string | null;
  rationale: string;
  nextLetter: string;
  variant: string | null;
  onVariant: (id: string | null) => void;
  onHover: (optionId: string | null) => void;
  onSelect: (optionId: string) => void;
  onRationale: (text: string) => void;
  onIssue: () => void;
}

export const MIN_RATIONALE_WORDS = 3;

export function BriefingPanel(p: Props) {
  const { t, number } = useI18n();
  const base = `chapters.${p.chapter.id}`;
  const words = p.rationale.trim().split(/\s+/).filter(Boolean).length;
  const ready = p.selected !== null && words >= MIN_RATIONALE_WORDS;
  return (
    <Vellum x={944} y={50} w={462} rotate={-1.1} className="briefing" label={t(`${base}.title`)} testId="briefing">
      <div className="kicker mono">
        {t('ui.briefing.kicker', { n: p.chapter.number, total: p.totalSheets, quarter: p.quarterLabel, concept: t(`${base}.short`) })}
      </div>
      <h2 className="lbl">{t(`${base}.title`)}</h2>
      <p className="voice mono">
        {t(`${base}.voice`)} {t(`${base}.briefing`)}
      </p>
      <dl className="ctx mono">
        <dt>{t('ui.briefing.team')}</dt>
        <dd>{t('ui.briefing.teamValue', { n: p.context.teamSize })}</dd>
        <dt>{t('ui.briefing.traffic')}</dt>
        <dd>{t('ui.briefing.trafficValue', { n: number(p.context.ordersPerDay) })}</dd>
        <dt>{t('ui.briefing.runway')}</dt>
        <dd>{t('ui.briefing.runwayValue', { n: number(p.context.runwayMonths) })}</dd>
        <dt>{t('ui.briefing.rules')}</dt>
        <dd>{t(`ui.regulation.${p.context.regulation}`)}</dd>
      </dl>
      {p.chapter.contextVariants.length > 0 && (
        <div className="variants mono" role="group" aria-label={t('ui.briefing.contextHint')}>
          <span>{t('ui.briefing.contextHint')}</span>
          <button type="button" className={p.variant === null ? 'on' : ''} aria-pressed={p.variant === null} onClick={() => p.onVariant(null)}>
            {t('ui.briefing.contextToday')}
          </button>
          {p.chapter.contextVariants.map((v) => (
            <button key={v.id} type="button" className={p.variant === v.id ? 'on' : ''} aria-pressed={p.variant === v.id} onClick={() => p.onVariant(v.id)} data-testid={`variant-${v.id}`}>
              {t(`${base}.variants.${v.id}`)}
            </button>
          ))}
        </div>
      )}
      <p className="dilemma lbl">{t(`${base}.dilemma`)}</p>
      <div role="radiogroup" aria-label={t(`${base}.dilemma`)} className="options">
        {p.chapter.dilemma.options.map((o, i) => {
          const letter = String.fromCharCode(65 + i);
          const on = p.selected === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`opt ${on ? 'sel' : ''} ${p.hovered === o.id ? 'hover' : ''}`}
              data-testid={`option-${o.id}`}
              onPointerEnter={() => p.onHover(o.id)}
              onPointerLeave={() => p.onHover(null)}
              onFocus={() => p.onHover(o.id)}
              onBlur={() => p.onHover(null)}
              onClick={() => p.onSelect(o.id)}
            >
              {p.previews[o.id] && <OptionThumb current={p.current} after={p.previews[o.id]!} />}
              <span className="opt-body">
                <span className="opt-title">
                  <i className="letter lbl">{letter}</i>
                  <span className="lbl">{t(`${base}.options.${o.id}.title`)}</span>
                </span>
                <span className="mono line">
                  <b>{t('ui.briefing.optimizes')}</b> {t(`${base}.options.${o.id}.optimizes`)}
                </span>
                <span className="mono line">
                  <b>{t('ui.briefing.costs')}</b> {t(`${base}.options.${o.id}.costs`)}
                </span>
              </span>
              {p.hovered === o.id && <span className="previewing mono">{t('ui.briefing.previewing')}</span>}
            </button>
          );
        })}
      </div>
      {p.variant && <p className="variant-note mono">{t('ui.briefing.variantNote', { name: t(`${base}.variants.${p.variant}`) })}</p>}
      {p.selected && (
        <form
          className="rationale"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) p.onIssue();
          }}
        >
          <label className="mono">
            <span>{t('ui.briefing.because')}</span>
            <input
              value={p.rationale}
              maxLength={280}
              placeholder={t('ui.briefing.rationalePlaceholder')}
              onChange={(e) => p.onRationale(e.target.value)}
              data-testid="rationale"
              autoFocus
            />
          </label>
          <div className="actions">
            <span className="mono hint">{t('ui.briefing.rationaleHint')}</span>
            <button type="submit" className="ink-button lbl" disabled={!ready} data-testid="issue">
              {t('ui.briefing.issue', { letter: p.nextLetter })}
            </button>
          </div>
        </form>
      )}
    </Vellum>
  );
}
