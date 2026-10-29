import type { Campaign, Chapter, Decision, EffectTarget, ForceId, Forces, NumericContextKey } from './schema';
import { FORCE_IDS } from './schema';
import type { AppliedEffect, Snapshot, Timeline } from './simulate';
import { simulate } from './simulate';

export interface ChapterWindow {
  start: number;
  end: number;
}

export function chapterWindow(chapter: Chapter): ChapterWindow {
  return { start: chapter.quarter, end: chapter.quarter + chapter.timelapseQuarters };
}

export function snapshotAt(timeline: Timeline, quarter: number): Snapshot {
  const snap = timeline.snapshots[Math.min(quarter, timeline.snapshots.length - 1)];
  if (!snap) throw new Error('empty timeline');
  return snap;
}

export function appliedBetween(timeline: Timeline, from: number, to: number): AppliedEffect[] {
  return timeline.snapshots.filter((s) => s.quarter > from && s.quarter <= to).flatMap((s) => s.applied);
}

export function forceDelta(a: Forces, b: Forces): Forces {
  const out = { ...a };
  for (const f of FORCE_IDS) out[f] = b[f] - a[f];
  return out;
}

export type DeltaTone = 'better' | 'worse' | 'neutral';

// Team size and orders per day are neither good nor bad on their own, so they stay out.
const BETTER_WHEN_HIGHER: Partial<Record<ForceId | NumericContextKey, boolean>> = {
  velocity: true,
  reliability: true,
  runwayMonths: true,
  complexity: false,
  cost: false,
  cognitiveLoad: false,
};

export function deltaTone(target: EffectTarget, delta: number): DeltaTone {
  const higherIsBetter = BETTER_WHEN_HIGHER['force' in target ? target.force : target.context];
  if (delta === 0 || higherIsBetter === undefined) return 'neutral';
  return delta > 0 === higherIsBetter ? 'better' : 'worse';
}

export function traceForce(timeline: Timeline, from: number, to: number, force: ForceId): AppliedEffect[] {
  return appliedBetween(timeline, from, to).filter((e) => 'force' in e.target && e.target.force === force && e.delta !== 0);
}

export interface ForceOutcome {
  force: ForceId;
  total: number;
  // Moved by the player's own revisions, this one or earlier ones arriving late.
  decisions: number;
  // Moved by growth, events, demand noise and congestion.
  world: number;
  // The single largest move, so the sheet can say why in one line.
  cause: AppliedEffect;
}

export function forceOutcomes(timeline: Timeline, from: number, to: number): ForceOutcome[] {
  const applied = appliedBetween(timeline, from, to);
  const out: ForceOutcome[] = [];
  for (const force of FORCE_IDS) {
    const moves = applied.filter((e) => 'force' in e.target && e.target.force === force && e.delta !== 0);
    const cause = moves.reduce<AppliedEffect | undefined>((top, e) => (!top || Math.abs(e.delta) > Math.abs(top.delta) ? e : top), undefined);
    if (!cause) continue;
    const decisions = roundTenth(moves.filter((e) => e.origin.kind === 'option').reduce((s, e) => s + e.delta, 0));
    const world = roundTenth(moves.filter((e) => e.origin.kind !== 'option').reduce((s, e) => s + e.delta, 0));
    out.push({ force, total: roundTenth(decisions + world), decisions, world, cause });
  }
  return out.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

function roundTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface ChangeSet {
  added: string[];
  removed: string[];
  // Components whose load grew by at least one floor's worth.
  grown: string[];
  // Components now at or past capacity.
  stressed: string[];
  // Applied effects grouped by the component they are anchored to.
  byAnchor: Record<string, AppliedEffect[]>;
}

export function changesBetween(timeline: Timeline, from: number, to: number): ChangeSet {
  const a = snapshotAt(timeline, from);
  const b = snapshotAt(timeline, to);
  const before = new Set(a.topology.components.map((c) => c.id));
  const after = new Set(b.topology.components.map((c) => c.id));
  const grown = b.topology.components
    .filter((c) => before.has(c.id) && floorsFor(b.loads[c.id]?.load ?? 0) > floorsFor(a.loads[c.id]?.load ?? 0))
    .map((c) => c.id);
  const stressed = b.topology.components.filter((c) => (b.loads[c.id]?.stress ?? 0) >= 1).map((c) => c.id);
  const byAnchor: Record<string, AppliedEffect[]> = {};
  for (const e of appliedBetween(timeline, from, to)) {
    if (!e.anchor || e.delta === 0) continue;
    (byAnchor[e.anchor] ??= []).push(e);
  }
  return {
    added: [...after].filter((id) => !before.has(id)),
    removed: [...before].filter((id) => !after.has(id)),
    grown,
    stressed,
    byAnchor,
  };
}

// Floors are how load reads on the city: each floor is roughly a doubling of traffic.
export function floorsFor(load: number): number {
  return Math.max(1, Math.min(12, 1 + Math.round(Math.log2(1 + load / 20))));
}

export interface Forecast {
  before: Snapshot;
  after: Snapshot;
  delta: Forces;
  timeline: Timeline;
}

export function forecastOption(
  campaign: Campaign,
  decisions: readonly Decision[],
  chapter: Chapter,
  optionId: string,
  seed: number,
  variantId?: string,
): Forecast {
  const kept = decisions.filter((d) => d.chapterId !== chapter.id);
  const { end } = chapterWindow(chapter);
  const variant = variantId ? { chapterId: chapter.id, variantId } : undefined;
  const timeline = simulate(campaign, [...kept, { chapterId: chapter.id, optionId }], { seed, untilQuarter: end, variant });
  const baseline = simulate(campaign, kept, { seed, untilQuarter: end, variant });
  const before = snapshotAt(baseline, end);
  const after = snapshotAt(timeline, end);
  return { before, after, delta: forceDelta(before.forces, after.forces), timeline };
}

export interface DelayedConsequence {
  effect: AppliedEffect;
  revision: string;
  decidedAt: number;
}

// Effects that arrive late and point back to the revision that caused them.
export function delayedConsequences(timeline: Timeline, from: number, to: number): DelayedConsequence[] {
  return appliedBetween(timeline, from, to)
    .filter((e) => (e.timing === 'delayed' || e.timing === 'conditional') && e.origin.kind === 'option')
    .map((e) => {
      const origin = e.origin as Extract<AppliedEffect['origin'], { kind: 'option' }>;
      return { effect: e, revision: origin.revision, decidedAt: origin.decidedAt };
    });
}
