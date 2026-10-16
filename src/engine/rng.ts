// mulberry32: tiny, fast and identical on every platform, which is all determinism needs here.
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Derive an independent stream per purpose so adding a new random draw elsewhere never shifts this one.
export function deriveSeed(seed: number, label: string, index = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const ch of `${label}:${index}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x85ebca6b) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}
