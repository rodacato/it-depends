import { z } from 'zod';
import type { Campaign, Chapter, Effect, Topology } from '../engine/schema';
import { ChapterSchema, CompanySchema, SourceSchema } from '../engine/schema';
import { applyTopologyChanges, CLIENTS_NODE, validateTopology } from '../engine/topology';
import type { LocaleBundle } from '../i18n/messages';

export interface RawContent {
  company: unknown;
  sources: unknown;
  chapters: unknown[];
}

export class ContentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Content is invalid:\n- ${problems.join('\n- ')}`);
  }
}

export function parseCampaign(raw: RawContent): Campaign {
  const problems: string[] = [];
  const company = CompanySchema.safeParse(raw.company);
  const sources = z.array(SourceSchema).safeParse(raw.sources);
  const chapters = raw.chapters.map((c, i) => ({ i, r: ChapterSchema.safeParse(c) }));
  if (!company.success) problems.push(...issues('company', company.error));
  if (!sources.success) problems.push(...issues('sources', sources.error));
  for (const { i, r } of chapters) if (!r.success) problems.push(...issues(`chapter[${i}]`, r.error));
  if (problems.length || !company.success || !sources.success) throw new ContentError(problems);
  const parsed = chapters.map(({ r }) => r.data as Chapter).sort((a, b) => a.number - b.number);
  return { company: company.data, sources: sources.data, chapters: parsed };
}

function issues(where: string, error: z.ZodError): string[] {
  return error.issues.map((i) => `${where}.${i.path.join('.')}: ${i.message}`);
}

// Cross-references the schema cannot express. Returns problems instead of throwing so a build can list them all.
export function checkCampaign(campaign: Campaign, locales: LocaleBundle[]): string[] {
  const problems: string[] = [];
  const sourceIds = new Set(campaign.sources.map((s) => s.id));
  const eventIds = new Set(campaign.chapters.flatMap((c) => c.events.map((e) => e.id)));
  const requireText = (key: string, where: string) => {
    for (const l of locales) if (!l.messages[key]?.trim()) problems.push(`${where}: text "${key}" missing in ${l.locale}`);
  };
  const requireSources = (ids: string[], where: string) => {
    for (const id of ids) if (!sourceIds.has(id)) problems.push(`${where}: unknown source "${id}"`);
  };
  const checkEffect = (e: Pick<Effect, 'id' | 'assumption' | 'sources'>, where: string) => {
    requireText(e.assumption, `${where} effect ${e.id} assumption`);
    requireSources(e.sources, `${where} effect ${e.id}`);
  };

  duplicates(campaign.sources.map((s) => s.id)).forEach((d) => problems.push(`duplicate source id ${d}`));
  duplicates(campaign.chapters.map((c) => c.id)).forEach((d) => problems.push(`duplicate chapter id ${d}`));
  duplicates([...campaign.chapters.flatMap((c) => c.events.map((e) => e.id))]).forEach((d) => problems.push(`duplicate event id ${d}`));
  for (const s of campaign.sources) {
    requireText(s.note, `source ${s.id}`);
    if (s.titleKey) requireText(s.titleKey, `source ${s.id} title`);
  }

  const { company } = campaign;
  problems.push(...validateTopology(company.initialTopology).map((p) => `initial topology: ${p}`));
  for (const d of company.drifts) checkEffect(d, `drift ${d.id}`);
  checkEffect({ id: 'demand-noise', ...company.demandNoise }, 'company');
  checkEffect({ id: 'congestion', ...company.congestion }, 'company');

  const componentIds = new Set([
    ...company.initialTopology.components.map((c) => c.id),
    ...campaign.chapters.flatMap((ch) => ch.dilemma.options.flatMap((o) => o.topology.flatMap((t) => (t.op === 'addComponent' ? [t.component.id] : [])))),
  ]);

  // Every chapter must work whatever was chosen before it, so walk every reachable site.
  let reachable: Topology[] = [company.initialTopology];
  let previousEnd = 0;
  for (const ch of campaign.chapters) {
    const where = `chapter ${ch.id}`;
    if (ch.quarter < previousEnd) problems.push(`${where}: starts at quarter ${ch.quarter} before the previous time-lapse ends (${previousEnd})`);
    if (ch.quarter + ch.timelapseQuarters > company.totalQuarters) problems.push(`${where}: time-lapse runs past the campaign`);
    previousEnd = ch.quarter + ch.timelapseQuarters;
    const base = `chapters.${ch.id}`;
    for (const k of ['title', 'short', 'concept', 'voice', 'briefing', 'dilemma', 'disagreement', 'readNext']) requireText(`${base}.${k}`, where);
    requireSources(ch.readNext, `${where} readNext`);
    const variantIds = new Set(ch.contextVariants.map((v) => v.id));
    for (const v of ch.contextVariants) requireText(`${base}.variants.${v.id}`, where);
    duplicates(ch.dilemma.options.map((o) => o.id)).forEach((d) => problems.push(`${where}: duplicate option ${d}`));

    const next = new Map<string, Topology>();
    for (const option of ch.dilemma.options) {
      const ow = `${where} option ${option.id}`;
      for (const k of ['title', 'optimizes', 'costs']) requireText(`${base}.options.${option.id}.${k}`, ow);
      duplicates(option.effects.map((e) => e.id)).forEach((d) => problems.push(`${ow}: duplicate effect ${d}`));
      for (const e of option.effects) {
        checkEffect(e, ow);
        if (e.timing.kind === 'conditional' && !eventIds.has(e.timing.eventId)) problems.push(`${ow} effect ${e.id}: unknown event ${e.timing.eventId}`);
        for (const v of Object.keys(e.byVariant ?? {})) if (!variantIds.has(v)) problems.push(`${ow} effect ${e.id}: unknown variant ${v}`);
        const { has, lacks } = e.onlyIf ?? {};
        const builtSomewhere = (id: string) => reachable.some((t) => t.components.some((c) => c.id === id));
        const builtEverywhere = (id: string) => reachable.every((t) => t.components.some((c) => c.id === id));
        if (has && !builtSomewhere(has)) problems.push(`${ow} effect ${e.id}: onlyIf.has ${has} is never on the site, so it never applies`);
        if (lacks && !componentIds.has(lacks)) problems.push(`${ow} effect ${e.id}: onlyIf.lacks ${lacks} is not a component in this campaign, so it always applies`);
        if (lacks && builtEverywhere(lacks)) problems.push(`${ow} effect ${e.id}: onlyIf.lacks ${lacks} is always on the site, so it never applies`);
      }
      for (const topology of reachable) {
        let after: Topology;
        try {
          after = applyTopologyChanges(topology, option.topology);
        } catch (err) {
          problems.push(`${ow}: ${(err as Error).message}`);
          continue;
        }
        problems.push(...validateTopology(after).map((p) => `${ow}: ${p}`));
        const ids = new Set([...after.components.map((c) => c.id), CLIENTS_NODE]);
        for (const e of option.effects) {
          if (e.anchor && !ids.has(e.anchor)) problems.push(`${ow} effect ${e.id}: anchor ${e.anchor} is not on the site`);
        }
        next.set(JSON.stringify(after), after);
      }
    }
    reachable = [...next.values()];
    for (const ev of ch.events) {
      requireText(`${base}.events.${ev.id}`, where);
      if (ev.trigger.kind === 'scheduled' && ev.trigger.quarter <= ch.quarter) {
        problems.push(`${where} event ${ev.id}: scheduled at quarter ${ev.trigger.quarter}, but it cannot fire before the chapter's decision (quarter ${ch.quarter + 1})`);
      }
      for (const e of ev.effects) checkEffect(e, `${where} event ${ev.id}`);
    }
    for (const ins of ch.inspections) requireText(`${base}.inspections.${ins.id}`, where);
    const criteria = new Set(ch.rubric.map((c) => c.id));
    for (const c of ch.rubric) {
      requireText(`${base}.rubric.${c.id}`, where);
      if (c.check.kind === 'mentionsAny') requireText(c.check.termsKey, `${where} rubric ${c.id}`);
    }
    for (const q of ch.review.questions) {
      requireText(`${base}.review.${q.id}`, where);
      for (const c of q.criteria) if (!criteria.has(c)) problems.push(`${where}: question ${q.id} uses unknown criterion ${c}`);
    }
  }
  return [...new Set(problems)];
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}
