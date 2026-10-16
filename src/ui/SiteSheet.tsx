import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { CityModel } from '../city/layout';
import { lerp } from '../city/geometry';
import type { ChapterWindow } from '../engine/queries';
import { snapshotAt, traceForce } from '../engine/queries';
import type { ForceId, Forces } from '../engine/schema';
import { FORCE_IDS } from '../engine/schema';
import type { Timeline } from '../engine/simulate';
import { AssumptionTag } from './AssumptionTag';
import { CityCanvas } from './CityCanvas';
import { CityLabels } from './CityLabels';
import { ForceStrip, gaugeAnchor } from './ForceStrip';
import { useI18n } from './i18n';
import type { ChapterScene, Playhead } from './scene';
import { composeFrame } from './scene';
import { Sheet } from './Sheet';
import { SheetChrome } from './SheetChrome';
import type { RevisionRow } from './TitleBlock';
import { TitleBlock } from './TitleBlock';
import { TimelapseStamp } from './TimelapseStamp';

interface Props {
  label: string;
  caption: string;
  timeline: Timeline;
  scene: ChapterScene;
  window: ChapterWindow;
  playhead: Playhead;
  preview: { model: CityModel; forces: Forces } | null;
  startForces?: Forces;
  rows: RevisionRow[];
  sheetNumber: number;
  sheets: number;
  interactive: boolean;
  reducedMotion: boolean;
  onLocale: (l: string) => void;
  onRestore?: (row: RevisionRow) => void;
  onNewCampaign?: () => void;
  compact?: boolean;
  children?: ReactNode;
}

export function SiteSheet(p: Props) {
  const i18n = useI18n();
  const { t, has } = i18n;
  const [hovered, setHovered] = useState<string | null>(null);
  const [force, setForce] = useState<ForceId | null>(null);
  const frame = useMemo(() => composeFrame(p.scene, p.playhead, p.preview?.model ?? null, hovered), [p.scene, p.playhead, p.preview, hovered]);

  const start = snapshotAt(p.timeline, p.window.start);
  const end = snapshotAt(p.timeline, p.window.end);
  const startForces = p.startForces ?? start.forces;
  let forces: Forces = startForces;
  let from: Forces | null = null;
  let quarter = p.window.start;
  let inkLast = 1;
  const rows = p.rows;
  if (p.playhead.kind === 'playing') {
    const s = p.playhead.state;
    const a = snapshotAt(p.timeline, p.window.start + s.segment).forces;
    const b = snapshotAt(p.timeline, p.window.start + s.segment + 1).forces;
    forces = Object.fromEntries(FORCE_IDS.map((f) => [f, lerp(a[f], b[f], s.growth)])) as Forces;
    from = startForces;
    quarter = p.window.start + Math.floor(s.quarterProgress + 1e-6);
    inkLast = s.ink;
  } else if (p.playhead.kind === 'end') {
    forces = end.forces;
    from = startForces;
    quarter = p.window.end;
  }
  const traceRange: [number, number] = p.playhead.kind === 'start' ? [0, p.window.start] : [p.window.start, p.window.end];
  const tagForce = force ? traceForce(p.timeline, traceRange[0], traceRange[1], force) : [];
  const model = frame.target;
  const hoveredBounds = hovered ? model.bounds[hovered] : undefined;
  const hoveredEffects = hovered && p.playhead.kind !== 'start' ? (p.scene.changes.byAnchor[hovered] ?? []) : [];
  const name = (id: string) => (has(`components.${id}.name`) ? t(`components.${id}.name`) : id);
  const ql = (q: number) => t('ui.quarter', { q: (q % 4) + 1, y: Math.floor(q / 4) + 1 });

  return (
    <Sheet label={p.label}>
      <div className="paper" aria-hidden="true" />
      <SheetChrome caption={p.caption} />
      <CityCanvas frame={frame} reducedMotion={p.reducedMotion} />
      <CityLabels
        preview={frame.preview}
        base={frame.base}
        target={frame.target}
        growth={frame.growth}
        clouds={p.scene.clouds}
        cloudProgress={frame.clouds.map((c) => c.progress)}
        hovered={hovered}
        onHover={setHovered}
        interactive={p.interactive && p.playhead.kind !== 'playing'}
      />
      <ForceStrip forces={forces} from={from} preview={p.preview?.forces ?? null} hovered={force} onHover={setForce} />
      <TitleBlock
        sheet={p.sheetNumber}
        sheets={p.sheets}
        quarterLabel={ql(quarter)}
        rows={rows}
        inkLast={inkLast}
        onLocale={p.onLocale}
        onRestore={p.onRestore}
        onNewCampaign={p.onNewCampaign}
        compact={p.compact}
      />
      {p.playhead.kind === 'playing' && <TimelapseStamp state={p.playhead.state} startQuarter={p.window.start} quarters={p.window.end - p.window.start} />}
      {p.children}
      {hovered && hoveredBounds && (
        <AssumptionTag
          x={hoveredBounds.x + hoveredBounds.w + 22}
          y={hoveredBounds.y}
          title={t('ui.tag.componentTitle', { name: name(hovered) })}
          effects={hoveredEffects}
          empty={t('ui.tag.load', { load: i18n.number(end.loads[hovered]?.load ?? 0), pct: Math.round((end.loads[hovered]?.stress ?? 0) * 100) })}
        />
      )}
      {force && (
        <AssumptionTag
          x={gaugeAnchor(force)[0]}
          y={gaugeAnchor(force)[1] - 60 - Math.min(5, tagForce.length) * 70}
          title={t('ui.forces.tagTitle', { name: t(`ui.forces.${force}`) })}
          effects={tagForce}
          empty={t('ui.forces.tagEmpty')}
          testId="force-tag"
        />
      )}
    </Sheet>
  );
}
