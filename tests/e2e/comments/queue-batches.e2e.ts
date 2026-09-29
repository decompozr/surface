import { verifyEdgeSwipes } from './edge-swipes.ts';
/** Real browser/HTTP/store/SSE; isolated provider protocol fixture, never a real agent socket. */
import { chromium, webkit, devices, expect } from '@playwright/test';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';

import { existsSync, realpathSync, rmSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const installedCLI = async (...args: string[]) => {
  const env: Record<string, string | undefined> = { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', SURFACE_HOME: installedHome };
  delete env.SURFACE_STATE_DIR;
  const child = Bun.spawn([join(installedHome!, 'bin/surface'), ...args], { cwd: project, env, stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (code) throw new Error(err + out);
  return JSON.parse(out);
};

const root = process.cwd();
const output = resolve(process.env.COMMENTS_E2E_OUTPUT ?? '.decompozr/surface/comments-full-e2e'); mkdirSync(output, { recursive: true });
const project = realpathSync(mkdtempSync(join(tmpdir(), 'surface-mounted-project-')));
const installedHome = process.env.COMMENTS_E2E_INSTALLED_HOME && realpathSync(process.env.COMMENTS_E2E_INSTALLED_HOME);
if (installedHome && JSON.parse(readFileSync(join(installedHome, 'e2e-fixture.json'), 'utf8')).purpose !== 'isolated-release-verification') throw new Error('Installed E2E requires an explicitly marked isolated installation.');
const state = installedHome ? join(installedHome, 'state') : realpathSync(mkdtempSync(join(tmpdir(), 'surface-loop-')));
const socket = join(state, 'fixture.sock');
const http = createServer(); const ws = new WebSocketServer({ server: http });
const interactionModule = 'virtual:surface-interactions';
const interactionFactory = 'createInteractionClient';
const activeRecipient = process.env.COMMENTS_E2E_ACTIVE !== '0';
let activeTurn = 'fixture-active-1';
let deliveries: { method: string; params: any }[] = [];
ws.on('connection', client => client.on('message', raw => {
  const message = JSON.parse(raw.toString()); if (message.id === undefined) return;
  let result: unknown;
  if (message.method === 'initialize') result = {};
  else if (message.method === 'thread/read') result = { thread: { id: 'e2e-fixture', cwd: project, status: { type: activeRecipient ? 'active' : 'idle' } } };
  else if (message.method === 'thread/turns/list') result = { data: [{ id: activeTurn, status: 'inProgress' }] };
  else if (message.method === 'turn/steer') { deliveries.push(message); result = { turnId: activeTurn }; }
  else if (message.method === 'thread/queue/add') { deliveries.push(message); result = { queuedSubmission: { id: `queue-${deliveries.length}` } }; }
  else if (message.method === 'turn/start') { deliveries.push(message); result = { turn: { id: `fixture-turn-${deliveries.length}`, status: 'completed' } }; }
  else { client.send(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Fixture does not implement ' + message.method } })); return; }
  client.send(JSON.stringify({ id: message.id, result }));
}));
await new Promise<void>(r => http.listen(socket, r));
mkdirSync(join(project, 'ui/routes/second'), { recursive: true });
writeFileSync(join(project, 'ui/package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
writeFileSync(join(project, 'ui/surface.json'), JSON.stringify({ framework: 'svelte', components: 'routes', routes: 'routes' }));
writeFileSync(join(project, 'ui/routes/+page.svelte'), `<script>
import { ${interactionFactory} as createInteractionClient } from '${interactionModule}';
let count = $state(0), domainMessage = $state(''), domainReply = $state('');
const sendDomain = async () => {
 const client = createInteractionClient();
 const result = await client.submit({ domainChoice: 'keep' }, crypto.randomUUID());
 domainMessage = result.response?.status;
 domainReply = (await client.waitForResult()).message;
}
</script>
<main style="padding:24px;max-width:720px">
<h1 id="headline">Ordinary project page</h1>
<section id="option-a"><h2>Project-owned content</h2><p>Review this ordinary mounted content.</p></section>
<button onclick={() => count++}><span>Project counter {count}</span></button>
<input aria-label="Project draft" /><button onclick={sendDomain}>Send domain choice</button><p data-testid="domain-status">{domainMessage}</p><p data-testid="domain-result">{domainReply}</p>
<div style="height:1200px">Scroll content</div>
</main>`);
writeFileSync(join(project, 'ui/routes/second/+page.svelte'), '<h1 id="headline">Second page</h1>');
const surfaceId = crypto.randomUUID();
writeFileSync(join(project, 'surface.project.json'), JSON.stringify({ version: 1, projectId: crypto.randomUUID(), name: `Mounted comments ${project.slice(-6)}`, surfaces: [{ id: surfaceId, name: 'Review', source: 'ui', archived: false }] }));
const git = Bun.spawn(['git', 'init', '-q', project]); if (await git.exited) throw new Error('Fixture Git init failed');
const release = resolve(process.env.COMMENTS_E2E_APP_DIR!);
let app: { origin: string; stop(): Promise<unknown> } | undefined;
try {

const api = async (path: string, data?: unknown) => {
  const response = await fetch(origin + path, { method: data === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${management}`, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const value = await response.json(); expect(response.ok, JSON.stringify(value)).toBe(true); return value;
};

if (installedHome) {
  const selected = JSON.parse(readFileSync(join(installedHome, 'active.json'), 'utf8'));
  expect(realpathSync(release)).toBe(realpathSync(join(installedHome, 'releases', selected.release, 'apps/surface')));
  await installedCLI('start', '--port', process.env.COMMENTS_E2E_INSTALLED_PORT ?? '0');
  app = { origin: JSON.parse(readFileSync(join(state, 'connection.json'), 'utf8')).origin, stop: () => installedCLI('stop') };
} else {
  const { startSurfaceApp } = await import(join(release, 'src/lib/server/host/host.ts'));
  app = await startSurfaceApp({ stateDir: state, dataRoot: join(state, 'data'), port: 0 });
}
if (!app) throw new Error("Fixture host did not start.");
const origin = app.origin;
const management = JSON.parse(readFileSync(join(state, 'connection.json'), 'utf8')).token;
if (installedHome) await installedCLI('project', 'register');
else await api('/api/v1/projects/operations', { operation: 'register', projectRoot: project });
const mount = (installedHome ? await installedCLI('project', 'mount', '--surface', surfaceId) : await api('/api/v1/projects/operations', { operation: 'mount', projectRoot: project, surfaceId })).data;
const binding = installedHome ? await installedCLI('bind', '--project', project, '--thread', 'e2e-fixture', '--socket', socket) : await api('/api/bindings', { projectRoot: project, threadId: 'e2e-fixture', socketPath: socket });
const input = { bindingId: binding.id, namespace: mount.namespace, name: mount.name, component: 'routes/+page.svelte', title: 'Mounted page comments', schema: { type: 'object', required: ['domainChoice'], properties: { domainChoice: { type: 'string' } }, additionalProperties: false } };
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();
    const parent=await api('/api/requests',input);
    const url=new URL(parent.previewUrl);url.hash='token='+parent.token;
    await page.goto(url.href);
    for(let i=0;i<2;i++) {
      const close=page.getByRole('button',{name:'Close comments',exact:true});if(await close.isVisible())await close.click();
      const select=page.getByRole('button',{name:'Select and comment',exact:true});if(await select.isVisible())await select.click();
      await page.locator('#headline').click();
      await page.getByRole('button',{name:'Comment on selected element',exact:true}).click();
      await page.getByRole('textbox',{name:'Comment on selected element',exact:true}).fill('Queued fixture '+i);
      await page.getByRole('button',{name:'Add comment to draft',exact:true}).click();
      await page.getByRole('button',{name:/Open comments/}).click();
      const steer=page.getByRole('switch',{name:'Steer delivery',exact:true});if(await steer.isChecked())await page.locator('label').filter({has:steer}).click();
      activeTurn='changed-before-send-'+i;
      await page.getByRole('button',{name:'Send 1 comments together',exact:true}).click();
      await expect.poll(()=>deliveries.length).toBe(i+1);
      await expect(page.getByText('Waiting for reply…',{exact:true})).toHaveCount(i+1);
    }
    expect(deliveries.every(d=>d.method==='thread/queue/add')).toBe(true);
    console.log('Two independent batches queued with no reply; fresh turn observed on each send.');
  } finally {await browser.close();}
} finally { await app?.stop(); ws.close(); http.close(); rmSync(project, { recursive: true, force: true }); if (!installedHome) rmSync(state, { recursive: true, force: true }); }
