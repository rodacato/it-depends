import type { AdrField, Criterion } from './schema';

export type Adr = Record<AdrField, string>;

export interface CriterionResult {
  criterionId: string;
  met: boolean;
}

// Words that mark a revisit trigger as a condition rather than a wish, in every supported locale.
const CONDITION_PATTERN = /\d|\b(if|when|once|after|before|unless|until|si|cuando|antes|después|despues|hasta|apenas)\b/i;

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function evaluateCriterion(adr: Adr, criterion: Criterion, terms: (key: string) => string[]): CriterionResult {
  const text = adr[criterion.field] ?? '';
  const check = criterion.check;
  let met: boolean;
  if (check.kind === 'minWords') met = countWords(text) >= check.n;
  else if (check.kind === 'hasCondition') met = countWords(text) >= 3 && CONDITION_PATTERN.test(text);
  else {
    const haystack = normalize(text);
    met = terms(check.termsKey).some((t) => t.trim() && haystack.includes(normalize(t.trim())));
  }
  return { criterionId: criterion.id, met };
}

export function evaluateAdr(adr: Adr, rubric: readonly Criterion[], terms: (key: string) => string[]): CriterionResult[] {
  return rubric.map((c) => evaluateCriterion(adr, c, terms));
}

export function emptyAdr(): Adr {
  return { context: '', decision: '', consequences: '', givenUp: '', revisit: '' };
}
