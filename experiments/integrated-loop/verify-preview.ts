// Read-only browser check against this experiment's existing request.
// All non-GET/HEAD browser requests are blocked; no real conversation receives fixtures.
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selection } from './selection';

const evidence = resolve('.decompozr/surface/integrated-loop');
const request = JSON.parse(readFileSync(resolve(evidence, 'request.json'), 'utf8'));
const expectedResult = process.argv.includes('--expect-result')
  ? JSON.parse(readFileSync(resolve(evidence, 'result.json'), 'utf8')) : undefined;
const phase = expectedResult ? 'result' : selection.applied ? 'applied' : 'preview';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors: string[] = [];
const attemptedWrites: string[] = [];
mkdirSync(evidence, { recursive: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.route('**/*', route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) {
        attemptedWrites.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(request.browserPreviewUrl ?? request.previewUrl);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Refresh recipient', exact: true })).toBeEnabled();
    const card = page.getByTestId('source-card');
    await expect(card.getByRole('heading', { level: 3 })).toHaveText(selection.title);
    if (!selection.applied) {
      await expect(page.getByLabel('卡片標題', { exact: true })).toBeEnabled();
      await page.getByLabel('卡片標題', { exact: true }).fill('Browser-only unsent draft');
      await page.getByLabel('閱讀密度', { exact: true }).selectOption('compact');
      await expect(card.getByRole('heading', { level: 3 })).toHaveText(selection.title);
      await expect(card).not.toHaveClass(/compact/);
      await page.reload();
      await expect(page.getByLabel('卡片標題', { exact: true })).toBeEnabled();
    } else {
      await expect(card).toHaveClass(selection.density === 'compact' ? /compact/ : /^(?!.*compact)/);
      await expect(card).toContainText('已由 AGENT 套用');
      await expect(page.getByLabel('卡片標題', { exact: true })).toHaveValue(selection.title);
      await expect(page.getByLabel('卡片標題', { exact: true })).toBeDisabled();
      await expect(page.getByLabel('閱讀密度', { exact: true })).toHaveValue(selection.density);
      await expect(page.locator('details')).toContainText(selection.responseId);
      expect(await card.evaluate(element => getComputedStyle(element).paddingTop)).toBe(selection.density === 'compact' ? '16px' : '32px');
      if (expectedResult) {
        await expect(page.getByText('Agent 已回傳結果', { exact: true })).toBeVisible();
        await expect(page.getByText(expectedResult.message, { exact: true })).toBeVisible();
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: resolve(evidence, `${phase}-${width}.png`), fullPage: true });
    await context.close();
  }
  expect(errors).toEqual([]);
  expect(attemptedWrites).toEqual([]);
  const result = { checkedAt: new Date().toISOString(), requestId: request.id, widths: [1440, 390, 320], errors, attemptedWrites, sourceApplied: selection.applied, phase };
  writeFileSync(resolve(evidence, `${phase}-browser-check.json`), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
