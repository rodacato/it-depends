// The only hues on the sheet. Healthy flow is white; stress shifts toward red.
export const INK = {
  blue: 0x1e3f66,
  line: 0xf5f7f2,
  vellum: 0xedebe3,
  red: 0xd2412f,
  graphite: 0x5a5a5a,
} as const;

export const CSS = {
  blue: '#1E3F66',
  line: '#F5F7F2',
  vellum: '#EDEBE3',
  red: '#D2412F',
  graphite: '#5A5A5A',
} as const;

function channel(c: number, shift: number): number {
  return (c >> shift) & 0xff;
}

export function mix(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(channel(a, 16) + (channel(b, 16) - channel(a, 16)) * k);
  const g = Math.round(channel(a, 8) + (channel(b, 8) - channel(a, 8)) * k);
  const bl = Math.round(channel(a, 0) + (channel(b, 0) - channel(a, 0)) * k);
  return (r << 16) | (g << 8) | bl;
}

// Stress below 0.6 reads white; at capacity it is fully red pencil.
export function stressColor(stress: number): number {
  return mix(INK.line, INK.red, (stress - 0.6) / 0.4);
}
