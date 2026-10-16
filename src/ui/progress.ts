import { z } from 'zod';
import { ADR_FIELDS, DecisionSchema } from '../engine/schema';

export const PHASES = ['briefing', 'timelapse', 'consequences', 'adr', 'review'] as const;
export type ChapterPhase = (typeof PHASES)[number];

const AdrSchema = z.object(Object.fromEntries(ADR_FIELDS.map((f) => [f, z.string().max(4000)])) as Record<(typeof ADR_FIELDS)[number], z.ZodString>);

export const ProgressSchema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  locale: z.string().nullable(),
  started: z.boolean(),
  decisions: z.array(DecisionSchema),
  rationales: z.record(z.string().max(600)),
  adrs: z.record(AdrSchema),
  completed: z.array(z.string()),
  current: z.object({ chapterId: z.string(), phase: z.enum(PHASES) }).nullable(),
});
export type Progress = z.infer<typeof ProgressSchema>;

const STORAGE_KEY = 'it-depends:v1';

export function freshProgress(locale: string | null = null): Progress {
  return { version: 1, seed: 20260101, locale, started: false, decisions: [], rationales: {}, adrs: {}, completed: [], current: null };
}

export type LoadResult = { progress: Progress; damaged: boolean };

export function loadProgress(storage: Pick<Storage, 'getItem'> | null): LoadResult {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { progress: freshProgress(), damaged: false };
    const parsed = ProgressSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { progress: parsed.data, damaged: false } : { progress: freshProgress(), damaged: true };
  } catch {
    return { progress: freshProgress(), damaged: true };
  }
}

export function saveProgress(storage: Pick<Storage, 'setItem'> | null, progress: Progress): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private mode or full storage: progress lives for this visit only.
  }
}

export function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
