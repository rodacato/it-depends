import { describe, expect, it, vi } from 'vitest';
import { EmbeddedBridge, HandshakeTimeout } from './EmbeddedBridge';

const HOST = 'https://dojo.example';
const parent = { name: 'parent' };

function harness(overrides: { initTimeoutMs?: number } = {}) {
  const sent: { message: Record<string, unknown>; origin: string }[] = [];
  let handler: (e: MessageEvent) => void = () => {};
  const bridge = new EmbeddedBridge({
    hostOrigin: HOST,
    scroll: { id: 'it-depends', version: '0.1.0' },
    capabilities: ['progress', 'llm'],
    target: { postMessage: (message: unknown, origin: string) => sent.push({ message: message as Record<string, unknown>, origin }) } as never,
    expectedSource: parent,
    listen: (h) => {
      handler = h;
      return () => {};
    },
    initTimeoutMs: overrides.initTimeoutMs ?? 50,
  });
  const deliver = (data: unknown, origin = HOST, source: unknown = parent) => handler({ data, origin, source } as MessageEvent);
  const init = (nonce: string, extra: Record<string, unknown> = {}) => ({
    dojo: 'scroll',
    v: 0,
    type: 'init',
    nonce,
    session: 's-1',
    locale: 'es-MX',
    theme: {},
    progress: {},
    capabilities: ['progress'],
    userRef: 'u',
    authenticated: true,
    ...extra,
  });
  return { bridge, sent, deliver, init };
}

describe('EmbeddedBridge (Dojo scroll protocol v0)', () => {
  it('says hello with a nonce, only to the host origin, and accepts the matching init', async () => {
    const { bridge, sent, deliver, init } = harness();
    const started = bridge.start();
    const hello = sent[0]!;
    expect(hello.origin).toBe(HOST);
    expect(hello.message).toMatchObject({ dojo: 'scroll', v: 0, type: 'hello', scroll: { id: 'it-depends' } });
    deliver(init(hello.message.nonce as string));
    await expect(started).resolves.toMatchObject({ mode: 'embedded', locale: 'es-MX', canEvaluateAdr: false });
  });

  it('ignores messages from another origin, another window, or with the wrong nonce', async () => {
    const { bridge, sent, deliver, init } = harness();
    const started = bridge.start();
    const nonce = sent[0]!.message.nonce as string;
    deliver(init(nonce), 'https://evil.example');
    deliver(init(nonce), HOST, { name: 'other' });
    deliver(init('wrong'));
    await expect(started).rejects.toBeInstanceOf(HandshakeTimeout);
  });

  it('reports unit progress and completion with the session', async () => {
    const { bridge, sent, deliver, init } = harness();
    const started = bridge.start();
    deliver(init(sent[0]!.message.nonce as string));
    await started;
    bridge.unitStarted('reversibility');
    bridge.unitCompleted('reversibility', { optionId: 'payments-port' });
    expect(sent.slice(1).map((s) => s.message.type)).toEqual(['progress', 'progress', 'complete']);
    expect(sent.slice(1).every((s) => s.message.session === 's-1')).toBe(true);
  });

  it('never asks for an ADR evaluation unless the host granted llm', async () => {
    const { bridge, sent, deliver, init } = harness();
    const started = bridge.start();
    deliver(init(sent[0]!.message.nonce as string));
    await started;
    await expect(bridge.evaluateAdr({ chapterId: 'x', locale: 'en', adr: {}, questions: [] })).resolves.toBeNull();
    expect(sent.some((s) => s.message.type === 'llm')).toBe(false);
  });

  it('forwards locale changes for its own session only', async () => {
    const { bridge, sent, deliver, init } = harness();
    const started = bridge.start();
    deliver(init(sent[0]!.message.nonce as string));
    await started;
    const listener = vi.fn();
    bridge.onLocaleChange(listener);
    deliver({ dojo: 'scroll', v: 0, type: 'setLocale', session: 'other', locale: 'en' });
    deliver({ dojo: 'scroll', v: 0, type: 'setLocale', session: 's-1', locale: 'en' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('en');
  });
});
