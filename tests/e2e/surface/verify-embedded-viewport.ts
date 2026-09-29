import assert from 'node:assert/strict';
import {chromium, webkit, devices, expect} from '@playwright/test';
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {startSurfaceApp as StartSurfaceApp} from '@decompozr/surface-app/server/host/host';
import {workspaceFixture} from './workspace-fixture.ts';
const appDirectory=process.env.COMMENTS_E2E_APP_DIR;
if(!appDirectory)throw Error('Specify an immutable COMMENTS_E2E_APP_DIR snapshot.');
const {startSurfaceApp}:{startSurfaceApp:typeof StartSurfaceApp}=await import(pathToFileURL(join(resolve(appDirectory),'src/lib/server/host/host.ts')).href);
const f=await workspaceFixture();
mkdirSync(join(f.main,'ui/routes/keyboard'),{recursive:true});
writeFileSync(join(f.main,'ui/routes/keyboard/+page.svelte'),'<h1 id="keyboard-target">Keyboard target</h1><div style="height:1800px">Long content</div>');
const app=await startSurfaceApp({...f,port:0});
const output=process.env.SURFACE_EDITOR_OUTPUT??'/tmp/surface-toolbar-review';mkdirSync(output,{recursive:true});
try{
 for(const operation of ['register','mount'] as const){const result=await app.projectOperation({operation,projectRoot:f.main,...(operation==='mount'?{surfaceId:f.surfaceId}:{})});assert.ok(result.ok);}
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]] as const){
  const browser=await engine.launch();
  try{
   const context=await browser.newContext(devices['iPhone 13']);
   await context.addInitScript(()=>{if(window.parent!==window)return;const viewport=Object.assign(new EventTarget(),{offsetLeft:0,offsetTop:0,width:innerWidth,height:innerHeight,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});});
   const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(app.origin);await page.waitForFunction(()=>localStorage.getItem('surface.workbench.v1')!==null);
   await page.getByRole('button',{name:'Open surface',exact:true}).click();await page.getByRole('combobox',{name:'Open surface'}).fill('keyboard');await page.keyboard.press('Enter');
   const frame=page.frameLocator('iframe[title="keyboard"]');const tools=frame.getByRole('toolbar',{name:'Comment tools',exact:true});await expect(tools).toBeVisible();
   const position=await tools.boundingBox();assert.ok(position);assert.ok(page.viewportSize());
   const resize=async(height:number,offsetTop=0)=>{await page.evaluate(({height,offsetTop})=>{const viewport=window.visualViewport;if(!viewport)throw Error('Missing viewport');Object.assign(viewport,{height,offsetTop});viewport.dispatchEvent(new Event('resize'));},{height,offsetTop});};
   await resize(350);
   await expect.poll(async()=>{const r=await tools.boundingBox();return r?Math.round(r.y+r.height):0;}).toBe(318);
   await tools.getByRole('button',{name:'Comment',exact:true}).click();await frame.locator('#keyboard-target').click();
   const field=frame.locator('#comment');await field.fill('Draft stays above outer keyboard');
   const editor=frame.getByRole('region',{name:'Comment on selected element',exact:true});const add=frame.getByRole('button',{name:'Add comment to draft'});
   await expect.poll(async()=>{const r=await editor.boundingBox();return {fits:!!r&&r.y>=36&&r.y+r.height<=350,bounds:r};},{message:'Composer above outer keyboard'}).toMatchObject({fits:true});
   const bounds=await field.boundingBox();assert.ok(bounds);assert.ok(bounds.y+bounds.height<=350);await expect(field).toBeFocused();
   await resize(280,70);await expect.poll(async()=>{const r=await add.boundingBox();return !!r&&r.y>=70&&r.y+r.height<=350;}).toBe(true);
   await expect(field).toHaveValue('Draft stays above outer keyboard');await page.screenshot({path:join(output,`${name}-embedded-keyboard.png`)});
   await field.press('Escape');await expect(tools).toBeVisible();
   await page.keyboard.press('Control+Shift+p');const commands=page.getByRole('combobox',{name:'Run command'});await commands.fill('Toggle status');await page.keyboard.press('Enter');
   await expect.poll(async()=>{const r=await tools.boundingBox();return r?Math.round(r.y+r.height):0;}).toBe(342);
   await page.screenshot({path:join(output,`${name}-embedded-toolbar.png`)});
   const viewportHeight=page.viewportSize()?.height;if(!viewportHeight)throw new Error('Missing outer viewport');
   await resize(viewportHeight,0);
   const savedPreferences=await page.evaluate(()=>localStorage.getItem('surface.workbench.v1'));
   await tools.getByRole('button',{name:'Fullscreen',exact:true}).click();
   const exit=page.getByRole('button',{name:'Exit fullscreen',exact:true});await expect(exit).toHaveCount(1);
   await expect(frame.getByRole('button',{name:'Exit fullscreen',exact:true})).toHaveCount(0);
   await expect(tools).toBeHidden();await expect(page.getByRole('button',{name:'Open surface',exact:true})).toBeHidden();
   await expect.poll(async()=>{const r=await page.locator('iframe[title="keyboard"]').boundingBox();return r ? {y:r.y,height:r.height} : null;},{message:'Fullscreen iframe fills outer viewport'}).toEqual({y:0,height:viewportHeight});
   await page.screenshot({path:join(output,`${name}-embedded-fullscreen.png`)});
   await exit.click();await expect(tools).toBeVisible();
   expect(await page.evaluate(()=>localStorage.getItem('surface.workbench.v1'))).toBe(savedPreferences);
   await expect(frame.getByRole('contentinfo',{name:'Connection status'})).toBeHidden();
   await frame.locator('#keyboard-target').click();await expect(field).toHaveValue('Draft stays above outer keyboard');
   await frame.locator('#comment').evaluate(()=>window.dispatchEvent(new CustomEvent('surface:execute',{detail:'fullscreen.toggle'})));
   await expect(editor).toBeHidden();await frame.locator('body').press('Escape');await expect(editor).toBeVisible();await expect(field).toHaveValue('Draft stays above outer keyboard');
   assert.deepEqual(errors,[]);console.log(`${name}: embedded toolbar and composer follow outer keyboard/pan; status visibility accounted for; draft retained`);
  }finally{await browser.close();}
 }
}finally{await app.stop();rmSync(f.directory,{recursive:true,force:true});}
