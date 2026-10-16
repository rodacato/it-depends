import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { SHOTS } from './shots';

const LETTERS = 'ABCDEFGH';

// Walk k picks option (k + sheet) % count, so across the four walks every option of every sheet is played.
const walks = [
  { walk: 0, locale: 'es-MX', viewport: { width: 1280, height: 720 }, reloadAfter: 4 },
  { walk: 1, locale: 'en-US', viewport: { width: 1440, height: 900 }, rewindAt: 6 },
  { walk: 2, locale: 'es-MX', viewport: { width: 1440, height: 900 } },
  { walk: 3, locale: 'en-US', viewport: { width: 1280, height: 720 } },
] as const;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  page.on('requestfailed', (r) => {
    if (r.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`request: ${r.url()} ${r.failure()?.errorText}`);
  });
  return errors;
}

for (const w of walks) {
  test.describe(`whole course · walk ${w.walk} · ${w.locale} · ${w.viewport.width}x${w.viewport.height}`, () => {
    test.use({ locale: w.locale, viewport: w.viewport, reducedMotion: 'reduce' });

    test('plays all eight sheets to a closed drawing set without errors', async ({ page }) => {
      test.setTimeout(180_000);
      const errors = collectErrors(page);
      await page.goto('/');
      await page.getByTestId('begin').click();

      for (let sheet = 1; sheet <= 8; sheet++) {
        const letter = LETTERS[sheet - 1]!;
        await test.step(`sheet ${sheet}`, async () => {
          await expect(page.getByTestId('briefing')).toBeVisible();
          const options = page.getByTestId('briefing').getByRole('radio');
          await options.nth((w.walk + sheet) % (await options.count())).click();
          await page.getByTestId('rationale').fill('the constraints this quarter point this way');
          await page.getByTestId('issue').click();
          await expect(page.getByTestId('issued')).toBeVisible();
          await expect(page.getByTestId(`rev-${letter}`)).toBeVisible();
          await page.screenshot({ path: `${SHOTS}/course/walk-${w.walk}-sheet-${sheet}.png` });

          await page.getByTestId('write-adr').click();
          await page.getByTestId('adr-context').fill('Team, traffic and runway as on the briefing.');
          await page.getByTestId('adr-revisit').fill('If reliability drops below 40 for two quarters.');
          await page.getByTestId('submit-adr').click();
          await expect(page.getByTestId('review')).toBeVisible();

          if ('reloadAfter' in w && sheet === w.reloadAfter) {
            await page.reload();
            await page.getByTestId('begin').click();
            await expect(page.getByTestId('review')).toBeVisible();
            await expect(page.getByTestId(`rev-${letter}`)).toBeVisible();
          }

          if ('rewindAt' in w && sheet === w.rewindAt) {
            await page.getByTestId('restore').click();
            await page.getByTestId('rewind').locator('[data-testid^="alt-"]').first().click();
            await page.getByTestId('alt-rationale').fill('the other door looked cheaper in hindsight');
            await page.getByTestId('compare').click();
            await expect(page.getByTestId('compare-view')).toBeVisible();
            await page.getByTestId('keep').click();
            await expect(page.getByTestId('review')).toBeVisible();
          }

          if (sheet < 8) await page.getByTestId('next-sheet').click();
        });
      }

      await page.getByTestId('finish').click();
      await expect(page.getByTestId('complete')).toBeVisible();
      await expect(page.getByTestId('rev-H')).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
