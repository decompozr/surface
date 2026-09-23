import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { startSingleton } from '../runtime/server.ts';
import { DeliveryError, type AgentAdapter, type Binding } from '../src/adapters/codex.ts';

const root = resolve(import.meta.dir, '../../..');
const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'surface-mcp-')));
const stateDir = join(temporary, 'state'), source = join(temporary, 'project', 'panel');
const projectRoot = join(temporary, 'project'), badSource = join(temporary, 'bad');
const proof = join(root, '.decompozr/surface/mcp-proof'); mkdirSync(proof, { recursive: true });
for (const path of [source, badSource]) {
  mkdirSync(join(path, 'src'), { recursive: true });
  writeFileSync(join(path, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { svelte: path === badSource ? '0.0.0' : '5.57.1' } }));
  writeFileSync(join(path, 'src/Panel.svelte'), '<h1>MCP interoperability fixture</h1>');
}
const socketPath = join(temporary, 'fixture.sock');
const socket = Bun.listen({ unix: socketPath, socket: { data() {} } });
const deliveries: { binding: Binding; message: string }[] = [];
const adapter: AgentAdapter = {
  async inspect(binding) { assert.equal(binding.projectRoot, projectRoot); assert.equal(binding.threadId, 'fixture-existing-thread'); return { status: 'idle' }; },
  async deliver(binding, message) {
    deliveries.push({ binding, message });
    const { data } = JSON.parse(message.split('\n')[1]!);
    if (data.label === 'fixture-failed' || data.label === 'fixture-unknown') throw new DeliveryError('Explicit fixture delivery outcome.', data.label === 'fixture-failed' ? 'failed' : 'unknown');
    return { mode: 'start', turnId: `fixture-turn-${deliveries.length}` };
  },
};
let app: Awaited<ReturnType<typeof startSingleton>> | undefined;
const transport = new StdioClientTransport({ command: process.execPath, args: [join(import.meta.dir, 'server.ts'), '--state-dir', stateDir], cwd: root, stderr: 'pipe' });
let stderr = ''; transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
const client = new Client({ name: 'surface-mcp-verifier', version: '0.1.0' });
const observations: Record<string, unknown> = {};
const cliPath = join(root, 'apps/surface/runtime/cli.ts');
async function cliCode(expectedCode: number, ...args: string[]) {
  const child = Bun.spawn([process.execPath, cliPath, ...args, '--state-dir', stateDir], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  assert.equal(code, expectedCode, `CLI failed: ${error}`); return JSON.parse(stdout);
}
const cli = (...args: string[]) => cliCode(0, ...args);
async function tool(name: string, args: Record<string, unknown> = {}, error = false) {
  const result = await client.callTool({ name: `surface_${name}`, arguments: args }, { timeout: 150_000 });
  assert.equal(result.isError === true, error, JSON.stringify(result));
  if (!error) assert.ok(result.structuredContent, 'Expected structured output');
  return { result, output: result.structuredContent as any };
}
const scope = { namespace: 'mcp', name: 'panel' };
const schema = { type: 'object', required: ['label'], additionalProperties: false, properties: { label: { type: 'string' } } };
try {
  app = await startSingleton({ stateDir, port: 0, adapter });
  const initialIdentity = { pid: app.pid, instanceId: app.instanceId };
  const initialConnection = readFileSync(join(stateDir, 'connection.json'), 'utf8');
  const managementToken = JSON.parse(initialConnection).token;
  await client.connect(transport);
  const listing = await client.listTools();
  assert.equal(listing.tools.length, 19);
  assert.ok(listing.tools.every(tool => tool.name.startsWith('surface_')), 'Only canonical Surface MCP names may be advertised.');
  assert.ok(listing.tools.every(tool => tool.inputSchema && tool.outputSchema));
  observations.tools = listing.tools.map(tool => tool.name);
  const invalid = await tool('namespace', { name: '../invalid' }, true);
  assert.match(JSON.stringify(invalid.result), /validation|Invalid/i);
  await tool('namespace', { name: 'extra', unexpected: true }, true);
  const invalidMissing = await tool('inspect', {}, true);
  assert.match(JSON.stringify(invalidMissing.result), /requestId/i);
  observations.invalidInputsRejected = true;

  await tool('namespace', { name: scope.namespace });
  const mounted = (await tool('mount', { ...scope, source, projectRoot })).output;
  assert.equal(mounted.status, 'ready');
  assert.equal((await cli('list'))[0].source, source);
  assert.ok(existsSync(join(source, 'node_modules/svelte')));
  const page = await fetch(`${app.origin}/n/mcp/panel/?component=src%2FPanel.svelte`);
  assert.equal(page.status, 200);
  observations.mcpMountVisibleToCli = true;

  const failed = (await tool('mount', { namespace: 'mcp', name: 'failed', source: badSource }, true)).output;
  assert.equal(failed.status, 'failed'); assert.equal(failed.httpStatus, 200);
  assert.match(failed.data.error, /svelte exactly/);
  assert.equal((await tool('health')).output.data.instanceId, initialIdentity.instanceId);
  observations.failedMountStructuredAsError = true;

  const binding = (await tool('bind', { projectRoot, threadId: 'fixture-existing-thread', socketPath })).output.data;
  const request = (await tool('request', { ...scope, bindingId: binding.id, title: 'MCP to CLI fixture', component: 'src/Panel.svelte', schema })).output.data;
  assert.equal(request.token, undefined);
  const requestToken = new URLSearchParams(new URL(request.previewUrl).hash.slice(1)).get('token');
  assert.ok(requestToken);
  assert.equal((await cli('inspect', '--request', request.id)).id, request.id);
  await cli('send', '--request', request.id, '--response-id', 'cli-response', '--data', JSON.stringify({ label: 'from-cli' }));
  assert.equal(deliveries.length, 1);
  await tool('result', { requestId: request.id, data: { message: 'published-by-mcp' } });
  assert.equal((await cli('inspect', '--request', request.id)).result.message, 'published-by-mcp');
  const inspected = (await tool('inspect', { requestId: request.id })).result;
  const requestList = (await tool('list', { kind: 'requests' })).result;
  for (const result of [inspected, requestList]) {
    assert.ok(!JSON.stringify(result).includes(requestToken!), 'Read tools must not repeat browser capabilities');
    assert.ok(!JSON.stringify(result).includes(managementToken), 'Management token leaked');
  }
  observations.mcpRequestCliSendMcpResultCliInspect = true;
  observations.capabilitiesOnlyInCreationPreviewUrl = true;

  await cli('namespace', 'cli');
  assert.equal((await tool('list')).output.data.length, 2);
  const schemaFile = join(temporary, 'schema.json'); writeFileSync(schemaFile, JSON.stringify(schema));
  const fromCli = await cli('request', '--binding', binding.id, '--namespace', 'mcp', '--name', 'panel', '--component', 'src/Panel.svelte', '--title', 'CLI to MCP fixture', '--schema-file', schemaFile);
  await tool('send', { requestId: fromCli.id, responseId: 'mcp-response', data: { label: 'from-mcp' } });
  await tool('send', { requestId: fromCli.id, responseId: 'mcp-response', data: { label: 'from-mcp' } });
  assert.equal(deliveries.length, 2, 'Duplicate submission must not deliver again');
  const conflicting = (await tool('send', { requestId: fromCli.id, responseId: 'mcp-response', data: { label: 'changed' } }, true)).output;
  assert.equal(conflicting.httpStatus, 409);
  await cli('result', '--request', fromCli.id, '--data', JSON.stringify({ message: 'published-by-cli' }));
  assert.equal((await tool('inspect', { requestId: fromCli.id })).output.data.result.message, 'published-by-cli');
  observations.cliRequestMcpSendCliResultMcpInspect = true;
  observations.deduplicationAndConflictsShared = true;
  await tool('close', { requestId: fromCli.id });
  assert.equal((await cli('inspect', '--request', fromCli.id)).closed, true);
  for (const status of ['failed', 'unknown']) {
    const failureRequest = (await tool('request', { ...scope, bindingId: binding.id, title: `Delivery ${status}`, component: 'src/Panel.svelte', schema })).output.data;
    const failure = (await tool('send', { requestId: failureRequest.id, responseId: `failure-${status}`, data: { label: `fixture-${status}` } }, true)).output;
    assert.equal(failure.status, status); assert.equal(failure.httpStatus, 200);
    assert.equal((await cliCode(1, 'inspect', '--request', failureRequest.id)).response.status, status);
  }
  assert.equal(deliveries.length, 4, 'Adapter must not retry failed or unknown outcomes');
  observations.deliveryFailureAndUncertaintyPreserved = true;
  const closedRequest = (await tool('request', { ...scope, bindingId: binding.id, title: 'Closed fixture', component: 'src/Panel.svelte', schema })).output.data;
  await cli('close', '--request', closedRequest.id);
  const closedSend = (await tool('send', { requestId: closedRequest.id, responseId: 'closed-response', data: { label: 'closed' } }, true)).output;
  assert.equal(closedSend.httpStatus, 409); assert.equal(deliveries.length, 4);
  observations.closedRequestRejectedAcrossInterfaces = true;

  await cli('unmount', '--namespace', scope.namespace, '--name', scope.name);
  assert.equal((await tool('list')).output.data.find((item: any) => item.name === 'panel').status, 'unmounted');
  await tool('mount', { ...scope, source, projectRoot });
  await tool('unmount', scope);
  assert.equal((await cli('list')).find((item: any) => item.name === 'panel').status, 'unmounted');
  observations.lifecycleShared = true;
  const health = (await tool('health')).output.data;
  assert.equal(health.pid, initialIdentity.pid); assert.equal(health.instanceId, initialIdentity.instanceId);
  observations.sameSingletonIdentity = true;
  writeFileSync(join(stateDir, 'connection.json'), JSON.stringify({ origin: app.origin, token: 'invalid-fixture-token' }));
  assert.equal((await tool('list', {}, true)).output.httpStatus, 401);
  writeFileSync(join(stateDir, 'connection.json'), JSON.stringify({ origin: 'https://example.invalid', token: managementToken }));
  assert.equal((await tool('health', {}, true)).output.status, 'invalid_connection');
  writeFileSync(join(stateDir, 'connection.json'), initialConnection);
  observations.authAndLocalConnectionValidation = true;
  await app.stop(); app = undefined;
  const unavailable = (await tool('health', {}, true)).output;
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(existsSync(join(stateDir, 'connection.json')), false);
  assert.equal((await client.listTools()).tools.length, 19);
  observations.unavailableDoesNotStartServer = true;
  writeFileSync(join(stateDir, 'connection.json'), initialConnection);
  assert.equal((await tool('health', {}, true)).output.status, 'unavailable');
  assert.equal((await tool('namespace', { name: 'transport-outcome' }, true)).output.status, 'unknown');
  observations.transportMutationOutcomeIsUnknown = true;
  app = await startSingleton({ stateDir, port: 0, adapter });
  const refreshed = (await tool('health')).output.data;
  assert.equal(refreshed.instanceId, app.instanceId);
  assert.notEqual(refreshed.instanceId, initialIdentity.instanceId);
  assert.equal((await tool('inspect', { requestId: request.id })).output.data.result.message, 'published-by-mcp');
  observations.connectionRefreshedAfterRestart = true;
  observations.fixtureOnly = true;
  assert.ok(!stderr.includes(managementToken));
  writeFileSync(join(proof, 'result.json'), JSON.stringify(observations, null, 2) + '\n');
  console.log(JSON.stringify(observations, null, 2));
} finally {
  await client.close(); await app?.stop(); socket.stop(true);
  writeFileSync(join(proof, 'mcp-stderr.log'), stderr);
  rmSync(temporary, { recursive: true, force: true });
}
