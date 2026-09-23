import { chromium, webkit, devices, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const origin = process.env.COMMENTS_E2E_ORIGIN;
if (!origin || !origin.startsWith('http://127.0.0.1:')) throw new Error('Use an isolated loopback fixture.');
const output = process.env.COMMENTS_E2E_OUTPUT ?? '.decompozr/surface/mobile-viewport-fix-20260923/viewport';
mkdirSync(output, { recursive: true });
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]] as const) {
  const browser = await engine.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  await context.route('**/experiments/comments/batch', route => route.abort());
  // Synthetic visual viewport events reproduce keyboard resize/pan separately
  // from the layout viewport. This is not a physical iOS keyboard acceptance.
  await context.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { offsetLeft: 0, offsetTop: 0, width: innerWidth, height: innerHeight, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  try {
    await page.goto(origin + '/experiments/comments', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Leave comment mode', exact: true })).toBeEnabled();
    const workspace = page.locator('#comment-workspace');
    expect(await workspace.evaluate(el => Math.abs(el.getBoundingClientRect().bottom - innerHeight))).toBeLessThan(1);
    const status = page.getByRole('contentinfo', { name: 'Connection status' });
    expect(await status.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(await page.evaluate(() => !!document.elementFromPoint(12, innerHeight - 12)?.closest('#comment-workspace'))).toBe(true);
    await page.locator('#headline').tap();
    await page.getByRole('button', { name: 'Comment on selected element', exact: true }).click();
    const field = page.locator('#comment');
    const editor = page.getByRole('region', { name: 'Comment on selected element', exact: true });
    await field.fill('Keep this draft through keyboard resize and scrolling.');
    await expect(field).toBeFocused();
    // A focused nested content scroll moves the anchored composer, not just its outline.
    const initial = await editor.boundingBox();
    await workspace.evaluate(el => { el.scrollTop += 50; });
    await expect.poll(async () => (await editor.boundingBox())!.y).toBeLessThan(initial!.y - 10);
    await expect(field).toBeFocused();
    async function resize(x: number, y: number, width: number, height: number, event = 'resize') {
      await page.evaluate(({ x, y, width, height, event }) => {
        Object.assign(window.visualViewport!, { offsetLeft: x, offsetTop: y, width, height });
        window.visualViewport!.dispatchEvent(new Event(event));
      }, { x, y, width, height, event });
      await expect.poll(async () => {
        const r = await editor.boundingBox();
        return !!r && r.x >= x + 11 && r.y >= y + 11 && r.x + r.width <= x + width - 11 && r.y + r.height <= y + height - 31;
      }).toBe(true);
    }
    await resize(0, 150, 390, 310);
    const input = await field.boundingBox();
    expect(input!.y).toBeGreaterThanOrEqual(150);
    expect(input!.y + input!.height).toBeLessThanOrEqual(460);
    await expect(field).toHaveValue('Keep this draft through keyboard resize and scrolling.');
    await expect(field).toBeFocused();
    await resize(25, 210, 340, 280, 'scroll');
    const save = page.getByRole('button', { name: 'Add comment to draft' });
    const saveBounds = await save.boundingBox();
    expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(490);
    await page.screenshot({ path: `${output}/${name}-keyboard-pan.png` });
    await resize(0, 0, 390, page.viewportSize()!.height);
    await expect(field).toBeFocused();
    await field.press('End'); await field.pressSequentially(' Still editing.');
    await save.click();
    await expect(page.getByRole('button', { name: 'Open comments (1 drafts)' })).toBeVisible();
    // The reported case includes a capture and a long selector. Keep the field
    // reachable while the screenshot body scrolls and actions remain visible.
    await page.locator('#option-a h2').scrollIntoViewIfNeeded();
    await page.locator('#option-a h2').tap();
    await page.getByRole('button', { name: 'Capture selected element', exact: true }).click();
    await expect(page.getByAltText('Selected element screenshot preview')).toBeVisible({ timeout: 15000 });
    await field.fill('Capture plus keyboard draft');
    await resize(0, 120, 390, 300);
    await expect(field).toBeFocused();
    const captureField = await field.boundingBox();
    const captureSave = await save.boundingBox();
    expect(captureField!.y).toBeGreaterThanOrEqual(120);
    expect(captureField!.y + captureField!.height).toBeLessThanOrEqual(420);
    expect(captureSave!.y + captureSave!.height).toBeLessThanOrEqual(388);
    await page.screenshot({ path: `${output}/${name}-capture-keyboard.png` });
    await expect(field).toHaveValue('Capture plus keyboard draft');
    expect(errors).toEqual([]);
    console.log(`${name}: PASS keyboard resize/pan, focused nested scroll, retained draft, transparent overlay status`);
  } catch (error) {
    await page.screenshot({ path: `${output}/${name}-failure.png` }); throw error;
  } finally {
    await context.tracing.stop({ path: `${output}/${name}-trace.zip` }); await browser.close();
  }
}
