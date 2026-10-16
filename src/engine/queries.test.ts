import { describe, expect, it } from 'vitest';
import { deltaTone } from './queries';

describe('deltaTone', () => {
  it('reads a drop in cost, complexity or cognitive load as better', () => {
    expect(deltaTone({ force: 'cost' }, -5)).toBe('better');
    expect(deltaTone({ force: 'complexity' }, -3)).toBe('better');
    expect(deltaTone({ force: 'cognitiveLoad' }, -8)).toBe('better');
  });

  it('reads a rise in cost as worse, even though the number is positive', () => {
    expect(deltaTone({ force: 'cost' }, 12)).toBe('worse');
  });

  it('reads velocity, reliability and runway the usual way round', () => {
    expect(deltaTone({ force: 'velocity' }, 4)).toBe('better');
    expect(deltaTone({ force: 'reliability' }, -6)).toBe('worse');
    expect(deltaTone({ context: 'runwayMonths' }, -2)).toBe('worse');
  });

  it('does not judge team size, orders or a zero delta', () => {
    expect(deltaTone({ context: 'teamSize' }, 10)).toBe('neutral');
    expect(deltaTone({ context: 'ordersPerDay' }, -200)).toBe('neutral');
    expect(deltaTone({ force: 'cost' }, 0)).toBe('neutral');
  });
});
