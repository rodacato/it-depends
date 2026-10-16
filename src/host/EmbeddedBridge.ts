import type { AdrEvaluation, AdrEvaluationRequest, HostBridge, HostSession } from './HostBridge';
import type { Capability, InitMessage, ScrollMessage } from './protocol';
import { createNonce, HostMessageSchema, stateFits } from './protocol';

export interface EmbeddedOptions {
  hostOrigin: string;
  scroll: { id: string; version: string };
  capabilities: Capability[];
  target: Pick<Window, 'postMessage'>;
  // The window messages must come from: our parent frame.
  expectedSource: unknown;
  listen: (handler: (event: MessageEvent) => void) => () => void;
  initTimeoutMs?: number;
  llmTimeoutMs?: number;
}

export class HandshakeTimeout extends Error {}

export class EmbeddedBridge implements HostBridge {
  readonly mode = 'embedded' as const;
  private session: string | null = null;
  private granted = new Set<string>();
  private nonce = createNonce();
  private localeListeners = new Set<(l: string) => void>();
  private themeListeners = new Set<(t: Record<string, string>) => void>();
  private pendingLlm = new Map<string, (r: AdrEvaluation | null) => void>();
  private unlisten: () => void = () => {};
  private requestCounter = 0;

  constructor(private options: EmbeddedOptions) {}

  start(): Promise<HostSession> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.unlisten();
        reject(new HandshakeTimeout('no init from host'));
      }, this.options.initTimeoutMs ?? 3000);
      this.unlisten = this.options.listen((event) => {
        const message = this.accept(event);
        if (!message) return;
        if (message.type === 'init') {
          if (this.session || message.nonce !== this.nonce) return;
          clearTimeout(timer);
          resolve(this.onInit(message));
        } else if (message.session !== this.session) {
          return;
        } else if (message.type === 'setLocale') {
          this.localeListeners.forEach((l) => l(message.locale));
        } else if (message.type === 'setTheme') {
          this.themeListeners.forEach((l) => l(message.theme));
        } else if (message.type === 'llmResult') {
          this.pendingLlm.get(message.id)?.(message.output);
          this.pendingLlm.delete(message.id);
        }
      });
      this.post({ dojo: 'scroll', v: 0, type: 'hello', scroll: this.options.scroll, nonce: this.nonce, capabilities: this.options.capabilities });
    });
  }

  // Strict checks from the spec: exact host origin, our parent as source, and a valid message.
  private accept(event: MessageEvent) {
    if (event.origin !== this.options.hostOrigin) return null;
    if (event.source !== this.options.expectedSource) return null;
    const parsed = HostMessageSchema.safeParse(event.data);
    return parsed.success ? parsed.data : null;
  }

  private onInit(message: InitMessage): HostSession {
    this.session = message.session;
    this.granted = new Set(message.capabilities);
    return {
      mode: 'embedded',
      locale: message.locale,
      theme: message.theme,
      progress: message.progress,
      canEvaluateAdr: this.granted.has('llm'),
    };
  }

  private post(message: ScrollMessage): void {
    this.options.target.postMessage(message, this.options.hostOrigin);
  }

  unitStarted(unitId: string): void {
    if (!this.session || !this.granted.has('progress')) return;
    this.post({ dojo: 'scroll', v: 0, type: 'progress', session: this.session, unitId, completed: false });
  }

  unitCompleted(unitId: string, state: unknown): void {
    if (!this.session || !this.granted.has('progress')) return;
    const fits = stateFits(state);
    this.post({ dojo: 'scroll', v: 0, type: 'progress', session: this.session, unitId, completed: true, ...(fits ? { state } : {}) });
    this.post({ dojo: 'scroll', v: 0, type: 'complete', session: this.session, unitId });
    if (!fits) this.reportError('invalid-state', `state for ${unitId} exceeds 64 KiB and was not sent`);
  }

  courseCompleted(): void {
    if (!this.session || !this.granted.has('progress')) return;
    this.post({ dojo: 'scroll', v: 0, type: 'complete', session: this.session });
  }

  reportError(code: string, message: string): void {
    this.post({ dojo: 'scroll', v: 0, type: 'error', ...(this.session ? { session: this.session } : {}), code, message: message.slice(0, 1000) });
  }

  onLocaleChange(listener: (locale: string) => void): () => void {
    this.localeListeners.add(listener);
    return () => this.localeListeners.delete(listener);
  }

  onThemeChange(listener: (theme: Record<string, string>) => void): () => void {
    this.themeListeners.add(listener);
    return () => this.themeListeners.delete(listener);
  }

  evaluateAdr(request: AdrEvaluationRequest): Promise<AdrEvaluation | null> {
    if (!this.session || !this.granted.has('llm')) return Promise.resolve(null);
    const id = `adr-${++this.requestCounter}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingLlm.delete(id);
        resolve(null);
      }, this.options.llmTimeoutMs ?? 60_000);
      this.pendingLlm.set(id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      this.post({ dojo: 'scroll', v: 0, type: 'llm', session: this.session!, id, task: 'evaluate-adr', input: request });
    });
  }
}
