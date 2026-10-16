import type { UnitProgress } from './protocol';

export type HostMode = 'standalone' | 'embedded';

export interface HostSession {
  mode: HostMode;
  locale: string | null;
  theme: Record<string, string>;
  progress: Record<string, UnitProgress>;
  canEvaluateAdr: boolean;
}

export interface AdrEvaluationRequest {
  chapterId: string;
  locale: string;
  adr: Record<string, string>;
  questions: { id: string; text: string }[];
}

export interface AdrEvaluation {
  summary: string;
  questions: { id: string; comment: string }[];
}

// The course talks to its host only through this port. Standalone is the default adapter.
export interface HostBridge {
  readonly mode: HostMode;
  start(): Promise<HostSession>;
  unitStarted(unitId: string): void;
  unitCompleted(unitId: string, state: unknown): void;
  courseCompleted(): void;
  reportError(code: string, message: string): void;
  onLocaleChange(listener: (locale: string) => void): () => void;
  onThemeChange(listener: (theme: Record<string, string>) => void): () => void;
  evaluateAdr(request: AdrEvaluationRequest): Promise<AdrEvaluation | null>;
}
