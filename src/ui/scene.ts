import type { CityFrame } from '../city/CityRenderer';
import type { Rect } from '../city/geometry';
import type { CityModel, SlotOrder } from '../city/layout';
import { modelFor } from '../city/layout';
import type { ChangeSet, ChapterWindow, DelayedConsequence } from '../engine/queries';
import { changesBetween, delayedConsequences, snapshotAt } from '../engine/queries';
import type { AppliedEffect, Timeline } from '../engine/simulate';
import type { TimelapseState } from './timelapse';

export interface CloudMark {
  id: string;
  componentId: string;
  rect: Rect;
  letter: string;
}

// A consequence that landed on this sheet from an earlier revision, one per component and revision.
export interface LateChange {
  id: string;
  componentId: string;
  revision: string;
  effects: AppliedEffect[];
}

export interface ChapterScene {
  models: CityModel[];
  clouds: CloudMark[];
  lateChanges: LateChange[];
  changes: ChangeSet;
  late: DelayedConsequence[];
  // Components that newly congested during this window: the only ones lettered "at capacity".
  congested: string[];
}

// Clouds mark what this revision changed; growth and congestion already show as height and red traffic.
const MAX_CLOUDS = 4;
const MAX_LATE_CHANGES = 3;

export const TITLE_BLOCK = { x: 1000, y: 618, w: 384, h: 246 } as const;

export function buildScene(timeline: Timeline, window: ChapterWindow, order: SlotOrder): ChapterScene {
  const models: CityModel[] = [];
  for (let q = window.start; q <= window.end; q++) models.push(modelFor(snapshotAt(timeline, q), order));
  const final = models[models.length - 1]!;
  const changes = changesBetween(timeline, window.start, window.end);
  const letter = snapshotAt(timeline, window.end).revisions.at(-1)?.letter ?? '';

  const fromThisRevision = (id: string) =>
    changes.byAnchor[id]!.some((e) => e.origin.kind === 'option' && e.origin.revision === letter && (e.timing === 'immediate' || e.timing === 'delayed'));
  const revisionOf = (id: string) => {
    if (changes.byAnchor[id] && fromThisRevision(id)) return letter;
    const revisions = (changes.byAnchor[id] ?? []).flatMap((e) => (e.origin.kind === 'option' ? [e.origin.revision] : []));
    return revisions.at(-1) ?? letter;
  };
  const priority = [
    ...changes.added,
    ...Object.keys(changes.byAnchor).filter(fromThisRevision),
    ...Object.keys(changes.byAnchor).filter((id) => changes.byAnchor[id]!.some((e) => e.origin.kind === 'option' || e.origin.kind === 'event')),
  ];
  const clouds: CloudMark[] = [];
  for (const id of priority) {
    if (clouds.some((c) => c.componentId === id) || clouds.length >= MAX_CLOUDS) continue;
    const rect = final.bounds[id];
    if (!rect) continue;
    const revision = revisionOf(id);
    clouds.push({ id: `cloud-${revision}-${id}`, componentId: id, rect, letter: revision });
  }

  const late = delayedConsequences(timeline, window.start, window.end);
  const byAnchor = new Map<string, DelayedConsequence[]>();
  for (const d of late) {
    const key = `${d.effect.anchor ?? 'site'}|${d.revision}`;
    byAnchor.set(key, [...(byAnchor.get(key) ?? []), d]);
  }
  const lateChanges: LateChange[] = [];
  for (const [key, items] of byAnchor) {
    if (lateChanges.length >= MAX_LATE_CHANGES) break;
    const [anchor, revision] = key.split('|') as [string, string];
    if (!final.bounds[anchor]) continue;
    lateChanges.push({ id: `late-${key}`, componentId: anchor, revision, effects: items.map((i) => i.effect) });
  }
  const congested = timeline.snapshots
    .filter((s) => s.quarter > window.start && s.quarter <= window.end)
    .flatMap((s) => s.incidents)
    .filter((i) => i.kind === 'congestion' && i.anchor)
    .map((i) => i.anchor!);
  return { models, clouds, lateChanges, changes, late, congested };
}

export type Playhead = { kind: 'start' } | { kind: 'end' } | { kind: 'playing'; state: TimelapseState };

export function composeFrame(scene: ChapterScene, playhead: Playhead, preview: CityModel | null, highlight: string | null): CityFrame {
  const first = scene.models[0]!;
  const last = scene.models[scene.models.length - 1]!;
  if (playhead.kind === 'start') {
    return { base: first, target: first, growth: 1, clouds: [], preview, highlight, trafficSpeed: 1, crackProgress: 1 };
  }
  if (playhead.kind === 'end') {
    return {
      base: last,
      target: last,
      growth: 1,
      clouds: scene.clouds.map((c) => ({ id: c.id, rect: c.rect, progress: 1 })),
      preview: null,
      highlight,
      trafficSpeed: 1,
      crackProgress: 1,
    };
  }
  const s = playhead.state;
  return {
    base: scene.models[s.segment] ?? first,
    target: scene.models[s.segment + 1] ?? last,
    growth: s.growth,
    clouds: scene.clouds.map((c, i) => ({ id: c.id, rect: c.rect, progress: s.clouds[i] ?? 0 })),
    preview: null,
    highlight: null,
    trafficSpeed: s.trafficSpeed,
    crackProgress: s.crackProgress,
  };
}
