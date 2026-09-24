import { chromium } from '@playwright/test';
import { parseArgs } from 'node:util';
import { join, resolve } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { startSingleton } from '@decompozr/surface-app/server/host/runtime';
import { CodexRpc } from '@decompozr/surface-app/server/agent-adapters/rpc';
const { values } = parseArgs({ options: { live: { type: 'boolean' }, project: { type: 'string' }, thread: { type: 'string' }, socket: { type: 'string' } } });
if (!values.live || !values.project || !values.thread || !values.socket) throw new Error('Explicit live gate: --live --project CANONICAL_PROJECT --thread EXISTING_THREAD --socket EXISTING_SOCKET. This sends one authorized source-edit request to that exact session.');
const project = realpathSync(resolve(values.project)), threadId = values.thread, socketPath = resolve(values.socket);
const evidence = join(process.cwd(), '.decompozr/surface/live-source-edit');
mkdirSync(evidence, { recursive: true });
if (existsSync(join(evidence, 'request.json'))) throw new Error('Existing request receipt: reconcile it before another live invocation.');
const fixture = join(project, '.decompozr/surface/live-edit-proof'), source = join(fixture, 'source'), neighborSource = join(fixture, 'neighbor');
const stateDir = join(evidence, 'state'), componentPath = join(source, 'src/Layout.svelte');
const rpc = await CodexRpc.connect(socketPath);
let app: Awaited<ReturnType<typeof startSingleton>> | undefined, browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function cli(...args: string[]) {
  const child = Bun.spawn([process.execPath, join(process.cwd(), 'apps/cli/src/runtime.ts'), ...args, '--state-dir', stateDir], { stdout: 'pipe', stderr: 'pipe' });
  const [out, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code) throw new Error(`CLI ${args[0]} failed: ${error} ${out}`); return JSON.parse(out);
}
try {
  const { thread } = await rpc.call<any>('thread/read', { threadId, includeTurns: false });
  assert(thread.id === threadId && realpathSync(thread.cwd) === project, 'Session project identity mismatch.');
  assert(['idle', 'notLoaded'].includes(thread.status.type), 'Exact target is not idle/unloaded; do not collide with another turn.');
  for (const folder of [source, neighborSource]) { mkdirSync(join(folder, 'src'), { recursive: true }); writeFileSync(join(folder, 'package.json'), JSON.stringify({ name: folder === source ? 'live-edit-source' : 'live-edit-neighbor', private: true, type: 'module', dependencies: { svelte: '5.57.1' } })); }
  const initial = `<script>
import { onMount } from 'svelte';
import { previewState } from 'virtual:surface-preview';
import { createSurfaceClient } from 'virtual:surface-client';
const draft = previewState('unrelated-draft', '', 1);
const responseId = previewState('response-id', crypto.randomUUID(), 1);
const client = createSurfaceClient();
let request = $state(null), failure = $state('');
async function refresh(){try{request=await client.read()}catch(error){failure=String(error)}}
async function submit(){try{request=await client.submit({columns:2,sourcePath:${JSON.stringify(componentPath)},automated:true},$responseId)}catch(error){failure=String(error)}}
onMount(()=>{void refresh();const timer=setInterval(refresh,300);return()=>clearInterval(timer)});
</script>
<main><h1>Live agent layout edit</h1><div class="cards" data-testid="cards"><section><h2>Unrelated draft</h2><input aria-label="Keep this draft" bind:value={$draft}/></section><section><h2>Requested layout</h2><p>Ask the bound agent to change this source to two equal columns.</p><button disabled={!request||!!request.response} onclick={submit}>Request two columns</button></section></div><p data-testid="status">{request?.response?.status ?? 'pending'}</p><p data-testid="result">{request?.result?.message ?? ''}</p><p>{failure}</p></main>
<style>:global(body){margin:0;background:#f4f5ef;color:#173e31;font:16px system-ui}main{max-width:900px;margin:40px auto;padding:24px}.cards{display:grid;grid-template-columns:1fr;gap:24px}section{padding:24px;background:white;border:1px solid #c3d0c7;border-radius:12px}input,button{font:inherit;padding:12px;max-width:100%;box-sizing:border-box}button{background:#173e31;color:white;border:0}</style>`;
  writeFileSync(componentPath, initial);
  writeFileSync(join(neighborSource, 'src/Counter.svelte'), `<script>import {previewState} from 'virtual:surface-preview';const count=previewState('counter',0);</script><h1>Unaffected neighbor</h1><button onclick={()=> $count++}>Count {$count}</button>`);
  app = await startSingleton({ stateDir, port: 0 });
  await cli('namespace', 'live-edit'); await cli('namespace', 'neighbor');
  const mount = await cli('mount', source, '--project', project, '--namespace', 'live-edit', '--name', 'layout');
  const neighborMount = await cli('mount', neighborSource, '--project', project, '--namespace', 'neighbor', '--name', 'counter');
  const binding = await cli('bind', '--project', project, '--thread', threadId, '--socket', socketPath);
  const schema = join(evidence, 'schema.json'); writeFileSync(schema, JSON.stringify({ type: 'object', additionalProperties: false, required: ['columns', 'sourcePath', 'automated'], properties: { columns: { const: 2 }, sourcePath: { const: componentPath }, automated: { const: true } } }));
  const request = await cli('request', '--binding', binding.id, '--namespace', 'live-edit', '--name', 'layout', '--component', 'src/Layout.svelte', '--schema-file', schema, '--title', 'Authorized automated experiment: edit only sourcePath from one to two equal CSS columns; preserve all other code/stores. Then publish message, columns:2, sourcePath via result CLI.');
  writeFileSync(join(evidence, 'request.json'), JSON.stringify(request, null, 2), { mode: 0o600 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 } }), neighbor = await browser.newPage();
  await page.goto(request.previewUrl); await neighbor.goto(neighborMount.previewUrl + '?component=src%2FCounter.svelte');
  await page.getByRole('textbox').fill('Unsent draft must survive the agent edit');
  await page.evaluate(() => { (window as any).proofMarker = 'same-live-document'; });
  await neighbor.evaluate(() => { (window as any).proofMarker = 'same-neighbor-document'; });
  await neighbor.getByRole('button').click();
  const columnCount = () => page.getByTestId('cards').evaluate(node => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
  assert(await columnCount() === 1, 'Initial source does not render one column.');
  await page.screenshot({ path: join(evidence, 'before.png'), fullPage: true });
  const fresh = await rpc.call<any>('thread/read', { threadId, includeTurns: false });
  assert(['idle', 'notLoaded'].includes(fresh.thread.status.type) && realpathSync(fresh.thread.cwd) === project, 'Target changed before submission; do not deliver.');
  await page.getByRole('button', { name: 'Request two columns' }).click();
  await page.getByTestId('status').filter({ hasText: 'accepted' }).waitFor({ timeout: 60000 });
  const accepted = await cli('inspect', '--request', request.id);
  assert(accepted.response.receipt.mode === 'start', 'Expected same-thread idle continuation.');
  console.log(JSON.stringify({ stage: 'accepted', threadId, requestId: request.id, receipt: accepted.response.receipt }));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="cards"]')!).gridTemplateColumns.trim().split(/\s+/).length === 2, null, { timeout: 180000 });
  await page.getByTestId('result').filter({ hasText: /\S/ }).waitFor({ timeout: 180000 });
  const completed = await cli('inspect', '--request', request.id), after = readFileSync(componentPath, 'utf8');
  assert(after !== initial, 'Agent result did not correspond to an observed source edit.');
  assert(after.match(/<script>[\s\S]*?<\/script>/)?.[0] === initial.match(/<script>[\s\S]*?<\/script>/)?.[0], 'Agent changed unrelated component logic.');
  assert(completed.result.columns === 2 && completed.result.sourcePath === componentPath, 'Result does not identify actual change/source.');
  assert(await page.evaluate(() => (window as any).proofMarker) === 'same-live-document', 'Source edit caused a full document refresh.');
  assert(await page.getByRole('textbox').inputValue() === 'Unsent draft must survive the agent edit', 'Live source edit lost unrelated opted-in draft.');
  assert(await neighbor.evaluate(() => (window as any).proofMarker) === 'same-neighbor-document', 'Neighbor refreshed.');
  await neighbor.getByRole('button', { name: 'Count 1' }).click(); await neighbor.getByRole('button', { name: 'Count 2' }).waitFor();
  await page.screenshot({ path: join(evidence, 'after.png'), fullPage: true });
  let turn: any;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const turns = await rpc.call<any>('thread/turns/list', { threadId, limit: 5, sortDirection: 'desc', itemsView: 'full' });
    turn = turns.data.find((item: any) => item.id === accepted.response.receipt.turnId);
    if (turn?.status === 'completed') break;
    await Bun.sleep(500);
  }
  assert(turn?.status === 'completed', 'Exact accepted turn did not complete.');
  const resultCommand = turn.items.find((item: any) => item.type === 'commandExecution' && item.command.includes(request.id) && item.command.includes(' result ') && item.exitCode === 0);
  assert(resultCommand, 'No successful actual result CLI execution observed in exact accepted turn.');
  const editItems = turn.items.filter((item: any) => JSON.stringify(item).includes(componentPath) && (item.type === 'fileChange' || (item.type === 'commandExecution' && item.exitCode === 0 && /write_bytes|write_text|writeFile|apply_patch|sed -i|perl -pi/.test(item.command))));
  assert(editItems.length > 0, 'Cannot attribute source edit to exact accepted agent turn.');
  writeFileSync(join(evidence, 'turn.json'), JSON.stringify(turn, null, 2), { mode: 0o600 });
  writeFileSync(join(evidence, 'result.json'), JSON.stringify({ at: new Date().toISOString(), threadId, requestId: request.id, turnId: turn.id, liveAgent: true, automatedBrowserSubmission: true, personalUserChoice: false, sourceChanged: true, beforeHash: createHash('sha256').update(initial).digest('hex'), afterHash: createHash('sha256').update(after).digest('hex'), renderedColumns: await columnCount(), sameDocument: true, draftRetained: true, neighborInteractive: true, actualResultCliExitCode: resultCommand.exitCode, result: completed.result }, null, 2));
  console.log('PASS: exact-session live agent edited source; HMR retained draft and document; actual CLI result rendered.');
} finally { rpc.close(); await browser?.close(); await app?.stop(); }
