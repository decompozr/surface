import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const origin = process.env.COMMENTS_E2E_ORIGIN;
if (!origin?.startsWith('http://127.0.0.1:')) throw new Error('Isolated loopback fixture required');
const output = process.env.COMMENTS_E2E_OUTPUT ?? '.decompozr/surface/toolbar-scroll-fix-20260923/toolbar';
mkdirSync(output, { recursive: true });
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]] as const) {
 const browser = await engine.launch();
 const context = await browser.newContext({ viewport: { width: 900, height: 520 } });
 await context.route('**/experiments/comments/batch', route => route.abort());
 await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
 const page = await context.newPage();
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 try {
  await page.goto(origin+'/experiments/comments', {waitUntil:'networkidle'});
  const tools=page.getByRole('toolbar',{name:'Comment tools'});
  const root=page.getByRole('group',{name:'Comment tools position'});
  await expect(tools).toBeVisible();
  await expect(tools.getByRole('button')).toHaveCount(2);
  const before=await root.boundingBox();
  if (!before) throw new Error('Missing floating toolbar bounds');
  await root.evaluate(el=>el.setAttribute('data-observed-node','retained'));
  for (const scroll of [10,20,30,40,50,60,900]) {
   await page.locator('#comment-workspace').evaluate((el,y)=>{el.scrollTop=y;},scroll);
   await expect.poll(async()=> (await root.boundingBox())?.y).toBeCloseTo(before.y,1);
  }
  await expect(root).toHaveAttribute('data-observed-node','retained');
  const handle=page.getByRole('group',{name:'Move comment tools',exact:true});
  const grip=await handle.boundingBox();if(!grip)throw new Error('Visible drag handle missing');
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
  await page.mouse.down(); await page.mouse.move(grip.x+grip.width/2+120,grip.y+grip.height/2+70); await page.mouse.up();
  await expect.poll(async()=> (await root.boundingBox())?.x).toBeCloseTo(before.x + 120,1);
  await expect(tools.getByRole('button',{name:'Comment',exact:true})).toHaveAttribute('aria-pressed','false');
  await handle.focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(async()=> (await root.boundingBox())?.x).toBeCloseTo(before.x + 130,1);
  await page.reload();
  await expect.poll(async()=> (await root.boundingBox())?.x).toBeCloseTo(before.x + 130,1);
  await page.setViewportSize({width:320,height:400});
  await expect.poll(async()=> { const box=await root.boundingBox(); return !!box && box.x>=0 && box.x+box.width<=320 && box.y>=36 && box.y+box.height<=376; }).toBe(true);
  await expect(handle).toHaveCount(0);
  await expect.poll(async()=> {const r=await root.boundingBox();return r?400-r.y-r.height:0;}).toBeCloseTo(32,1);
  const fixed=await root.boundingBox();await page.locator('#comment-workspace').evaluate(el=>{el.scrollTop=0;});
  expect((await root.boundingBox())?.y).toBe(fixed?.y);
  await page.screenshot({path:`${output}/${name}-selected-toolbar.png`});
  expect(errors).toEqual([]);
  console.log(`${name}: PASS fixed toolbar during content scroll, pointer and keyboard movement, reload restoration, resize clamping`);
 } catch (error) { await page.screenshot({path:`${output}/${name}-failure.png`}); throw error; } finally {await context.tracing.stop({path:`${output}/${name}-trace.zip`}); await browser.close();}
}
