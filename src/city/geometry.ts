export type Point = readonly [number, number];
export type Polyline = Point[];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

export function pointAlong(points: readonly Point[], fraction: number): Point {
  let target = Math.max(0, Math.min(1, fraction)) * polylineLength(points);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (target <= l && l > 0) return [a[0] + ((b[0] - a[0]) * target) / l, a[1] + ((b[1] - a[1]) * target) / l];
    target -= l;
  }
  return points[points.length - 1] ?? [0, 0];
}

// The drawn part of a line at pen progress p: linework is drawn, never faded in.
export function polylinePrefix(points: readonly Point[], fraction: number): Polyline {
  if (fraction >= 1) return [...points];
  if (fraction <= 0 || points.length < 2) return [];
  let remaining = fraction * polylineLength(points);
  const out: Polyline = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (remaining >= l) {
      out.push(b);
      remaining -= l;
    } else {
      out.push([a[0] + ((b[0] - a[0]) * remaining) / l, a[1] + ((b[1] - a[1]) * remaining) / l]);
      break;
    }
  }
  return out;
}

export function dashPolyline(points: readonly Point[], dash: number, gap: number): Polyline[] {
  const out: Polyline[] = [];
  let drawing = true;
  let left = dash;
  let current: Polyline = points[0] ? [points[0]] : [];
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1]!;
    const b = points[i]!;
    let l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (l > 0) {
      const step = Math.min(left, l);
      const p: Point = [a[0] + ((b[0] - a[0]) * step) / l, a[1] + ((b[1] - a[1]) * step) / l];
      if (drawing) current.push(p);
      left -= step;
      l -= step;
      a = p;
      if (left <= 1e-6) {
        if (drawing && current.length > 1) out.push(current);
        drawing = !drawing;
        left = drawing ? dash : gap;
        current = drawing ? [p] : [];
      }
    }
  }
  if (drawing && current.length > 1) out.push(current);
  return out;
}

export function rectPolyline(r: Rect): Polyline {
  return [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x + r.w, r.y + r.h],
    [r.x, r.y + r.h],
    [r.x, r.y],
  ];
}

export function ellipsePolyline(cx: number, cy: number, rx: number, ry: number, segments = 48): Polyline {
  const out: Polyline = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2 - Math.PI / 2;
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return out;
}

export function unionRect(rects: readonly Rect[]): Rect | null {
  if (!rects.length) return null;
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Revision cloud: scalloped arcs traced around a superellipse, as drawn by hand on real sheets.
export function revisionCloud(r: Rect, seed: number, pad = 12, scallop = 12): Polyline {
  const rand = seeded(seed);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const a = r.w / 2 + pad;
  const b = r.h / 2 + pad;
  const n = 5;
  const outline: Polyline = [];
  for (let i = 0; i <= 360; i++) {
    const t = (i / 360) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    outline.push([cx + a * Math.sign(c) * Math.abs(c) ** (2 / n), cy + b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  const per = polylineLength(outline);
  const count = Math.max(8, Math.round(per / (scallop * 1.7)));
  const anchors: Point[] = [];
  for (let k = 0; k < count; k++) anchors.push(pointAlong(outline, (k + (rand() - 0.5) * 0.25) / count));
  const out: Polyline = [];
  for (let k = 0; k < count; k++) {
    const p = anchors[k]!;
    const q = anchors[(k + 1) % count]!;
    const chord = Math.hypot(q[0] - p[0], q[1] - p[1]);
    // Outward normal for a clockwise trace in screen space.
    const nx = (q[1] - p[1]) / chord;
    const ny = -(q[0] - p[0]) / chord;
    const bulge = chord * (0.42 + rand() * 0.12);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const along = 1 - (2 * t - 1) ** 2;
      out.push([p[0] + (q[0] - p[0]) * t + nx * bulge * along, p[1] + (q[1] - p[1]) * t + ny * bulge * along]);
    }
  }
  return out;
}

// A crack: a jagged polyline that propagates from an origin, deterministic per id.
export function crackPath(origin: Point, length: number, seed: number, heading = 0.6): Polyline {
  const rand = seeded(seed);
  const out: Polyline = [origin];
  let [x, y] = origin;
  let angle = heading;
  let travelled = 0;
  while (travelled < length) {
    const step = 5 + rand() * 7;
    angle += (rand() - 0.5) * 1.3;
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
    travelled += step;
    out.push([x, y]);
  }
  return out;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Mechanical ease: decisive start, precise stop, never an overshoot.
export const easeOutCubic = (x: number) => 1 - (1 - clamp01(x)) ** 3;

export function windowed(t: number, start: number, end: number): number {
  return clamp01((t - start) / (end - start));
}
