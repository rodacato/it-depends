// Average advance per character, measured in Chrome on the loaded fonts and rounded up.
export const NAME_TYPE = { size: 15, advance: 6.4, line: 16 } as const;
export const ROLE_TYPE = { size: 9.5, advance: 5.7, line: 11.5 } as const;

export interface LabelSlot {
  x: number;
  // Baseline of the first line.
  y: number;
  w: number;
  lines: number;
}

export interface WrappedLabel {
  name: string[];
  role: string[];
  // Baseline of each role line, relative to the slot's first baseline.
  roleOffsets: number[];
}

export const textWidth = (s: string, advance: number) => s.length * advance;

// Height from the slot's top edge to below its last line; the worst case is a two-line name.
export function labelHeight(lines: number): number {
  const nameLines = Math.min(2, lines - 1);
  return 12 + (nameLines - 1) * NAME_TYPE.line + 13 + (lines - 1 - nameLines) * ROLE_TYPE.line + 3;
}

function splitWord(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) return [word];
  const cut = word.lastIndexOf('-', maxChars - 1);
  const at = cut > 0 ? cut + 1 : maxChars;
  return [word.slice(0, at), ...splitWord(word.slice(at), maxChars)];
}

export function wrap(text: string, width: number, advance: number, maxLines: number): string[] {
  const maxChars = Math.max(4, Math.floor(width / advance));
  const words = text.split(/\s+/).filter(Boolean).flatMap((w) => splitWord(w, maxChars));
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= maxChars && !last.endsWith('-')) lines[lines.length - 1] = `${last} ${word}`;
    else if (last !== undefined && last.endsWith('-') && `${last}${word}`.length <= maxChars) lines[lines.length - 1] = `${last}${word}`;
    else lines.push(word);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const tail = kept[maxLines - 1]!;
  kept[maxLines - 1] = tail.length + 1 <= maxChars ? `${tail}…` : `${tail.slice(0, maxChars - 1)}…`;
  return kept;
}

// The name takes at most two lines; the role gets whatever the slot has left.
export function wrapLabel(name: string, role: string, slot: LabelSlot): WrappedLabel {
  const nameLines = wrap(name, slot.w, NAME_TYPE.advance, Math.min(2, slot.lines - 1));
  const roleLines = wrap(role, slot.w, ROLE_TYPE.advance, slot.lines - nameLines.length);
  const first = (nameLines.length - 1) * NAME_TYPE.line + 13;
  return { name: nameLines, role: roleLines, roleOffsets: roleLines.map((_, i) => first + i * ROLE_TYPE.line) };
}
