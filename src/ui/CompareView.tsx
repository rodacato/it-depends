import { useMemo, useState } from 'react';
import { slotOrder } from '../city/layout';
import { campaign } from '../content';
import { chapterWindow, snapshotAt } from '../engine/queries';
import type { Chapter, Decision } from '../engine/schema';
import type { Timeline } from '../engine/simulate';
import { simulate } from '../engine/simulate';
import { useI18n } from './i18n';
import type { Playhead } from './scene';
import { buildScene } from './scene';
import { SiteSheet } from './SiteSheet';
import { finalState, timelapseAt, timelapseDuration } from './timelapse';
import type { RevisionRow } from './TitleBlock';
import { useClock } from './useClock';

interface Props {
  chapter: Chapter;
  letter: string;
  original: Decision[];
  alternate: Decision[];
  seed: number;
  untilQuarter: number;
  reducedMotion: boolean;
  onLocale: (l: string) => void;
  onKeep: () => void;
  onAdopt: () => void;
}

// Two cities, same company, one different decision, growing in sync on one clock.
export function CompareView({ chapter, letter, original, alternate, seed, untilQuarter, reducedMotion, onLocale, onKeep, onAdopt }: Props) {
  const { t } = useI18n();
  const [run, setRun] = useState(0);
  const window = { start: chapterWindow(chapter).start, end: untilQuarter };
  const left = useMemo(() => simulate(campaign, original, { seed, untilQuarter }), [original, seed, untilQuarter]);
  const right = useMemo(() => simulate(campaign, alternate, { seed, untilQuarter }), [alternate, seed, untilQuarter]);
  // One shared slot order, so both cities put the same building on the same lot.
  const order = useMemo(() => slotOrder([...left.snapshots, ...right.snapshots].map((s) => s.topology)), [left, right]);
  const leftScene = useMemo(() => buildScene(left, window, order), [left, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const rightScene = useMemo(() => buildScene(right, window, order), [right, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const clouds = Math.max(leftScene.clouds.length, rightScene.clouds.length);
  const quarters = window.end - window.start;
  const duration = timelapseDuration(clouds);
  const ms = useClock(!reducedMotion, run, duration);
  const state = reducedMotion ? finalState(quarters, clouds) : timelapseAt(ms, quarters, clouds);
  const playhead: Playhead = state.done ? { kind: 'end' } : { kind: 'playing', state };
  const rowsFor = (tl: Timeline, mark: string): RevisionRow[] =>
    snapshotAt(tl, window.end).revisions.map((r) => ({
      letter: r.chapterId === chapter.id ? `${r.letter}${mark}` : r.letter,
      issued: t('ui.quarterShort', { q: (r.quarter % 4) + 1, y: Math.floor(r.quarter / 4) + 1 }),
      description: t(`chapters.${r.chapterId}.options.${r.optionId}.title`),
      chapterId: r.chapterId,
    }));

  return (
    <div className="compare" data-testid="compare-view">
      <header className="compare-bar">
        <div>
          <div className="mono k">{t('ui.rewind.kicker', { letter })}</div>
          <h2 className="lbl">{t('ui.rewind.compareTitle')}</h2>
        </div>
        <div className="actions">
          <button type="button" className="link mono" onClick={() => setRun((r) => r + 1)} data-testid="replay">
            {t('ui.rewind.replay')}
          </button>
          <button type="button" className="ink-button lbl light" onClick={onKeep} data-testid="keep">
            {t('ui.rewind.keep', { letter })}
          </button>
          <button type="button" className="ink-button lbl light" onClick={onAdopt} data-testid="adopt">
            {t('ui.rewind.adopt')}
          </button>
        </div>
      </header>
      <div className="compare-sheets">
        {[
          { key: 'l', tl: left, scene: leftScene, label: t('ui.rewind.left', { letter }), mark: '' },
          { key: 'r', tl: right, scene: rightScene, label: t('ui.rewind.right', { letter }), mark: '′' },
        ].map((side) => (
          <div key={side.key} className="compare-side">
            <div className="compare-label lbl">{side.label}</div>
            <SiteSheet
              label={side.label}
              caption={side.label}
              timeline={side.tl}
              scene={side.scene}
              window={window}
              playhead={playhead}
              preview={null}
              rows={rowsFor(side.tl, side.mark)}
              sheetNumber={chapter.number}
              sheets={campaign.chapters.length}
              interactive={state.done}
              reducedMotion={reducedMotion}
              onLocale={onLocale}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
