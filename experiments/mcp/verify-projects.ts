import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { startSingleton } from '../singleton/server.ts';

const root = resolve(import.meta.dir, '../..');
const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'artifact-project-access-')));
const stateDir = join(temporary, 'server');
const evidenceDir = join(root, '.artifact/project-access-proof'); mkdirSync(evidenceDir, { recursive: true });
const observations: string[] = [];
function observed(message: string) { observations.push(message); console.log(message); }
const component = `<script lang="ts">
import { previewState } from 'virtual:artifact-preview';
const count = previewState('counter', 0, 1);
const draft = previewState('draft', '', 1);
</script>
<h1>Shared project core</h1><input aria-label="Draft" bind:value={$draft}/><button onclick={() => $count++}>Count {$count}</button>`;
function project(name: string) {
  const projectRoot = join(temporary, name), source = join(projectRoot, 'artifacts/panel');
  mkdirSync(join(source, 'src'), { recursive: true });
  writeFileSync(join(projectRoot, 'README.md'), 'User-owned project.\n');
  writeFileSync(join(source, 'package.json'), JSON.stringify({ name, private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
  writeFileSync(join(source, 'src/Panel.svelte'), component);
  return { projectRoot, source };
}
const alpha = project('alpha'), beta = project('beta');
const client = new Client({ name: 'artifact-project-access-verifier', version: '0.1.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [join(import.meta.dir, 'server.ts'), '--state-dir', stateDir], cwd: root, stderr: 'pipe' });
let stderr = ''; transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
let app: Awaited<ReturnType<typeof startSingleton>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
async function cli(projectRoot: string, operation: string, ...args: string[]) {
  const child = Bun.spawn([process.execPath, join(root, 'src/cli/index.ts'), 'project', operation, '--project', projectRoot, '--state-dir', stateDir, ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  assert.equal(code, 0, `CLI ${operation}: ${error} ${stdout}`);
  const outcome = JSON.parse(stdout); assert.equal(outcome.ok, true); assert.equal(outcome.version, 1); return outcome.data;
}
async function tool(operation: string, args: Record<string, unknown>, expectError = false) {
  const result = await client.callTool({ name: `artifact_project_${operation}`, arguments: args }, { timeout: 150_000 });
  assert.equal(result.isError === true, expectError, JSON.stringify(result));
  const outcome = result.structuredContent as any;
  if (!expectError) { assert.equal(outcome.version, 1); assert.equal(outcome.ok, true); }
  return { result, outcome, data: outcome?.data };
}
try {
  app = await startSingleton({ stateDir, port: 0 });
  const compiler = app.vite, identity = app.instanceId;
  const managementToken = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8')).token;
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 19);
  const projectTools = tools.filter(tool => tool.name.startsWith('artifact_project_'));
  assert.equal(projectTools.length, 8);
  assert.deepEqual(projectTools.filter(tool => tool.annotations?.readOnlyHint).map(tool => tool.name), ['artifact_project_list']);
  await tool('add', { projectRoot: alpha.projectRoot, source: 'artifacts/panel' }, true);
  await tool('init', { projectRoot: alpha.projectRoot, unexpected: true }, true);
  await tool('init', { projectRoot: 'relative/root' }, true);
  const aProject = (await tool('init', { projectRoot: alpha.projectRoot, name: 'Alpha' })).data;
  assert.equal((await cli(alpha.projectRoot, 'list')).projectId, aProject.projectId);
  const a = await cli(alpha.projectRoot, 'add', '--source', 'artifacts/panel', '--name', 'Controls');
  const viaMcp = await tool('list', { projectRoot: alpha.projectRoot });
  assert.equal(viaMcp.data.artifacts[0].id, a.id);
  assert.ok(!JSON.stringify(viaMcp.result).includes(managementToken));
  await tool('register', { projectRoot: alpha.projectRoot });
  const mountA = (await tool('mount', { projectRoot: alpha.projectRoot, artifactId: a.id })).data;
  const mountedList = await cli(alpha.projectRoot, 'list');
  assert.equal(mountedList.artifacts[0].runtime.status, 'ready');
  await cli(beta.projectRoot, 'init', '--name', 'Beta');
  const b = (await tool('add', { projectRoot: beta.projectRoot, source: 'artifacts/panel', name: 'Controls' })).data;
  await cli(beta.projectRoot, 'register');
  const mountB = await cli(beta.projectRoot, 'mount', '--artifact', b.id);
  assert.notEqual(mountA.namespace, mountB.namespace);
  observed('Real stdio MCP and the root CLI share server-owned project identity, registration and mounting; all 8 project tools have strict schemas and only list is read-only.');

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(), neighbor = await browser.newPage();
  await page.goto(mountA.previewUrl + '?component=src%2FPanel.svelte');
  await neighbor.goto(mountB.previewUrl + '?component=src%2FPanel.svelte');
  await page.getByRole('heading', { name: 'Shared project core' }).waitFor();
  await neighbor.getByRole('heading', { name: 'Shared project core' }).waitFor();
  await page.getByRole('textbox', { name: 'Draft' }).fill('Retain this unsent draft');
  await page.getByRole('button', { name: 'Count 0' }).click();
  await neighbor.getByRole('button', { name: 'Count 0' }).click();
  await page.evaluate(() => { (window as any).documentMarker = 'alpha'; });
  await neighbor.evaluate(() => { (window as any).documentMarker = 'beta'; });
  writeFileSync(join(alpha.source, 'src/Panel.svelte'), component.replace('Shared project core', 'Shared project core updated'));
  await page.getByRole('heading', { name: 'Shared project core updated' }).waitFor();
  assert.equal(await page.getByRole('textbox').inputValue(), 'Retain this unsent draft');
  await page.getByRole('button', { name: 'Count 1' }).waitFor();
  assert.equal(await page.evaluate(() => (window as any).documentMarker), 'alpha');
  await page.screenshot({ path: join(evidenceDir, 'mounted-hmr.png'), fullPage: true });
  observed('Actual Chrome rendering, clicks and source HMR preserve the opted-in counter, unsent draft and original document after mounting through the shared API.');

  const lock = readFileSync(join(alpha.source, 'bun.lock'), 'utf8');
  await tool('archive', { projectRoot: alpha.projectRoot, artifactId: a.id });
  assert.equal((await fetch(mountA.previewUrl)).status, 404);
  assert.equal((await cli(alpha.projectRoot, 'list')).artifacts[0].archived, true);
  await tool('mount', { projectRoot: alpha.projectRoot, artifactId: a.id }, true);
  assert.equal(await neighbor.evaluate(() => (window as any).documentMarker), 'beta');
  await neighbor.getByRole('button', { name: 'Count 1' }).click();
  await neighbor.getByRole('button', { name: 'Count 2' }).waitFor();
  await cli(alpha.projectRoot, 'restore', '--artifact', a.id);
  assert.equal((await fetch(mountA.previewUrl)).status, 404, 'Restore must not mount implicitly.');
  const remounted = await cli(alpha.projectRoot, 'mount', '--artifact', a.id);
  assert.equal(remounted.previewUrl, mountA.previewUrl);
  await page.goto(remounted.previewUrl + '?component=src%2FPanel.svelte'); await page.reload();
  await page.getByRole('heading', { name: 'Shared project core updated' }).waitFor();
  await tool('unmount', { projectRoot: alpha.projectRoot, artifactId: a.id });
  assert.equal((await fetch(mountA.previewUrl)).status, 404);
  assert.equal((await cli(alpha.projectRoot, 'list')).artifacts[0].runtime.status, 'unmounted');
  await tool('restore', { projectRoot: alpha.projectRoot, artifactId: a.id }, true);
  assert.equal(readFileSync(join(alpha.source, 'bun.lock'), 'utf8'), lock);
  assert.equal(readFileSync(join(alpha.projectRoot, 'README.md'), 'utf8'), 'User-owned project.\n');
  assert.ok(existsSync(join(alpha.source, 'node_modules/svelte')));
  assert.equal(app.vite, compiler); assert.equal(app.instanceId, identity);
  assert.equal(await neighbor.evaluate(() => (window as any).documentMarker), 'beta');
  observed('MCP archive/CLI restore/remount preserve stable routes and project files; unmount reports inactive runtime state, while the neighboring document and counter survive under the same compiler/server instance.');

  await app.stop(); app = await startSingleton({ stateDir, port: 0 });
  assert.equal((await tool('list', { projectRoot: alpha.projectRoot })).data.projectId, aProject.projectId);
  await tool('mount', { projectRoot: alpha.projectRoot, artifactId: a.id });
  assert.equal((await cli(alpha.projectRoot, 'list')).artifacts[0].runtime.status, 'ready');
  observed('The running MCP adapter refreshes the connection after server restart and continues sharing the same durable identities with CLI.');
  writeFileSync(join(evidenceDir, 'result.json'), JSON.stringify({ at: new Date().toISOString(), observations, liveAgent: false }, null, 2));
  console.log('PASS: shared project CLI/MCP/browser access.');
} catch (error) { if (stderr) console.error(stderr); throw error; }
finally { await client.close(); await browser?.close(); await app?.stop(); rmSync(temporary, { recursive: true, force: true }); }
