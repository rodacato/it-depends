import { describe, expect, it } from 'vitest';
import { campaign } from '../test/campaign';
import type { Decision } from './schema';
import { simulate } from './simulate';

function* everyPath(): Generator<Decision[]> {
  const walk = function* (i: number, acc: Decision[]): Generator<Decision[]> {
    const ch = campaign.chapters[i];
    if (!ch) return yield acc;
    for (const o of ch.dilemma.options) yield* walk(i + 1, [...acc, { chapterId: ch.id, optionId: o.id }]);
  };
  yield* walk(0, []);
}

// Static content rules live in the validator; these are the ones that only break on some paths.
function problemsOn(decisions: Decision[], seed: number): string[] {
  const path = decisions.map((d) => d.optionId).join(' > ');
  const problems: string[] = [];
  const t = simulate(campaign, decisions, { seed });
  const firstQuarter = new Map(campaign.chapters.flatMap((ch) => ch.events.map((e) => [e.id, ch.quarter + 1] as const)));
  for (const s of t.snapshots) {
    for (const [force, v] of Object.entries(s.forces)) if (v < 0 || v > 100) problems.push(`${path}: ${force} = ${v} at q${s.quarter}`);
    if (!Number.isFinite(s.context.runwayMonths)) problems.push(`${path}: runway is not a number at q${s.quarter}`);
    for (const i of s.incidents) {
      if (i.eventId && s.quarter < firstQuarter.get(i.eventId)!) problems.push(`${path}: ${i.eventId} fired at q${s.quarter}, before its chapter decided`);
    }
    const onSite = new Set(s.topology.components.map((c) => c.id));
    for (const e of s.applied) {
      if (e.origin.kind === 'option' && e.anchor && !onSite.has(e.anchor)) {
        problems.push(`${path}: ${e.effectId} points at ${e.anchor}, which is not on the site at q${s.quarter}`);
      }
    }
  }
  if (t.snapshots.at(-1)!.revisions.length !== campaign.chapters.length) problems.push(`${path}: not every chapter left a revision`);
  return problems;
}

describe('every path through the campaign', () => {
  it('stays coherent on all of them', () => {
    const problems: string[] = [];
    let paths = 0;
    for (const decisions of everyPath()) {
      paths++;
      problems.push(...problemsOn(decisions, paths));
    }
    expect(paths).toBe(campaign.chapters.reduce((n, ch) => n * ch.dilemma.options.length, 1));
    expect(problems.slice(0, 20)).toEqual([]);
  });
});
