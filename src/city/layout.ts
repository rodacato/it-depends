import { floorsFor } from '../engine/queries';
import type { Forces, Topology } from '../engine/schema';
import type { ComponentLoad, Snapshot } from '../engine/simulate';
import { CLIENTS_NODE } from '../engine/topology';
import type { Point, Polyline, Rect } from './geometry';
import { crackPath, hashString } from './geometry';
import type { LabelSlot } from './labels';
import { labelHeight } from './labels';

// The sheet is a fixed design space; the UI scales it to fit, so layout never depends on the window.
export const SHEET = { w: 1440, h: 900 } as const;
export const FLOOR_HEIGHT = 5;
// Everything stays left of this line: the briefing and issued sheets cover the rest.
export const CITY_RIGHT = 826;
export const CLIENT_GATE: Point = [40, 268];

const DISTRICT_SLOTS: Rect[] = [
  { x: 84, y: 166, w: 382, h: 324 },
  { x: 480, y: 166, w: 346, h: 190 },
  { x: 480, y: 368, w: 346, h: 190 },
  { x: 480, y: 570, w: 346, h: 188 },
  { x: 84, y: 502, w: 224, h: 256 },
  { x: 320, y: 502, w: 146, h: 256 },
];
// Off-site lots along the north edge, lettered to their right.
const VENDOR_SLOTS: Rect[] = [
  { x: 84, y: 84, w: 80, h: 66 },
  { x: 338, y: 84, w: 80, h: 66 },
  { x: 592, y: 84, w: 80, h: 66 },
];
const VENDOR_LABEL_W = 144;

const TITLE_BAND = 28;
const MARGIN = 12;
const GAP = 10;
const STORE_W = 104;
const MIN_CELL = 92;
const MAX_BUILDING_W = 124;
const PAD_LINES = 4;
const STORE_LINES = 3;
const PAD_LABEL = Math.ceil(labelHeight(PAD_LINES));
const STORE_LABEL = Math.ceil(labelHeight(STORE_LINES));
const BASIN_RY = 14;
const DEPOT_H = 14;
const SERVICE_H = 40;
const MODULE_H = 30;
// Room a module's port stub needs on its left.
const PORT_STUB = 18;

export interface BuildingShape {
  id: string;
  kind: 'service' | 'module';
  footprint: Rect;
  floors: number;
  // What fits under the district title; taller buildings are drawn broken off at this height.
  maxFloors: number;
}

export interface ReservoirShape {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  // Full when healthy; drains as the database runs past its capacity.
  level: number;
}

export interface DepotShape {
  id: string;
  rect: Rect;
}

export interface VendorShape {
  id: string;
  lot: Rect;
  footprint: Rect;
  floors: number;
}

export interface DistrictShape {
  id: string;
  rect: Rect;
}

export interface LinkShape {
  id: string;
  kind: 'road' | 'rail' | 'pipe';
  // A call inside one district, through a module's port: drawn as a corridor, not a street.
  internal: boolean;
  from: string;
  to: string;
  points: Polyline;
  load: number;
  stress: number;
}

export interface CrackShape {
  id: string;
  points: Polyline;
}

export interface CityModel {
  districts: DistrictShape[];
  buildings: BuildingShape[];
  reservoirs: ReservoirShape[];
  depots: DepotShape[];
  vendors: VendorShape[];
  links: LinkShape[];
  cracks: CrackShape[];
  // Bounding box per component, for revision clouds and hover.
  bounds: Record<string, Rect>;
  stress: Record<string, number>;
  kinds: Record<string, string>;
  labels: Record<string, LabelSlot>;
  // Where "at capacity" is stamped, on the component itself.
  stamps: Record<string, Point>;
  districtLabels: Record<string, Point>;
}

export interface SlotOrder {
  districts: string[];
  vendors: string[];
  // Service and module pads, and reservoirs, per district, in order of first appearance.
  pads: Record<string, string[]>;
  basins: Record<string, string[]>;
  depots: Record<string, string[]>;
}

const push = (list: string[], id: string) => {
  if (!list.includes(id)) list.push(id);
};

function addTopology(order: SlotOrder, topology: Topology): void {
  for (const d of topology.districts) push(order.districts, d.id);
  for (const c of topology.components) {
    if (c.kind === 'vendor') push(order.vendors, c.id);
    else if (c.kind === 'service' || c.kind === 'module') push((order.pads[c.district ?? ''] ??= []), c.id);
    else if (c.kind === 'database') push((order.basins[c.district ?? ''] ??= []), c.id);
    else if (c.kind === 'queue') push((order.depots[c.district ?? ''] ??= []), c.id);
  }
}

// Slots follow first appearance across a whole run, so nothing moves when something else is added or removed.
export function slotOrder(topologies: readonly Topology[]): SlotOrder {
  const order: SlotOrder = { districts: [], vendors: [], pads: {}, basins: {}, depots: {} };
  for (const t of topologies) addTopology(order, t);
  return order;
}

export function extendOrder(order: SlotOrder, topology: Topology): SlotOrder {
  const next: SlotOrder = {
    districts: [...order.districts],
    vendors: [...order.vendors],
    pads: Object.fromEntries(Object.entries(order.pads).map(([k, v]) => [k, [...v]])),
    basins: Object.fromEntries(Object.entries(order.basins).map(([k, v]) => [k, [...v]])),
    depots: Object.fromEntries(Object.entries(order.depots).map(([k, v]) => [k, [...v]])),
  };
  addTopology(next, topology);
  return next;
}

export function layoutCity(
  topology: Topology,
  loads: Record<string, ComponentLoad>,
  forces: Forces,
  order: SlotOrder,
): CityModel {
  const model: CityModel = {
    districts: [],
    buildings: [],
    reservoirs: [],
    depots: [],
    vendors: [],
    links: [],
    cracks: [],
    bounds: {},
    stress: {},
    kinds: {},
    labels: {},
    stamps: {},
    districtLabels: {},
  };
  const full = extendOrder(order, topology);
  const districtRect: Record<string, Rect> = {};
  for (const d of topology.districts) {
    const slot = DISTRICT_SLOTS[full.districts.indexOf(d.id) % DISTRICT_SLOTS.length]!;
    districtRect[d.id] = slot;
    model.districts.push({ id: d.id, rect: slot });
    model.districtLabels[d.id] = [slot.x + 12, slot.y + 18];
  }

  const plans: Record<string, DistrictPlan> = {};
  for (const d of topology.districts) plans[d.id] = planDistrict(districtRect[d.id]!, full.pads[d.id]?.length ?? 0, full.basins[d.id]?.length ?? 0, full.depots[d.id]?.length ?? 0);

  for (const c of topology.components) {
    const load = loads[c.id]?.load ?? 0;
    const stress = loads[c.id]?.stress ?? 0;
    model.stress[c.id] = stress;
    model.kinds[c.id] = c.kind;
    if (c.kind === 'vendor') {
      const lot = VENDOR_SLOTS[full.vendors.indexOf(c.id) % VENDOR_SLOTS.length]!;
      const footprint = { x: lot.x + 12, y: lot.y + 32, w: lot.w - 24, h: 24 };
      model.vendors.push({ id: c.id, lot, footprint, floors: 4 });
      model.bounds[c.id] = { x: lot.x, y: lot.y, w: lot.w + 10 + VENDOR_LABEL_W, h: lot.h };
      model.labels[c.id] = { x: lot.x + lot.w + 10, y: lot.y + 24, w: VENDOR_LABEL_W, lines: STORE_LINES };
      model.stamps[c.id] = [lot.x + 6, lot.y + lot.h - 6];
      continue;
    }
    const district = c.district ?? '';
    const plan = plans[district];
    if (!plan) continue;
    if (c.kind === 'service' || c.kind === 'module') {
      const cell = plan.pads[full.pads[district]?.indexOf(c.id) ?? 0]!;
      const service = c.kind === 'service';
      const w = Math.min(MAX_BUILDING_W, service ? cell.w : cell.w - PORT_STUB);
      const h = service ? SERVICE_H : MODULE_H;
      const footprint = { x: service ? cell.x : cell.x + PORT_STUB, y: cell.base - h, w, h };
      const maxFloors = Math.max(1, Math.min(12, Math.floor((footprint.y - cell.ceiling) / FLOOR_HEIGHT)));
      const floors = floorsFor(load);
      model.buildings.push({ id: c.id, kind: c.kind, footprint, floors, maxFloors });
      const top = footprint.y - Math.min(floors, maxFloors) * FLOOR_HEIGHT;
      model.bounds[c.id] = { x: cell.x, y: top, w: cell.w, h: cell.base + PAD_LABEL - top };
      model.labels[c.id] = { x: cell.x, y: cell.base + 12, w: cell.w, lines: PAD_LINES };
      model.stamps[c.id] = [footprint.x + 5, footprint.y + footprint.h - 6];
    } else {
      const index = c.kind === 'database' ? (full.basins[district]?.indexOf(c.id) ?? 0) : (full.basins[district]?.length ?? 0) + (full.depots[district]?.indexOf(c.id) ?? 0);
      const cell = plan.stores[index]!;
      const shapeH = c.kind === 'database' ? BASIN_RY * 2 : DEPOT_H;
      if (c.kind === 'database') {
        const rx = Math.min(40, cell.w / 2);
        const level = Math.max(0.12, 1 - Math.max(0, stress - 0.4) * 0.9);
        model.reservoirs.push({ id: c.id, cx: cell.x + rx, cy: cell.y + BASIN_RY, rx, ry: BASIN_RY, level });
        model.stamps[c.id] = [cell.x + 8, cell.y + BASIN_RY + 3];
      } else {
        model.depots.push({ id: c.id, rect: { x: cell.x, y: cell.y, w: 64, h: DEPOT_H } });
        model.stamps[c.id] = [cell.x + 70, cell.y + 11];
      }
      model.bounds[c.id] = { x: cell.x, y: cell.y, w: cell.w, h: shapeH + 4 + STORE_LABEL };
      model.labels[c.id] = { x: cell.x, y: cell.y + shapeH + 4 + 12, w: cell.w, lines: STORE_LINES };
    }
  }

  for (const k of topology.connections) {
    const points = route(model, k.kind, k.from, k.to);
    if (!points) continue;
    const fromLoad = loads[k.from]?.load ?? Infinity;
    const toLoad = loads[k.to]?.load ?? 0;
    const load = Math.min(fromLoad, toLoad);
    const stress = Math.max(loads[k.to]?.stress ?? 0, k.from === CLIENTS_NODE ? 0 : (loads[k.from]?.stress ?? 0));
    const ends = [k.from, k.to].map((id) => topology.components.find((c) => c.id === id));
    const internal = k.kind === 'road' && ends.every((c) => c && c.district && c.district === ends[0]?.district) && ends.some((c) => c?.kind === 'module');
    model.links.push({ id: k.id, kind: k.kind, internal, from: k.from, to: k.to, points, load: Number.isFinite(load) ? load : toLoad, stress });
  }

  addCracks(model, topology, forces);
  return model;
}

interface PadCell {
  x: number;
  w: number;
  // Highest a roof may reach, and the ground line labels hang from.
  ceiling: number;
  base: number;
}

interface DistrictPlan {
  pads: PadCell[];
  stores: Rect[];
}

const BASIN_CELL = BASIN_RY * 2 + 4 + STORE_LABEL;
const DEPOT_CELL = DEPOT_H + 4 + STORE_LABEL;

// Pads take up to two columns. Databases, then queues, stack in columns on the right, or sit in a row underneath when those columns would squeeze the pads.
function planDistrict(d: Rect, padCount: number, basins: number, depots: number): DistrictPlan {
  const inner = { x: d.x + MARGIN, y: d.y + TITLE_BAND, w: d.w - 2 * MARGIN, h: d.h - TITLE_BAND - 6 };
  const heights = [...Array<number>(basins).fill(BASIN_CELL), ...Array<number>(depots).fill(DEPOT_CELL)];
  const cols = Math.max(1, Math.min(2, padCount));
  const storeCols: number[][] = [];
  for (const h of heights) {
    const col = storeCols[storeCols.length - 1];
    if (col && col.reduce((a, b) => a + b, 0) + h <= inner.h - 4) col.push(h);
    else storeCols.push([h]);
  }
  const sideW = storeCols.length * (STORE_W + GAP);
  const side = heights.length > 0 && padCount > 0 && (inner.w - sideW - (cols - 1) * GAP) / cols >= MIN_CELL;
  const below = heights.length > 0 && padCount > 0 && !side ? BASIN_CELL + 6 : 0;
  const padsW = side ? inner.w - sideW : inner.w;
  const rows = Math.max(1, Math.ceil(padCount / cols));
  const rowH = (inner.h - below) / rows;
  const cellW = (padsW - (cols - 1) * GAP) / cols;
  const pads: PadCell[] = Array.from({ length: padCount }, (_, i) => {
    const top = inner.y + Math.floor(i / cols) * rowH;
    return { x: inner.x + (i % cols) * (cellW + GAP), w: cellW, ceiling: top + 2, base: top + rowH - PAD_LABEL };
  });
  const stores: Rect[] = [];
  if (side) {
    storeCols.forEach((col, c) => {
      let y = inner.y + 4;
      for (const h of col) {
        stores.push({ x: inner.x + padsW + GAP + c * (STORE_W + GAP), y, w: STORE_W, h });
        y += h;
      }
    });
  } else {
    const w = Math.min(STORE_W * 1.4, (inner.w - (heights.length - 1) * GAP) / Math.max(1, heights.length));
    const y = padCount > 0 ? inner.y + inner.h - below + 6 : inner.y + 4;
    heights.forEach((h, k) => stores.push({ x: inner.x + k * (w + GAP), y, w, h }));
  }
  return { pads, stores };
}

function portOf(model: CityModel, id: string, side: 'in' | 'out' | 'top' | 'bottom'): Point | null {
  if (id === CLIENTS_NODE) return CLIENT_GATE;
  const b = model.buildings.find((x) => x.id === id);
  if (b) {
    const f = b.footprint;
    if (side === 'in') return [f.x, f.y + f.h / 2];
    if (side === 'out') return [f.x + f.w, f.y + f.h / 2];
    if (side === 'bottom') return [f.x + f.w * 0.78, f.y + f.h];
    return [f.x + f.w / 2, f.y];
  }
  const v = model.vendors.find((x) => x.id === id);
  if (v) return [v.lot.x + v.lot.w / 2, v.lot.y + v.lot.h];
  const r = model.reservoirs.find((x) => x.id === id);
  if (r) return [r.cx, r.cy - r.ry];
  const d = model.depots.find((x) => x.id === id);
  if (d) return [d.rect.x + d.rect.w / 2, d.rect.y + d.rect.h / 2];
  return null;
}

function route(model: CityModel, kind: LinkShape['kind'], from: string, to: string): Polyline | null {
  if (kind === 'pipe') {
    const a = portOf(model, from, 'bottom');
    const b = portOf(model, to, 'top');
    if (!a || !b) return null;
    const r = model.reservoirs.find((x) => x.id === to);
    const f = model.buildings.find((x) => x.id === from)?.footprint;
    // Leave from the side at ground level, so the pipe runs under neighbours rather than through lettering.
    if (r && f && (r.cx < f.x || r.cx > f.x + f.w)) {
      const side: Point = [r.cx > f.x ? f.x + f.w : f.x, f.y + f.h - 8];
      const end: Point = r.cy > side[1] ? b : [r.cx, r.cy + r.ry];
      return [side, [end[0], side[1]], end];
    }
    const midY = (a[1] + b[1]) / 2;
    return a[0] === b[0] ? [a, b] : [a, [a[0], midY], [b[0], midY], b];
  }
  const toVendor = model.vendors.some((v) => v.id === to);
  const a = portOf(model, from, 'out');
  const b = portOf(model, to, toVendor ? 'bottom' : 'in');
  if (!a || !b) return null;
  if (toVendor) return [a, [b[0], a[1]], b];
  if (kind === 'rail') return [a, [a[0] + 12, a[1]], [a[0] + 12, b[1]], b];
  const mx = Math.max(a[0] + 14, b[0] - 18);
  return [a, [mx, a[1]], [mx, b[1]], b];
}

// Shared reservoirs crack first: more writers, more coupling, more complexity to carry.
function addCracks(model: CityModel, topology: Topology, forces: Forces): void {
  for (const r of model.reservoirs) {
    const writers = new Set(topology.connections.filter((k) => k.kind === 'pipe' && k.to === r.id).map((k) => k.from));
    const shareDistricts = new Set(
      topology.components.filter((c) => writers.has(c.id) || (c.kind === 'module' && c.district === districtOf(topology, r.id))).map((c) => c.id),
    );
    const pressure = Math.max(0, shareDistricts.size - 1) * (forces.complexity / 100);
    if (pressure <= 0.05) continue;
    const length = Math.min(90, 12 + pressure * 60);
    model.cracks.push({ id: `crack-${r.id}`, points: crackPath([r.cx + r.rx - 4, r.cy], length, hashString(r.id), 0.3) });
  }
  for (const b of model.buildings) {
    const stress = model.stress[b.id] ?? 0;
    if (stress < 1) continue;
    const f = b.footprint;
    model.cracks.push({ id: `crack-${b.id}`, points: crackPath([f.x + f.w * 0.3, f.y + f.h], Math.min(60, 20 + (stress - 1) * 30), hashString(b.id), 1.1) });
  }
}

function districtOf(topology: Topology, id: string): string | undefined {
  return topology.components.find((c) => c.id === id)?.district;
}

export function modelFor(snapshot: Snapshot, order: SlotOrder): CityModel {
  return layoutCity(snapshot.topology, snapshot.loads, snapshot.forces, order);
}
