import type { CityFrame } from '../city/CityRenderer';
import type { Point, Rect } from '../city/geometry';
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

export interface LeaderMark {
  id: string;
  componentId: string;
  from: Point;
  to: Point;
  revision: string;
  effects: AppliedEffect[];
}

export interface ChapterScene {
  models: CityModel[];
  clouds: CloudMark[];
  leaders: LeaderMark[];
  changes: ChangeSet;
  late: DelayedConsequence[];
}

const MAX_CLOUDS = 6;

// Title block revision rows live at fixed sheet coordinates; leader lines point at them.
export const TITLE_BLOCK = { x: 1000, y: 618, w: 384, h: 246, tableTop: 722, rowHeight: 13 } as const;

export function revisionRowPoint(index: number): Point {
  return [TITLE_BLOCK.x - 2, TITLE_BLOCK.tableTop + TITLE_BLOCK.rowHeight / 2 + index * TITLE_BLOCK.rowHeight];
}

export function buildScene(timeline: Timeline, window: ChapterWindow, order: SlotOrder, revisionIndex: (letter: string) => number): ChapterScene {
  const models: CityModel[] = [];
  for (let q = window.start; q <= window.end; q++) models.push(modelFor(snapshotAt(timeline, q), order));
  const final = models[models.length - 1]!;
  const changes = changesBetween(timeline, window.start, window.end);
  const letter = snapshotAt(timeline, window.end).revisions.at(-1)?.letter ?? '';

  const priority = [
    ...changes.added,
    ...Object.keys(changes.byAnchor).filter((id) => changes.byAnchor[id]!.some((e) => e.origin.kind !== 'drift' && e.origin.kind !== 'noise')),
    ...changes.stressed,
    ...changes.grown,
  ];
  const clouds: CloudMark[] = [];
  for (const id of priority) {
    if (clouds.some((c) => c.componentId === id) || clouds.length >= MAX_CLOUDS) continue;
    const rect = final.bounds[id];
    if (!rect) continue;
    clouds.push({ id: `cloud-${letter}-${id}`, componentId: id, rect, letter });
  }

  const late = delayedConsequences(timeline, window.start, window.end);
  const byAnchor = new Map<string, DelayedConsequence[]>();
  for (const d of late) {
    const key = `${d.effect.anchor ?? 'site'}|${d.revision}`;
    byAnchor.set(key, [...(byAnchor.get(key) ?? []), d]);
  }
  const leaders: LeaderMark[] = [];
  for (const [key, items] of byAnchor) {
    const [anchor, revision] = key.split('|') as [string, string];
    const rect = final.bounds[anchor];
    if (!rect) continue;
    leaders.push({
      id: `leader-${key}`,
      componentId: anchor,
      from: [rect.x + rect.w + 6, rect.y + rect.h / 2],
      to: revisionRowPoint(revisionIndex(revision)),
      revision,
      effects: items.map((i) => i.effect),
    });
  }
  return { models, clouds, leaders, changes, late };
}

export type Playhead = { kind: 'start' } | { kind: 'end' } | { kind: 'playing'; state: TimelapseState };

export function composeFrame(scene: ChapterScene, playhead: Playhead, preview: CityModel | null, highlight: string | null): CityFrame {
  const first = scene.models[0]!;
  const last = scene.models[scene.models.length - 1]!;
  if (playhead.kind === 'start') {
    return { base: first, target: first, growth: 1, clouds: [], leaders: [], preview, highlight, trafficSpeed: 1, crackProgress: 1 };
  }
  if (playhead.kind === 'end') {
    return {
      base: last,
      target: last,
      growth: 1,
      clouds: scene.clouds.map((c) => ({ id: c.id, rect: c.rect, progress: 1 })),
      leaders: scene.leaders.map((l) => ({ id: l.id, from: l.from, to: l.to, progress: 1 })),
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
    leaders: scene.leaders.map((l, i) => ({ id: l.id, from: l.from, to: l.to, progress: s.leaders[i] ?? 0 })),
    preview: null,
    highlight: null,
    trafficSpeed: s.trafficSpeed,
    crackProgress: s.crackProgress,
  };
}
