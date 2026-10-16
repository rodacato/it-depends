import { floorsFor } from '../engine/queries';
import type { Forces, Topology } from '../engine/schema';
import type { ComponentLoad, Snapshot } from '../engine/simulate';
import { CLIENTS_NODE } from '../engine/topology';
import type { Point, Polyline, Rect } from './geometry';
import { crackPath, hashString } from './geometry';

// The sheet is a fixed design space; the UI scales it to fit, so layout never depends on the window.
export const SHEET = { w: 1440, h: 900 } as const;
export const FLOOR_HEIGHT = 7;
export const CLIENT_GATE: Point = [52, 360];

const DISTRICT_SLOTS: Rect[] = [
  { x: 250, y: 214, w: 340, h: 296 },
  { x: 632, y: 214, w: 300, h: 296 },
  { x: 250, y: 552, w: 340, h: 196 },
  { x: 632, y: 552, w: 300, h: 196 },
  { x: 84, y: 552, w: 140, h: 196 },
  { x: 84, y: 420, w: 140, h: 104 },
];
// Off-site lots along the north edge, lettered to their right; extras wrap to the west strip.
const VENDOR_SLOTS: Rect[] = [
  { x: 300, y: 92, w: 92, h: 80 },
  { x: 504, y: 92, w: 92, h: 80 },
  { x: 708, y: 92, w: 92, h: 80 },
  { x: 84, y: 440, w: 92, h: 80 },
  { x: 84, y: 640, w: 92, h: 80 },
];

export interface BuildingShape {
  id: string;
  kind: 'service' | 'module';
  footprint: Rect;
  floors: number;
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
  // Bounding box per component, for revision clouds, hover and leader lines.
  bounds: Record<string, Rect>;
  stress: Record<string, number>;
  kinds: Record<string, string>;
  // Where each component's label sits.
  anchors: Record<string, Point>;
  districtLabels: Record<string, Point>;
}

export interface SlotOrder {
  districts: string[];
  vendors: string[];
  // Service and module pads, and reservoirs, per district, in order of first appearance.
  pads: Record<string, string[]>;
  basins: Record<string, string[]>;
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
  }
}

// Slots follow first appearance across a whole run, so nothing moves when something else is added or removed.
export function slotOrder(topologies: readonly Topology[]): SlotOrder {
  const order: SlotOrder = { districts: [], vendors: [], pads: {}, basins: {} };
  for (const t of topologies) addTopology(order, t);
  return order;
}

export function extendOrder(order: SlotOrder, topology: Topology): SlotOrder {
  const next: SlotOrder = {
    districts: [...order.districts],
    vendors: [...order.vendors],
    pads: Object.fromEntries(Object.entries(order.pads).map(([k, v]) => [k, [...v]])),
    basins: Object.fromEntries(Object.entries(order.basins).map(([k, v]) => [k, [...v]])),
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
    anchors: {},
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

  for (const c of topology.components) {
    const load = loads[c.id]?.load ?? 0;
    const stress = loads[c.id]?.stress ?? 0;
    model.stress[c.id] = stress;
    model.kinds[c.id] = c.kind;
    if (c.kind === 'vendor') {
      const i = full.vendors.indexOf(c.id);
      const lot = VENDOR_SLOTS[i % VENDOR_SLOTS.length]!;
      const footprint = { x: lot.x + 14, y: lot.y + 40, w: lot.w - 28, h: 30 };
      model.vendors.push({ id: c.id, lot, footprint, floors: 4 });
      model.bounds[c.id] = lot;
      model.anchors[c.id] = [lot.x + lot.w + 10, lot.y + 34];
      continue;
    }
    const district = c.district ?? '';
    const d = districtRect[district];
    if (!d) continue;
    if (c.kind === 'service' || c.kind === 'module') {
      const pad = full.pads[district]?.indexOf(c.id) ?? 0;
      const rows = d.h >= 280 ? [d.y + 112, d.y + 196] : [d.y + 92];
      const col = pad % 2;
      const row = Math.min(rows.length - 1, Math.floor(pad / 2));
      const padW = (d.w - 64) / 2;
      const w = c.kind === 'service' ? padW : padW * 0.78;
      const h = c.kind === 'service' ? 62 : 46;
      const footprint = { x: d.x + 24 + col * (padW + 16), y: rows[row]! + (62 - h), w, h };
      const floors = floorsFor(load);
      model.buildings.push({ id: c.id, kind: c.kind, footprint, floors });
      const top = footprint.y - floors * FLOOR_HEIGHT;
      model.bounds[c.id] = { x: footprint.x, y: top, w: footprint.w, h: footprint.y + footprint.h - top + 26 };
      model.anchors[c.id] = [footprint.x, footprint.y + footprint.h + 16];
    } else if (c.kind === 'database') {
      const k = full.basins[district]?.indexOf(c.id) ?? 0;
      const rx = Math.min(64, d.w * 0.19);
      const cx = d.x + d.w * (0.28 + 0.44 * (k % 2));
      const cy = d.y + d.h - 66;
      const level = Math.max(0.12, 1 - Math.max(0, stress - 0.4) * 0.9);
      model.reservoirs.push({ id: c.id, cx, cy, rx, ry: 20, level });
      model.bounds[c.id] = { x: cx - rx, y: cy - 20, w: rx * 2, h: 40 + 26 };
      model.anchors[c.id] = [cx - rx, cy + 36];
    } else {
      const rect = { x: d.x + 24, y: d.y + 34, w: 64, h: 14 };
      model.depots.push({ id: c.id, rect });
      model.bounds[c.id] = { x: rect.x, y: rect.y, w: rect.w, h: rect.h + 22 };
      model.anchors[c.id] = [rect.x + rect.w + 10, rect.y + 11];
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
    const length = 12 + pressure * 120;
    model.cracks.push({ id: `crack-${r.id}`, points: crackPath([r.cx + r.rx - 4, r.cy], length, hashString(r.id), 0.3) });
  }
  for (const b of model.buildings) {
    const stress = model.stress[b.id] ?? 0;
    if (stress < 1) continue;
    const f = b.footprint;
    model.cracks.push({ id: `crack-${b.id}`, points: crackPath([f.x + f.w * 0.3, f.y + f.h], 20 + (stress - 1) * 60, hashString(b.id), 1.1) });
  }
}

function districtOf(topology: Topology, id: string): string | undefined {
  return topology.components.find((c) => c.id === id)?.district;
}

export function modelFor(snapshot: Snapshot, order: SlotOrder): CityModel {
  return layoutCity(snapshot.topology, snapshot.loads, snapshot.forces, order);
}
