import { describe, expect, it } from 'vitest';
import { campaign } from '../test/campaign';
import type { Topology } from '../engine/schema';
import { applyTopologyChanges } from '../engine/topology';
import type { Rect } from './geometry';
import { layoutCity, slotOrder } from './layout';

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Every site reachable through any sequence of choices, deduplicated, with the path that built it.
function reachableSites(): { path: string; topology: Topology; history: Topology[] }[] {
  let sites = [{ path: 'start', topology: campaign.company.initialTopology, history: [campaign.company.initialTopology] }];
  for (const ch of campaign.chapters) {
    const next = new Map<string, (typeof sites)[number]>();
    for (const s of sites) {
      for (const o of ch.dilemma.options) {
        const t = applyTopologyChanges(s.topology, o.topology);
        const key = JSON.stringify(t);
        if (!next.has(key)) next.set(key, { path: `${s.path} > ${ch.id}:${o.id}`, topology: t, history: [...s.history, t] });
      }
    }
    sites = [...next.values()];
  }
  return sites;
}

describe('city layout on every reachable site', () => {
  const sites = reachableSites();
  const forces = campaign.company.initialForces;

  it('walks every chapter', () => {
    expect(campaign.chapters.length).toBe(8);
    expect(sites.length).toBeGreaterThan(1000);
  });

  it('never overlaps buildings, reservoirs, depots or vendor lots', () => {
    for (const s of sites) {
      const model = layoutCity(s.topology, {}, forces, slotOrder(s.history));
      const footprints: [string, Rect][] = [
        ...model.buildings.map((b) => [b.id, b.footprint] as [string, Rect]),
        ...model.reservoirs.map((r) => [r.id, { x: r.cx - r.rx, y: r.cy - r.ry, w: r.rx * 2, h: r.ry * 2 }] as [string, Rect]),
        ...model.depots.map((d) => [d.id, d.rect] as [string, Rect]),
        ...model.vendors.map((v) => [v.id, v.lot] as [string, Rect]),
      ];
      for (let i = 0; i < footprints.length; i++) {
        for (let j = i + 1; j < footprints.length; j++) {
          const [a, ra] = footprints[i]!;
          const [b, rb] = footprints[j]!;
          if (overlap(ra, rb)) throw new Error(`${a} overlaps ${b} on ${s.path}`);
        }
      }
    }
  });

  it('places every component of every site', () => {
    for (const s of sites) {
      const model = layoutCity(s.topology, {}, forces, slotOrder(s.history));
      for (const c of s.topology.components) expect(model.bounds[c.id], `${c.id} on ${s.path}`).toBeDefined();
    }
  });
});
