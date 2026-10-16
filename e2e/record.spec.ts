import { rename } from 'node:fs/promises';
import { test } from '@playwright/test';

// Records the README demo. Run with RECORD=1 npx playwright test e2e/record.spec.ts
test.skip(!process.env.RECORD, 'recording only on demand');
test.use({ locale: 'en-US' });

test('record the time-lapse demo', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: 'test-results/video', size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForTimeout(2200);
  await page.getByTestId('begin').click();
  await page.waitForTimeout(1200);
  await page.getByTestId('option-own-service').hover();
  await page.waitForTimeout(1600);
  await page.getByTestId('option-payments-port').hover();
  await page.waitForTimeout(1200);
  await page.getByTestId('option-payments-port').click();
  await page.getByTestId('rationale').pressSequentially('we may outgrow the vendor before the monolith', { delay: 28 });
  await page.waitForTimeout(500);
  await page.getByTestId('issue').click();
  await page.waitForTimeout(9800);
  await page.getByTestId('hit-payments-module').hover();
  await page.waitForTimeout(2200);
  const video = page.video();
  await context.close();
  if (video) await rename(await video.path(), 'docs/demo/timelapse.webm');
});
