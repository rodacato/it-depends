import type { AdrEvaluation, HostBridge, HostSession } from './HostBridge';

// Outside Dojo the course keeps its own progress (see ui/progress.ts) and sends nothing anywhere.
export class StandaloneBridge implements HostBridge {
  readonly mode = 'standalone' as const;

  async start(): Promise<HostSession> {
    return { mode: 'standalone', locale: null, theme: {}, progress: {}, canEvaluateAdr: false };
  }

  unitStarted(): void {}
  unitCompleted(): void {}
  courseCompleted(): void {}
  reportError(): void {}

  onLocaleChange(): () => void {
    return () => {};
  }

  onThemeChange(): () => void {
    return () => {};
  }

  async evaluateAdr(): Promise<AdrEvaluation | null> {
    return null;
  }
}
