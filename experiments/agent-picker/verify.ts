import {chromium} from '@playwright/test';
import {strict as assert} from 'node:assert';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();const a=await context.newPage(),b=await context.newPage();
 const url='http://127.0.0.1:5198/experiments/agent-picker';
 await a.goto(url);await b.goto(url);
 await a.locator('select').selectOption('fixture-a');await a.locator('textarea').fill('Draft A');
 await b.locator('select').selectOption('fixture-b');await b.locator('textarea').fill('Draft B');
 await a.waitForFunction(()=>sessionStorage.getItem('surface:experiment:demo:main:agent-picker')?.includes('Draft A'));
 await a.reload();await a.waitForFunction(()=>document.querySelector('textarea')?.value==='Draft A');
 assert.equal(await a.locator('select').inputValue(),'fixture-a');assert.equal(await b.locator('select').inputValue(),'fixture-b');
 await a.getByRole('link',{name:'Provider offline'}).click();await a.waitForURL('**scenario=offline');assert.equal(await a.locator('button').isDisabled(),true);assert.equal(await a.locator('textarea').inputValue(),'Draft A');
 await a.getByRole('link',{name:'Selected agent deleted'}).click();await a.waitForURL('**scenario=deleted');assert.equal(await a.locator('button').isDisabled(),true);assert.equal(await a.locator('select').inputValue(),'fixture-a');
 await a.locator('select').selectOption('fixture-c');await a.locator('button').click();assert.match(await a.locator('section').innerText(),/No request was created/);
 assert.equal(await b.locator('textarea').inputValue(),'Draft B');
 await a.screenshot({path:'/tmp/surface-agent-picker.png',fullPage:true});
 console.log('PASS: two-tab isolation, reload persistence, offline/deleted disable with draft preservation, explicit reselection; no delivery.');
}finally{await browser.close();}
