import { describe, expect, it } from 'vitest';
import { campaign } from '../test/campaign';
import { changesBetween, delayedConsequences, forecastOption, traceForce } from './queries';
import { simulate } from './simulate';
import { applyTopologyChanges } from './topology';

const ch1 = campaign.chapters[0]!;
const decide = (optionId: string) => [{ chapterId: ch1.id, optionId }];

describe('determinism', () => {
  it('same inputs and seed give the same timeline', () => {
    const a = simulate(campaign, decide('payments-port'), { seed: 7 });
    const b = simulate(campaign, decide('payments-port'), { seed: 7 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a different seed changes demand but nothing about the decision', () => {
    const a = simulate(campaign, decide('payments-port'), { seed: 1 });
    const b = simulate(campaign, decide('payments-port'), { seed: 2 });
    expect(a.snapshots[4]!.context.ordersPerDay).not.toBe(b.snapshots[4]!.context.ordersPerDay);
    expect(a.snapshots[4]!.topology).toEqual(b.snapshots[4]!.topology);
  });

  it('every applied effect carries an assumption and at least one source', () => {
    for (const option of ch1.dilemma.options) {
      const t = simulate(campaign, decide(option.id), { seed: 3 });
      for (const e of t.snapshots.flatMap((s) => s.applied)) {
        expect(e.assumption.length).toBeGreaterThan(0);
        expect(e.sources.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('effect timing', () => {
  it('the briefing snapshot is untouched by the decision', () => {
    const t = simulate(campaign, decide('own-service'), { seed: 1 });
    expect(t.snapshots[0]!.revisions).toHaveLength(0);
    expect(t.snapshots[0]!.topology.components.map((c) => c.id)).not.toContain('payments-service');
  });

  it('immediate effects land in the first quarter of the time-lapse', () => {
    const t = simulate(campaign, decide('own-service'), { seed: 1 });
    const q1 = t.snapshots[1]!.applied.map((e) => e.effectId);
    expect(q1).toContain('service-eats-the-runway');
    expect(q1).not.toContain('service-pci-scope');
  });

  it('delayed effects arrive N quarters later and point back to their revision', () => {
    const t = simulate(campaign, decide('own-service'), { seed: 1 });
    const pci = t.snapshots.flatMap((s) => s.applied).find((e) => e.effectId === 'service-pci-scope');
    expect(pci?.quarter).toBe(3);
    const late = delayedConsequences(t, 2, 3);
    expect(late.map((d) => d.revision)).toContain('A');
  });

  it('conditional effects fire only when their event occurs while the decision is in place', () => {
    const withDecision = simulate(campaign, decide('hosted-checkout'), { seed: 1 });
    const hit = withDecision.snapshots.flatMap((s) => s.applied).find((e) => e.effectId === 'hosted-outage-is-yours');
    expect(hit?.timing).toBe('conditional');
    expect(hit?.quarter).toBe(2);
    const without = simulate(campaign, [], { seed: 1 });
    expect(without.snapshots.flatMap((s) => s.applied).some((e) => e.effectId === 'hosted-outage-is-yours')).toBe(false);
  });

  it('a threshold event never fires before its own chapter decides, whatever the seed', () => {
    const data = campaign.chapters.find((c) => c.id === 'data')!;
    // The last option of every chapter grows demand fastest, which once fired reservoir-dry a quarter early.
    const decisions = campaign.chapters.map((c) => ({ chapterId: c.id, optionId: c.dilemma.options.at(-1)!.id }));
    for (let seed = 0; seed < 300; seed++) {
      const t = simulate(campaign, decisions, { seed });
      const dry = t.snapshots.flatMap((s) => s.incidents).find((i) => i.eventId === 'reservoir-dry');
      if (dry) expect(dry.quarter).toBeGreaterThan(data.quarter);
    }
  });

  it('threshold events fire once', () => {
    const t = simulate(campaign, decide('payments-port'), { seed: 1 });
    const rush = t.snapshots.flatMap((s) => s.incidents).filter((i) => i.eventId === 'first-friday-rush');
    expect(rush).toHaveLength(1);
  });
});

describe('effects that depend on what was built', () => {
  const finaleWith = (firstOptionId: string, finaleOptionId: string) =>
    campaign.chapters.map((c, i) => ({
      chapterId: c.id,
      optionId: c.id === 'reversibility' ? firstOptionId : c.id === 'finale' ? finaleOptionId : c.dilemma.options[i % 2]!.id,
    }));
  const appliedIds = (decisions: { chapterId: string; optionId: string }[]) =>
    simulate(campaign, decisions, { seed: 1 }).snapshots.flatMap((s) => s.applied.map((e) => e.effectId));

  it('a payments team that inherits its own ledger skips the cutover', () => {
    expect(appliedIds(finaleWith('payments-port', 'platform-team'))).toContain('platform-cutover-risk');
    expect(appliedIds(finaleWith('own-service', 'platform-team'))).not.toContain('platform-cutover-risk');
  });

  it('buying a platform costs a retirement only if you built your own service', () => {
    expect(appliedIds(finaleWith('own-service', 'buy-platform'))).toContain('buy-retire-own-service');
    expect(appliedIds(finaleWith('hosted-checkout', 'buy-platform'))).not.toContain('buy-retire-own-service');
  });
});

describe('topology', () => {
  it('options change the site as declared', () => {
    const t = simulate(campaign, decide('own-service'), { seed: 1 });
    const changes = changesBetween(t, 0, 2);
    expect(changes.added).toEqual(expect.arrayContaining(['payments-service', 'ledger-db', 'payment-events', 'card-network']));
    expect(t.snapshots[2]!.topology.districts.map((d) => d.id)).toContain('payments');
  });

  it('adding an existing component updates it in place, keeping layout order', () => {
    const base = campaign.company.initialTopology;
    const next = applyTopologyChanges(base, [
      { op: 'addComponent', component: { id: 'mercadito-app', kind: 'service', district: 'storefront', loadShare: 0.5, capacity: 9 } },
    ]);
    expect(next.components.map((c) => c.id)).toEqual(base.components.map((c) => c.id));
    expect(next.components[0]!.capacity).toBe(9);
  });

  it('removing a component removes its connections', () => {
    const next = applyTopologyChanges(campaign.company.initialTopology, [{ op: 'removeComponent', id: 'shared-postgres' }]);
    expect(next.connections.some((c) => c.to === 'shared-postgres')).toBe(false);
  });
});

describe('congestion', () => {
  function quietCampaign() {
    const c = structuredClone(campaign);
    c.company.drifts = [];
    c.company.demandNoise.amount = 0;
    c.chapters.forEach((ch) => (ch.events = []));
    const component = c.company.initialTopology.components[0]!;
    component.loadShare = 1;
    return { c, component };
  }
  const congestions = (t: ReturnType<typeof simulate>, q: number) => t.snapshots[q]!.incidents.filter((i) => i.kind === 'congestion');

  it('a component just under capacity is not congested', () => {
    const { c, component } = quietCampaign();
    component.capacity = 700;
    c.company.initialContext.ordersPerDay = 697;
    const t = simulate(c, [], { seed: 1, untilQuarter: 1 });
    expect(congestions(t, 1)).toEqual([]);
    expect(t.snapshots[1]!.loads[component.id]!.stress).toBeLessThan(1);
  });

  it('a component removed while congested raises a new incident when it comes back overloaded', () => {
    const { c, component } = quietCampaign();
    component.capacity = 1000;
    c.company.initialContext.ordersPerDay = 2000;
    const [first, second] = c.chapters;
    first!.quarter = 1;
    second!.quarter = 2;
    first!.dilemma.options[0]!.topology = [{ op: 'removeComponent', id: component.id }];
    second!.dilemma.options[0]!.topology = [{ op: 'addComponent', component: structuredClone(component) }];
    const decisions = [first!, second!].map((ch) => ({ chapterId: ch.id, optionId: ch.dilemma.options[0]!.id }));
    const t = simulate(c, decisions, { seed: 1, untilQuarter: 4 });
    expect(t.snapshots.slice(2).some((s) => congestions(t, s.quarter).some((i) => i.anchor === component.id))).toBe(true);
  });
});

describe('forces and forecasts', () => {
  it('forces stay within 0-100', () => {
    for (const option of ch1.dilemma.options) {
      const t = simulate(campaign, decide(option.id), { seed: 9 });
      for (const s of t.snapshots) for (const v of Object.values(s.forces)) expect(v >= 0 && v <= 100).toBe(true);
    }
  });

  it('every force change traces back to applied effects', () => {
    const t = simulate(campaign, decide('payments-port'), { seed: 4 });
    for (const force of ['velocity', 'complexity', 'cost', 'reliability', 'cognitiveLoad'] as const) {
      const sum = traceForce(t, 0, 2, force).reduce((acc, e) => acc + e.delta, 0);
      expect(Math.round(sum)).toBe(t.snapshots[2]!.forces[force] - t.snapshots[0]!.forces[force]);
    }
  });

  it('the same dilemma weighs differently in another context', () => {
    const startup = forecastOption(campaign, [], ch1, 'own-service', 1);
    const fintech = forecastOption(campaign, [], ch1, 'own-service', 1, 'regulated-fintech');
    expect(fintech.delta.velocity).toBeGreaterThan(startup.delta.velocity);
    expect(fintech.delta.complexity).toBeLessThan(startup.delta.complexity);
  });
});
