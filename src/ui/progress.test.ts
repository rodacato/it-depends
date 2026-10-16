import { describe, expect, it } from 'vitest';
import { freshProgress, loadProgress, restoreFromHost } from './progress';

const chapters = ['reversibility', 'complexity', 'technology'];
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

  it('treats damaged local storage as a fresh, flagged start', () => {
    const r = loadProgress({ getItem: () => '{not json' });
    expect(r.damaged).toBe(true);
    expect(r.progress.decisions).toEqual([]);
  });
});
