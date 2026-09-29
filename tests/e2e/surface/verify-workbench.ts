import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';
const f = await workspaceFixture();
for (const name of ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi']) {
  mkdirSync(join(f.main, 'ui/routes', name), { recursive:true });
  writeFileSync(join(f.main, 'ui/routes', name, '+page.svelte'), `<h1>${name}</h1><label>Draft <textarea aria-label="Draft"></textarea></label><div style="height:1600px">Scrollable content</div><p>Bottom</p>`);
}
const app = await startSurfaceApp({ ...f, port:0 });
const browser = await chromium.launch({ channel:'chrome', headless:true });
const output = process.env.SURFACE_EDITOR_OUTPUT ?? '/tmp/surface-editor-review'; mkdirSync(output, { recursive:true });
try {
  for (const projectRoot of [f.main, f.linked]) for (const operation of ['register','mount'] as const) {
    const result = await app.projectOperation({ operation, projectRoot, ...(operation === 'mount' ? {surfaceId:f.surfaceId} : {}) }); assert.ok(result.ok);
  }
  for (const mobile of [false,true]) {
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
    const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(app.origin);await page.waitForFunction(()=>localStorage.getItem('surface.workbench.v1')!==null);
    await page.keyboard.press('Control+p');
    const search=page.getByRole('combobox',{name:'Open surface'});await expect(search).toBeFocused();await search.fill('alpha');await page.keyboard.press('Enter');
    await expect(page.getByRole('tab',{name:'alpha',exact:true})).toHaveAttribute('aria-selected','true');
    await page.keyboard.press('Control+p');await search.fill('beta');await page.keyboard.press('Enter');await expect(page.getByRole('tab',{name:'beta',exact:true})).toHaveAttribute('aria-selected','true');
    await page.reload();await expect(page.getByRole('tab',{name:'alpha',exact:true})).toHaveCount(1);await expect(page.getByRole('tab',{name:'beta',exact:true})).toHaveAttribute('aria-selected','true');
    await page.keyboard.press('Control+b');await expect(page.getByRole('complementary',{name:'Workspace navigation'})).toBeVisible();
    const resize=page.getByRole('separator',{name:'Resize Workspaces'});await resize.focus();await page.keyboard.press('ArrowRight');await expect(resize).toHaveAttribute('aria-valuenow','290');
    await page.reload();await expect(page.getByRole('separator',{name:'Resize Workspaces'})).toHaveAttribute('aria-valuenow','290');
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Control+Shift+p');const palette=page.getByRole('combobox',{name:'Run command'});await palette.fill('Toggle status');await page.keyboard.press('Enter');
    await expect(page.frameLocator('iframe[title="beta"]').getByRole('contentinfo',{name:'Connection status'})).toHaveCount(0);
    await page.keyboard.press('Control+Shift+p');await palette.fill('Toggle status');await page.keyboard.press('Enter');
    await expect(page.frameLocator('iframe[title="beta"]').getByRole('textbox',{name:'Draft'})).toBeVisible();
    await page.keyboard.press('Control+Alt+b');const comments=page.frameLocator('iframe[title="beta"]').getByRole('complementary',{name:'Comments and conversation'});await expect(comments).toBeVisible();
    await page.keyboard.press('Control+Alt+b');await expect(comments).toBeHidden();
    await page.keyboard.press('Control+Shift+p');await palette.fill('Keyboard shortcuts');await page.keyboard.press('Enter');
    const settings=page.getByRole('dialog',{name:'Keyboard shortcuts'});await expect(settings).toBeVisible();
    await settings.getByRole('textbox',{name:'Open surface shortcut',exact:true}).fill('Mod+o');await settings.getByRole('button',{name:'Close',exact:true}).click();
    await page.keyboard.press('Control+o');await expect(search).toBeVisible();await page.screenshot({path:join(output,`palette-${mobile?'phone':'desktop'}.png`)});await page.keyboard.press('Escape');
    await page.reload();await expect(page.frameLocator('iframe[title="beta"]').getByRole('textbox',{name:'Draft'})).toBeVisible();await page.keyboard.press('Control+o');await expect(search).toBeVisible();await page.keyboard.press('Escape');
    await page.getByRole('tab',{name:'alpha',exact:true}).click();await expect(page.getByRole('tab',{name:'alpha',exact:true})).toHaveAttribute('aria-selected','true');
    await page.getByRole('tab',{name:'beta',exact:true}).click();await page.goBack();await expect(page.getByRole('tab',{name:'alpha',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByRole('tab',{name:'beta',exact:true})).toHaveCount(1);
    await page.screenshot({path:join(output,`workbench-${mobile?'phone':'desktop'}.png`)});
    for(const name of ['gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu','nu','xi','omicron','pi']){await page.keyboard.press('Control+o');await search.fill(name);await page.keyboard.press('Enter');}
    const strip=page.getByRole('tablist',{name:'Open surfaces'});await expect.poll(()=>strip.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeGreaterThan(0);
    await strip.evaluate(node=>node.scrollLeft=0);await strip.hover();await page.mouse.wheel(0,200);await expect.poll(()=>strip.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Workbench: quick open, commands, independent panes, resizing, restore, status visibility and iframe command routing passed.');
} finally {await browser.close(); await app.stop(); rmSync(f.directory,{recursive:true,force:true});}
