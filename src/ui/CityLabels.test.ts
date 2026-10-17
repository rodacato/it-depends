import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CityModel } from '../city/layout';
import { modelFor, slotOrder } from '../city/layout';
import { snapshotAt } from '../engine/queries';
import { simulate } from '../engine/simulate';
import { campaign } from '../test/campaign';
import { CityLabels } from './CityLabels';
import { I18nProvider } from './i18n';

function districtClasses(base: CityModel, target: CityModel): Record<string, string> {
  const props = { preview: null, base, target, growth: 0.2, clouds: [], cloudProgress: [], hovered: null, onHover: () => {}, onSelect: () => {}, interactive: false, camera: { x: 0, y: 0, scale: 1 }, congested: [] };
  const html = renderToStaticMarkup(createElement(I18nProvider, { locale: 'en', children: createElement(CityLabels, props) }));
  const classes = [...html.matchAll(/<text[^>]*class="(lbl spaced dim[^"]*)"/g)].map((m) => m[1]!);
  return Object.fromEntries(target.districts.map((d, i) => [d.id, classes[i]!]));
}

describe('CityLabels', () => {
  it('letters in only the districts that are new to the site', () => {
    const timeline = simulate(campaign, [{ chapterId: 'reversibility', optionId: 'own-service' }], { seed: 1 });
    const order = slotOrder(timeline.snapshots.map((s) => s.topology));
    const base = modelFor(snapshotAt(timeline, 0), order);
    const target = modelFor(snapshotAt(timeline, 2), order);

    const classes = districtClasses(base, target);
    expect(classes.storefront).not.toContain('lettering');
    expect(classes.payments).toContain('lettering');
  });
});
