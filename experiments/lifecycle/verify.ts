import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, realpathSync, existsSync, rmSync, readdirSync, renameSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Installation, type Host } from './manager.ts';
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';

const { values } = parseArgs({ options: { repo: { type: 'string' }, ref: { type: 'string' }, host: { type: 'string' } } });
const root = resolve(import.meta.dir, '../..');
const sourceRepo = resolve(values.repo ?? root), sourceRef = values.ref ?? 'HEAD';
const host = (values.host ?? 'singleton') as Host;
const temporary = realpathSync(mkdtempSync('/tmp/surface-lifecycle-'));
const home = join(temporary, 'home'), fixtureRepo = join(temporary, 'repository'), project = join(temporary, 'project');
const proof = join(root, '.decompozr/surface/lifecycle-proof', host); mkdirSync(proof, { recursive: true });
const observations: Record<string, unknown> = { host, fixtureOnly: true };
const retainedRequestId = crypto.randomUUID();
const ownedPids = new Set<number>();
let ownedChild: ReturnType<typeof Bun.spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let cliOwned = false;
let mcpClient: { close(): Promise<void> } | undefined;
const installation = new Installation(home);
async function cmd(args: string[], cwd?: string) {
  const child = Bun.spawn(args, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  assert.equal(code, 0, `${args.join(' ')}\n${err}\n${out}`); return out.trim();
}
const git = (...args: string[]) => cmd(['git', '-C', fixtureRepo, ...args]);
async function commit(message: string, empty = false) {
  await git('-c', 'user.name=Surface Experiment', '-c', 'user.email=surface-fixture@example.invalid', 'commit', ...(empty ? ['--allow-empty'] : []), '-m', message);
  return git('rev-parse', 'HEAD');
}
async function api(path: string, data?: unknown) {
  const connection = JSON.parse(readFileSync(join(home, 'state/connection.json'), 'utf8'));
  const response = await fetch(new URL(path, connection.origin), {
    method: data === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(120_000),
  });
  const result = await response.json() as any; assert.ok(response.ok, JSON.stringify(result)); return result;
}
async function startAndMeasure(port?: number) {
  const start = performance.now();
  const launch = await installation.start(port); ownedChild = launch.child;
  ownedPids.add(launch.child.pid);
  const health = await installation.health(); assert.equal(health.status, 'running');
  return { ...launch.status, readyMs: Math.round(performance.now() - start) };
}
async function stopOwned() { await installation.stop(); if (ownedChild) await ownedChild.exited; ownedChild = undefined; }
try {
  mkdirSync(fixtureRepo); mkdirSync(join(project, 'src'), { recursive: true });
  const archive = join(temporary, 'snapshot.tar');
  const sourceCommit = await cmd(['git', '-C', sourceRepo, 'rev-parse', `${sourceRef}^{commit}`]);
  await cmd(['git', '-C', sourceRepo, 'archive', '--format=tar', `--output=${archive}`, sourceCommit]);
  await cmd(['tar', '-xf', archive, '-C', fixtureRepo]);
  await git('init', '-q'); await git('add', '.');
  const revisionA = await commit(`Clean fixture snapshot of ${sourceCommit}`);
  const revisionB = await commit('Mechanical release-transition fixture; no source/schema change', true);
  writeFileSync(join(fixtureRepo, 'package.json'), readFileSync(join(fixtureRepo, 'package.json'), 'utf8').replace('"ajv": "8.20.0"', '"ajv": "0.0.0-surface-missing"'));
  await git('add', 'package.json'); const revisionBad = await commit('Deliberate manifest/lock mismatch');
  observations.sourceCommit = sourceCommit;
  observations.revisions = { revisionA, revisionB, revisionBad, rollbackBoundary: 'two real Git revisions with identical source; mechanical rollback only' };

  writeFileSync(join(project, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
  writeFileSync(join(project, 'src/Panel.svelte'), '<h1>Installed Surface fixture</h1>');
  const installStart = performance.now();
  const firstRelease = await installation.install(fixtureRepo, revisionA, host);
  observations.initialInstallAndBuildMs = Math.round(performance.now() - installStart);
  assert.equal(firstRelease.commit, revisionA);
  assert.ok(existsSync(join(home, 'releases', firstRelease.release, 'node_modules')));
  assert.ok(existsSync(join(home, 'releases', firstRelease.release, 'experiments/singleton/node_modules')));
  assert.equal(existsSync(join(home, 'releases', firstRelease.release, '.git')), false);
  observations.cleanFrozenGitRefInstallation = true;
  writeFileSync(join(home, 'state/user-retained.json'), '{"keep":true}\n');
  // Explicit completed-record fixture: no adapter contact, delivery, or live authorship claim.
  writeFileSync(join(home, 'state/interactions.json'), JSON.stringify({ version: 1, bindings: [], runtimes: [], requests: [{
    id: retainedRequestId, bindingId: 'historical-fixture', title: 'Retained completed fixture', token: crypto.randomUUID(),
    schema: { type: 'object' }, createdAt: new Date().toISOString(), closed: true,
    response: { id: 'historical-response', data: {}, createdAt: new Date().toISOString(), status: 'accepted' },
    result: { message: 'retained-result-fixture' },
  }] }));
  const assertCompilerLink = (release: string) => assert.equal(realpathSync(join(home, 'state/workspace/node_modules')), realpathSync(join(home, 'releases', release, 'experiments/singleton/node_modules')));
  const first = await startAndMeasure(); assertCompilerLink(firstRelease.release);
  const installedMcp = join(home, 'releases', firstRelease.release, 'experiments/mcp');
  if (existsSync(join(installedMcp, 'package.json'))) {
    const requireInstalled = createRequire(join(installedMcp, 'package.json'));
    const { Client } = requireInstalled('@modelcontextprotocol/client');
    const { StdioClientTransport } = requireInstalled('@modelcontextprotocol/client/stdio');
    const installedClient = new Client({ name: 'installed-lifecycle-fixture', version: '0.1.0' });
    mcpClient = installedClient;
    const installedTransport = new StdioClientTransport({ command: process.execPath, args: [join(installedMcp, 'server.ts'), '--state-dir', join(home, 'state')], stderr: 'pipe' });
    await installedClient.connect(installedTransport);
    const installedTools = (await installedClient.listTools()).tools;
    assert.equal(installedTools.length, 19);
    assert.deepEqual(installedTools.filter(tool => tool.name.startsWith('surface_project_')).map(tool => tool.name).sort(), ['add', 'archive', 'init', 'list', 'mount', 'register', 'restore', 'unmount'].map(operation => `surface_project_${operation}`));
    const installedHealth = await installedClient.callTool({ name: 'surface_health', arguments: {} });
    assert.equal(installedHealth.structuredContent.data.instanceId, first.instanceId);
    const requests = await installedClient.callTool({ name: 'surface_list', arguments: { kind: 'requests' } });
    assert.equal(requests.structuredContent.data.length, 1);
    const inspected = await installedClient.callTool({ name: 'surface_inspect', arguments: { requestId: retainedRequestId } });
    assert.equal(inspected.structuredContent.data.result.message, 'retained-result-fixture');
    await installedClient.close(); mcpClient = undefined;
    observations.installedMcpUsesSameHost = true;
  }
  await api('/api/namespaces', { name: 'installed' });
  const mounted = await api('/api/mounts', { namespace: 'installed', name: 'panel', source: project });
  assert.equal(mounted.status, 'ready', mounted.error);
  const preview = `${first.origin}/n/installed/panel/?component=src%2FPanel.svelte`;
  const page = await fetch(preview); assert.equal(page.status, 200); assert.match(await page.text(), /artifact-preview-context/);
  browser = await chromium.launch({ headless: true });
  const browserPage = await browser.newPage();
  const pageErrors: string[] = []; browserPage.on('pageerror', error => pageErrors.push(error.message));
  await browserPage.goto(preview);
  await browserPage.getByRole('heading', { name: 'Installed Surface fixture' }).waitFor();
  await browserPage.screenshot({ path: join(proof, 'installed-component.png') });
  if (host === 'sveltekit') {
    await browserPage.goto(`${first.origin}/manage`);
    await browserPage.getByRole('heading', { name: 'SvelteKit singleton foundation' }).waitFor();
    await browserPage.getByRole('heading', { name: 'installed/panel' }).waitFor();
    await browserPage.screenshot({ path: join(proof, 'installed-management.png') });
    observations.installedKitApplicationRendered = true;
  }
  assert.deepEqual(pageErrors, []);
  await browser.close(); browser = undefined;
  observations.installedComponentRenderedInBrowser = true;
  assert.equal((await api('/api/mounts'))[0].source, project);
  observations.installedHostMountsExternalSource = true;
  await assert.rejects(installation.install(fixtureRepo, revisionB, host), /Stop the owned host/);
  await assert.rejects(installation.activate(firstRelease.release), /Stop the owned host/);
  await assert.rejects(installation.uninstall(), /Stop the owned host/);
  assert.equal((await installation.health()).status, 'running');
  observations.noImplicitInterruptionDuringActivation = true;
  const liveOwnerPath = join(home, 'run/owner.json');
  const liveOwner = readFileSync(liveOwnerPath, 'utf8');
  writeFileSync(liveOwnerPath, JSON.stringify({ ...JSON.parse(liveOwner), secret: 'incorrect-fixture-secret' }));
  await assert.rejects(installation.stop(), /identity could not be verified/);
  writeFileSync(liveOwnerPath, liveOwner);
  assert.equal((await installation.health()).status, 'running');
  observations.stopRequiresAuthenticatedOwner = true;
  await stopOwned();

  const selectedA = readFileSync(join(home, 'active.json'), 'utf8');
  const installedPackage = join(home, 'releases', firstRelease.release, 'package.json');
  const installedManifest = join(home, 'releases', firstRelease.release, '.artifact-release.json');
  const packageBefore = readFileSync(installedPackage, 'utf8'), manifestBefore = readFileSync(installedManifest, 'utf8');
  const hostLogBefore = readFileSync(join(home, 'run/host.log'), 'utf8');
  for (const fixture of ['declared-version', 'prepared-version']) {
    try {
      if (fixture === 'declared-version') writeFileSync(installedPackage, JSON.stringify({ ...JSON.parse(packageBefore), packageManager: 'bun@0.0.0-fixture' }));
      else {
        const mismatched = JSON.stringify({ ...JSON.parse(manifestBefore), bun: '0.0.0-fixture' });
        writeFileSync(installedManifest, mismatched); writeFileSync(join(home, 'active.json'), mismatched);
      }
      const selectedFixture = readFileSync(join(home, 'active.json'), 'utf8');
      await assert.rejects(installation.install(fixtureRepo, revisionA, host), /running bun@/);
      await assert.rejects(installation.activate(firstRelease.release), /running bun@/);
      await assert.rejects(installation.start(), /running bun@/);
      assert.equal(readFileSync(join(home, 'active.json'), 'utf8'), selectedFixture);
      assert.equal(existsSync(join(home, 'run/owner.json')), false);
      assert.equal(existsSync(join(home, 'state/server.lock')), false);
      assert.equal(readFileSync(join(home, 'run/host.log'), 'utf8'), hostLogBefore);
    } finally {
      writeFileSync(installedPackage, packageBefore); writeFileSync(installedManifest, manifestBefore);
      writeFileSync(join(home, 'active.json'), selectedA);
    }
  }
  observations.cachedActivationAndLaunchEnforceBunPin = true;
  await assert.rejects(installation.install(fixtureRepo, revisionBad, host), /Command failed/);
  assert.equal(readFileSync(join(home, 'active.json'), 'utf8'), selectedA);
  assert.equal(readdirSync(join(home, 'releases')).some(name => name.startsWith('.preparing-')), false);
  observations.failedInstallPreservesActivation = true;
  const secondRelease = await installation.install(fixtureRepo, revisionB, host);
  const second = await startAndMeasure(Number(new URL(first.origin).port)); assert.equal(second.release, secondRelease.release); assertCompilerLink(secondRelease.release);
  assert.equal(second.origin, first.origin);
  assert.notEqual(second.instanceId, first.instanceId);
  assert.equal((await api('/api/mounts'))[0].status, 'ready');
  await stopOwned();
  await installation.activate(firstRelease.release);
  const rollback = await startAndMeasure(); assert.equal(rollback.release, firstRelease.release); assertCompilerLink(firstRelease.release);
  assert.equal(rollback.origin, first.origin);
  assert.equal((await api('/api/mounts'))[0].source, project);
  observations.upgradeAndMechanicalRollback = true;
  await stopOwned();
  const restart = await startAndMeasure();
  assert.notEqual(restart.instanceId, rollback.instanceId);
  assert.equal(restart.origin, first.origin);
  observations.fixedPortPersistedAcrossRestartAndRollback = true;
  observations.gracefulRestartPreservesMountedProject = true;
  await stopOwned();
  const cliLaunch = JSON.parse(await cmd([process.execPath, join(import.meta.dir, 'manager.ts'), 'start', '--home', home]));
  cliOwned = true;
  ownedPids.add(cliLaunch.pid);
  assert.equal(cliLaunch.release, firstRelease.release);
  assert.equal(cliLaunch.origin, first.origin);
  const cliHealth = JSON.parse(await cmd([process.execPath, join(import.meta.dir, 'manager.ts'), 'health', '--home', home]));
  assert.equal(cliHealth.status, 'running');
  await cmd([process.execPath, join(import.meta.dir, 'manager.ts'), 'stop', '--home', home]); cliOwned = false;
  observations.separateCliProcessesManagePersistentHost = true;
  await startAndMeasure();

  // This is the exact live subprocess handle returned by this harness's launch, not a saved PID.
  ownedChild!.kill('SIGKILL'); await ownedChild!.exited; ownedChild = undefined;
  const ownerPath = join(home, 'run/owner.json');
  const staleOwner = readFileSync(ownerPath, 'utf8');
  assert.ok(existsSync(join(home, 'state/server.lock')));
  await assert.rejects(installation.start(), /Stop the owned host/);
  const fakeOwner = { ...JSON.parse(staleOwner), pid: process.pid };
  writeFileSync(ownerPath, JSON.stringify(fakeOwner));
  await assert.rejects(installation.recover(), /live or reused/);
  assert.ok(existsSync(join(home, 'state/server.lock')));
  process.kill(process.pid, 0); // The unrelated live process was not signalled.
  writeFileSync(ownerPath, staleOwner);
  const socketFile = join(home, 'run/control.sock');
  renameSync(socketFile, socketFile + '.saved'); writeFileSync(socketFile, 'unexpected regular file');
  const stateLockBefore = readFileSync(join(home, 'state/server.lock'), 'utf8');
  const connectionBefore = readFileSync(join(home, 'state/connection.json'), 'utf8');
  await assert.rejects(installation.recover(), /unexpected control path/);
  assert.equal(readFileSync(ownerPath, 'utf8'), staleOwner);
  assert.equal(readFileSync(join(home, 'state/server.lock'), 'utf8'), stateLockBefore);
  assert.equal(readFileSync(join(home, 'state/connection.json'), 'utf8'), connectionBefore);
  rmSync(socketFile); renameSync(socketFile + '.saved', socketFile);
  observations.recoveryPreconditionsPreserveMetadataOnFailure = true;
  const recovery = await installation.recover(); assert.equal(recovery.status, 'recovered');
  assert.ok(existsSync(join(recovery.archive, 'owner.json')));
  assert.equal(existsSync(join(home, 'state/server.lock')), false);
  const recovered = await startAndMeasure();
  assert.equal((await api('/api/mounts'))[0].status, 'ready');
  observations.ownedAbruptStopAndConservativeRecovery = true;
  observations.liveOrReusedPidRefused = true;
  await stopOwned();
  const interactionsFile = join(home, 'state/interactions.json');
  const originalInteractions = readFileSync(interactionsFile, 'utf8');
  for (const status of ['accepted', 'delivering', 'unknown']) {
    const snapshot = JSON.parse(originalInteractions);
    snapshot.requests.push({ id: 'explicit-pending-callback-fixture', closed: true, response: { status } });
    writeFileSync(interactionsFile, JSON.stringify(snapshot));
    await assert.rejects(installation.uninstall(), /Unresolved agent callbacks/);
    assert.ok(existsSync(join(home, 'releases', firstRelease.release)));
  }
  writeFileSync(interactionsFile, originalInteractions);
  observations.uninstallProtectsUnresolvedCallbackFixtures = true;
  const savedRegistry = readFileSync(join(home, 'state/registry.json'), 'utf8');
  const savedSource = readFileSync(join(project, 'src/Panel.svelte'), 'utf8');
  await installation.uninstall();
  assert.equal(existsSync(join(home, 'releases')), false);
  assert.equal(existsSync(join(home, 'run')), false);
  assert.equal(existsSync(join(home, 'active.json')), false);
  assert.equal(readFileSync(join(home, 'state/registry.json'), 'utf8'), savedRegistry);
  assert.equal(readFileSync(join(home, 'state/user-retained.json'), 'utf8'), '{"keep":true}\n');
  assert.equal(readFileSync(join(project, 'src/Panel.svelte'), 'utf8'), savedSource);
  assert.ok(existsSync(join(project, 'node_modules')));
  observations.uninstallPreservesStateAndSources = true;
  // Retained workspace state includes a dangling runtime dependency link after uninstall.
  // A different installed revision must reconcile that owned link before starting.
  await installation.install(fixtureRepo, revisionB, host);
  const reinstalled = await startAndMeasure();
  assertCompilerLink(secondRelease.release);
  assert.equal((await api('/api/mounts'))[0].status, 'ready');
  await stopOwned();
  const dependencyLink = join(home, 'state/workspace/node_modules');
  const dependencyOwner = readFileSync(join(home, 'state/workspace/dependency-link.json'), 'utf8');
  unlinkSync(dependencyLink); mkdirSync(dependencyLink); writeFileSync(join(dependencyLink, 'user-owned.txt'), 'keep');
  await assert.rejects(installation.start(), /did not become ready/);
  assert.equal(readFileSync(join(dependencyLink, 'user-owned.txt'), 'utf8'), 'keep');
  rmSync(dependencyLink, { recursive: true });
  symlinkSync(project, dependencyLink, 'dir');
  await assert.rejects(installation.start(), /did not become ready/);
  assert.equal(realpathSync(dependencyLink), project);
  assert.equal(readFileSync(join(home, 'state/workspace/dependency-link.json'), 'utf8'), dependencyOwner);
  unlinkSync(dependencyLink);
  symlinkSync(join(home, 'releases', secondRelease.release, 'experiments/singleton/node_modules'), dependencyLink, 'dir');
  await installation.uninstall();
  observations.compilerLinkTracksActiveReleaseAndReinstall = true;
  observations.unownedWorkspaceDependencyPathsPreserved = true;
  assert.equal(existsSync(join(home, 'run/owner.json')), false);
  assert.equal(existsSync(join(home, 'state/server.lock')), false);
  assert.equal(existsSync(join(home, 'state/connection.json')), false);
  observations.failedStartLeavesNoHostOwnershipOrLock = true;
  for (const pid of ownedPids) assert.throws(() => process.kill(pid, 0), (error: any) => error.code === 'ESRCH', 'An owned host remains alive');
  observations.allOwnedHostProcessesExited = ownedPids.size;
  observations.launches = [first, second, rollback, restart, recovered].map(({ release, readyMs }) => ({ release, readyMs }));
  writeFileSync(join(proof, 'result.json'), JSON.stringify(observations, null, 2) + '\n');
  console.log(JSON.stringify(observations, null, 2));
} finally {
  await mcpClient?.close();
  await browser?.close();
  if (cliOwned) await installation.stop();
  if (ownedChild) {
    try { await installation.stop(); } catch { ownedChild.kill('SIGKILL'); }
    await ownedChild.exited;
  }
  const log = join(home, 'run/host.log'); if (existsSync(log)) writeFileSync(join(proof, 'host.log'), readFileSync(log));
  rmSync(temporary, { recursive: true, force: true });
}
