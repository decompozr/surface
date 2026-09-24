import { chromium, type Page } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeliveryError, type AgentAdapter, type Binding } from '@decompozr/surface-app/server/agent-adapters/codex';
import type { RequestRecord } from '@decompozr/surface-app/server/services/store';
import { startSingleton } from '@decompozr/surface-app/server/host/runtime';

// No live model calls: this regression proves singleton wiring, not provider behavior.
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'surface-interaction-')));
const stateDir = join(directory, 'state');
const evidenceDir = join(process.cwd(), '.decompozr/surface/singleton-interaction-proof');
mkdirSync(evidenceDir, { recursive: true });
const socketPath = join(directory, 'fixture.sock');
const socket = createServer(connection => connection.end());
await new Promise<void>((resolve, reject) => { socket.once('error', reject); socket.listen(socketPath, resolve); });
const observations: string[] = [];
const deliveries: { threadId: string; requestId: string; responseId: string; data: Record<string, unknown> }[] = [];
const projects = new Map<string, string>();
let releaseDelivery!: () => void, deliveryStarted!: () => void;
const deliveryGate = new Promise<void>(resolve => { releaseDelivery = resolve; });
const startedGate = new Promise<void>(resolve => { deliveryStarted = resolve; });
const adapter: AgentAdapter = {
  async inspect(binding: Binding) {
    if (projects.get(binding.threadId) !== binding.projectRoot) throw new Error('Fixture session unavailable or wrong project.');
    return { status: 'idle' };
  },
  async deliver(binding, message) {
    await this.inspect(binding);
    const data = JSON.parse(message.split('\n')[1]!);
    deliveries.push({ threadId: binding.threadId, ...data });
    if (data.data.label === 'held') { deliveryStarted(); await deliveryGate; }
    if (data.data.label === 'unavailable') throw new DeliveryError('Fixture session became unavailable.', 'failed');
    if (data.data.label === 'uncertain') throw new DeliveryError('Fixture transport disconnected after send.', 'unknown');
    if (!message.includes('apps/cli/src/runtime.ts') || !message.includes(stateDir)) throw new Error('Callback instructions target the wrong CLI/state.');
    return { mode: 'start', turnId: `fixture-turn-${deliveries.length}` };
  },
};
const form = readFileSync(join(import.meta.dir, 'fixtures/InteractionForm.svelte'), 'utf8');
function project(name: string) {
  const root = join(directory, name), source = join(root, 'panels');
  mkdirSync(join(source, 'src'), { recursive: true });
  writeFileSync(join(source, 'package.json'), JSON.stringify({ name, private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
  // Existing mounted sources keep working through compatibility aliases.
  const sourceForm = name === 'beta' ? form.replaceAll('virtual:surface-', 'virtual:artifact-').replaceAll('createSurfaceClient', 'createArtifactClient') : form;
  writeFileSync(join(source, 'src/Form.svelte'), sourceForm);
  projects.set(`fixture-${name}`, root);
  return { root, source, component: join(source, 'src/Form.svelte') };
}
const alpha = project('alpha'), beta = project('beta');
const schemaPath = join(directory, 'schema.json');
writeFileSync(schemaPath, JSON.stringify({ type: 'object', additionalProperties: false, required: ['label'], properties: { label: { type: 'string', minLength: 1 } } }));
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function observed(message: string) { observations.push(message); console.log(message); }
async function cli(...args: string[]): Promise<any> {
  const process = Bun.spawn([processExec(), join(globalThis.process.cwd(), 'apps/cli/src/runtime.ts'), ...args, '--state-dir', stateDir], { stdout: 'pipe', stderr: 'pipe' });
  const [out, error, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
  if (code !== 0) throw new Error(`Singleton ${args[0]} failed (${code}): ${error}\n${out}`);
  return JSON.parse(out);
}
function processExec() { return Bun.which('bun')!; }
type Created = RequestRecord & { previewUrl: string };
async function request(bindingId: string, namespace = 'design'): Promise<Created> {
  return cli('request', '--binding', bindingId, '--namespace', namespace, '--name', 'panel', '--component', 'src/Form.svelte', '--title', 'Fixture custom feedback', '--schema-file', schemaPath);
}
async function status(page: Page, value: string) {
  await page.waitForFunction(expected => document.querySelector('[data-testid="status"]')?.textContent === expected, value);
}
let app: Awaited<ReturnType<typeof startSingleton>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
async function api(record: Created, path = '', data?: unknown, scope = 'design', token = record.token) {
  return fetch(`${app!.origin}/api/n/${scope}/panel/requests/${record.id}${path}`, {
    method: data === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
try {
  app = await startSingleton({ stateDir, port: 0, adapter });
  await cli('namespace', 'design'); await cli('namespace', 'analysis');
  await cli('mount', alpha.source, '--project', alpha.root, '--namespace', 'design', '--name', 'panel');
  await cli('mount', beta.source, '--project', beta.root, '--namespace', 'analysis', '--name', 'panel');
  const bindingA = await cli('bind', '--project', alpha.root, '--thread', 'fixture-alpha', '--socket', socketPath);
  const bindingB = await cli('bind', '--project', beta.root, '--thread', 'fixture-beta', '--socket', socketPath);
  const a = await request(bindingA.id), b = await request(bindingB.id, 'analysis');
  assert(a.previewScope?.projectRoot === alpha.root && a.previewScope.source === alpha.source, 'Nested source must retain canonical parent project identity.');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const pageA = await context.newPage(), pageB = await context.newPage();
  const pageErrors: string[] = [];
  context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)));
  pageA.on('pageerror', error => pageErrors.push(error.message)); pageB.on('pageerror', error => pageErrors.push(error.message));
  await pageA.goto(a.previewUrl); await pageB.goto(b.previewUrl);
  await pageA.getByRole('button').waitFor(); await pageB.getByRole('button').waitFor();
  await pageA.getByRole('textbox').fill('Preserved custom response');
  await pageA.evaluate(() => { (window as any).documentMarker = 'original'; });
  await pageB.evaluate(() => { (window as any).documentMarker = 'other-namespace'; });
  writeFileSync(alpha.component, form.replace('Singleton feedback', 'Singleton feedback updated'));
  await pageA.getByRole('heading', { name: 'Singleton feedback updated' }).waitFor();
  assert(await pageA.getByRole('textbox').inputValue() === 'Preserved custom response', 'HMR lost unsent draft.');
  assert(await pageA.evaluate(() => (window as any).documentMarker) === 'original', 'HMR refreshed the document.');
  assert(deliveries.length === 0, 'Opening or editing a form delivered an unsolicited response.');
  observed('Canonical Surface imports and legacy Artifact compatibility imports both render scoped forms; ordinary HMR preserves the unsent draft without submitting.');

  writeFileSync(alpha.component, form + '\n<script>');
  await pageA.locator('#artifact-compiler-error').waitFor();
  assert(await pageB.locator('#artifact-compiler-error, vite-error-overlay').count() === 0, 'Compile diagnostic leaked to another namespace.');
  await pageB.getByRole('textbox').fill('Other namespace remains usable');
  await pageB.getByRole('button').click(); await status(pageB, 'accepted');
  writeFileSync(alpha.component, form.replace('Singleton feedback', 'Singleton feedback recovered'));
  await pageA.getByRole('heading', { name: 'Singleton feedback recovered' }).waitFor();
  await pageA.locator('#artifact-compiler-error').waitFor({ state: 'detached' });
  assert(await pageA.getByRole('textbox').inputValue() === 'Preserved custom response', 'Compile recovery lost unsent input.');
  await pageA.getByRole('button').click(); await status(pageA, 'accepted');
  let inspected = await cli('inspect', '--request', a.id);
  assert(inspected.response.data.label === 'Preserved custom response', 'Custom schema response was not persisted.');
  assert(deliveries.filter(item => item.requestId === a.id).length === 1, 'Originating request delivered incorrectly.');
  assert(deliveries.find(item => item.requestId === a.id)?.threadId === 'fixture-alpha', 'Wrong bound session received input.');
  await cli('result', '--request', a.id, '--data', JSON.stringify({ message: 'Confirmed preserved custom response', label: inspected.response.data.label }));
  await pageA.getByTestId('result').filter({ hasText: 'Confirmed preserved custom response' }).waitFor();
  await pageA.screenshot({ path: join(evidenceDir, 'roundtrip-alpha.png'), fullPage: true });
  await pageB.screenshot({ path: join(evidenceDir, 'independent-beta.png'), fullPage: true });
  observed('A local compile failure leaves the second namespace usable; recovery preserves draft, and actual CLI result publication appears in the originating browser.');

  const delivered = deliveries.length;
  const retry = await api(a, '/responses', { responseId: inspected.response.id, data: inspected.response.data });
  assert(retry.ok && deliveries.length === delivered, 'Identical retry was redelivered.');
  assert((await api(a, '/responses', { responseId: inspected.response.id, data: { label: 'changed' } })).status === 409, 'Changed data reused response ID.');
  assert((await api(a, '/responses', { responseId: crypto.randomUUID(), data: inspected.response.data })).status === 409, 'Second submission was accepted.');
  await pageA.reload(); await status(pageA, 'accepted');
  await pageA.getByTestId('result').filter({ hasText: 'Confirmed preserved custom response' }).waitFor();
  assert(deliveries.length === delivered, 'Reload resubmitted input.');
  assert(await pageA.getByRole('textbox').inputValue() === '', 'Full refresh retained ephemeral unsent draft.');
  observed('Persisted receipt/result survives reload without resubmission; exact duplicate is deduplicated and changed/new submissions are rejected.');

  assert((await api(a, '', undefined, 'analysis')).status === 403, 'Valid token crossed namespace path.');
  assert((await api(a, '', undefined, 'design', b.token)).status === 401, 'Wrong request token granted access.');
  assert((await api(a, '/result', { message: 'forged' })).status === 401, 'Page token gained result publishing authority.');
  assert((await api(a, '/close', {})).status === 401, 'Page token gained close authority.');
  const denied = await pageB.evaluate(async ({ origin, id, token }) => {
    const response = await fetch(`${origin}/api/requests/${id}`, { headers: { authorization: `Bearer ${token}` } });
    return response.status;
  }, { origin: app.origin, id: a.id, token: a.token });
  assert(denied === 401, 'Browser request capability gained management access.');
  const wrongPage = new URL(b.previewUrl); wrongPage.searchParams.set('request', a.id);
  assert((await fetch(wrongPage)).status === 403, 'Interaction opened under a different mount.');
  observed('Scoped tokens cannot cross mount paths, retrieve with another request token, or use management/result/close endpoints. Shared-origin code remains trusted, not sandboxed.');

  const pending = await request(bindingA.id);
  const partialBody = JSON.stringify({ responseId: crypto.randomUUID(), data: { label: 'slow body' } });
  let finishBody!: () => void;
  const slowResponse = new Promise<number>((resolve, reject) => {
    const incoming = httpRequest(`${app!.origin}/api/n/design/panel/requests/${pending.id}/responses`, {
      method: 'POST', headers: { authorization: `Bearer ${pending.token}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(partialBody) },
    }, response => { response.resume(); response.on('end', () => resolve(response.statusCode!)); });
    incoming.on('error', reject); incoming.write(partialBody.slice(0, 1));
    finishBody = () => incoming.end(partialBody.slice(1));
  });
  await new Promise(resolve => setTimeout(resolve, 100));
  await cli('unmount', '--namespace', 'design', '--name', 'panel');
  finishBody();
  assert(await slowResponse === 409, 'Request whose body finishes after unmount must be rejected.');
  assert(!(await api(a)).ok, 'Unmount left scoped reads enabled.');
  assert(!(await api(pending, '/responses', { responseId: crypto.randomUUID(), data: { label: 'late' } })).ok, 'Unmount left submissions enabled.');
  inspected = await cli('inspect', '--request', a.id);
  assert(inspected.result.message === 'Confirmed preserved custom response', 'Unmount lost administration record.');
  await cli('result', '--request', a.id, '--data', '{"message":"Reconciled while unmounted"}');
  assert((await api(b, '', undefined, 'analysis')).ok, 'Unmount disabled another namespace.');
  await cli('mount', alpha.source, '--project', alpha.root, '--namespace', 'design', '--name', 'panel');
  assert((await api(a)).ok, 'Remount did not restore original scoped access.');
  await cli('close', '--request', pending.id);
  assert((await api(pending, '/responses', { responseId: crypto.randomUUID(), data: { label: 'closed' } })).status === 409, 'Closed request accepted new input.');
  assert(deliveries.length === delivered, 'Unmount/remount/close caused delivery.');
  observed('Unmount rejects an in-flight partial request body and blocks preview reads/submissions while management reconciliation remains available; remount restores original access and closing blocks new input.');

  for (const [label, expected] of [['unavailable', 'failed'], ['uncertain', 'unknown']] as const) {
    const record = await request(bindingA.id), responseId = crypto.randomUUID(), data = { label };
    await pageA.goto(record.previewUrl); await pageA.getByRole('textbox').fill(label); await pageA.getByRole('button').click();
    await status(pageA, expected);
    const saved = await (await api(record)).json() as RequestRecord;
    const before: number = deliveries.length;
    await api(record, '/responses', { responseId: saved.response!.id, data });
    assert((await api(record, '/responses', { responseId, data })).status === 409, 'A new ID retried a failed or uncertain request.');
    await pageA.reload(); await status(pageA, expected);
    assert(deliveries.length === before, 'Failed or uncertain delivery was retried automatically.');
  }
  assert(pageErrors.length === 0, pageErrors.join('\n'));
  observed('Failed and uncertain adapter outcomes remain visible and persisted; duplicate/reload never sends again.');
  await context.close();
  const held = await request(bindingA.id);
  const inFlight = api(held, '/responses', { responseId: crypto.randomUUID(), data: { label: 'held' } });
  await startedGate;
  let stopped = false;
  const stopping = app.stop().then(() => { stopped = true; });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert(!stopped && existsSync(join(stateDir, 'server.lock')), 'Stop released ownership before accepted delivery settled.');
  releaseDelivery();
  assert((await inFlight).ok, 'In-flight delivery did not complete during graceful stop.');
  await stopping;
  app = await startSingleton({ stateDir, port: 0, adapter });
  assert((await cli('inspect', '--request', held.id)).response.status === 'accepted', 'Graceful stop lost in-flight delivery outcome.');
  observed('Graceful stop retains its state lock until an in-flight adapter delivery settles, then restart reads its accepted receipt.');
  const restored = await cli('inspect', '--request', a.id);
  assert(restored.result.message === 'Reconciled while unmounted', 'Restart lost published result.');
  const restoredPage = await browser.newPage();
  const restoredURL = new URL(a.previewUrl); restoredURL.port = new URL(app.origin).port;
  await restoredPage.goto(restoredURL.href);
  await restoredPage.getByTestId('result').filter({ hasText: 'Reconciled while unmounted' }).waitFor();
  assert(deliveries.length === delivered + 3, 'Restart redelivered persisted responses.');
  await restoredPage.screenshot({ path: join(evidenceDir, 'restored-result.png'), fullPage: true });
  observed('Explicit singleton restart restores mounted interaction/result records and browser display without any replay.');
  writeFileSync(join(evidenceDir, 'result.json'), JSON.stringify({ at: new Date().toISOString(), liveAgent: false, adapter: 'deterministic fixture', observations, deliveries: deliveries.map(({ threadId, requestId, responseId, data }) => ({ threadId, requestId, responseId, data })) }, null, 2));
  console.log('PASS: singleton interaction experiment.');
} finally {
  releaseDelivery(); await browser?.close(); await app?.stop();
  await new Promise<void>(resolve => socket.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
