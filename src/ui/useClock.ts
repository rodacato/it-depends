import { useEffect, useRef, useState } from 'react';

// Milliseconds since `runKey` changed, advanced every animation frame while running.
export function useClock(running: boolean, runKey: string | number, until: number): number {
  const [clock, setClock] = useState({ key: runKey, ms: 0 });
  const startRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      setClock({ key: runKey, ms: Math.min(elapsed, until) });
      if (elapsed < until) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, runKey, until]);
  // A new runKey reads as 0 until its first frame, instead of resetting state inside the effect.
  return clock.key === runKey ? clock.ms : 0;
}

export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}
