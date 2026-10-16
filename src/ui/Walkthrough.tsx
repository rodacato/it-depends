import { useEffect, useState } from 'react';
import { useI18n } from './i18n';
import { TITLE_BLOCK } from './scene';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Sheet coordinates: each step rings a part of the real sheet and pins its note beside it.
const STEPS: { id: string; target: Rect; note: { x: number; y: number } }[] = [
  { id: 'decide', target: { x: 836, y: 40, w: 580, h: 556 }, note: { x: 440, y: 120 } },
  { id: 'forces', target: { x: 50, y: 764, w: 930, h: 92 }, note: { x: 120, y: 520 } },
  { id: 'log', target: { x: TITLE_BLOCK.x - 8, y: TITLE_BLOCK.y - 8, w: TITLE_BLOCK.w + 16, h: TITLE_BLOCK.h + 16 }, note: { x: 560, y: 560 } },
];

export function walkthroughDisabled(search: string): boolean {
  return new URLSearchParams(search).get('walkthrough') === 'off';
}

interface Props {
  onDone: () => void;
}

export function Walkthrough({ onDone }: Props) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  const next = () => (last ? onDone() : setI(i + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const { x, y, w, h } = step.target;
  return (
    <div className="walkthrough" data-testid="walkthrough">
      <svg className="walkthrough-shade" viewBox="0 0 1440 900" width={1440} height={900} aria-hidden="true">
        <path d={`M0,0 H1440 V900 H0 Z M${x},${y} v${h} h${w} v${-h} Z`} fillRule="evenodd" />
        <rect x={x} y={y} width={w} height={h} className="ring" />
      </svg>
      <section className="vellum walkthrough-note" style={{ left: step.note.x, top: step.note.y }} role="dialog" aria-modal="true" aria-labelledby="walkthrough-title">
        <div className="kicker mono">{t('ui.walkthrough.kicker', { n: i + 1, total: STEPS.length })}</div>
        <h2 className="lbl" id="walkthrough-title">
          {t(`ui.walkthrough.steps.${step.id}.title`)}
        </h2>
        <p className="mono">{t(`ui.walkthrough.steps.${step.id}.body`)}</p>
        <div className="actions">
          <button type="button" className="link mono" onClick={onDone} data-testid="walkthrough-skip">
            {t('ui.walkthrough.skip')}
          </button>
          {i > 0 && (
            <button type="button" className="link mono" onClick={() => setI(i - 1)}>
              {t('ui.walkthrough.back')}
            </button>
          )}
          <button type="button" className="ink-button lbl" onClick={next} autoFocus data-testid="walkthrough-next">
            {last ? t('ui.walkthrough.done') : t('ui.walkthrough.next')}
          </button>
        </div>
      </section>
    </div>
  );
}
