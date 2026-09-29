import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';
const f = await workspaceFixture();
for (const name of ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta']) {
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
    if (!mobile) { const width=await page.getByRole('tab',{name:'alpha',exact:true}).locator('..').evaluate(el=>el.getBoundingClientRect().width); assert.ok(width >= 240 && width <= 384); }
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
    await expect(comments).toBeHidden();
    const headerBounds = await page.locator('header').boundingBox(); assert.ok(headerBounds); assert.equal(headerBounds.height,36);
    const controls = await page.locator('header button').evaluateAll(nodes => nodes.map(node => { const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom}; }));
    assert.ok(controls.every(r => r.top >= headerBounds.y && r.bottom <= headerBounds.y + headerBounds.height), JSON.stringify(controls));
    const tab = page.getByRole('tab',{name:'beta',exact:true}); await expect(tab).toHaveAttribute('title', /.* \/ .* \/ .* \/ beta/);
    const label = tab.locator('.label'); await expect(label).toHaveCSS('direction','rtl'); await expect(label).toHaveCSS('text-overflow','ellipsis');
    await page.screenshot({path:join(output,mobile?'phone-tabs.png':'desktop-tabs.png')});
    page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'Close beta',exact:true}).click(); await expect(page.getByRole('tab',{name:'beta',exact:true})).toHaveCount(0);
    await expect(alpha.getByRole('textbox',{name:'Draft'})).toHaveValue('Keep this draft');
    for (const name of ['gamma','delta','epsilon','zeta','eta','theta']) {
      await page.getByRole('button',{name:'Toggle navigation',exact:true}).click(); await nav.getByRole('link',{name,exact:true}).click();
    }
    const widths=await page.getByRole('tab').evaluateAll(nodes=>nodes.map(node=>node.parentElement?.getBoundingClientRect().width ?? 0));
    assert.ok(widths.every(width=>width>=119 && width<320)); assert.ok(Math.max(...widths)-Math.min(...widths)<1);
    const selected=page.getByRole('tab',{name:'theta',exact:true}); await expect(selected).toBeInViewport();
    const suffixVisible=await selected.locator('.label').evaluate(el=>{const text=el.querySelector('bdi')?.firstChild;if(!(text instanceof Text))return false;const range=document.createRange();range.setStart(text,text.length-5);range.setEnd(text,text.length);const r=range.getBoundingClientRect(),box=el.getBoundingClientRect();return r.left>=box.left-1 && r.right<=box.right+1;});assert.ok(suffixVisible);
    await expect.poll(async()=>page.locator('main').first().evaluate(el=>parseFloat(getComputedStyle(el).left))).toBe(0);
    assert.equal(await page.evaluate(()=>window.scrollX),0);
    await expect(page.getByRole('button',{name:'Toggle navigation',exact:true})).toBeInViewport();
    await page.screenshot({path:join(output,mobile?'phone-crowded-tabs.png':'desktop-crowded-tabs.png')});
    assert.deepEqual(errors,[]); await context.close();
  }
  console.log('Editor verified: uniform 14px/400/32px tree, sidebar toggle, tabs, draft and scroll retention, keyboard selection and close on desktop and touch phone.');
} finally {await browser.close(); await app.stop(); rmSync(f.directory,{recursive:true,force:true});}
