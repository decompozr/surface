import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';
const f = await workspaceFixture();
for (const name of ['alpha', 'beta']) {
  mkdirSync(join(f.main, 'ui/routes', name), { recursive:true });
  writeFileSync(join(f.main, 'ui/routes', name, '+page.svelte'), `<h1>${name}</h1><label>Draft <textarea aria-label="Draft"></textarea></label><div style="height:1600px">Scrollable content</div><p>Bottom</p>`);
}
const app = await startSurfaceApp({ ...f, port:0 });
const browser = await chromium.launch({ channel:'chrome', headless:true });
const output = process.env.SURFACE_EDITOR_OUTPUT ?? '/tmp/surface-editor-review'; mkdirSync(output, { recursive:true });
try {
  for (const projectRoot of [f.main, f.linked]) for (const operation of ['register','mount'] as const) {
    const result = await app.projectOperation({ operation, projectRoot, ...(operation === 'mount' ? {artifactId:f.artifactId} : {}) }); assert.ok(result.ok);
  }
  for (const mobile of [false,true]) {
    const context = await browser.newContext({ viewport:mobile ? {width:390,height:844} : {width:1440,height:1000}, isMobile:mobile, hasTouch:mobile });
    const page = await context.newPage(); const errors:string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(app.origin); await page.getByRole('button', {name:'Toggle navigation',exact:true}).click();
    const nav = page.getByRole('complementary', {name:'Workspace navigation'}); await expect(nav).toBeVisible();
    await expect.poll(async () => Math.round((await nav.boundingBox())?.x ?? -999)).toBe(0);
    await expect(nav.getByText('Workspaces', {exact:true})).toBeVisible();
    await expect(page.getByRole('img',{name:'Surface',exact:true})).toHaveCount(0);
    await expect(page.getByRole('navigation',{name:'Breadcrumb'})).toHaveCount(0);
    const styles = await nav.locator('.group-label, .link-label').evaluateAll(nodes => nodes.map(node => { const style=getComputedStyle(node); const row=node.closest('a') ?? node; return {size:style.fontSize, weight:style.fontWeight, height:row.getBoundingClientRect().height}; }));
    assert.ok(styles.length > 3); assert.ok(styles.every(item => item.size === '14px' && item.weight === '400' && item.height === 32), JSON.stringify(styles));
    await page.screenshot({path:join(output, mobile?'phone-navigation.png':'desktop-navigation.png')});
    await nav.getByRole('link',{name:'alpha',exact:true}).click();
    await expect(page.getByRole('tab',{name:'alpha',exact:true})).toBeVisible();
    const alpha=page.frameLocator('iframe[title="alpha"]'); await alpha.getByRole('textbox',{name:'Draft'}).fill('Keep this draft');
    await expect(alpha.locator('header')).toHaveCount(0);
    await page.getByRole('button',{name:'Toggle navigation',exact:true}).click(); await nav.getByRole('link',{name:'beta',exact:true}).click();
    await page.frameLocator('iframe[title="beta"]').getByRole('textbox',{name:'Draft'}).fill('Second draft');
    await page.getByRole('tab',{name:'alpha',exact:true}).click(); await expect(alpha.getByRole('textbox',{name:'Draft'})).toHaveValue('Keep this draft');
    const frame=page.frames().find(frame=>frame.url().includes('/alpha')); assert.ok(frame);
    const scroll=await frame.evaluate(()=>{const el=document.querySelector('main'); if(!el) throw Error('Missing scroll container'); el.scrollTop=300; return el.scrollTop;}); assert.ok(scroll>0);
    await page.getByRole('tab',{name:'beta',exact:true}).click(); await page.getByRole('tab',{name:'alpha',exact:true}).click();
    assert.equal(await frame.evaluate(()=>document.querySelector('main')?.scrollTop),scroll);
    await page.getByRole('tab',{name:'alpha',exact:true}).focus(); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab',{name:'beta',exact:true})).toHaveAttribute('aria-selected','true');
    await page.getByRole('button',{name:'Open comments',exact:true}).click();
    const comments = page.frameLocator('iframe[title="beta"]').getByRole('complementary',{name:'Comments and conversation'});
    await expect(comments).toBeVisible();
    await expect.poll(async () => { const bounds = await comments.boundingBox(); return bounds ? Math.round(bounds.x + bounds.width) : -1; }).toBe(mobile ? 390 : 1440);
    await page.screenshot({path:join(output,mobile?'phone-comments.png':'desktop-comments.png')});
    await page.getByRole('button',{name:'Open comments',exact:true}).click();
    await page.screenshot({path:join(output,mobile?'phone-tabs.png':'desktop-tabs.png')});
    page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'Close beta',exact:true}).click(); await expect(page.getByRole('tab',{name:'beta',exact:true})).toHaveCount(0);
    await expect(alpha.getByRole('textbox',{name:'Draft'})).toHaveValue('Keep this draft');
    assert.deepEqual(errors,[]); await context.close();
  }
  console.log('Editor verified: uniform 14px/400/32px tree, sidebar toggle, tabs, draft and scroll retention, keyboard selection and close on desktop and touch phone.');
} finally {await browser.close(); await app.stop(); rmSync(f.directory,{recursive:true,force:true});}
