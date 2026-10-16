import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const SHOTS = 'docs/screenshots';

const locales = [
  { tag: 'en-US', dir: 'en', rationale: 'we may outgrow the vendor before we outgrow the monolith' },
  { tag: 'es-MX', dir: 'es', rationale: 'podemos superar al proveedor antes que al monolito' },
] as const;

async function shot(page: Page, dir: string, name: string) {
  await page.screenshot({ path: `${SHOTS}/${dir}/${name}.png` });
}

for (const loc of locales) {
  test.describe(`main flow · ${loc.tag}`, () => {
    test.use({ locale: loc.tag });

    test('cover → briefing → time-lapse → ADR → review → rewind', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('cover')).toBeVisible();
      await expect(page.getByTestId('title-block')).toBeVisible();
      await page.waitForTimeout(1200);
      await shot(page, loc.dir, '01-cover');

      await page.getByTestId('begin').click();
      await expect(page.getByTestId('briefing')).toBeVisible();
      await page.waitForTimeout(600);
      await page.getByTestId('option-own-service').hover();
      await page.waitForTimeout(400);
      await shot(page, loc.dir, '02-preview-own-service');

      await page.getByTestId('variant-regulated-fintech').click();
      await page.getByTestId('option-own-service').hover();
      await page.waitForTimeout(400);
      await shot(page, loc.dir, '03-preview-other-context');
      await page.getByTestId('variant-regulated-fintech').locator('xpath=preceding-sibling::button[1]').click();

      await page.getByTestId('option-payments-port').click();
      await page.getByTestId('rationale').fill(loc.rationale);
      await page.getByTestId('option-payments-port').hover();
      await shot(page, loc.dir, '04-selected-with-rationale');
      await page.getByTestId('issue').click();

      await expect(page.getByTestId('timelapse-stamp')).toBeVisible();
      await page.waitForTimeout(2600);
      await shot(page, loc.dir, '05-timelapse-growing');
      await page.waitForTimeout(3600);
      await shot(page, loc.dir, '06-timelapse-clouds');

      await expect(page.getByTestId('issued')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(700);
      await shot(page, loc.dir, '07-revision-issued');
      await expect(page.getByTestId('rev-A')).toBeVisible();

      await page.getByTestId('hit-payments-module').hover();
      await expect(page.getByTestId('assumption-tag')).toBeVisible();
      await shot(page, loc.dir, '08-assumption-tag');
      await page.getByTestId('gauge-complexity').hover();
      await expect(page.getByTestId('force-tag')).toBeVisible();
      await shot(page, loc.dir, '09-force-trace');
      await page.mouse.move(10, 10);

      await page.getByTestId('write-adr').click();
      await expect(page.getByTestId('adr')).toBeVisible();
      await page.getByTestId('adr-context').fill(
        loc.dir === 'en'
          ? 'Three founders, six weeks to launch, fourteen months of runway, about 40 orders a day.'
          : 'Tres fundadores, seis semanas para lanzar, catorce meses de runway, unos 40 pedidos al día.',
      );
      await page.getByTestId('adr-consequences').fill(
        loc.dir === 'en' ? 'Complexity and cost go up a little now; payments become testable in isolation.' : 'La complejidad y el costo suben un poco; pagos se puede probar aislado.',
      );
      await page.getByTestId('adr-givenUp').fill(
        loc.dir === 'en' ? 'We gave up a week of features before launch for later flexibility.' : 'Renunciamos a una semana de funcionalidades antes del lanzamiento.',
      );
      await page.getByTestId('adr-revisit').fill(loc.dir === 'en' ? 'If vendor fees pass 3% of revenue.' : 'Si las comisiones pasan del 3% del ingreso.');
      await shot(page, loc.dir, '10-adr');
      await page.getByTestId('submit-adr').click();

      await expect(page.getByTestId('review')).toBeVisible();
      await page.waitForTimeout(700);
      await shot(page, loc.dir, '11-review-board');

      await page.reload();
      await expect(page.getByTestId('cover')).toBeVisible();
      await page.getByTestId('begin').click();
      await expect(page.getByTestId('review')).toBeVisible();

      await page.getByTestId('restore').click();
      await expect(page.getByTestId('rewind')).toBeVisible();
      await page.getByTestId('alt-own-service').click();
      await page.getByTestId('alt-rationale').fill(loc.dir === 'en' ? 'control of the ledger matters more than speed' : 'controlar el ledger importa más que la velocidad');
      await page.getByTestId('compare').click();
      await expect(page.getByTestId('compare-view')).toBeVisible();
      await page.waitForTimeout(3000);
      await shot(page, loc.dir, '12-compare-growing');
      await page.waitForTimeout(6000);
      await shot(page, loc.dir, '13-compare-diverged');
      await page.getByTestId('keep').click();
      await expect(page.getByTestId('review')).toBeVisible();

      await page.getByRole('button', { name: /NEW CAMPAIGN|NUEVA CAMPAÑA/ }).click();
      await page.getByTestId('confirm-reset').click();
      await expect(page.getByTestId('cover')).toBeVisible();
      await expect(page.getByText(/No revisions issued|Sin revisiones emitidas/)).toBeVisible();
    });
  });
}

test.describe('reduced motion', () => {
  test.use({ locale: 'en-US', reducedMotion: 'reduce' });

  test('the time-lapse becomes a before/after with clouds drawn statically', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('begin').click();
    await page.getByTestId('option-hosted-checkout').click();
    await page.getByTestId('rationale').fill('launch matters more than fees right now');
    await page.getByTestId('issue').click();
    await expect(page.getByTestId('issued')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('rev-A')).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, 'en', '14-reduced-motion-after');
  });
});
