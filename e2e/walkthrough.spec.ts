import { expect, test } from '@playwright/test';
import { SHOTS } from './shots';

test.use({ locale: 'es-MX', reducedMotion: 'reduce' });

test('the guide shows once on the first sheet, stays gone after a reload, and GUIDE replays it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('walkthrough')).toBeHidden();
  await page.getByTestId('begin').click();
  await expect(page.getByTestId('walkthrough')).toBeVisible();
  await expect(page.getByText('CÓMO SE JUEGA · 1 DE 3')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/es/00-walkthrough.png` });

  await page.getByTestId('walkthrough-next').click();
  await page.getByTestId('walkthrough-next').click();
  await expect(page.getByText('CÓMO SE JUEGA · 3 DE 3')).toBeVisible();
  await page.getByTestId('walkthrough-next').click();
  await expect(page.getByTestId('walkthrough')).toBeHidden();

  await page.reload();
  await page.getByTestId('begin').click();
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('walkthrough')).toBeHidden();

  await page.getByTestId('help').click();
  await expect(page.getByTestId('walkthrough')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('walkthrough')).toBeHidden();
});

test('Tab stays inside the guide', async ({ page }) => {
  await page.goto('/?walkthrough=off');
  await page.getByTestId('begin').click();
  await page.getByTestId('help').click();
  await page.getByTestId('walkthrough-next').click();
  const focusInGuide = page.getByTestId('walkthrough').locator(':focus');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    await expect(focusInGuide).toHaveCount(1);
  }
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+Tab');
    await expect(focusInGuide).toHaveCount(1);
  }
});

test('?walkthrough=off keeps the guide away, but GUIDE still opens it', async ({ page }) => {
  await page.goto('/?walkthrough=off');
  await page.getByTestId('begin').click();
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('walkthrough')).toBeHidden();
  await page.getByTestId('help').click();
  await expect(page.getByTestId('walkthrough')).toBeVisible();
});
