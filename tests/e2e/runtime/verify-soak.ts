import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startSingleton } from '@decompozr/surface-app/server/host/runtime';
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'surface-soak-'))), stateDir = join(directory, 'state');
const evidence = join(process.cwd(), '.decompozr/surface/soak-proof'); mkdirSync(evidence, { recursive: true });
const probe = process.argv.includes('--probe');
const samples: Record<string, any>[] = [];
const started = performance.now();
let app: Awaited<ReturnType<typeof startSingleton>> | undefined, browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function source(name: string) {
  const root = join(directory, name); mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name, private: true, type: 'module', dependencies: { svelte: '5.57.1', lodash: '4.17.21' } }));
  writeFileSync(join(root, 'artifact.json'), JSON.stringify({ framework: 'svelte', components: 'src', prebundle: ['lodash'] }));
  writeFileSync(join(root, 'src/Panel.svelte'), component(name)); return root;
}
function component(name: string) { return `<script>import lodash from 'lodash';import {previewState} from 'virtual:surface-preview';const count=previewState('count',0);</script><h1>${name}</h1><p>{lodash.VERSION}</p><button onclick={()=> $count++}>Count {$count}</button>`; }
async function cli(...args: string[]) {
  const child = Bun.spawn([process.execPath, join(process.cwd(), 'apps/cli/src/runtime.ts'), ...args, '--state-dir', stateDir], { stdout: 'pipe', stderr: 'pipe' });
  const [out, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  const result = JSON.parse(out || '{}'); if (code && result.status !== 'failed') throw new Error(`${args[0]}: ${error}`); return result;
}
function descendantProcesses() {
  const output = Bun.spawnSync(['/bin/ps', '-axo', 'pid=,ppid=,comm=']).stdout.toString();
  const rows = output.trim().split('\n').map(line => { const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)!; return { pid: Number(match[1]), ppid: Number(match[2]), name: match[3]! }; });
  const pids = new Set([process.pid]);
  for (let step = 0; step < 10; step++) for (const row of rows) if (pids.has(row.ppid)) pids.add(row.pid);
  return rows.filter(row => pids.has(row.pid) && row.pid !== process.pid && !row.name.endsWith('/ps'));
}
function sample(stage: string, cycle = -1) {
  Bun.gc(true);
  const graph = app!.vite.environments.client.moduleGraph, modules = [...graph.idToModuleMap.values()];
  const watched = app!.vite.watcher.getWatched();
  // Read-only diagnostics pinned to the installed Vite/Chokidar implementation.
  const closers = [...((app!.vite.watcher as any)._closers as Map<string, unknown>).keys()];
  const registry = JSON.parse(readFileSync(join(stateDir, 'registry.json'), 'utf8'));
  const descendants = descendantProcesses();
  const value = { stage, cycle, elapsedSeconds: (performance.now() - started) / 1000, rss: process.memoryUsage().rss, heapUsed: process.memoryUsage().heapUsed,
    modules: graph.idToModuleMap.size, urls: graph.urlToModuleMap.size, fileKeys: graph.fileToModulesMap.size,
    sourceModules: modules.filter(item => item.id?.startsWith(directory + '/')).length,
    dependencyModules: modules.filter(item => item.id?.includes('virtual:artifact-dependency/')).length,
    transformBytes: modules.reduce((sum, item) => sum + (item.transformResult?.code.length ?? 0), 0),
    watchedDirectories: Object.keys(watched).length, watchedEntries: Object.values(watched).reduce((sum, entries) => sum + entries.length, 0),
    temporaryWatchedPaths: Object.keys(watched).filter(path => path.startsWith(directory)),
    activeWatcherClosers: closers.length, temporaryActiveWatcherPaths: closers.filter(path => path.startsWith(directory)),
    allowedSourcePaths: app!.vite.config.server.fs.allow.filter(path => path.startsWith(directory) && !path.startsWith(stateDir)),
    registeredMounts: registry.mounts.length, activeMounts: registry.mounts.filter((mount: any) => mount.status === 'ready').length,
    descendantProcesses: descendants.length, nonBrowserDescendants: descendants.filter(row => !/Chrome|chrome|crashpad/i.test(row.name)).map(row => row.name),
  };
  samples.push(value); writeFileSync(join(evidence, probe ? 'baseline-probe.json' : 'samples.json'), JSON.stringify(samples, null, 2)); return value;
}
try {
  app = await startSingleton({ stateDir, port: 0 }); await cli('namespace', 'soak');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const neighborSource = source('neighbor');
  const neighborMount = await cli('mount', neighborSource, '--namespace', 'soak', '--name', 'neighbor');
  const neighbor = await browser.newPage(); await neighbor.goto(neighborMount.previewUrl + '?component=src%2FPanel.svelte');
  await neighbor.getByRole('heading', { name: 'neighbor' }).waitFor();
  await neighbor.evaluate(() => { (window as any).proofMarker = 'persistent-neighbor'; });
  sample('warm-neighbor');
  const broken = source('broken'); writeFileSync(join(broken, 'src/Panel.svelte'), '<script>');
  const failed = await cli('mount', broken, '--namespace', 'soak', '--name', 'broken');
  assert(failed.status === 'failed', 'Initial compiler failure unexpectedly became ready.');
  await Bun.sleep(250);
  const afterFailure = sample('after-initial-compiler-failure');
  const retained = afterFailure.allowedSourcePaths.includes(broken) || afterFailure.temporaryActiveWatcherPaths.some(path => path === broken || path.startsWith(broken + '/'));
  console.log(JSON.stringify({ initialCompileFailureRetainedWatchOrAllow: retained, snapshot: afterFailure }));
  if (probe) { console.log('PROBE COMPLETE: inspect baseline-probe.json; this is not the full soak.'); }
  else {
    assert(!retained, 'Initial compile failure retained source watcher/fs.allow; fix cleanup before soak.');
    writeFileSync(join(broken, 'src/Panel.svelte'), component('broken recovered'));
    const recovered = await cli('mount', broken, '--namespace', 'soak', '--name', 'broken'); assert(recovered.status === 'ready', 'Initial failure did not recover.');
    await cli('unmount', '--namespace', 'soak', '--name', 'broken');
    const invalid = source('invalid'); writeFileSync(join(invalid, 'bun.lock'), 'invalid lock');
    assert((await cli('mount', invalid, '--namespace', 'soak', '--name', 'invalid')).status === 'failed', 'Invalid install did not fail.');
    rmSync(join(invalid, 'bun.lock'));
    assert((await cli('mount', invalid, '--namespace', 'soak', '--name', 'invalid')).status === 'ready', 'Install recovery failed.');
    await cli('unmount', '--namespace', 'soak', '--name', 'invalid');
    const repeat = source('repeat'); const page = await browser.newPage();
    const loopStarted = performance.now();
    for (let cycle = 0; cycle < 30; cycle++) {
      const cycleStart = performance.now(), name = cycle < 15 ? 'repeat' : `distinct-${cycle}`, root = cycle < 15 ? repeat : source(name);
      writeFileSync(join(root, 'src/Panel.svelte'), component(name));
      const mount = await cli('mount', root, '--namespace', 'soak', '--name', name); assert(mount.status === 'ready', 'Cycle mount failed.');
      await page.goto(mount.previewUrl + '?component=src%2FPanel.svelte'); await page.getByRole('heading', { name, exact: true }).waitFor();
      await page.getByRole('button').click(); await page.evaluate(() => { (window as any).proofMarker = 'edited-page'; });
      writeFileSync(join(root, 'src/Panel.svelte'), component(name + ' edited'));
      await page.getByRole('heading', { name: name + ' edited', exact: true }).waitFor(); await page.getByRole('button', { name: 'Count 1' }).waitFor();
      assert(await page.evaluate(() => (window as any).proofMarker) === 'edited-page', 'Cycle HMR refreshed document.');
      if (cycle === 0) {
        writeFileSync(join(root, 'src/Panel.svelte'), '<script>'); await page.locator('#artifact-compiler-error').waitFor();
        assert(await neighbor.locator('#artifact-compiler-error').count() === 0, 'Live compiler error reached neighbor.');
        writeFileSync(join(root, 'src/Panel.svelte'), component(name + ' recovered')); await page.getByRole('heading', { name: name + ' recovered' }).waitFor(); await page.getByRole('button', { name: 'Count 1' }).waitFor();
      }
      sample('mounted', cycle);
      await cli('unmount', '--namespace', 'soak', '--name', name);
      await page.getByText('Mount is not ready.', { exact: false }).waitFor();
      await neighbor.getByRole('button', { name: `Count ${cycle}` }).click();
      assert(await neighbor.evaluate(() => (window as any).proofMarker) === 'persistent-neighbor', 'Unrelated neighbor document refreshed.');
      await neighbor.getByRole('button', { name: `Count ${cycle + 1}` }).waitFor();
      const after = sample('unmounted', cycle);
      assert(!after.allowedSourcePaths.includes(root), 'Unmount retained filesystem allow entry.');
      assert(!after.temporaryActiveWatcherPaths.some(path => path === root || path.startsWith(root + '/')), 'Unmount retained active source watch.');
      assert(after.nonBrowserDescendants.length === 0, 'A non-browser child survived the cycle.');
      console.log(JSON.stringify({ cycle, modules: after.modules, transformBytes: after.transformBytes, heapUsed: after.heapUsed, rss: after.rss }));
      await Bun.sleep(Math.max(0, 6000 - (performance.now() - cycleStart)));
    }
    const duration = (performance.now() - loopStarted) / 1000; assert(duration >= 180, 'Measured lifecycle loop was shorter than three minutes.');
    const final = sample('final-neighbor-only');
    await neighbor.screenshot({ path: join(evidence, 'neighbor-after.png'), fullPage: true });
    await browser.close(); browser = undefined; await app.stop();
    const postStop = descendantProcesses(); assert(postStop.length === 0, 'Owned descendants survived complete shutdown.');
    writeFileSync(join(evidence, 'result.json'), JSON.stringify({ at: new Date().toISOString(), cycles: 30, repeatedIdentityCycles: 15, distinctIdentityCycles: 15, loopDurationSeconds: duration, final, postStopDescendants: postStop, neighborSameDocument: true, neighborClicks: 30, forcedGcAtSamples: true, liveAgent: false, samples }, null, 2));
    console.log('PASS: bounded lifecycle soak; inspect retained metadata and measured resource trends, not indefinite stability.');
  }
} finally { await browser?.close(); await app?.stop(); rmSync(directory, { recursive: true, force: true }); }
