import { describe, expect, it } from 'vitest';
import { readLocales, readRawContent } from '../../scripts/load-fs';
import { checkCampaign, parseCampaign } from './validate';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('content validation', () => {
  it('the shipped content is valid in every locale', () => {
    const campaign = parseCampaign(readRawContent());
    expect(checkCampaign(campaign, readLocales())).toEqual([]);
  });

  it('an effect without a source fails', () => {
    const raw = clone(readRawContent());
    const ch = raw.chapters[0] as { dilemma: { options: { effects: { sources: string[] }[] }[] } };
    ch.dilemma.options[0]!.effects[0]!.sources = [];
    expect(() => parseCampaign(raw)).toThrow(/at least one source/);
  });

  it('an effect without an assumption fails', () => {
    const raw = clone(readRawContent());
    const ch = raw.chapters[0] as { dilemma: { options: { effects: Record<string, unknown>[] }[] } };
    delete ch.dilemma.options[0]!.effects[0]!.assumption;
    expect(() => parseCampaign(raw)).toThrow(/assumption/);
  });

  it('an assumption missing from a locale fails', () => {
    const campaign = parseCampaign(readRawContent());
    const locales = readLocales();
    const es = locales.find((l) => l.locale === 'es-MX')!;
    delete es.messages['assumptions.reversibility.portCostsAWeek'];
    expect(checkCampaign(campaign, locales).join('\n')).toMatch(/portCostsAWeek.*es-MX/);
  });

  it('a scheduled event that would fire before its own chapter decides fails', () => {
    const raw = clone(readRawContent());
    const finale = raw.chapters.find((c) => (c as { id: string }).id === 'finale') as { quarter: number; events: { trigger: { quarter: number } }[] };
    finale.events[0]!.trigger.quarter = finale.quarter;
    expect(checkCampaign(parseCampaign(raw), readLocales()).join('\n')).toMatch(/series-b: scheduled at quarter 11/);
  });

  it('an onlyIf that no reachable site can satisfy fails', () => {
    const raw = clone(readRawContent());
    const first = raw.chapters[0] as { dilemma: { options: { effects: Record<string, unknown>[] }[] } };
    first.dilemma.options[0]!.effects[0]!.onlyIf = { has: 'ledger-db' };
    expect(checkCampaign(parseCampaign(raw), readLocales()).join('\n')).toMatch(/onlyIf.has ledger-db is never on the site/);
  });

  it('an unknown source id fails', () => {
    const raw = clone(readRawContent());
    const ch = raw.chapters[0] as { dilemma: { options: { effects: { sources: string[] }[] }[] } };
    ch.dilemma.options[0]!.effects[0]!.sources = ['not-a-book'];
    expect(checkCampaign(parseCampaign(raw), readLocales()).join('\n')).toMatch(/unknown source "not-a-book"/);
  });
});
