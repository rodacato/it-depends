import type { CriterionResult } from '../engine/rubric';
import type { Chapter } from '../engine/schema';
import type { AdrEvaluation } from '../host/HostBridge';
import { sourceById } from '../content';
import { useI18n } from './i18n';
import { Vellum } from './Vellum';

interface Props {
  chapter: Chapter;
  letter: string;
  results: CriterionResult[];
  sensei: AdrEvaluation | null | 'pending';
  embedded: boolean;
  hasNext: boolean;
  onNext: () => void;
  onRestore: () => void;
  onEditAdr: () => void;
}

// No verdict, no score: the board says what the ADR already answers and where it would push.
export function ReviewPanel({ chapter, letter, results, sensei, embedded, hasNext, onNext, onRestore, onEditAdr }: Props) {
  const { t } = useI18n();
  const base = `chapters.${chapter.id}`;
  const met = new Set(results.filter((r) => r.met).map((r) => r.criterionId));
  return (
    <Vellum x={760} y={50} w={644} rotate={-1} className="review" label={t('ui.review.title', { letter })} testId="review" from="top">
      <div className="kicker mono">{t('ui.review.kicker', { letter })}</div>
      <h2 className="lbl">{t('ui.review.title', { letter })}</h2>
      <ol className="questions">
        {chapter.review.questions.map((q, i) => {
          const answered = q.criteria.filter((c) => met.has(c));
          const open = q.criteria.filter((c) => !met.has(c));
          const comment = sensei && sensei !== 'pending' ? sensei.questions.find((x) => x.id === q.id)?.comment : undefined;
          return (
            <li key={q.id} data-testid={`question-${q.id}`}>
              <span className="num lbl">{i + 1}</span>
              <p className="lbl q">{t(`${base}.review.${q.id}`)}</p>
              {answered.map((c) => (
                <p key={c} className="mono answered">
                  <b>{t('ui.review.answered')}</b> {t(`${base}.rubric.${c}`)}
                </p>
              ))}
              {open.map((c) => (
                <p key={c} className="mono press">
                  <b>{t('ui.review.press')}</b> {t(`${base}.rubric.${c}`)}
                </p>
              ))}
              {comment && <p className="mono sensei">{comment}</p>}
            </li>
          );
        })}
      </ol>
      {sensei === 'pending' && <p className="mono dim">{t('ui.review.senseiPending')}</p>}
      {sensei && sensei !== 'pending' && (
        <p className="mono sensei-summary">
          <b>{t('ui.review.senseiTitle')}</b> {sensei.summary}
        </p>
      )}
      {!embedded && <p className="mono dim small">{t('ui.review.standalone')}</p>}
      <p className="disagree mono">
        <b>{t('ui.briefing.disagreement')}</b> {t(`${base}.disagreement`)}
      </p>
      <p className="closing lbl">{t('ui.review.closing')}</p>
      <div className="read-next mono">
        <b>{t('ui.review.readNext')}</b> {t(`${base}.readNext`)}
        <ul>
          {chapter.readNext.map((id) => {
            const s = sourceById(id);
            return s ? (
              <li key={id}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}{' '}
                · {s.authors}, {s.year}
              </li>
            ) : null;
          })}
        </ul>
      </div>
      <div className="actions">
        <button type="button" className="link mono" onClick={onEditAdr}>
          {t('ui.review.editAdr')}
        </button>
        <button type="button" className="link mono red" onClick={onRestore} data-testid="restore">
          {t('ui.review.restore', { letter })}
        </button>
        <button type="button" className="ink-button lbl" onClick={onNext} disabled={!hasNext} data-testid="next-sheet">
          {hasNext ? t('ui.review.next', { n: chapter.number + 1 }) : t('ui.review.noNext', { n: chapter.number + 1 })}
        </button>
      </div>
    </Vellum>
  );
}
