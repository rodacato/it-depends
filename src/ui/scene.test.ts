import { describe, expect, it } from 'vitest';
import { slotOrder } from '../city/layout';
import { chapterWindow, snapshotAt } from '../engine/queries';
import { simulate } from '../engine/simulate';
import { campaign } from '../test/campaign';
import { buildScene } from './scene';

describe('scene', () => {
  it('a window over several revisions letters each cloud with the revision that changed it', () => {
    const played = campaign.chapters.slice(0, 5);
    const decisions = played.map((c) => ({ chapterId: c.id, optionId: c.dilemma.options[0]!.id }));
    const end = chapterWindow(played.at(-1)!).end;
    const timeline = simulate(campaign, decisions, { seed: 1, untilQuarter: end });
    const letters = snapshotAt(timeline, end).revisions.map((r) => r.letter);
    const window = { start: chapterWindow(played[0]!).start, end };
    const scene = buildScene(timeline, window, slotOrder(timeline.snapshots.map((s) => s.topology)), (l) => letters.indexOf(l));

    expect(scene.clouds.find((c) => c.componentId === 'hosted-checkout')?.letter).toBe('A');
    expect(scene.clouds.find((c) => c.componentId === 'pricing-engine')?.letter).toBe('B');
  });
});
