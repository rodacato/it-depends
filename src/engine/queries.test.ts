import { describe, expect, it } from 'vitest';
import { campaign } from '../test/campaign';
import { chapterWindow, deltaTone, forceOutcomes, snapshotAt } from './queries';
import { simulate } from './simulate';

describe('forceOutcomes', () => {
  const chapter = campaign.chapters[0]!;
  const { start, end } = chapterWindow(chapter);
  const timeline = simulate(campaign, [{ chapterId: chapter.id, optionId: 'hosted-checkout' }], { seed: 7, untilQuarter: end });
  const outcomes = forceOutcomes(timeline, start, end);

  it('adds up to what the gauges show', () => {
    const before = snapshotAt(timeline, start).forces;
    const after = snapshotAt(timeline, end).forces;
    for (const o of outcomes) expect(o.total).toBeCloseTo(after[o.force] - before[o.force], 1);
  });

  it('splits what the decision moved from what the world moved', () => {
    // The fee is the decision's; the processor outage's refunds are the world's.
    const cost = outcomes.find((o) => o.force === 'cost')!;
    expect(cost.decisions).toBeGreaterThan(0);
    expect(cost.world).toBeGreaterThan(0);
    expect(cost.decisions + cost.world).toBeCloseTo(cost.total, 1);
  });

  it('names the largest single move as the cause', () => {
    for (const o of outcomes) {
      const target = o.cause.target;
      expect('force' in target && target.force).toBe(o.force);
    }
  });

  it('leaves out forces nothing moved', () => {
    const quiet = forceOutcomes(timeline, start, start);
    expect(quiet).toEqual([]);
  });
});

describe('deltaTone', () => {
  it('reads a drop in cost, complexity or cognitive load as better', () => {
    expect(deltaTone({ force: 'cost' }, -5)).toBe('better');
    expect(deltaTone({ force: 'complexity' }, -3)).toBe('better');
    expect(deltaTone({ force: 'cognitiveLoad' }, -8)).toBe('better');
  });

  it('reads a rise in cost as worse, even though the number is positive', () => {
    expect(deltaTone({ force: 'cost' }, 12)).toBe('worse');
  });

  it('reads velocity, reliability and runway the usual way round', () => {
    expect(deltaTone({ force: 'velocity' }, 4)).toBe('better');
    expect(deltaTone({ force: 'reliability' }, -6)).toBe('worse');
    expect(deltaTone({ context: 'runwayMonths' }, -2)).toBe('worse');
  });

  it('does not judge team size, orders or a zero delta', () => {
    expect(deltaTone({ context: 'teamSize' }, 10)).toBe('neutral');
    expect(deltaTone({ context: 'ordersPerDay' }, -200)).toBe('neutral');
    expect(deltaTone({ force: 'cost' }, 0)).toBe('neutral');
  });
});
