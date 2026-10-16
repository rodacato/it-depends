import { describe, expect, it } from 'vitest';
import { campaign } from '../content';
import { emptyAdr, evaluateAdr } from './rubric';

const terms = (key: string) =>
  ({
    'terms.context': ['team', 'runway'],
    'terms.forces': ['cost', 'complexity'],
    'terms.reversibility': ['door', 'undo'],
  })[key] ?? [];

describe('standalone rubric', () => {
  const rubric = campaign.chapters[0]!.rubric;

  it('is deterministic and never says right or wrong, only met or not', () => {
    const adr = {
      ...emptyAdr(),
      context: 'Three founders, six weeks to launch, fourteen months of runway.',
      decision: 'A port: a two-way door we can undo by writing a second adapter.',
      consequences: 'Complexity goes up a little and cost by a week.',
      givenUp: 'We gave up a week of features before launch for later flexibility.',
      revisit: 'If the vendor fee passes 3% of revenue, or when we reach 1,000 orders a day.',
    };
    const a = evaluateAdr(adr, rubric, terms);
    expect(a).toEqual(evaluateAdr(adr, rubric, terms));
    expect(a.every((r) => r.met)).toBe(true);
  });

  it('an empty ADR meets nothing', () => {
    expect(evaluateAdr(emptyAdr(), rubric, terms).some((r) => r.met)).toBe(false);
  });

  it('a revisit trigger needs a condition, not a hope', () => {
    const r = evaluateAdr({ ...emptyAdr(), revisit: 'We will see how it goes.' }, rubric, terms);
    expect(r.find((x) => x.criterionId === 'revisit-trigger')?.met).toBe(false);
  });
});
