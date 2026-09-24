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
  await expect(page.getByRole('button',{name:'Leave comment mode',exact:true})).toBeEnabled();
  // The paragraph has enough room above it to test unclamped tracking after density changes.
  await page.locator('#description').click();
  const tools=page.getByRole('toolbar',{name:'Selected element actions'});
  const root=page.locator('.selection-tools');
  await expect(tools).toBeVisible();
  await page.mouse.move(880,20);
  await page.waitForTimeout(80);
  const before=await root.boundingBox();
  await page.locator('#description').hover();
  await page.waitForTimeout(80);
  const hover=await root.boundingBox();
  expect(hover!.x).toBeCloseTo(before!.x,1); expect(hover!.y).toBeCloseTo(before!.y,1);
  expect(await root.evaluate(el=>getComputedStyle(el).top)).toBe('0px');
  expect(await root.evaluate(el=>getComputedStyle(el).willChange)).toBe('transform');
  expect(await root.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
  // Distinguish the mounted node from a recreated toolbar after clipping.
  await root.evaluate(el=>el.setAttribute('data-observed-node','retained'));
  await page.mouse.move(880,20);
  const positions:number[]=[];
  for (const scroll of [10,20,30,40,50,60]) {
   await page.locator('#comment-workspace').evaluate((el,y)=>{el.scrollTop=y;},scroll);
   await expect.poll(async()=>Math.abs((await root.boundingBox())!.y-(before!.y-scroll))).toBeLessThan(1);
   positions.push((await root.boundingBox())!.y);
  }
  for(let i=1;i<positions.length;i++)expect(positions[i-1]-positions[i]).toBeCloseTo(10,1);
  await page.locator('#comment-workspace').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect(tools).toHaveCount(0); // hidden from accessibility, still mounted
  await expect(root).toHaveCount(1);
  await page.locator('#comment-workspace').evaluate(el=>{el.scrollTop=0;});
  await expect(tools).toBeVisible();
  await expect(root).toHaveAttribute('data-observed-node','retained');
  await page.screenshot({path:`${output}/${name}-selected-toolbar.png`});
  expect(errors).toEqual([]);
  console.log(`${name}: PASS stable selection anchor, monotonic scroll tracking, retained toolbar, transform positioning`);
 } catch (error) { await page.screenshot({path:`${output}/${name}-failure.png`}); throw error; } finally {await context.tracing.stop({path:`${output}/${name}-trace.zip`}); await browser.close();}
}
