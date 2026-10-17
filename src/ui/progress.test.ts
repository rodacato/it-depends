import { describe, expect, it } from 'vitest';
import { freshProgress, loadProgress, restoreFromHost } from './progress';

const chapters = [
  { id: 'reversibility', options: ['payments-port', 'hosted-checkout'] },
  { id: 'complexity', options: ['pricing-engine'] },
  { id: 'technology', options: ['postgres-fts'] },
];
const adr = { context: 'c', decision: 'd', consequences: 'x', givenUp: 'g', revisit: 'r' };

describe('progress', () => {
  it('rebuilds decisions from the host and continues at the next sheet', () => {
    const p = restoreFromHost(freshProgress(), { reversibility: { completed: true, state: { optionId: 'payments-port', rationale: 'why', adr } } }, chapters);
    expect(p.decisions).toEqual([{ chapterId: 'reversibility', optionId: 'payments-port' }]);
    expect(p.completed).toEqual(['reversibility']);
    expect(p.current).toEqual({ chapterId: 'complexity', phase: 'briefing' });
  });

  it('ignores unit states it does not recognise', () => {
    const local = freshProgress();
    expect(restoreFromHost(local, { reversibility: { completed: true, state: { nope: 1 } } }, chapters)).toBe(local);
  });

  it('ignores a decision for an option the chapter no longer has', () => {
    const p = restoreFromHost(
      freshProgress(),
      {
        reversibility: { completed: true, state: { optionId: 'payments-port', adr } },
        complexity: { completed: true, state: { optionId: 'retired-option', adr } },
      },
      chapters,
    );
    expect(p.decisions).toEqual([{ chapterId: 'reversibility', optionId: 'payments-port' }]);
    expect(p.current).toEqual({ chapterId: 'complexity', phase: 'briefing' });
  });

  it('loads a save from before the guide existed without calling it damaged', () => {
    const older: Record<string, unknown> = { ...freshProgress('es-MX'), started: true };
    delete older.walkthroughSeen;
    const r = loadProgress({ getItem: () => JSON.stringify(older) });
    expect(r.damaged).toBe(false);
    expect(r.progress.started).toBe(true);
    expect(r.progress.walkthroughSeen).toBe(false);
  });

  it('treats damaged local storage as a fresh, flagged start', () => {
    const r = loadProgress({ getItem: () => '{not json' });
    expect(r.damaged).toBe(true);
    expect(r.progress.decisions).toEqual([]);
  });
});
