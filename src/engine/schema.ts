import { z } from 'zod';

// Stable English ids: lowercase, digits, hyphens. Text never lives in content, only keys to locale files.
const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase kebab-case');
const TextKey = z.string().regex(/^[a-z0-9][a-zA-Z0-9.-]*$/, 'text keys are dotted paths into the locale files');

export const FORCE_IDS = ['velocity', 'complexity', 'cost', 'reliability', 'cognitiveLoad'] as const;
export const ForceIdSchema = z.enum(FORCE_IDS);
export type ForceId = z.infer<typeof ForceIdSchema>;

// Relative values 0-100. Never absolute measurements.
const Relative = z.number().min(0).max(100);
export const ForcesSchema = z.object({
  velocity: Relative,
  complexity: Relative,
  cost: Relative,
  reliability: Relative,
  cognitiveLoad: Relative,
});
export type Forces = z.infer<typeof ForcesSchema>;

export const REGULATION_LEVELS = ['none', 'light', 'audited', 'licensed'] as const;
export const ContextSchema = z.object({
  teamSize: z.number().int().min(1),
  ordersPerDay: z.number().min(0),
  runwayMonths: z.number(),
  regulation: z.enum(REGULATION_LEVELS),
});
export type Context = z.infer<typeof ContextSchema>;
export const NUMERIC_CONTEXT_KEYS = ['teamSize', 'ordersPerDay', 'runwayMonths'] as const;
export type NumericContextKey = (typeof NUMERIC_CONTEXT_KEYS)[number];

export const COMPONENT_KINDS = ['service', 'module', 'database', 'queue', 'vendor'] as const;
export const ComponentKindSchema = z.enum(COMPONENT_KINDS);
export type ComponentKind = z.infer<typeof ComponentKindSchema>;

export const ComponentSchema = z.object({
  id: Id,
  kind: ComponentKindSchema,
  // The district (module boundary) the component lives in. Vendors live off-site and have none.
  district: Id.optional(),
  // Fraction of the company's orders that pass through this component.
  loadShare: z.number().min(0).max(1),
  // Orders per day it handles before it congests. Relative to the model, not a benchmark.
  capacity: z.number().positive(),
});
export type Component = z.infer<typeof ComponentSchema>;

export const DistrictSchema = z.object({ id: Id });
export type District = z.infer<typeof DistrictSchema>;

export const CONNECTION_KINDS = ['road', 'rail', 'pipe'] as const;
export const ConnectionSchema = z.object({
  id: Id,
  // road = synchronous API call, rail = queue, pipe = database access
  kind: z.enum(CONNECTION_KINDS),
  from: Id,
  to: Id,
});
export type Connection = z.infer<typeof ConnectionSchema>;

export const TopologySchema = z.object({
  districts: z.array(DistrictSchema),
  components: z.array(ComponentSchema),
  connections: z.array(ConnectionSchema),
});
export type Topology = z.infer<typeof TopologySchema>;

export const TopologyChangeSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('addDistrict'), district: DistrictSchema }),
  z.object({ op: z.literal('removeDistrict'), id: Id }),
  z.object({ op: z.literal('addComponent'), component: ComponentSchema }),
  z.object({
    op: z.literal('updateComponent'),
    id: Id,
    set: ComponentSchema.pick({ loadShare: true, capacity: true, district: true }).partial(),
  }),
  z.object({ op: z.literal('removeComponent'), id: Id }),
  z.object({ op: z.literal('addConnection'), connection: ConnectionSchema }),
  z.object({ op: z.literal('removeConnection'), id: Id }),
]);
export type TopologyChange = z.infer<typeof TopologyChangeSchema>;

export const EffectTargetSchema = z.union([
  z.object({ force: ForceIdSchema }),
  z.object({ context: z.enum(NUMERIC_CONTEXT_KEYS) }),
]);
export type EffectTarget = z.infer<typeof EffectTargetSchema>;

export const EffectTimingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('immediate') }),
  z.object({ kind: z.literal('delayed'), afterQuarters: z.number().int().min(1) }),
  // Fires only if the event occurs while the decision is in place.
  z.object({ kind: z.literal('conditional'), eventId: Id }),
]);
export type EffectTiming = z.infer<typeof EffectTimingSchema>;

// Every effect carries a written assumption and at least one source. Effects are data, not code.
export const EffectSchema = z.object({
  id: Id,
  target: EffectTargetSchema,
  delta: z.number(),
  // The same effect weighs differently in another context (see Chapter.contextVariants).
  byVariant: z.record(Id, z.number()).optional(),
  timing: EffectTimingSchema,
  anchor: Id.optional(),
  assumption: TextKey,
  sources: z.array(Id).min(1, 'an effect needs at least one source'),
  // Applies only if the site as built before this decision has, or lacks, a component.
  onlyIf: z.object({ has: Id.optional(), lacks: Id.optional() }).optional(),
});
export type Effect = z.infer<typeof EffectSchema>;

export const OptionSchema = z.object({
  id: Id,
  topology: z.array(TopologyChangeSchema),
  effects: z.array(EffectSchema).min(1),
});
export type Option = z.infer<typeof OptionSchema>;

export const ThresholdSchema = z.object({
  kind: z.literal('threshold'),
  on: EffectTargetSchema,
  op: z.enum(['gte', 'lte']),
  value: z.number(),
});

export const EventSchema = z.object({
  id: Id,
  trigger: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('scheduled'), quarter: z.number().int().min(0) }),
    ThresholdSchema,
  ]),
  effects: z.array(EffectSchema.omit({ onlyIf: true }).extend({ timing: z.object({ kind: z.literal('immediate') }) })),
  regulation: z.enum(REGULATION_LEVELS).optional(),
  anchor: Id.optional(),
});
export type CampaignEvent = z.infer<typeof EventSchema>;

export const InspectionSchema = z.object({
  id: Id,
  // Quarters after the chapter starts.
  atOffset: z.number().int().min(0),
  anchor: Id.optional(),
  // Shown only if the component exists and its stress is at least this.
  minStress: z.number().min(0).default(0),
});
export type Inspection = z.infer<typeof InspectionSchema>;

export const ADR_FIELDS = ['context', 'decision', 'consequences', 'givenUp', 'revisit'] as const;
export const AdrFieldSchema = z.enum(ADR_FIELDS);
export type AdrField = z.infer<typeof AdrFieldSchema>;

export const CriterionSchema = z.object({
  id: Id,
  field: AdrFieldSchema,
  check: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('minWords'), n: z.number().int().min(1) }),
    // termsKey points to a locale entry holding a comma-separated list of terms.
    z.object({ kind: z.literal('mentionsAny'), termsKey: TextKey }),
    z.object({ kind: z.literal('hasCondition') }),
  ]),
});
export type Criterion = z.infer<typeof CriterionSchema>;

export const ChapterSchema = z.object({
  id: Id,
  number: z.number().int().min(1),
  // Absolute quarter index; 0 is Q1 of Year 1.
  quarter: z.number().int().min(0),
  timelapseQuarters: z.number().int().min(1).max(4),
  dilemma: z.object({ id: Id, options: z.array(OptionSchema).min(2).max(4) }),
  events: z.array(EventSchema).default([]),
  inspections: z.array(InspectionSchema).default([]),
  review: z.object({
    questions: z.array(z.object({ id: Id, criteria: z.array(Id).min(1) })).length(3),
  }),
  rubric: z.array(CriterionSchema).min(3),
  readNext: z.array(Id).min(1),
  // Optional alternative context to replay the same dilemma in (e.g. an 80-engineer regulated fintech).
  contextVariants: z
    .array(
      z.object({
        id: Id,
        context: ContextSchema.partial(),
        forces: ForcesSchema.partial().default({}),
        // A bigger company runs bigger machines; without this every component reads as congested.
        capacityScale: z.number().positive().default(1),
      }),
    )
    .default([]),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const DriftSchema = EffectSchema.omit({ timing: true, byVariant: true, onlyIf: true }).extend({
  fromQuarter: z.number().int().min(0),
  toQuarter: z.number().int().min(0),
  // add: delta per quarter; multiply: the value is multiplied by delta each quarter (growth curves).
  mode: z.enum(['add', 'multiply']).default('add'),
});
export type Drift = z.infer<typeof DriftSchema>;

export const CompanySchema = z.object({
  id: Id,
  initialContext: ContextSchema,
  initialForces: ForcesSchema,
  initialTopology: TopologySchema,
  // Background growth applied every quarter in range, each with its own assumption and source.
  drifts: z.array(DriftSchema),
  // Seeded quarter-to-quarter demand variation, so a seed changes the run in a written, sourced way.
  demandNoise: z.object({ amount: z.number().min(0).max(0.3), assumption: TextKey, sources: z.array(Id).min(1) }),
  // What congestion costs when a component runs past its capacity.
  congestion: z.object({ reliabilityDelta: z.number(), assumption: TextKey, sources: z.array(Id).min(1) }),
  totalQuarters: z.number().int().min(1),
});
export type Company = z.infer<typeof CompanySchema>;

export const SourceSchema = z.object({
  id: Id,
  authors: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int(),
  url: z.string().url().optional(),
  // Localized one-line note on what the source contributes; a text key.
  note: TextKey,
});
export type Source = z.infer<typeof SourceSchema>;

export const DecisionSchema = z.object({
  chapterId: Id,
  optionId: Id,
  variantId: Id.optional(),
});
export type Decision = z.infer<typeof DecisionSchema>;

export interface Campaign {
  company: Company;
  chapters: Chapter[];
  sources: Source[];
}
