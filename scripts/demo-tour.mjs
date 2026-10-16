// The README demo: sheet 1 from the briefing to the time-lapse. Recorded by record-demo.mjs.
export const launchOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};

export default async function tour(page) {
  const pause = (ms) => page.waitForTimeout(ms);

  await pause(2200);
  await page.getByTestId('begin').click();
  await pause(1200);
  await page.getByTestId('option-own-service').hover();
  await pause(1600);
  await page.getByTestId('option-payments-port').hover();
  await pause(1200);
  await page.getByTestId('option-payments-port').click();
  await page.getByTestId('rationale').pressSequentially('we may outgrow the vendor before the monolith', { delay: 28 });
  await pause(500);
  await page.getByTestId('issue').click();
  await pause(9800);
  await page.getByTestId('hit-payments-module').hover();
  await pause(2200);
}
