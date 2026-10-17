import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US', reducedMotion: 'reduce' });

async function playSheet(page: Page) {
  await expect(page.getByTestId('briefing')).toBeVisible();
  await page.getByTestId('briefing').getByRole('radio').first().click();
  await page.getByTestId('rationale').fill('the constraints this quarter point this way');
  await page.getByTestId('issue').click();
  await page.getByTestId('write-adr').click();
  await page.getByTestId('adr-context').fill('Team, traffic and runway as on the briefing.');
  await page.getByTestId('adr-revisit').fill('If reliability drops below 40 for two quarters.');
  await page.getByTestId('submit-adr').click();
  await expect(page.getByTestId('review')).toBeVisible();
}

async function finishCampaign(page: Page) {
  await page.goto('/?walkthrough=off');
  await page.getByTestId('begin').click();
  for (let sheet = 1; sheet <= 8; sheet++) {
    await playSheet(page);
    if (sheet < 8) await page.getByTestId('next-sheet').click();
  }
  await page.getByTestId('finish').click();
  await expect(page.getByTestId('complete')).toBeVisible();
}

async function adoptFirstAlternate(page: Page) {
  await page.getByTestId('rewind').locator('[data-testid^="alt-"]').first().click();
  await page.getByTestId('alt-rationale').fill('the other door looked cheaper in hindsight');
  await page.getByTestId('compare').click();
  await page.getByTestId('adopt').click();
}

test('a new campaign after finishing shows the first review, not the closed drawing set', async ({ page }) => {
  test.setTimeout(180_000);
  await finishCampaign(page);
  await page.getByTestId('complete-new').click();
  await page.getByTestId('confirm-reset').click();
  await page.getByTestId('begin').click();
  await playSheet(page);
  await expect(page.getByTestId('complete')).toHaveCount(0);
});

test('rewinding from the closed drawing set ends on that sheet’s review', async ({ page }) => {
  test.setTimeout(180_000);
  await finishCampaign(page);
  await page.getByTestId('rev-B').click();
  await adoptFirstAlternate(page);
  await page.getByTestId('adr-context').fill('Team, traffic and runway as on the briefing.');
  await page.getByTestId('adr-revisit').fill('If reliability drops below 40 for two quarters.');
  await page.getByTestId('submit-adr').click();
  await expect(page.getByTestId('review')).toBeVisible();
});
