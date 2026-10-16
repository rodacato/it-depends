import type { Adr } from '../engine/rubric';
import type { AdrField, Chapter } from '../engine/schema';
import { ADR_FIELDS } from '../engine/schema';
import { useI18n } from './i18n';
import { Vellum } from './Vellum';

interface Props {
  chapter: Chapter;
  number: number;
  title: string;
  letter: string;
  quarterLabel: string;
  adr: Adr;
  onChange: (field: AdrField, value: string) => void;
  onSubmit: () => void;
}

// Michael Nygard's ADR format, plus what was given up and when to revisit.
export function AdrPanel({ chapter, number, title, letter, quarterLabel, adr, onChange, onSubmit }: Props) {
  const { t } = useI18n();
  const filled = ADR_FIELDS.filter((f) => adr[f].trim()).length;
  const criteriaFor = (f: AdrField) => chapter.rubric.filter((c) => c.field === f);
  return (
    <Vellum x={380} y={50} w={1024} rotate={-0.8} className="adr" label={t('ui.adr.kicker', { n: number, title })} testId="adr" from="top">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="adr-head">
          <div>
            <div className="kicker mono">{t('ui.adr.kicker', { n: String(number).padStart(3, '0'), title })}</div>
            <div className="mono status">{t('ui.adr.status', { letter, quarter: quarterLabel })}</div>
          </div>
          <div className="mono dim">{t('ui.adr.nygard')}</div>
        </div>
        <div className="adr-grid">
          {ADR_FIELDS.map((f) => (
            <label key={f} className={`field field-${f}`}>
              <span className="lbl">{t(`ui.adr.fields.${f}`)}</span>
              {criteriaFor(f).map((c) => (
                <span key={c.id} className="mono criterion" data-testid={`criterion-${c.id}`}>
                  <b>{t('ui.adr.boardLooksFor')}</b> {t(`chapters.${chapter.id}.rubric.${c.id}`)}
                </span>
              ))}
              <textarea
                value={adr[f]}
                maxLength={1200}
                rows={f === 'context' || f === 'consequences' ? 3 : 2}
                placeholder={t(`ui.adr.hints.${f}`)}
                onChange={(e) => onChange(f, e.target.value)}
                data-testid={`adr-${f}`}
              />
            </label>
          ))}
        </div>
        <p className="mono dim small rubric-note">{t('ui.adr.rubricNote')}</p>
        <div className="actions">
          <span className="mono hint">{t('ui.adr.progress', { n: filled, total: ADR_FIELDS.length })}</span>
          <button type="submit" className="ink-button lbl" disabled={filled < 2} data-testid="submit-adr">
            {t('ui.adr.submit')}
          </button>
        </div>
      </form>
    </Vellum>
  );
}
