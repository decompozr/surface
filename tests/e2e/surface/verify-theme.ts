import assert from 'node:assert/strict';
import {chromium,webkit,devices,expect} from '@playwright/test';
import {mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {startSurfaceApp as StartSurfaceApp} from '@decompozr/surface-app/server/host/host';
import {workspaceFixture} from './workspace-fixture.ts';
const appDirectory=process.env.COMMENTS_E2E_APP_DIR;
if(!appDirectory)throw Error('Specify immutable COMMENTS_E2E_APP_DIR.');
const {startSurfaceApp}:{startSurfaceApp:typeof StartSurfaceApp}=await import(pathToFileURL(join(resolve(appDirectory),'src/lib/server/host/host.ts')).href);
const fixture=await workspaceFixture();
mkdirSync(join(fixture.main,'ui/routes/theme'),{recursive:true});
writeFileSync(join(fixture.main,'ui/routes/theme/+page.svelte'),'<h1>Authored content</h1><style>:global(body){background:#f7f7ef}h1{background:#f7f7ef;color:#252820}</style>');
const app=await startSurfaceApp({...fixture,port:0});
const output=process.env.SURFACE_EDITOR_OUTPUT??'/tmp/surface-theme-review';mkdirSync(output,{recursive:true});
try{
 for(const operation of ['register','mount'] as const)assert.ok((await app.projectOperation({operation,projectRoot:fixture.main,...(operation==='mount'?{surfaceId:fixture.surfaceId}:{})})).ok);
 for(const [name,engine] of [['desktop',chromium],['phone',webkit]] as const){
  const browser=await engine.launch();try{
   const context=await browser.newContext(name==='phone'?{...devices['iPhone 13'],colorScheme:'dark'}:{viewport:{width:1440,height:1000},colorScheme:'dark'});
   const page=await context.newPage();await page.goto(app.origin);await page.waitForFunction(()=>localStorage.getItem('surface.workbench.v1'));
   const command=async(label:string)=>{await page.getByRole('button',{name:'Open surface',exact:true}).click();await page.getByRole('option',{name:'Commands >',exact:true}).click();await page.getByRole('combobox',{name:'Run command'}).fill(label);await page.getByRole('option',{name:label,exact:true}).click();};
   await command('Theme: Dark');
   await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
   const dark=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
   await page.getByRole('button',{name:'Open surface',exact:true}).click();await page.getByRole('combobox',{name:'Open surface'}).fill('theme');await page.keyboard.press('Enter');
   const source=await page.locator('iframe[title="theme"]').getAttribute('src');assert.ok(source);const url=new URL(source,app.origin);url.searchParams.delete('__surface_embedded');await page.goto(url.href);await expect(page.getByRole('heading',{name:'Authored content'})).toBeVisible();
   await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe(dark);
   assert.equal(await page.getByRole('heading',{name:'Authored content'}).evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(247, 247, 239)');
   assert.ok(await page.locator('meta[name="theme-color"]').getAttribute('content'));
   await page.getByRole('button',{name:'Toggle navigation'}).click();await page.waitForTimeout(250);
   await page.screenshot({path:join(output,`${name}-dark.png`)});await page.getByRole('button',{name:'Toggle navigation'}).click();
   await page.reload();await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
   await command('Theme: Light');await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)).toBe('light');
   const light=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);assert.notEqual(light,dark);
   await page.screenshot({path:join(output,`${name}-light.png`)});
   await command('Theme: System');await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe(dark);
   await page.emulateMedia({colorScheme:'light'});await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe(light);
   console.log(`${name}: persisted themes and system changes passed`);
  }finally{await browser.close();}
 }
}finally{await app.stop();rmSync(fixture.directory,{recursive:true,force:true});}
