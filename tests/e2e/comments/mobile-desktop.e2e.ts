import { verifyEdgeSwipes } from './edge-swipes.ts';
import { chromium, webkit, devices, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const origin = process.env.COMMENTS_E2E_ORIGIN;
if (!origin?.startsWith('http://127.0.0.1:')) throw new Error('Isolated loopback fixture required');
const output = process.env.COMMENTS_E2E_OUTPUT ?? '.decompozr/surface/comments-e2e';
mkdirSync(output, { recursive: true });
for (const profile of ['desktop', 'touch-chromium', 'mobile'] as const) {
  const browser = await (profile === 'mobile' ? webkit : chromium).launch({ headless: true });
  const context = await browser.newContext(profile !== 'desktop' ? { ...devices['iPhone 13'], reducedMotion: 'no-preference' } : { viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  // Fresh storage, no private capability, and no delivery allowed.
  await context.route('**/experiments/comments/batch', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(origin + '/experiments/comments', { waitUntil: 'networkidle' });
    const reviewTools = page.getByRole('toolbar', { name: 'Comment tools' });
    await expect(reviewTools).toBeVisible();
    await expect(reviewTools.getByRole('button')).toHaveCount(3);
    for (const icon of await reviewTools.locator('svg').all()) {
      const box = await icon.boundingBox();
      if (!box) throw new Error('Missing tool icon');
      expect(box.width).toBeLessThanOrEqual(16); expect(box.height).toBeLessThanOrEqual(16);
    }
    const commentAction = reviewTools.getByRole('button', {name:'Comment',exact:true});
    if (profile === 'desktop') {
      await commentAction.focus(); await page.keyboard.press('ArrowRight');
      await expect(reviewTools.getByRole('button',{name:'Screenshot',exact:true})).toBeFocused();
      await page.keyboard.press('Home'); await expect(commentAction).toBeFocused();
      await page.keyboard.press('End'); await expect(reviewTools.getByRole('button',{name:'Fullscreen',exact:true})).toBeFocused();
      await page.keyboard.press('ArrowRight'); await expect(commentAction).toBeFocused();
      await page.keyboard.press('ArrowLeft'); await expect(reviewTools.getByRole('button',{name:'Fullscreen',exact:true})).toBeFocused();
    }
    for (const action of await reviewTools.getByRole('button').all()) {
      const target = await action.boundingBox();
      if (!target) throw new Error('Missing tool target');
      expect(target.width).toBeGreaterThanOrEqual(profile === 'desktop' ? 28 : 32);
      expect(target.height).toBeGreaterThanOrEqual(profile === 'desktop' ? 28 : 32);
      expect(target.height).toBeLessThanOrEqual(36);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (profile !== 'desktop') await verifyEdgeSwipes(page, profile === 'touch-chromium', output, profile);
    const menu = page.getByRole('button', { name: 'Toggle navigation' });
    if (profile === 'desktop') {
      await page.keyboard.press('i');
      await expect(page.getByRole('button', { name: /Open comments/ })).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('i');
      await page.keyboard.press('m');
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('m');
      await page.waitForTimeout(250);
    }
    const main = page.locator('#comment-workspace');
    const before = await main.boundingBox();
    await menu.evaluate(el => (el as HTMLButtonElement).click());
    await page.waitForTimeout(70);
    const movingLeft = await page.locator('#surface-navigation').boundingBox();
    if (!movingLeft || !before) throw new Error('Navigation or page geometry is unavailable');
    expect(movingLeft.x).toBeLessThan(0);
    expect(movingLeft.x).toBeGreaterThan(-movingLeft.width);
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    const left = page.getByRole('complementary', { name: 'Workspace navigation' });
    await expect(left).toBeVisible();
    await page.waitForTimeout(250);
    expect((await main.boundingBox())?.width).toBe(before.width);
    expect(await left.evaluate(el => getComputedStyle(el).transitionDuration)).not.toBe('0s');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(250);
    if (profile === 'touch-chromium') {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.synthesizeScrollGesture', { x: 190, y: 600, yDistance: -240, gestureSourceType: 'touch', speed: 500 });
      await expect.poll(() => main.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      await expect(reviewTools).toBeVisible();
      await expect(page.locator('.selection-outline')).toHaveCount(0);
    }
    // Scroll never opens a composer or selection toolbar.
    await main.evaluate(el => { el.scrollTop = 220; });
    await page.waitForTimeout(100);
    await expect(reviewTools).toBeVisible();
    await expect(page.getByRole('region', { name: 'Comment on selected element' })).toHaveCount(0);
    await main.evaluate(el => { el.scrollTop = 0; });
    const tools = reviewTools;
    const toolBounds = await tools.boundingBox();
    if (!toolBounds) throw new Error('Missing toolbar');
    expect(toolBounds.x).toBeGreaterThanOrEqual(0);
    expect(toolBounds.x + toolBounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const actionCount=await tools.getByRole('button').count();
    const gripWidth=profile==='desktop'?24:0;
    expect(toolBounds.width).toBeLessThanOrEqual(actionCount*36+gripWidth+16);
    await page.screenshot({path:`${output}/${profile}-compact-selection.png`});
    await commentAction.click();
    await expect(commentAction).toHaveAttribute('aria-pressed','true');
    await (profile === 'desktop' ? page.locator('#headline').click() : page.locator('#headline').tap());
    await expect(page.locator('#comment')).toBeVisible();
    await page.locator('#comment').fill('E2E local-only comment');
    if (profile === 'desktop') {
      await page.locator('#comment').press('m');
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await page.locator('#comment').press('Meta+Enter');
      await expect(page.locator('#comment')).toHaveCount(0);
    } else await page.getByRole('button', { name: 'Add comment to draft' }).click();
    const pane = page.getByRole('complementary', { name: 'Comments and conversation' });
    await expect(pane).toBeVisible();
    await page.waitForTimeout(250);
    const after = await main.boundingBox();
    if (profile !== 'desktop') expect(after!.width).toBe(before!.width);
    else expect(after!.width).toBeLessThan(before!.width - 250);
    const bounds = await pane.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await page.screenshot({ path: `${output}/${profile}-pane.png`, fullPage: true });
    await page.getByRole('button', { name: 'Close comments', exact: true }).click();
    await page.waitForTimeout(250);
    await tools.getByRole('button', { name: 'Screenshot', exact:true }).click();
    await (profile === 'desktop' ? page.locator('#headline').click() : page.locator('#headline').tap());
    await expect(page.getByAltText('Selected element screenshot preview')).toBeVisible({ timeout: 15000 });
    const editor = page.getByRole('region', { name: 'Comment on selected element' });
    // Image layout and ResizeObserver repositioning settle on separate frames.
    await expect.poll(async () => {
      const bounds = await editor.boundingBox();
      return bounds!.y + bounds!.height;
    }).toBeLessThanOrEqual(page.viewportSize()!.height - 24);
    const editorBounds = await editor.boundingBox();
    const saveBounds = await page.getByRole('button', { name: 'Add comment to draft' }).boundingBox();
    expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(editorBounds!.y + editorBounds!.height);
    await page.screenshot({ path: `${output}/${profile}-capture.png`, fullPage: true });
    expect(errors).toEqual([]);
    console.log(`${profile}: PASS (menu, scrolling, select -> tools -> comment/capture, pane geometry, no browser errors)`);
  } catch (error) {
    await page.screenshot({ path: `${output}/${profile}-failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.tracing.stop({ path: `${output}/${profile}-trace.zip` });
    await browser.close();
  }
}
