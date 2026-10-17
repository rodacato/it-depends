import { expect, test } from '@playwright/test';
import { SHOTS } from './shots';

// Another origin than the course's localhost; a public hostname would be blocked from framing localhost.
const HOST = 'http://127.0.0.1:4392';

// A stand-in for Dojo: frames the course on another origin and speaks scroll protocol v0 back to it.
function hostPage(courseUrl: string, progress: Record<string, unknown> = {}): string {
  return `<!doctype html><html><body style="margin:0;background:#111">
<iframe id="scroll" src="${courseUrl}" style="width:1440px;height:900px;border:0"></iframe>
<script>
  window.received = [];
  const frame = document.getElementById('scroll');
  const courseOrigin = new URL(${JSON.stringify(courseUrl)}).origin;
  window.addEventListener('message', (e) => {
    if (e.origin !== courseOrigin || e.source !== frame.contentWindow) return;
    window.received.push(e.data);
    if (e.data && e.data.type === 'hello') {
      frame.contentWindow.postMessage({ dojo: 'scroll', v: 0, type: 'init', nonce: e.data.nonce, session: 'sess-1',
        locale: 'es-MX', theme: {}, progress: ${JSON.stringify(progress)}, capabilities: ['progress'], userRef: 'u-1', authenticated: true }, courseOrigin);
    }
  });
  window.setLocale = (locale) => frame.contentWindow.postMessage({ dojo: 'scroll', v: 0, type: 'setLocale', session: 'sess-1', locale }, courseOrigin);
</script></body></html>`;
}

test.use({ locale: 'en-US', reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

test('embedded in a Dojo-like host: handshake, host locale, progress and completion', { tag: '@smoke' }, async ({ page, baseURL }) => {
  const course = `${baseURL}/?host=${encodeURIComponent(HOST)}&walkthrough=off`;
  await page.route(`${HOST}/host.html`, (route) => route.fulfill({ contentType: 'text/html', body: hostPage(course) }));
  await page.goto(`${HOST}/host.html`);
  const app = page.frameLocator('#scroll');

  await expect(app.getByTestId('cover')).toBeVisible();
  await expect(app.getByText('Abrir la lámina 1')).toBeVisible();
  const hello = await page.evaluate(() => (window as unknown as { received: { type: string }[] }).received[0]);
  expect(hello).toMatchObject({ dojo: 'scroll', v: 0, type: 'hello', scroll: { id: 'it-depends' } });

  await app.getByTestId('begin').click();
  await app.getByTestId('option-payments-port').click();
  await app.getByTestId('rationale').fill('podemos superar al proveedor antes que al monolito');
  await app.getByTestId('issue').click();
  await app.getByTestId('write-adr').click();
  await app.getByTestId('adr-context').fill('Tres fundadores, seis semanas, catorce meses de runway.');
  await app.getByTestId('submit-adr').click();
  await expect(app.getByTestId('review')).toBeVisible();

  const read = () => page.evaluate(() => (window as unknown as { received: Record<string, unknown>[] }).received);
  await expect.poll(async () => (await read()).some((m) => m.type === 'complete')).toBe(true);
  const messages = await read();
  expect(messages.filter((m) => m.type === 'hello')).toHaveLength(1);
  const types = messages.map((m) => m.type);
  expect(types).toContain('progress');
  expect(messages).toContainEqual(expect.objectContaining({ type: 'complete', session: 'sess-1', unitId: 'reversibility' }));
  expect(messages.filter((m) => m.type !== 'hello').every((m) => m.session === 'sess-1')).toBe(true);
  expect(types).not.toContain('llm');

  await page.evaluate(() => (window as unknown as { setLocale: (l: string) => void }).setLocale('en'));
  await expect(app.getByText('The review board has three questions about Rev A.')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/en/16-embedded-in-host.png` });
});

test('continuing on a sheet the host has as completed does not report it incomplete', async ({ page, baseURL }) => {
  const adr = { context: 'c', decision: 'd', consequences: 'x', givenUp: 'g', revisit: 'r' };
  const decided = {
    reversibility: 'hosted-checkout',
    complexity: 'pricing-engine',
    technology: 'postgres-fts',
    services: 'modular-monolith',
    data: 'scale-the-reservoir',
    'build-vs-buy': 'build-risk',
    'tech-debt': 'shortcut-with-plan',
    finale: 'platform-team',
  };
  const progress = Object.fromEntries(Object.entries(decided).map(([id, optionId]) => [id, { completed: true, state: { optionId, adr } }]));
  const course = `${baseURL}/?host=${encodeURIComponent(HOST)}&walkthrough=off`;
  await page.route(`${HOST}/host.html`, (route) => route.fulfill({ contentType: 'text/html', body: hostPage(course, progress) }));
  await page.goto(`${HOST}/host.html`);
  const app = page.frameLocator('#scroll');

  await app.getByTestId('begin').click();
  await expect(app.getByTestId('review')).toBeVisible();

  const messages = await page.evaluate(() => (window as unknown as { received: Record<string, unknown>[] }).received);
  expect(messages).not.toContainEqual(expect.objectContaining({ type: 'progress', unitId: 'finale', completed: false }));
});
