import type { Texture } from 'pixi.js';
import { Application, Container, Graphics, Particle, ParticleContainer } from 'pixi.js';
import type { Point, Polyline, Rect } from './geometry';
import {
  clamp01,
  dashPolyline,
  easeOutCubic,
  ellipsePolyline,
  lerp,
  pointAlong,
  polylineLength,
  polylinePrefix,
  rectPolyline,
  revisionCloud,
  hashString,
  windowed,
} from './geometry';
import type { BuildingShape, CityModel, LinkShape, ReservoirShape, VendorShape } from './layout';
import { FLOOR_HEIGHT, SHEET } from './layout';
import { INK, stressColor } from './palette';

export interface CloudSpec {
  id: string;
  rect: Rect;
  progress: number;
}

export interface LeaderSpec {
  id: string;
  from: Point;
  to: Point;
  progress: number;
}

export interface CityFrame {
  base: CityModel;
  target: CityModel;
  // 0..1 from base to target: floors rise, new linework is drawn with a pen.
  growth: number;
  clouds: CloudSpec[];
  leaders: LeaderSpec[];
  preview: CityModel | null;
  highlight: string | null;
  // Time-lapse fast-forward multiplier for traffic.
  trafficSpeed: number;
  crackProgress: number;
}

export interface RendererOptions {
  reducedMotion: boolean;
  maxParticles?: number;
}

interface Mover {
  path: Polyline;
  length: number;
  u: number;
  speed: number;
  offset: number;
  color: number;
  alpha: number;
}

const DEFAULT_MAX_PARTICLES = 3000;

// Draws the city from engine-derived models only. It never reads simulation state directly.
export class CityRenderer {
  private app: Application;
  private world = new Container();
  private survey = new Graphics();
  private lines = new Graphics();
  private overlay = new Graphics();
  private traffic: ParticleContainer;
  private pool: Particle[] = [];
  private movers: Mover[] = [];
  private frame: CityFrame | null = null;
  private budget: number;
  private slowFrames = 0;
  private fastFrames = 0;
  private resizeObserver: ResizeObserver;

  private constructor(
    app: Application,
    private host: HTMLElement,
    private options: RendererOptions,
  ) {
    this.app = app;
    this.budget = options.maxParticles ?? DEFAULT_MAX_PARTICLES;
    const dot = new Graphics().circle(0, 0, 2).fill(0xffffff);
    const texture: Texture = app.renderer.generateTexture({ target: dot, resolution: 2 });
    this.traffic = new ParticleContainer({ dynamicProperties: { position: true, color: true } });
    for (let i = 0; i < (options.maxParticles ?? DEFAULT_MAX_PARTICLES); i++) {
      const p = new Particle({ texture, anchorX: 0.5, anchorY: 0.5, scaleX: 0.85, scaleY: 0.85, alpha: 0 });
      this.pool.push(p);
      this.traffic.addParticle(p);
    }
    this.world.addChild(this.survey, this.lines, this.traffic, this.overlay);
    app.stage.addChild(this.world);
    this.drawSurvey();
    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(host);
    this.fit();
    app.ticker.add((ticker) => this.tick(ticker.deltaMS, ticker.FPS));
  }

  static async create(host: HTMLElement, options: RendererOptions): Promise<CityRenderer> {
    const app = new Application();
    await app.init({
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
      width: host.clientWidth || SHEET.w,
      height: host.clientHeight || SHEET.h,
    });
    app.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(app.canvas);
    return new CityRenderer(app, host, options);
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.app.destroy(true, { children: true, texture: true });
  }

  setFrame(frame: CityFrame): void {
    const trafficChanged = !this.frame || this.frame.base !== frame.base || this.frame.target !== frame.target || Math.abs(this.frame.growth - frame.growth) > 0.08;
    this.frame = frame;
    this.drawLines(frame);
    if (trafficChanged) this.rebuildTraffic(frame);
  }

  particleCount(): number {
    return this.movers.length;
  }

  private fit(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.app.renderer.resize(w, h);
    this.world.scale.set(w / SHEET.w, h / SHEET.h);
  }

  private drawSurvey(): void {
    const g = this.survey;
    for (let x = 60; x <= 990; x += 30) g.moveTo(x, 60).lineTo(x, 770);
    for (let y = 60; y <= 770; y += 30) g.moveTo(60, y).lineTo(990, y);
    g.stroke({ width: 0.6, color: INK.line, alpha: 0.07 });
  }

  private tick(deltaMS: number, fps: number): void {
    this.adaptBudget(fps);
    const frame = this.frame;
    if (!frame) return;
    const dt = this.options.reducedMotion ? 0 : Math.min(deltaMS, 50) / 1000;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i]!;
      const m = i < this.budget ? this.movers[i] : undefined;
      if (!m) {
        p.alpha = 0;
        continue;
      }
      m.u = (m.u + (m.speed * frame.trafficSpeed * dt) / Math.max(1, m.length)) % 1;
      const [x, y] = pointAlong(m.path, m.u);
      const [x2, y2] = pointAlong(m.path, Math.min(1, m.u + 0.002));
      const dx = x2 - x;
      const dy = y2 - y;
      const n = Math.hypot(dx, dy) || 1;
      p.x = x - (dy / n) * m.offset;
      p.y = y + (dx / n) * m.offset;
      p.tint = m.color;
      p.alpha = m.alpha;
    }
  }

  // Degrade gracefully: shed particles when frames drop, win them back when there is headroom.
  private adaptBudget(fps: number): void {
    const max = this.options.maxParticles ?? DEFAULT_MAX_PARTICLES;
    if (fps < 50) this.slowFrames++;
    else this.slowFrames = 0;
    if (fps > 58) this.fastFrames++;
    else this.fastFrames = 0;
    if (this.slowFrames > 30) {
      this.budget = Math.max(200, Math.floor(this.budget * 0.75));
      this.slowFrames = 0;
    } else if (this.fastFrames > 180 && this.budget < max) {
      this.budget = Math.min(max, Math.floor(this.budget * 1.15));
      this.fastFrames = 0;
    }
  }

  private rebuildTraffic(frame: CityFrame): void {
    const movers: Mover[] = [];
    const baseLinks = new Map(frame.base.links.map((l) => [l.id, l]));
    for (const link of frame.target.links) {
      if (link.kind === 'pipe') continue;
      const before = baseLinks.get(link.id);
      const reveal = before ? 1 : windowed(frame.growth, 0.55, 0.85);
      if (reveal <= 0) continue;
      const load = before ? lerp(before.load, link.load, frame.growth) : link.load;
      const stress = before ? lerp(before.stress, link.stress, frame.growth) : link.stress;
      movers.push(...this.moversFor(link, load, stress, reveal));
    }
    for (const link of frame.base.links) {
      if (link.kind === 'pipe' || frame.target.links.some((l) => l.id === link.id)) continue;
      const fade = 1 - windowed(frame.growth, 0, 0.3);
      if (fade > 0) movers.push(...this.moversFor(link, link.load, link.stress, fade));
    }
    // Keep existing particle phases so traffic does not jump when the density changes.
    for (let i = 0; i < movers.length && i < this.movers.length; i++) {
      const prev = this.movers[i]!;
      if (prev.path === movers[i]!.path) movers[i]!.u = prev.u;
    }
    this.movers = movers.slice(0, this.options.maxParticles ?? DEFAULT_MAX_PARTICLES);
  }

  private moversFor(link: LinkShape, load: number, stress: number, reveal: number): Mover[] {
    const length = polylineLength(link.points);
    const count = Math.round(Math.min(420, 4 + 10 * Math.log2(1 + load / 12)) * reveal);
    const seed = hashString(link.id);
    const out: Mover[] = [];
    const congestion = Math.min(stress, 1.4) / 1.4;
    for (let i = 0; i < count; i++) {
      const r1 = ((seed * (i + 1) * 2654435761) >>> 0) / 4294967296;
      const r2 = ((seed ^ ((i + 7) * 40503)) >>> 0) % 1000 / 1000;
      const hot = stress > 0.6 && r2 < clamp01((stress - 0.6) * 1.6);
      out.push({
        path: link.points,
        length,
        u: r1,
        speed: (link.kind === 'rail' ? 46 : 58) * (0.8 + r2 * 0.4) * (1 - 0.6 * congestion),
        offset: link.kind === 'rail' || link.internal ? 0 : (r2 - 0.5) * 7,
        color: hot ? INK.red : stressColor(stress * 0.7),
        alpha: 0.92,
      });
    }
    return out;
  }

  private drawLines(frame: CityFrame): void {
    const g = this.lines;
    const o = this.overlay;
    g.clear();
    o.clear();
    const { base, target, growth } = frame;

    for (const d of target.districts) {
      const existed = base.districts.some((x) => x.id === d.id);
      const k = existed ? 1 : easeOutCubic(windowed(growth, 0, 0.4));
      strokeMany(g, dashPolyline(polylinePrefix(rectPolyline(d.rect), k), 18, 5), 1.1, INK.line, 0.8);
    }
    for (const d of base.districts) {
      if (target.districts.some((x) => x.id === d.id)) continue;
      const k = 1 - windowed(growth, 0, 0.4);
      strokeMany(g, dashPolyline(polylinePrefix(rectPolyline(d.rect), k), 18, 5), 1.1, INK.line, 0.8);
    }

    this.drawLinks(g, base, target, growth);

    for (const r of target.reservoirs) {
      const prev = base.reservoirs.find((x) => x.id === r.id);
      const k = prev ? 1 : easeOutCubic(windowed(growth, 0.15, 0.55));
      drawReservoir(g, prev ? { ...r, level: lerp(prev.level, r.level, growth) } : r, k, stressColor(target.stress[r.id] ?? 0));
    }
    for (const v of target.vendors) {
      const existed = base.vendors.some((x) => x.id === v.id);
      drawVendor(g, v, existed ? 1 : easeOutCubic(windowed(growth, 0.2, 0.6)));
    }
    for (const d of target.depots) {
      const existed = base.depots.some((x) => x.id === d.id);
      const k = existed ? 1 : easeOutCubic(windowed(growth, 0.2, 0.5));
      strokeLine(g, polylinePrefix(rectPolyline(d.rect), k), 1.2, INK.line, 1);
    }

    const buildings = [...target.buildings].sort((a, b) => a.footprint.y - b.footprint.y);
    for (const b of buildings) {
      const prev = base.buildings.find((x) => x.id === b.id);
      if (prev) {
        drawBuilding(g, b, lerp(prev.floors, b.floors, stepped(growth, prev.floors, b.floors)), 1, stressColor(lerp(base.stress[b.id] ?? 0, target.stress[b.id] ?? 0, growth)));
      } else {
        const pen = easeOutCubic(windowed(growth, 0.1, 0.4));
        const rise = windowed(growth, 0.35, 0.85);
        drawBuilding(g, b, b.floors * stepped(rise, 0, b.floors), pen, INK.line);
      }
    }
    for (const b of base.buildings) {
      if (target.buildings.some((x) => x.id === b.id)) continue;
      const k = 1 - windowed(growth, 0, 0.5);
      if (k > 0) drawBuilding(g, b, b.floors * k, k, INK.line);
    }

    for (const c of target.cracks) {
      const existed = base.cracks.some((x) => x.id === c.id);
      const k = existed ? 1 : frame.crackProgress;
      strokeLine(o, polylinePrefix(c.points, k), 1.1, INK.red, 0.95);
    }

    if (frame.preview) drawPreview(o, target, frame.preview);

    for (const cloud of frame.clouds) {
      const path = revisionCloud(cloud.rect, hashString(cloud.id));
      strokeLine(o, polylinePrefix(path, easeOutCubic(cloud.progress)), 1.8, INK.red, 1);
    }
    for (const leader of frame.leaders) {
      const line: Polyline = [leader.from, leader.to];
      const drawn = polylinePrefix(line, easeOutCubic(leader.progress));
      strokeLine(o, drawn, 1.2, INK.red, 1);
      if (leader.progress > 0) o.circle(leader.from[0], leader.from[1], 2.5).fill(INK.red);
      if (leader.progress >= 1) drawArrowHead(o, leader.from, leader.to);
    }
    if (frame.highlight) {
      const b = target.bounds[frame.highlight];
      if (b) strokeMany(o, dashPolyline(rectPolyline({ x: b.x - 6, y: b.y - 6, w: b.w + 12, h: b.h + 12 }), 4, 4), 1, INK.line, 0.9);
    }
  }

  private drawLinks(g: Graphics, base: CityModel, target: CityModel, growth: number): void {
    const baseIds = new Set(base.links.map((l) => l.id));
    for (const l of target.links) {
      const k = baseIds.has(l.id) ? 1 : easeOutCubic(windowed(growth, 0.3, 0.7));
      drawLink(g, l, k);
    }
    for (const l of base.links) {
      if (target.links.some((x) => x.id === l.id)) continue;
      drawLink(g, l, 1 - windowed(growth, 0, 0.4));
    }
  }
}

// Floors rise one at a time: each floor gets its own slice of the growth window.
function stepped(t: number, from: number, to: number): number {
  const floors = Math.max(1, Math.abs(Math.round(to - from)));
  const per = 1 / floors;
  const done = Math.floor(clamp01(t) / per);
  const within = easeOutCubic((clamp01(t) - done * per) / per);
  return Math.min(1, (done + within) * per);
}

function strokeLine(g: Graphics, points: readonly Point[], width: number, color: number, alpha: number): void {
  strokeMany(g, [points], width, color, alpha);
}

// One path per style: many dashes, one stroke call.
function strokeMany(g: Graphics, lines: readonly (readonly Point[])[], width: number, color: number, alpha: number): void {
  let any = false;
  for (const points of lines) {
    if (points.length < 2) continue;
    g.moveTo(points[0]![0], points[0]![1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i]![0], points[i]![1]);
    any = true;
  }
  if (any) g.stroke({ width, color, alpha, cap: 'butt', join: 'miter' });
}

function drawArrowHead(g: Graphics, from: Point, to: Point): void {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const s = 7;
  strokeLine(g, [
    [to[0] - Math.cos(a - 0.45) * s, to[1] - Math.sin(a - 0.45) * s],
    to,
    [to[0] - Math.cos(a + 0.45) * s, to[1] - Math.sin(a + 0.45) * s],
  ], 1.4, INK.red, 1);
}

function drawLink(g: Graphics, l: LinkShape, k: number): void {
  if (k <= 0) return;
  const pts = polylinePrefix(l.points, k);
  if (l.internal) {
    for (const off of [-2.5, 2.5]) strokeLine(g, offsetPolyline(pts, off), 0.8, INK.line, 0.8);
  } else if (l.kind === 'road') {
    strokeLine(g, pts, 13, INK.line, 1);
    strokeLine(g, pts, 10.4, INK.blue, 1);
    strokeMany(g, dashPolyline(pts, 6, 6), 0.8, INK.line, 0.55);
  } else if (l.kind === 'rail') {
    for (const off of [-4, 4]) strokeLine(g, offsetPolyline(pts, off), 1, INK.line, 0.95);
    const len = polylineLength(pts);
    for (let s = 4; s < len; s += 8) {
      const p = pointAlong(pts, s / len);
      const q = pointAlong(pts, Math.min(1, (s + 1) / len));
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const n = Math.hypot(dx, dy) || 1;
      strokeLine(g, [[p[0] - (dy / n) * 6.5, p[1] + (dx / n) * 6.5], [p[0] + (dy / n) * 6.5, p[1] - (dx / n) * 6.5]], 0.8, INK.line, 0.6);
    }
  } else {
    for (const off of [-3.5, 3.5]) strokeLine(g, offsetPolyline(pts, off), 1, INK.line, 0.9);
  }
}

function offsetPolyline(points: readonly Point[], d: number): Polyline {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(points.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const n = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / n) * d, p[1] + (dx / n) * d] as Point;
  });
}

function drawBuilding(g: Graphics, b: BuildingShape, floors: number, pen: number, color: number): void {
  const f = b.footprint;
  if (pen < 1) {
    strokeLine(g, polylinePrefix(rectPolyline(f), pen), 1.3, INK.line, 1);
    return;
  }
  const H = Math.max(0, floors) * FLOOR_HEIGHT;
  strokeMany(g, dashPolyline(rectPolyline(f), 3, 3), 0.8, INK.line, 0.35);
  // Front face and roof are filled with ground colour so buildings behind are occluded, like ink on paper.
  g.rect(f.x, f.y + f.h - H, f.w, H).fill(INK.blue);
  g.rect(f.x, f.y - H, f.w, f.h).fill(INK.blue);
  strokeLine(g, rectPolyline({ x: f.x, y: f.y + f.h - H, w: f.w, h: H }), 1.3, color, 1);
  strokeLine(g, rectPolyline({ x: f.x, y: f.y - H, w: f.w, h: f.h }), 1.3, color, 1);
  for (let i = 1; i < floors; i++) strokeLine(g, [[f.x, f.y + f.h - i * FLOOR_HEIGHT], [f.x + f.w, f.y + f.h - i * FLOOR_HEIGHT]], 0.7, color, 0.55);
  strokeLine(g, rectPolyline({ x: f.x + 5, y: f.y - H + 5, w: f.w - 10, h: f.h - 10 }), 0.7, color, 0.5);
  strokeLine(g, rectPolyline({ x: f.x + f.w * 0.62, y: f.y - H + f.h * 0.22, w: f.w * 0.2, h: f.h * 0.22 }), 0.7, color, 0.6);
  if (b.kind === 'module') {
    const y = f.y - H + f.h / 2;
    strokeLine(g, [[f.x - 12, y], [f.x, y]], 1.2, color, 1);
    g.arc(f.x - 12, y, 5, Math.PI / 2, (Math.PI * 3) / 2).stroke({ width: 1.2, color });
  }
}

function drawReservoir(g: Graphics, r: ReservoirShape, k: number, color: number): void {
  strokeLine(g, polylinePrefix(ellipsePolyline(r.cx, r.cy, r.rx, r.ry), k), 1.4, color, 1);
  if (k < 1) return;
  strokeLine(g, ellipsePolyline(r.cx, r.cy, r.rx - 6, r.ry - 5), 0.7, color, 0.6);
  const rows = Math.round(r.level * 5);
  for (let i = 0; i < rows; i++) {
    const y = r.cy + r.ry - 8 - i * ((r.ry * 2 - 14) / 5);
    const half = r.rx * Math.sqrt(Math.max(0, 1 - ((y - r.cy) / r.ry) ** 2)) - 12;
    if (half < 6) continue;
    const wave: Polyline = [];
    for (let x = -half; x <= half; x += 2.5) wave.push([r.cx + x, y + Math.sin((x / 5) * Math.PI) * 1.3]);
    strokeLine(g, wave, 0.7, color, 0.7);
  }
}

function drawVendor(g: Graphics, v: VendorShape, k: number): void {
  strokeMany(g, dashPolyline(polylinePrefix(rectPolyline(v.lot), k), 7, 4), 0.9, INK.line, 0.9);
  if (k < 1) return;
  const { x, y, w, h } = v.lot;
  for (let c = 6; c < w + h; c += 7) {
    let sx = x + c;
    let sy = y;
    let ex = x + c - h;
    let ey = y + h;
    if (sx > x + w) {
      sy += sx - (x + w);
      sx = x + w;
    }
    if (ex < x) {
      ey -= x - ex;
      ex = x;
    }
    strokeLine(g, [[sx, sy], [ex, ey]], 0.6, INK.line, 0.32);
  }
  drawBuilding(g, { id: v.id, kind: 'service', footprint: v.footprint, floors: v.floors }, v.floors, 1, INK.line);
}

// Dashed pencil linework for what an option would add; removals are struck through.
function drawPreview(g: Graphics, current: CityModel, preview: CityModel): void {
  const has = (list: { id: string }[], id: string) => list.some((x) => x.id === id);
  const dashed = (pts: Polyline, w = 1.2) => {
    strokeMany(g, dashPolyline(pts, 7, 5), w, INK.line, 0.85);
  };
  for (const d of preview.districts) if (!has(current.districts, d.id)) dashed(rectPolyline(d.rect), 1);
  for (const l of preview.links) {
    if (has(current.links, l.id)) continue;
    if (l.kind === 'road' && !l.internal) for (const off of [-6.5, 6.5]) dashed(offsetPolyline(l.points, off), 1);
    else dashed(l.points, 1);
  }
  for (const b of preview.buildings) {
    if (has(current.buildings, b.id)) continue;
    const f = b.footprint;
    const H = b.floors * FLOOR_HEIGHT;
    dashed(rectPolyline({ x: f.x, y: f.y + f.h - H, w: f.w, h: H }));
    dashed(rectPolyline({ x: f.x, y: f.y - H, w: f.w, h: f.h }));
  }
  for (const r of preview.reservoirs) if (!has(current.reservoirs, r.id)) dashed(ellipsePolyline(r.cx, r.cy, r.rx, r.ry));
  for (const v of preview.vendors) if (!has(current.vendors, v.id)) dashed(rectPolyline(v.lot));
  for (const d of preview.depots) if (!has(current.depots, d.id)) dashed(rectPolyline(d.rect));
  for (const b of current.buildings) {
    if (has(preview.buildings, b.id)) continue;
    const f = b.footprint;
    strokeLine(g, [[f.x, f.y], [f.x + f.w, f.y + f.h]], 1.2, INK.line, 0.85);
    strokeLine(g, [[f.x + f.w, f.y], [f.x, f.y + f.h]], 1.2, INK.line, 0.85);
  }
}
