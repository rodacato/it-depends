import { describe, expect, it } from 'vitest';
import { campaign } from '../test/campaign';
import type { Topology } from '../engine/schema';
import { applyTopologyChanges } from '../engine/topology';
import { MESSAGES } from '../i18n/locales';
import type { Rect } from './geometry';
import { NAME_TYPE, ROLE_TYPE, labelHeight, textWidth, wrapLabel } from './labels';
import type { CityModel } from './layout';
import { CITY_RIGHT, FLOOR_HEIGHT, layoutCity, slotOrder } from './layout';

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

// Drawn at their tallest, so anything that could ever collide does here.
const TALLEST = 1e9;

function shapes(model: CityModel): [string, Rect][] {
  return [
    ...model.buildings.map((b) => {
      const f = b.footprint;
      const roof = f.y - Math.min(b.floors, b.maxFloors) * FLOOR_HEIGHT;
      const stub = b.kind === 'module' ? 18 : 0;
      return [b.id, { x: f.x - stub, y: roof, w: f.w + stub, h: f.y + f.h - roof }] as [string, Rect];
    }),
    ...model.reservoirs.map((r) => [r.id, { x: r.cx - r.rx, y: r.cy - r.ry, w: r.rx * 2, h: r.ry * 2 }] as [string, Rect]),
    ...model.depots.map((d) => [d.id, d.rect] as [string, Rect]),
    ...model.vendors.map((v) => [v.id, v.lot] as [string, Rect]),
  ];
}

const labelBoxes = (model: CityModel): [string, Rect][] =>
  Object.entries(model.labels).map(([id, s]) => [`label ${id}`, { x: s.x, y: s.y - 12, w: s.w, h: labelHeight(s.lines) }]);

const titleBoxes = (model: CityModel): [string, Rect][] => model.districts.map((d) => [`title ${d.id}`, { x: d.rect.x, y: d.rect.y, w: d.rect.w, h: 26 }]);

describe('city layout on every reachable site', () => {
  const sites = reachableSites();
  const forces = campaign.company.initialForces;
  const models = sites.map((s) => ({ path: s.path, model: layoutCity(s.topology, Object.fromEntries(s.topology.components.map((c) => [c.id, { load: TALLEST, stress: 0 }])), forces, slotOrder(s.history)) }));

  it('walks every chapter', () => {
    expect(campaign.chapters.length).toBe(8);
    expect(sites.length).toBeGreaterThan(1000);
  });

  it('never overlaps buildings, reservoirs, depots, lots, lettering or district titles', () => {
    for (const { path, model } of models) {
      const all = [...shapes(model), ...labelBoxes(model), ...titleBoxes(model)];
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const [a, ra] = all[i]!;
          const [b, rb] = all[j]!;
          if (overlap(ra, rb)) throw new Error(`${a} overlaps ${b} on ${path}`);
        }
      }
    }
  });

  it('keeps the whole city clear of the sheets on the right and the gauges below', () => {
    for (const { path, model } of models) {
      for (const [id, r] of [...shapes(model), ...labelBoxes(model)]) {
        expect(r.x + r.w, `${id} on ${path}`).toBeLessThanOrEqual(CITY_RIGHT);
        expect(r.y + r.h, `${id} on ${path}`).toBeLessThanOrEqual(762);
        expect(r.y, `${id} on ${path}`).toBeGreaterThanOrEqual(70);
      }
    }
  });

  it('places every component of every site', () => {
    sites.forEach((s, i) => {
      for (const c of s.topology.components) expect(models[i]!.model.bounds[c.id], `${c.id} on ${s.path}`).toBeDefined();
    });
  });

  it('fits every name and role inside its slot, in every locale', () => {
    for (const [locale, messages] of Object.entries(MESSAGES)) {
      for (const { path, model } of models) {
        for (const [id, slot] of Object.entries(model.labels)) {
          const name = messages[`components.${id}.name`] ?? id;
          const role = messages[`components.${id}.role`] ?? messages[`kinds.${model.kinds[id]}`] ?? '';
          const lines = wrapLabel(name, role, slot);
          for (const l of lines.name) expect(textWidth(l, NAME_TYPE.advance), `${locale} ${id} "${l}" on ${path}`).toBeLessThanOrEqual(slot.w);
          for (const l of lines.role) expect(textWidth(l, ROLE_TYPE.advance), `${locale} ${id} "${l}" on ${path}`).toBeLessThanOrEqual(slot.w);
          expect(lines.name.length + lines.role.length).toBeLessThanOrEqual(slot.lines);
        }
      }
    }
  });
});
