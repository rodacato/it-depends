import type { ReactNode } from 'react';
import { CITY_VIEW } from '../city/CityRenderer';
import { floorsFor } from '../engine/queries';
import type { Component } from '../engine/schema';
import type { Snapshot } from '../engine/simulate';
import { CLIENTS_NODE } from '../engine/topology';
import { useI18n } from './i18n';

interface Props {
  snapshot: Snapshot;
  componentId: string;
  changed: boolean;
  letter: string;
  onClose: () => void;
}

const GRADE = 470;
const FH = 22;

// Semantic zoom's last step: the building opens into a section of the service, drawn in the sheet's own style
// (the Section Cut direction). Above grade what users touch; below grade the data and queues it depends on.
export function SectionDetail({ snapshot, componentId, changed, letter, onClose }: Props) {
  const { t, has, number } = useI18n();
  const name = (id: string) => (has(`components.${id}.name`) ? t(`components.${id}.name`) : id);
  const role = (c: Component) => (has(`components.${c.id}.role`) ? t(`components.${c.id}.role`) : t(`kinds.${c.kind}`));
  const byId = new Map(snapshot.topology.components.map((c) => [c.id, c]));
  const focus = byId.get(componentId);
  if (!focus) return null;
  const links = snapshot.topology.connections.filter((k) => k.from === componentId || k.to === componentId);
  const other = (k: { from: string; to: string }) => (k.from === componentId ? k.to : k.from);
  const neighbours = links.map((k) => ({ link: k, c: byId.get(other(k)), id: other(k) }));
  const load = (id: string) => snapshot.loads[id]?.load ?? 0;
  const stress = (id: string) => snapshot.loads[id]?.stress ?? 0;
  const loadLine = (id: string) => t('ui.detail.load', { load: number(load(id)), pct: Math.round(stress(id) * 100) });

  const aboveAll = [focus, ...neighbours.map((n) => n.c).filter((c): c is Component => !!c && (c.kind === 'service' || c.kind === 'module'))].filter(
    (c, i, all) => (c.kind === 'service' || c.kind === 'module') && all.findIndex((x) => x.id === c.id) === i,
  );
  const belowAll = neighbours.map((n) => n.c).filter((c): c is Component => !!c && (c.kind === 'database' || c.kind === 'queue'));
  if (focus.kind === 'database' || focus.kind === 'queue') belowAll.unshift(focus);
  // What fits between the street and the property line; the rest is on the site plan.
  const above = aboveAll.slice(0, 4);
  const below = belowAll.slice(0, 3);
  const vendors = [focus, ...neighbours.map((n) => n.c)].filter((c): c is Component => !!c && c.kind === 'vendor');
  const fromClients = neighbours.some((n) => n.id === CLIENTS_NODE);

  const parts: ReactNode[] = [];
  const labels = new LabelPlacer();
  let x = 250;
  const buildingX: Record<string, number> = {};
  let focusTop: [number, number] | null = null;
  for (const c of above) {
    const w = c.kind === 'service' ? 170 : 110;
    const floors = Math.min(12, floorsFor(load(c.id)));
    const top = GRADE - floors * FH;
    buildingX[c.id] = x + w / 2;
    if (c.id === componentId) focusTop = [x + w, top];
    const text = { label: name(c.id), role: role(c), load: loadLine(c.id) };
    parts.push(<Elevation key={c.id} x={x} w={w} floors={floors} hot={stress(c.id) >= 1} {...text} labelY={labels.place(x, top - 40, text)} focus={c.id === componentId} />);
    x += w + 46;
  }
  let bx = 240;
  for (const c of below) {
    const anchor = buildingX[neighbours.find((n) => n.id === c.id)?.link.from ?? ''] ?? buildingX[componentId] ?? bx + 80;
    if (c.kind === 'database') {
      parts.push(<Tank key={c.id} x={bx} w={170} level={Math.max(0.12, 1 - Math.max(0, stress(c.id) - 0.4) * 0.9)} label={name(c.id)} role={role(c)} load={loadLine(c.id)} hot={stress(c.id) >= 1} />);
      parts.push(<line key={`${c.id}-pipe`} x1={anchor} y1={GRADE + 40} x2={bx + 85} y2={GRADE + 74} className="pen thin" pathLength={1} />);
      bx += 230;
    } else {
      parts.push(<Tunnel key={c.id} x={bx} w={250} label={name(c.id)} role={role(c)} load={loadLine(c.id)} />);
      bx += 290;
    }
  }
  const vw = vendors.length > 1 ? 52 : 110;
  vendors.slice(0, 3).forEach((v, i) => {
    const vx = 812 + i * (vw + 6);
    const text = { label: name(v.id), role: vendors.length > 1 ? '' : role(v), load: '' };
    parts.push(<Elevation key={v.id} x={vx} w={vw} floors={6} hatch {...text} labelY={labels.place(vx, GRADE - 6 * FH - 40, text)} focus={v.id === componentId} />);
  });

  return (
    <g className="section-detail" data-testid="section-detail" clipPath="url(#detail-clip)">
      <clipPath id="detail-clip">
        <rect x={CITY_VIEW.x} y={CITY_VIEW.y} width={CITY_VIEW.w} height={CITY_VIEW.h} />
      </clipPath>
      <rect x={CITY_VIEW.x} y={CITY_VIEW.y} width={CITY_VIEW.w} height={CITY_VIEW.h} className="detail-ground" />
      <rect x={CITY_VIEW.x + 14} y={CITY_VIEW.y + 14} width={CITY_VIEW.w - 28} height={CITY_VIEW.h - 28} className="pen border" pathLength={1} />
      <text x={CITY_VIEW.x + 34} y={CITY_VIEW.y + 46} className="lbl title">
        {t('ui.detail.title', { name: name(componentId) })}
      </text>
      <text x={CITY_VIEW.x + 34} y={CITY_VIEW.y + 64} className="mono dim">
        {t('ui.detail.subtitle')}
      </text>
      <line x1={70} y1={GRADE} x2={985} y2={GRADE} className="pen grade" pathLength={1} />
      <rect x={70} y={GRADE} width={915} height={9} className="earth" />
      <text x={84} y={GRADE + 26} className="mono dim">
        {t('ui.detail.grade')}
      </text>
      <text x={84} y={GRADE + 40} className="mono dim">
        {t('ui.detail.belowGrade')}
      </text>
      {vendors.length > 0 && (
        <g>
          <line x1={800} y1={150} x2={800} y2={620} className="pen property" pathLength={1} />
          <text x={808} y={612} className="mono dim">
            {t('ui.city.notOurs')}
          </text>
        </g>
      )}
      {fromClients && (
        <g>
          <line x1={84} y1={GRADE - 8} x2={240} y2={GRADE - 8} className="pen" pathLength={1} markerEnd="url(#detail-arrow)" />
          <text x={86} y={GRADE - 18} className="mono">
            {name(CLIENTS_NODE)}
          </text>
        </g>
      )}
      {parts}
      {changed && focusTop && (
        <g className="detail-delta" transform={`translate(${focusTop[0] + 14}, ${focusTop[1] - 6})`}>
          <path d="M0,-12 L11,8 L-11,8 Z" />
          <text y={5} textAnchor="middle" className="lbl">
            {letter}
          </text>
        </g>
      )}
      <defs>
        <marker id="detail-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9" fill="none" stroke="var(--line)" strokeWidth="1.4" />
        </marker>
        <pattern id="detail-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line)" strokeWidth=".7" strokeOpacity=".5" />
        </pattern>
      </defs>
      <foreignObject x={CITY_VIEW.x + CITY_VIEW.w - 214} y={CITY_VIEW.y + CITY_VIEW.h - 52} width={190} height={34}>
        <button type="button" className="ink-button lbl light small" onClick={onClose} data-testid="detail-close">
          {t('ui.detail.back')}
        </button>
      </foreignObject>
    </g>
  );
}

interface LabelText {
  label: string;
  role: string;
  load: string;
}

// Lettering above roofs is stacked upward until it clears what is already lettered, then tied back with a leader.
class LabelPlacer {
  private boxes: { x0: number; x1: number; y: number }[] = [];

  place(x: number, y: number, text: LabelText): number {
    const width = Math.max(text.label.length * 8, text.role.length * 6.1, text.load.length * 6.1);
    let yy = y;
    while (this.boxes.some((b) => x < b.x1 + 8 && b.x0 < x + width && Math.abs(b.y - yy) < 52)) yy -= 54;
    this.boxes.push({ x0: x, x1: x + width, y: yy });
    return yy;
  }
}

function Elevation(p: LabelText & { x: number; w: number; floors: number; labelY: number; hot?: boolean; hatch?: boolean; focus?: boolean }) {
  const H = p.floors * FH;
  const top = GRADE - H;
  const bays = Math.floor((p.w - 16) / 24);
  const cls = `pen ${p.hot ? 'hot' : ''} ${p.focus ? 'focus' : ''}`;
  return (
    <g>
      <rect x={p.x} y={top} width={p.w} height={H} className={`${cls} ${p.hatch ? 'hatched' : 'solid'}`} pathLength={1} />
      {Array.from({ length: p.floors - 1 }, (_, i) => (
        <line key={`f${i}`} x1={p.x} y1={GRADE - (i + 1) * FH} x2={p.x + p.w} y2={GRADE - (i + 1) * FH} className={`${cls} thin`} pathLength={1} />
      ))}
      {Array.from({ length: p.floors }, (_, f) =>
        Array.from({ length: bays }, (_, b) => <rect key={`w${f}-${b}`} x={p.x + 12 + b * 24} y={GRADE - (f + 1) * FH + 6} width={12} height={FH - 11} className={`${cls} thin`} />),
      )}
      <rect x={p.x + p.w * 0.6} y={top - 12} width={p.w * 0.24} height={12} className={cls} pathLength={1} />
      <line x1={p.x + p.w * 0.25} y1={top} x2={p.x + p.w * 0.25} y2={top - 26} className={cls} pathLength={1} />
      {Array.from({ length: Math.floor(p.w / 30) }, (_, i) => (
        <line key={`p${i}`} x1={p.x + 14 + i * 30} y1={GRADE} x2={p.x + 14 + i * 30} y2={GRADE + 40} className="pen thin dim" pathLength={1} />
      ))}
      {p.labelY < top - 40 && <line x1={p.x + 4} y1={p.labelY + 30} x2={p.x + 4} y2={top - 14} className="leader" />}
      <text x={p.x} y={p.labelY - 8} className={`lbl name ${p.hot ? 'red' : ''}`}>
        {p.label}
      </text>
      <text x={p.x} y={p.labelY + 6} className="mono dim">
        {p.role}
      </text>
      <text x={p.x} y={p.labelY + 19} className={`mono ${p.hot ? 'red' : 'dim'}`}>
        {p.load}
      </text>
    </g>
  );
}

function Tank(p: { x: number; w: number; level: number; label: string; role: string; load: string; hot: boolean }) {
  const y = GRADE + 74;
  const h = 130;
  const wl = y + h * (1 - p.level);
  const waves: string[] = [];
  for (let yy = wl; yy < y + h - 6; yy += 9) waves.push(`M${p.x + 6},${yy} h${p.w - 12}`);
  return (
    <g>
      <path d={`M${p.x},${y} V${y + h - 16} q0,16 16,16 H${p.x + p.w - 16} q16,0 16,-16 V${y}`} className={`pen ${p.hot ? 'hot' : ''}`} pathLength={1} />
      <line x1={p.x - 10} y1={y} x2={p.x + p.w + 10} y2={y} className="pen" pathLength={1} />
      <path d={waves.join(' ')} className="pen thin water" />
      <text x={p.x} y={y + h + 22} className={`lbl name ${p.hot ? 'red' : ''}`}>
        {p.label}
      </text>
      <text x={p.x} y={y + h + 36} className="mono dim">
        {p.role}
      </text>
      <text x={p.x} y={y + h + 49} className={`mono ${p.hot ? 'red' : 'dim'}`}>
        {p.load}
      </text>
    </g>
  );
}

function Tunnel(p: { x: number; w: number; label: string; role: string; load: string }) {
  const y = GRADE + 110;
  return (
    <g>
      <line x1={p.x} y1={y - 16} x2={p.x + p.w} y2={y - 16} className="pen" pathLength={1} />
      <line x1={p.x} y1={y + 16} x2={p.x + p.w} y2={y + 16} className="pen" pathLength={1} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={p.x + 24 + i * 46} y={y - 9} width={40} height={18} className="pen thin train" pathLength={1} />
      ))}
      <text x={p.x} y={y + 40} className="lbl name">
        {p.label}
      </text>
      <text x={p.x} y={y + 54} className="mono dim">
        {p.role}
      </text>
      <text x={p.x} y={y + 67} className="mono dim">
        {p.load}
      </text>
    </g>
  );
}
