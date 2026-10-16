import { expect, test } from '@playwright/test';

test.use({ locale: 'es-MX', reducedMotion: 'reduce' });

// The busiest section: the monolith late in a campaign, with modules, queues and a vendor around it.
test('section drawing of the monolith stays legible on a crowded site', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByTestId('begin').click();
  for (let sheet = 1; sheet <= 4; sheet++) {
    const options = page.getByTestId('briefing').getByRole('radio');
    await options.nth(sheet % (await options.count())).click();
    await page.getByTestId('rationale').fill('las restricciones de este trimestre apuntan aquí');
    await page.getByTestId('issue').click();
    await page.getByTestId('write-adr').click();
    await page.getByTestId('adr-context').fill('Equipo, tráfico y runway del briefing.');
    await page.getByTestId('submit-adr').click();
    if (sheet < 4) await page.getByTestId('next-sheet').click();
  }
  await page.getByTestId('hit-mercadito-app').click();
  await expect(page.getByTestId('section-detail')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/screenshots/es/15-section-monolith.png' });
  await page.getByTestId('detail-close').click();
  await expect(page.getByTestId('section-detail')).toBeHidden();
});
