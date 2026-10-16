import { createRng, deriveSeed } from './rng';
import type { Campaign, Chapter, Context, Decision, Effect, EffectTarget, Forces, Topology } from './schema';
import { FORCE_IDS } from './schema';
import { applyTopologyChanges, cloneTopology } from './topology';

type OptionOrigin = { kind: 'option'; chapterId: string; optionId: string; revision: string; decidedAt: number };

export type EffectOrigin =
  | OptionOrigin
  | { kind: 'drift' }
  | { kind: 'event'; eventId: string }
  | { kind: 'noise' }
  | { kind: 'congestion'; componentId: string };

export type AppliedTiming = 'immediate' | 'delayed' | 'conditional' | 'drift' | 'event' | 'noise' | 'congestion';

export interface AppliedEffect {
  effectId: string;
  origin: EffectOrigin;
  timing: AppliedTiming;
  target: EffectTarget;
  // The change actually applied after clamping, so every number on the sheet adds up.
  delta: number;
  anchor?: string;
  assumption: string;
  sources: string[];
  quarter: number;
}

export interface ComponentLoad {
  load: number;
  stress: number;
}

export interface Incident {
  id: string;
  kind: 'congestion' | 'event';
  quarter: number;
  anchor?: string;
  eventId?: string;
}

export interface Revision {
  letter: string;
  chapterId: string;
  optionId: string;
  quarter: number;
}

export interface InspectionNote {
  id: string;
  chapterId: string;
  anchor?: string;
}

export interface Snapshot {
  quarter: number;
  context: Context;
  forces: Forces;
  topology: Topology;
  loads: Record<string, ComponentLoad>;
  applied: AppliedEffect[];
  incidents: Incident[];
  inspections: InspectionNote[];
  revisions: Revision[];
  added: string[];
  removed: string[];
}

export interface Timeline {
  seed: number;
  snapshots: Snapshot[];
}

export interface SimulateOptions {
  seed: number;
  untilQuarter?: number;
  variant?: { chapterId: string; variantId: string };
}

interface PendingEffect {
  effect: Effect;
  origin: OptionOrigin;
  dueStep: number;
}

interface MutableState {
  context: Context;
  forces: Forces;
  topology: Topology;
  revisions: Revision[];
  pending: PendingEffect[];
  conditionals: { effect: Effect; origin: OptionOrigin }[];
  firedEvents: Set<string>;
  congested: Set<string>;
  capacityScale: number;
}

const REVISION_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function revisionLetter(index: number): string {
  return REVISION_LETTERS[index] ?? `R${index + 1}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const roundTo = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

function readTarget(state: MutableState, target: EffectTarget): number {
  return 'force' in target ? state.forces[target.force] : state.context[target.context];
}

function writeTarget(state: MutableState, target: EffectTarget, value: number): void {
  if ('force' in target) state.forces[target.force] = clamp(Math.round(value), 0, 100);
  else if (target.context === 'teamSize') state.context.teamSize = Math.max(1, Math.round(value));
  else if (target.context === 'ordersPerDay') state.context.ordersPerDay = Math.max(0, Math.round(value));
  else state.context.runwayMonths = roundTo(value, 1);
}

function applyDelta(state: MutableState, log: AppliedEffect[], entry: AppliedEffect): void {
  const before = readTarget(state, entry.target);
  writeTarget(state, entry.target, before + entry.delta);
  log.push({ ...entry, delta: roundTo(readTarget(state, entry.target) - before, 1) });
}

function deltaFor(effect: Effect, variantId: string | undefined): number {
  return (variantId ? effect.byVariant?.[variantId] : undefined) ?? effect.delta;
}

export function computeLoads(topology: Topology, context: Context, capacityScale = 1): Record<string, ComponentLoad> {
  const loads: Record<string, ComponentLoad> = {};
  for (const c of topology.components) {
    const load = context.ordersPerDay * c.loadShare;
    loads[c.id] = { load: Math.round(load), stress: roundTo(load / (c.capacity * capacityScale), 2) };
  }
  return loads;
}

// snapshots[q] is the start of quarter q; a decision taken at q shows from snapshots[q + 1].
export function simulate(campaign: Campaign, decisions: readonly Decision[], options: SimulateOptions): Timeline {
  const { company } = campaign;
  const until = options.untilQuarter ?? company.totalQuarters;
  const noise = createRng(deriveSeed(options.seed, 'demand'));
  const state: MutableState = {
    context: { ...company.initialContext },
    forces: { ...company.initialForces },
    topology: cloneTopology(company.initialTopology),
    revisions: [],
    pending: [],
    conditionals: [],
    firedEvents: new Set(),
    congested: new Set(),
    capacityScale: 1,
  };
  const snapshots: Snapshot[] = [
    snapshotOf(state, 0, [], [], [], state.topology.components.map((c) => c.id), []),
  ];

  for (let step = 0; step < until; step++) {
    const quarter = step + 1;
    const applied: AppliedEffect[] = [];
    const incidents: Incident[] = [];
    const before = new Set(state.topology.components.map((c) => c.id));

    const chapter = campaign.chapters.find((ch) => ch.quarter === step);
    if (chapter) {
      const variantId = options.variant?.chapterId === chapter.id ? options.variant.variantId : undefined;
      if (variantId) applyVariant(state, chapter, variantId);
      const decision = decisions.find((d) => d.chapterId === chapter.id);
      if (decision) decide(state, chapter, decision, step, quarter, applied, variantId);
    }

    applyDrifts(campaign, state, applied, quarter);
    applyDemandNoise(campaign, state, applied, quarter, noise());
    applyDueEffects(state, applied, step, quarter);
    fireEvents(campaign, state, applied, incidents, quarter);
    detectCongestion(campaign, state, applied, incidents, quarter);
    const inspections = dueInspections(campaign, state, quarter);

    const after = new Set(state.topology.components.map((c) => c.id));
    snapshots.push(
      snapshotOf(
        state,
        quarter,
        applied,
        incidents,
        inspections,
        [...after].filter((id) => !before.has(id)),
        [...before].filter((id) => !after.has(id)),
      ),
    );
  }
  return { seed: options.seed, snapshots };
}

function snapshotOf(
  state: MutableState,
  quarter: number,
  applied: AppliedEffect[],
  incidents: Incident[],
  inspections: InspectionNote[],
  added: string[],
  removed: string[],
): Snapshot {
  return {
    quarter,
    context: { ...state.context },
    forces: { ...state.forces },
    topology: cloneTopology(state.topology),
    loads: computeLoads(state.topology, state.context, state.capacityScale),
    applied,
    incidents,
    inspections,
    revisions: state.revisions.map((r) => ({ ...r })),
    added,
    removed,
  };
}

function applyVariant(state: MutableState, chapter: Chapter, variantId: string): void {
  const variant = chapter.contextVariants.find((v) => v.id === variantId);
  if (!variant) throw new Error(`unknown variant ${variantId} in ${chapter.id}`);
  Object.assign(state.context, variant.context);
  state.capacityScale = variant.capacityScale;
  for (const f of FORCE_IDS) {
    const v = variant.forces[f];
    if (v !== undefined) state.forces[f] = v;
  }
}

function decide(
  state: MutableState,
  chapter: Chapter,
  decision: Decision,
  step: number,
  quarter: number,
  applied: AppliedEffect[],
  variantId: string | undefined,
): void {
  const option = chapter.dilemma.options.find((o) => o.id === decision.optionId);
  if (!option) throw new Error(`unknown option ${decision.optionId} in ${chapter.id}`);
  const revision = revisionLetter(state.revisions.length);
  state.revisions.push({ letter: revision, chapterId: chapter.id, optionId: option.id, quarter: step });
  state.topology = applyTopologyChanges(state.topology, option.topology);
  const origin: OptionOrigin = { kind: 'option', chapterId: chapter.id, optionId: option.id, revision, decidedAt: step };
  for (const effect of option.effects) {
    const weighted = { ...effect, delta: deltaFor(effect, variantId) };
    if (effect.timing.kind === 'immediate') applyOptionEffect(state, applied, weighted, origin, 'immediate', quarter);
    else if (effect.timing.kind === 'delayed') state.pending.push({ effect: weighted, origin, dueStep: step + effect.timing.afterQuarters });
    else state.conditionals.push({ effect: weighted, origin });
  }
}

function applyOptionEffect(
  state: MutableState,
  applied: AppliedEffect[],
  effect: Effect,
  origin: OptionOrigin,
  timing: AppliedTiming,
  quarter: number,
): void {
  applyDelta(state, applied, {
    effectId: effect.id,
    origin,
    timing,
    target: effect.target,
    delta: effect.delta,
    anchor: effect.anchor,
    assumption: effect.assumption,
    sources: effect.sources,
    quarter,
  });
}

function applyDrifts(campaign: Campaign, state: MutableState, applied: AppliedEffect[], quarter: number): void {
  for (const drift of campaign.company.drifts) {
    if (quarter < drift.fromQuarter || quarter > drift.toQuarter) continue;
    const current = readTarget(state, drift.target);
    applyDelta(state, applied, {
      effectId: drift.id,
      origin: { kind: 'drift' },
      timing: 'drift',
      target: drift.target,
      delta: drift.mode === 'multiply' ? current * drift.delta - current : drift.delta,
      anchor: drift.anchor,
      assumption: drift.assumption,
      sources: drift.sources,
      quarter,
    });
  }
}

function applyDemandNoise(campaign: Campaign, state: MutableState, applied: AppliedEffect[], quarter: number, draw: number): void {
  const { amount, assumption, sources } = campaign.company.demandNoise;
  applyDelta(state, applied, {
    effectId: 'demand-noise',
    origin: { kind: 'noise' },
    timing: 'noise',
    target: { context: 'ordersPerDay' },
    delta: state.context.ordersPerDay * (draw - 0.5) * 2 * amount,
    assumption,
    sources,
    quarter,
  });
}

function applyDueEffects(state: MutableState, applied: AppliedEffect[], step: number, quarter: number): void {
  const due = state.pending.filter((p) => p.dueStep === step);
  state.pending = state.pending.filter((p) => p.dueStep !== step);
  for (const p of due) applyOptionEffect(state, applied, p.effect, p.origin, 'delayed', quarter);
}

// An event never fires before its own chapter's decision, or that decision's conditionals could never react to it.
function fireEvents(campaign: Campaign, state: MutableState, applied: AppliedEffect[], incidents: Incident[], quarter: number): void {
  const owned = campaign.chapters.flatMap((ch) => ch.events.map((event) => ({ event, earliest: ch.quarter + 1 })));
  for (const { event, earliest } of owned) {
    if (state.firedEvents.has(event.id) || quarter < earliest) continue;
    const t = event.trigger;
    const fires = t.kind === 'scheduled' ? t.quarter === quarter : thresholdMet(state, t.on, t.op, t.value);
    if (!fires) continue;
    state.firedEvents.add(event.id);
    if (event.regulation) state.context.regulation = event.regulation;
    incidents.push({ id: `event-${event.id}`, kind: 'event', quarter, anchor: event.anchor, eventId: event.id });
    for (const effect of event.effects) {
      applyDelta(state, applied, {
        effectId: effect.id,
        origin: { kind: 'event', eventId: event.id },
        timing: 'event',
        target: effect.target,
        delta: effect.delta,
        anchor: effect.anchor ?? event.anchor,
        assumption: effect.assumption,
        sources: effect.sources,
        quarter,
      });
    }
    for (const c of state.conditionals) {
      if (c.effect.timing.kind === 'conditional' && c.effect.timing.eventId === event.id) {
        applyOptionEffect(state, applied, c.effect, c.origin, 'conditional', quarter);
      }
    }
  }
}

function detectCongestion(campaign: Campaign, state: MutableState, applied: AppliedEffect[], incidents: Incident[], quarter: number): void {
  const loads = computeLoads(state.topology, state.context, state.capacityScale);
  const rule = campaign.company.congestion;
  for (const c of state.topology.components) {
    const stress = loads[c.id]?.stress ?? 0;
    if (stress >= 1 && !state.congested.has(c.id)) {
      state.congested.add(c.id);
      incidents.push({ id: `congestion-${c.id}-${quarter}`, kind: 'congestion', quarter, anchor: c.id });
      applyDelta(state, applied, {
        effectId: `congestion-${c.id}`,
        origin: { kind: 'congestion', componentId: c.id },
        timing: 'congestion',
        target: { force: 'reliability' },
        delta: rule.reliabilityDelta,
        anchor: c.id,
        assumption: rule.assumption,
        sources: rule.sources,
        quarter,
      });
    }
    // Hysteresis, so a component hovering at capacity does not raise an incident every quarter.
    if (stress < 0.8) state.congested.delete(c.id);
  }
}

function dueInspections(campaign: Campaign, state: MutableState, quarter: number): InspectionNote[] {
  const loads = computeLoads(state.topology, state.context, state.capacityScale);
  const notes: InspectionNote[] = [];
  for (const ch of campaign.chapters) {
    for (const ins of ch.inspections) {
      if (ch.quarter + ins.atOffset !== quarter) continue;
      const stress = ins.anchor === undefined ? Infinity : loads[ins.anchor]?.stress;
      if (stress !== undefined && stress >= ins.minStress) notes.push({ id: ins.id, chapterId: ch.id, anchor: ins.anchor });
    }
  }
  return notes;
}

function thresholdMet(state: MutableState, on: EffectTarget, op: 'gte' | 'lte', value: number): boolean {
  const v = readTarget(state, on);
  return op === 'gte' ? v >= value : v <= value;
}
