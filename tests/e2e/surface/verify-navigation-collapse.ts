import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';

const fixture = await workspaceFixture();
const app = await startSurfaceApp({ ...fixture, port: 0 });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = process.env.SURFACE_EDITOR_OUTPUT ?? '/tmp/surface-editor-review';
mkdirSync(output, { recursive: true });
try {
  for (const projectRoot of [fixture.main, fixture.linked]) {
    for (const operation of ['register', 'mount'] as const) {
      assert.ok((await app.projectOperation({ operation, projectRoot, ...(operation === 'mount' ? { surfaceId: fixture.surfaceId } : {}) })).ok);
    }
  }
  for (const phone of [false, true]) {
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: phone, isMobile: phone });
    const page = await context.newPage();
    await page.goto(app.origin);
    await page.keyboard.press('Control+b');
    const navigation = page.getByRole('navigation', { name: 'Mounted pages' });
    await expect(navigation).toBeVisible();
    for (const name of ['ui', 'main']) {
      const collapse = navigation.getByRole('button', { name: `Collapse ${name}`, exact: true }).first();
      await collapse.click();
      await expect(navigation.getByRole('button', { name: `Expand ${name}`, exact: true }).first()).toHaveAttribute('aria-expanded', 'false');
      await page.reload();
      const expand = navigation.getByRole('button', { name: `Expand ${name}`, exact: true }).first();
      await expect(expand).toBeVisible();
      await expand.focus();
      await page.keyboard.press('Enter');
      await expect(navigation.getByRole('button', { name: `Collapse ${name}`, exact: true }).first()).toHaveAttribute('aria-expanded', 'true');
    }
    const root = navigation.getByRole('button', { name: /^(Collapse|Expand) app fixture$/ }).first();
    await root.click();
    await expect(navigation.getByRole('link')).toHaveCount(0);
    await page.reload();
    await expect(navigation.getByRole('link')).toHaveCount(0);
    await root.click();
    await expect(navigation.getByRole('link').first()).toBeVisible();
    await page.screenshot({ path: join(output, `navigation-expanded-${phone ? 'phone' : 'desktop'}.png`) });
    await navigation.getByRole('button', { name: 'Collapse ui', exact: true }).first().click();
    await page.screenshot({ path: join(output, `navigation-collapsed-${phone ? 'phone' : 'desktop'}.png`) });
    await context.close();
  }
  console.log('Navigation collapse: project, worktree, folder, keyboard and refresh restoration passed on phone and desktop.');
} finally {
  await browser.close();
  await app.stop();
  rmSync(fixture.directory, { recursive: true, force: true });
}
