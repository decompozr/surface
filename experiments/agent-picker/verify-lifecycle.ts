import {chromium} from '@playwright/test';
import {strict as assert} from 'node:assert';
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5198/experiments/agent-picker');
 const click=async(name:string,match:string)=>{await page.getByRole('button',{name,exact:true}).click();await page.waitForFunction(text=>document.querySelector('pre')?.textContent?.includes(text),match);};
 await click('Check recipient','fixture-a');await click('Disconnect','unknown');await click('Submit fixture','Draft was not submitted');
 await click('Reconnect','fixture-a');await click('New agent takes over','fixture-b');await click('Submit fixture','accepted');await click('Publish fixture result','Fixture agent processed');await click('New agent takes over','Reconcile');
 await click('Reset fixture','reset');await click('Lose acknowledgement','fixture-a');await click('Submit fixture','unknown');
 const before=JSON.parse(await page.locator('pre').innerText()).request.response.id;
 await click('Submit fixture','unknown');assert.equal(JSON.parse(await page.locator('pre').innerText()).request.response.id,before);
 await click('Reset fixture','reset');console.log('PASS browser lifecycle: offline gate, explicit takeover, accepted/result, pending outcome retained, fixture cleanup');
}finally{await browser.close();}
