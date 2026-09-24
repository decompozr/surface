import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentAdapter } from '@decompozr/surface-app/server/agent-adapters/codex';
import { startKitFoundation } from './server.ts';

const cli = async (...args: string[]): Promise<any> => {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, '../../apps/cli/src/runtime.ts'), ...args, '--state-dir', stateDir], { stdout: 'pipe', stderr: 'pipe' });
  const [out, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  assert(code === 0, `Singleton ${args[0]} failed: ${error}\n${out}`);
  return JSON.parse(out);
};


const project = (name: string, nanoid: string) => {
  const root = join(directory, name), source = join(root, 'panels');
  mkdirSync(join(source, 'src'), { recursive: true });
  writeFileSync(join(source, 'package.json'), JSON.stringify({ name, private: true, type: 'module', dependencies: { svelte: '5.57.1', nanoid } }));
  writeFileSync(join(source, 'src/Form.svelte'), form);
  projects.set(`fixture-${name}`, root);
  return { root, source, component: join(source, 'src/Form.svelte') };
};

const assert: (condition: unknown, message: string) => asserts condition = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };

const observed = (message: string) => { observations.push(message); console.log(message); };


// Automated fixture inputs only. This does not contact a live model session.
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'surface-kit-'))), stateDir = join(directory, 'state');
const evidenceDir = join(import.meta.dir, '../../.decompozr/surface/sveltekit-proof');
mkdirSync(evidenceDir, { recursive: true });
const socketPath = join(directory, 'fixture.sock');
const socket = createServer(connection => connection.end());
await new Promise<void>((resolve, reject) => { socket.once('error', reject); socket.listen(socketPath, resolve); });
const observations: string[] = [], moduleURLs = new Set<string>();
const deliveries: { threadId: string; requestId: string; data: { label: string } }[] = [];
const projects = new Map<string, string>();
const adapter: AgentAdapter = {
  async inspect(binding) {
    if (projects.get(binding.threadId) !== binding.projectRoot) throw new Error('Wrong fixture session/project.');
    return { status: 'idle' };
  },
  async deliver(binding, message) {
    await this.inspect(binding);
    deliveries.push({ threadId: binding.threadId, ...JSON.parse(message.split('\n')[1]!) });
    assert(message.includes('apps/cli/src/runtime.ts') && message.includes(stateDir), 'Callback is not routed to the shared interaction core.');
    return { mode: 'start', turnId: `fixture-turn-${deliveries.length}` };
  },
};
const baseForm = readFileSync(join(import.meta.dir, '../../tests/e2e/runtime/fixtures/InteractionForm.svelte'), 'utf8');
const form = baseForm.replace('<script lang="ts">', '<script lang="ts">\nimport { nanoid } from "nanoid";\nimport dependency from "../node_modules/nanoid/package.json";\nconst generated = nanoid();').replace('<main>', '<main><p data-testid="dependency">{dependency.version}</p><p data-testid="generated">{generated}</p>');
const alpha = project('alpha', '4.0.2'), beta = project('beta', '5.1.5');
const schemaPath = join(directory, 'schema.json');
writeFileSync(schemaPath, JSON.stringify({ type: 'object', additionalProperties: false, required: ['label'], properties: { label: { type: 'string', minLength: 1 } } }));
let app: Awaited<ReturnType<typeof startKitFoundation>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  app = await startKitFoundation({ stateDir, port: 0, adapter });
  const initialVite = app.vite, initialInstance = app.instanceId;
  assert(initialVite.httpServer === null, 'Component compiler opened another HTTP listener.');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const errors: string[] = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  context.on('request', request => { if (request.url().includes('/nanoid/')) moduleURLs.add(request.url()); });
  const dashboard = await context.newPage();
  await dashboard.goto(app.origin + '/');
  await dashboard.getByRole('heading', { name: 'SvelteKit singleton foundation' }).waitFor();
  await dashboard.getByTestId('empty').waitFor();
  const emptyStatus = await fetch(app.origin + '/kit-api/status').then(response => response.json()) as any;
  assert(emptyStatus.pid === app.pid && emptyStatus.mounts.length === 0, 'Kit initial endpoint should show this process and no mounts.');
  writeFileSync(join(stateDir, 'registry.json'), '{broken');
  assert((await fetch(app.origin + '/kit-api/status')).status === 500, 'Malformed registry falsely reported a healthy empty catalog.');
  unlinkSync(join(stateDir, 'registry.json'));
  observed('Built SvelteKit SSR management page and read-only status API run before any mounts, on the singleton process/origin.');

  for (const [namespace, source] of [['design', alpha], ['analysis', beta]] as const) {
    await cli('namespace', namespace);
    const mounted = await cli('mount', source.source, '--project', source.root, '--namespace', namespace, '--name', 'panel');
    assert(mounted.status === 'ready', 'Mount failed: ' + mounted.error);
  }
  await dashboard.reload();
  assert(await dashboard.getByTestId('mount').count() === 2, 'Kit page did not discover runtime mounts.');
  assert(app.vite === initialVite && app.instanceId === initialInstance, 'Mount replaced the shared compiler/server.');
  const aBinding = await cli('bind', '--project', alpha.root, '--thread', 'fixture-alpha', '--socket', socketPath);
  const bBinding = await cli('bind', '--project', beta.root, '--thread', 'fixture-beta', '--socket', socketPath);
  const request = (binding: string, namespace: string) => cli('request', '--binding', binding, '--namespace', namespace, '--name', 'panel', '--component', 'src/Form.svelte', '--schema-file', schemaPath, '--title', 'Kit foundation fixture');
  const a = await request(aBinding.id, 'design'), b = await request(bBinding.id, 'analysis');
  const pageA = await context.newPage(), pageB = await context.newPage();
  await pageA.goto(a.previewUrl); await pageB.goto(b.previewUrl);
  await pageA.getByTestId('dependency').filter({ hasText: '4.0.2' }).waitFor();
  await pageB.getByTestId('dependency').filter({ hasText: '5.1.5' }).waitFor();
  assert((await pageA.getByTestId('generated').textContent())?.length === 21, 'Alpha dependency did not execute.');
  assert((await pageB.getByTestId('generated').textContent())?.length === 21, 'Beta dependency did not execute.');
  assert([...moduleURLs].some(url => url.includes('/alpha/panels/node_modules/nanoid/')), 'Missing Alpha dependency source URL.');
  assert([...moduleURLs].some(url => url.includes('/beta/panels/node_modules/nanoid/')), 'Missing Beta dependency source URL.');
  observed('Two post-start CSR mounts execute nanoid 4.0.2 and 5.1.5 from independent source node_modules without replacing Vite or restarting Kit.');

  await pageA.getByRole('textbox').fill('Draft survives Kit-hosted update');
  await pageA.evaluate(() => { (window as any).documentMarker = 'alpha'; });
  await pageB.evaluate(() => { (window as any).documentMarker = 'beta'; });
  writeFileSync(alpha.component, form.replace('Singleton feedback', 'Kit component updated'));
  await pageA.getByRole('heading', { name: 'Kit component updated' }).waitFor();
  assert(await pageA.getByRole('textbox').inputValue() === 'Draft survives Kit-hosted update', 'HMR lost draft.');
  assert(await pageA.evaluate(() => (window as any).documentMarker) === 'alpha', 'HMR reloaded document.');
  writeFileSync(alpha.component, form + '\n<script>');
  await pageA.locator('#artifact-compiler-error').waitFor();
  assert(await pageB.locator('#artifact-compiler-error, vite-error-overlay').count() === 0, 'Compiler error affected another namespace.');
  await pageB.getByRole('textbox').fill('Neighbor remains usable');
  await pageB.getByRole('button', { name: 'Send feedback' }).click();
  await pageB.getByTestId('status').filter({ hasText: 'accepted' }).waitFor();
  assert(await pageB.evaluate(() => (window as any).documentMarker) === 'beta', 'Other namespace was refreshed.');
  await dashboard.reload(); await dashboard.getByRole('heading', { name: 'SvelteKit singleton foundation' }).waitFor();
  writeFileSync(alpha.component, form.replace('Singleton feedback', 'Kit component recovered'));
  await pageA.getByRole('heading', { name: 'Kit component recovered' }).waitFor();
  await pageA.locator('#artifact-compiler-error').waitFor({ state: 'detached' });
  assert(await pageA.getByRole('textbox').inputValue() === 'Draft survives Kit-hosted update', 'Recovery lost draft.');
  await pageA.screenshot({ path: join(evidenceDir, 'kit-draft-retained.png'), fullPage: true });
  observed('Compatible HMR and compile-error recovery retain opted-in draft/document; the other namespace submits and Kit management remains usable during failure.');

  await pageA.getByRole('button', { name: 'Send feedback' }).click();
  await pageA.getByTestId('status').filter({ hasText: 'accepted' }).waitFor();
  const saved = await cli('inspect', '--request', a.id);
  assert(saved.response.data.label === 'Draft survives Kit-hosted update', 'Wrong response persisted.');
  assert(deliveries.find(item => item.requestId === a.id)?.threadId === 'fixture-alpha', 'Wrong fixture session received response.');
  await cli('result', '--request', a.id, '--data', '{"message":"Kit foundation callback complete"}');
  await pageA.getByTestId('result').filter({ hasText: 'Kit foundation callback complete' }).waitFor();
  await pageA.reload();
  await pageA.getByTestId('result').filter({ hasText: 'Kit foundation callback complete' }).waitFor();
  assert(deliveries.length === 2, 'Reload resubmitted a response.');
  observed('The existing exact-binding interaction core delivers fixture data, actual CLI publication renders, and reload restores the result without resubmission.');

  const connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
  const statusText = await fetch(app.origin + '/kit-api/status').then(response => response.text());
  const html = await fetch(app.origin + '/manage').then(response => response.text());
  for (const secret of [connection.token, a.token, b.token, socketPath, 'fixture-alpha', 'fixture-beta', aBinding.id, bBinding.id, alpha.root, beta.root]) {
    assert(!statusText.includes(secret) && !html.includes(secret), 'Kit view leaked private state: ' + secret.slice(0, 8));
  }
  assert((await fetch(app.origin + '/api/mounts')).status === 401, 'Kit bypassed management authentication.');
  assert((await fetch(app.origin + '/kit-api/status', { method: 'POST' })).status === 405, 'Status API accepts mutations.');
  assert((await fetch(app.origin + '/kit-api/status', { headers: { origin: 'http://foreign.invalid' } })).status === 403, 'Kit bypassed origin guard.');
  assert((await fetch(app.origin + '/kit-api/status', { headers: { host: 'foreign.invalid' } })).status === 403, 'Kit bypassed host guard.');
  assert((await fetch(`${app.origin}/api/n/analysis/panel/requests/${a.id}`, { headers: { authorization: `Bearer ${a.token}` } })).status === 403, 'Wrong mount scope accepted request.');
  observed('Kit status/HTML expose only sanitized mount metadata; no management/request tokens, source roots, binding/session IDs or socket path. Core authentication and scope checks remain enforced.');
  await dashboard.screenshot({ path: join(evidenceDir, 'kit-management.png'), fullPage: true });
  await pageA.screenshot({ path: join(evidenceDir, 'kit-roundtrip.png'), fullPage: true });

  await cli('unmount', '--namespace', 'design', '--name', 'panel');
  await pageA.waitForFunction(() => document.body.textContent?.includes('Mount is not ready.')); // Wait for the expected unmount navigation before revisiting.
  assert((await fetch(new URL(a.previewUrl).origin + '/n/design/panel/')).status === 404, 'Unmount still serves preview.');
  await dashboard.reload();
  assert(await pageB.evaluate(() => (window as any).documentMarker) === 'beta', 'Unmount refreshed unrelated namespace.');
  const statuses = await dashboard.getByTestId('mount-status').allTextContents();
  assert(statuses.includes('unmounted') && statuses.includes('ready'), 'Kit lifecycle view is stale.');
  const remounted = await cli('mount', alpha.source, '--project', alpha.root, '--namespace', 'design', '--name', 'panel');
  assert(remounted.status === 'ready', 'Remount failed: ' + remounted.error);
  await pageA.goto(a.previewUrl);
  await pageA.reload(); // The capability fragment can make revisiting an unavailable page a same-document navigation.
  await pageA.getByTestId('result').filter({ hasText: 'Kit foundation callback complete' }).waitFor();
  assert(app.vite === initialVite && app.vite.httpServer === null && app.instanceId === initialInstance, 'Lifecycle changed singleton topology.');
  const listenerCheck = Bun.spawn(['/usr/sbin/lsof', '-nP', '-a', '-p', String(app.pid), '-iTCP', '-sTCP:LISTEN', '-Fn'], { stdout: 'pipe', stderr: 'pipe' });
  const listenerOutput = await new Response(listenerCheck.stdout).text(); await listenerCheck.exited;
  const listeners = [...new Set(listenerOutput.split('\n').filter(line => line.startsWith('n')).map(line => line.slice(1)))];
  assert(listeners.length === 1 && listeners[0] === new URL(app.origin).host, 'Expected exactly one TCP listener: ' + listeners.join(', '));
  assert(errors.length === 0, errors.join('\n'));
  observed('Unmount/re-mount updates Kit routes and restores interactions without restarting or reloading the neighboring namespace; lsof observes exactly one TCP listener and the same Vite middleware instance.');
  writeFileSync(join(evidenceDir, 'result.json'), JSON.stringify({ at: new Date().toISOString(), liveAgent: false, application: 'built-sveltekit-handler', previewRendering: 'CSR', compiler: 'one Vite development instance', observations, moduleURLs: [...moduleURLs], listeners, versions: { kit: '2.70.3', adapterNode: '5.5.7', svelte: '5.57.1', vite: '8.3.0' } }, null, 2));
  console.log('PASS: SvelteKit singleton foundation experiment.');
} finally {
  await browser?.close(); await app?.stop();
  await new Promise<void>(resolve => socket.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
