import { z } from 'zod';

// Dojo scroll protocol v0 (docs/scrolls/PROTOCOL.md in the Dojo repository). The spec is the contract.
export const PROTOCOL_VERSION = 0;

const Envelope = { dojo: z.literal('scroll'), v: z.literal(PROTOCOL_VERSION) };
const Locale = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);
export const STATE_LIMIT_BYTES = 65_536;

export const CAPABILITIES = ['progress', 'run', 'llm'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const UnitProgressSchema = z.object({ completed: z.boolean(), state: z.unknown().optional() });
export type UnitProgress = z.infer<typeof UnitProgressSchema>;

export const InitSchema = z.object({
  ...Envelope,
  type: z.literal('init'),
  nonce: z.string(),
  session: z.string().min(1),
  locale: Locale,
  theme: z.record(z.string(), z.string()),
  progress: z.record(z.string(), UnitProgressSchema),
  capabilities: z.array(z.string()),
  userRef: z.string().nullable(),
  authenticated: z.boolean(),
});
export type InitMessage = z.infer<typeof InitSchema>;

export const SetLocaleSchema = z.object({ ...Envelope, type: z.literal('setLocale'), session: z.string(), locale: Locale });
export const SetThemeSchema = z.object({ ...Envelope, type: z.literal('setTheme'), session: z.string(), theme: z.record(z.string(), z.string()) });

// Not in v0: the host reserves the `llm` capability and message type. This is our proposal for it,
// used only if a future host grants `llm`; until then the course never sends it.
export const LlmResultSchema = z.object({
  ...Envelope,
  type: z.literal('llmResult'),
  session: z.string(),
  id: z.string(),
  task: z.literal('evaluate-adr'),
  output: z.object({
    summary: z.string().max(4000),
    questions: z.array(z.object({ id: z.string(), comment: z.string().max(2000) })).max(10),
  }),
});
export type LlmResult = z.infer<typeof LlmResultSchema>;

export const HostMessageSchema = z.discriminatedUnion('type', [InitSchema, SetLocaleSchema, SetThemeSchema, LlmResultSchema]);
export type HostMessage = z.infer<typeof HostMessageSchema>;

export type ScrollMessage =
  | { dojo: 'scroll'; v: 0; type: 'hello'; scroll: { id: string; version: string }; nonce: string; capabilities: Capability[] }
  | { dojo: 'scroll'; v: 0; type: 'progress'; session: string; unitId: string; completed?: boolean; state?: unknown }
  | { dojo: 'scroll'; v: 0; type: 'complete'; session: string; unitId?: string }
  | { dojo: 'scroll'; v: 0; type: 'resize'; session: string; height: number }
  | { dojo: 'scroll'; v: 0; type: 'error'; session?: string; code: string; message: string }
  | { dojo: 'scroll'; v: 0; type: 'llm'; session: string; id: string; task: 'evaluate-adr'; input: unknown };

export function stateFits(state: unknown): boolean {
  return new TextEncoder().encode(JSON.stringify(state ?? null)).length <= STATE_LIMIT_BYTES;
}

export function createNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
