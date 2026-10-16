import { EmbeddedBridge } from './EmbeddedBridge';
import type { HostBridge, HostSession } from './HostBridge';
import { COURSE_ID, COURSE_VERSION, OPTIONAL_CAPABILITIES, REQUIRED_CAPABILITIES } from './manifest';
import { StandaloneBridge } from './StandaloneBridge';

export type { HostBridge, HostSession } from './HostBridge';

type Connection = { bridge: HostBridge; session: HostSession };

let connection: Promise<Connection> | null = null;

// One handshake per page load, even when React mounts effects twice.
export function connectHost(win: Window = window): Promise<Connection> {
  connection ??= connect(win);
  return connection;
}

// Embedded only when framed AND given a host origin; otherwise, or if the handshake times out, standalone.
async function connect(win: Window): Promise<Connection> {
  const hostOrigin = new URLSearchParams(win.location.search).get('host');
  const framed = win.parent !== win;
  if (framed && hostOrigin && isOrigin(hostOrigin)) {
    const bridge = new EmbeddedBridge({
      hostOrigin,
      scroll: { id: COURSE_ID, version: COURSE_VERSION },
      capabilities: [...REQUIRED_CAPABILITIES, ...OPTIONAL_CAPABILITIES],
      target: win.parent,
      expectedSource: win.parent,
      listen: (handler) => {
        win.addEventListener('message', handler);
        return () => win.removeEventListener('message', handler);
      },
    });
    try {
      return { bridge, session: await bridge.start() };
    } catch {
      // Fall through to standalone, as the protocol requires.
    }
  }
  const bridge = new StandaloneBridge();
  return { bridge, session: await bridge.start() };
}

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === value;
  } catch {
    return false;
  }
}
