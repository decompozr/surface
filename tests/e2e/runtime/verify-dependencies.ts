import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startSingleton } from '@decompozr/surface-app/server/host/runtime';

const assert: (value: unknown, message: string) => asserts value = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };

const observed = (message: string) => { observations.push(message); console.log(message); };

const project = (name: string, version: string) => {
  const source = join(directory, name); mkdirSync(join(source, 'src'), { recursive: true });
  mkdirSync(join(source, 'packages/mixed-entry'), { recursive: true });
  writeFileSync(join(source, 'package.json'), JSON.stringify({ name, private: true, type: 'module', dependencies: { svelte: '5.57.1', lodash: version, 'mixed-entry': 'file:./packages/mixed-entry' } }));
  writeFileSync(join(source, 'packages/mixed-entry/package.json'), JSON.stringify({ name: 'mixed-entry', version: '1.0.0', type: 'module', main: 'index.js' }));
  writeFileSync(join(source, 'packages/mixed-entry/index.js'), `import lodash from 'lodash'; export const mixed = 'ESM via CJS ' + lodash.VERSION + ': ' + lodash.chunk(['a','b','c'], 2).map(row=>row.join('')).join('|');`);
  writeFileSync(join(source, 'src/Panel.svelte'), `<script>import lodash from 'lodash'; import { mixed } from 'mixed-entry'; import { previewState } from 'virtual:surface-preview'; const count=previewState('count',0);</script><h1>${name}</h1><p data-testid="version">{lodash.VERSION}</p><p data-testid="cjs">{lodash.chunk([1,2,3],2).map(row=>row.join('')).join('|')}</p><p data-testid="mixed">{mixed}</p><button onclick={()=> $count++}>Count {$count}</button>`);
  return source;
};

const manifest = (source: string, prebundle: string[]) => { writeFileSync(join(source, 'artifact.json'), JSON.stringify({ framework: 'svelte', components: 'src', prebundle })); };

const cli = async (...args: string[]) => {
  const child = Bun.spawn([process.execPath, join(process.cwd(), 'apps/cli/src/runtime.ts'), ...args, '--state-dir', stateDir], { stdout: 'pipe', stderr: 'pipe' });
  const [out, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  const result = JSON.parse(out || '{}');
  if (code && result.status !== 'failed') throw new Error(`${args[0]}: ${error}`);
  return result;
};

const directory = realpathSync(mkdtempSync(join(tmpdir(), 'surface-dependencies-')));
const stateDir = join(directory, 'state');
const evidenceDir = join(process.cwd(), '.decompozr/surface/dependency-proof'); mkdirSync(evidenceDir, { recursive: true });
const baselineOnly = process.argv.includes('--baseline');
const observations: string[] = [];
const alpha = project('alpha', '4.17.20'), beta = project('beta', '4.17.21');
let app: Awaited<ReturnType<typeof startSingleton>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  app = await startSingleton({ stateDir, port: 0 });
  const originalVite = app.vite, originalInstance = app.instanceId;
  await cli('namespace', 'deps');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const pageA = await browser.newPage();
  const baselineErrors: string[] = [];
  const frames: string[] = []; pageA.on('websocket', ws => ws.on('framereceived', event => frames.push(String(event.payload))));
  pageA.on('pageerror', error => baselineErrors.push(error.message));
  pageA.on('console', message => { if(message.type() === 'error') baselineErrors.push(message.text()); });
  let mountedA = await cli('mount', alpha, '--namespace', 'deps', '--name', 'alpha');
  await pageA.goto(mountedA.previewUrl + '?component=src%2FPanel.svelte');
  await pageA.waitForFunction(() => !!document.querySelector('h1'), { }, { timeout: 1000 }).catch(() => {});
  assert(baselineErrors.some(message => /export|require|module|CommonJS|500/.test(message)), 'Baseline did not expose its expected CommonJS browser failure: ' + JSON.stringify(baselineErrors));
  assert(await pageA.getByRole('heading').count() === 0, 'Baseline unexpectedly rendered CommonJS.');
  writeFileSync(join(evidenceDir, 'baseline.json'), JSON.stringify({ at: new Date().toISOString(), baselineErrors, mountStatus: mountedA.status }, null, 2));
  observed('Baseline mount reported ready, but unbundled CommonJS failed in Chrome before rendering.');
  if (!baselineOnly) {
    await cli('unmount', '--namespace', 'deps', '--name', 'alpha');
    manifest(alpha, ['lodash', 'mixed-entry']);
    mountedA = await cli('mount', alpha, '--namespace', 'deps', '--name', 'alpha');
    assert(mountedA.status === 'ready', JSON.stringify(mountedA));
    const requestsA: string[] = [], requestsB: string[] = [];
    pageA.on('request', request => { if (request.url().includes('surface-dependency')) requestsA.push(request.url()); });
    await pageA.goto(mountedA.previewUrl + '?component=src%2FPanel.svelte');
    await pageA.getByRole('heading', { name: 'alpha' }).waitFor();
    assert(await pageA.getByTestId('version').textContent() === '4.17.20', 'Alpha loaded wrong CommonJS version.');
    assert(await pageA.getByTestId('cjs').textContent() === '12|3', 'CommonJS function did not execute.');
    assert(await pageA.getByTestId('mixed').textContent() === 'ESM via CJS 4.17.20: ab|c', 'Mixed ESM/CommonJS graph failed.');
    await pageA.getByRole('button').click();
    await pageA.evaluate(() => { (window as any).proofMarker = 'alpha'; });
    manifest(beta, ['lodash', 'mixed-entry']);
    const mountedB = await cli('mount', beta, '--namespace', 'deps', '--name', 'beta');
    assert(mountedB.status === 'ready', JSON.stringify(mountedB));
    const pageB = await browser.newPage();
    pageB.on('request', request => { if (request.url().includes('surface-dependency')) requestsB.push(request.url()); });
    await pageB.goto(mountedB.previewUrl + '?component=src%2FPanel.svelte');
    await pageB.getByRole('heading', { name: 'beta' }).waitFor();
    assert(await pageB.getByTestId('version').textContent() === '4.17.21', 'Beta reused alpha CommonJS version.');
    assert(await pageB.getByTestId('mixed').textContent() === 'ESM via CJS 4.17.21: ab|c', 'Mixed graph crossed source version boundary.');
    assert(requestsA.length > 0 && requestsB.length > 0 && requestsA.every(url => !requestsB.includes(url)), 'Separate sources shared dependency URL cache.');
    assert(await pageA.evaluate(() => (window as any).proofMarker) === 'alpha', 'Adding a dependency mount refreshed alpha.');
    await pageA.getByRole('button', { name: 'Count 1' }).waitFor();
    observed('Scoped prebundles execute lodash 4.17.20 and 4.17.21, plus ESM-to-CJS graphs, without shared dependency URL identity or an unrelated page refresh.');
    const gamma = join(directory, 'gamma'); mkdirSync(join(gamma, 'src'), { recursive: true });
    writeFileSync(join(gamma, 'package.json'), JSON.stringify({ name: 'gamma', private: true, type: 'module', dependencies: { svelte: '5.57.1', slugify: '1.6.6' } }));
    writeFileSync(join(gamma, 'src/Panel.svelte'), `<script>import slugify from 'slugify';</script><h1>New dependency: {slugify('Hello new package', {lower:true})}</h1>`);
    manifest(gamma, ['slugify']);
    const mountedG = await cli('mount', gamma, '--namespace', 'deps', '--name', 'gamma');
    assert(mountedG.status === 'ready', JSON.stringify(mountedG));
    const pageG = await browser.newPage(); await pageG.goto(mountedG.previewUrl + '?component=src%2FPanel.svelte');
    await pageG.getByRole('heading', { name: 'New dependency: hello-new-package' }).waitFor();
    assert(await pageA.evaluate(() => (window as any).proofMarker) === 'alpha', 'New package discovery refreshed existing alpha document.');
    await pageA.getByRole('button', { name: 'Count 1' }).waitFor();
    observed('A third mount introduces slugify 1.6.6 after both existing pages are open; the new CommonJS dependency renders without replacing server/Vite or refreshing alpha.');

    const unsupported = project('unsupported', '4.17.21');
    for (const [name, source] of [['native-entry', `import { readFileSync } from 'node:fs'; export const data=readFileSync('/etc/hosts','utf8');`], ['style-entry', `import './theme.css'; export const styled=true;`]]) {
      const path = join(unsupported, 'packages', name!); mkdirSync(path, { recursive: true });
      writeFileSync(join(path, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module', main: 'index.js' }));
      writeFileSync(join(path, 'index.js'), source!); writeFileSync(join(path, 'theme.css'), 'body{color:purple}');
    }
    const pkg = JSON.parse(readFileSync(join(unsupported, 'package.json'), 'utf8'));
    pkg.dependencies['native-entry'] = 'file:./packages/native-entry'; pkg.dependencies['style-entry'] = 'file:./packages/style-entry';
    writeFileSync(join(unsupported, 'package.json'), JSON.stringify(pkg));
    const failures: Record<string, string> = {};
    for (const entry of ['../secret', 'lodash/../secret', '.', 'missing-entry', 'native-entry', 'style-entry']) {
      manifest(unsupported, [entry]);
      const failed = await cli('mount', unsupported, '--namespace', 'deps', '--name', 'unsupported');
      assert(failed.status === 'failed' && failed.error, `Unsupported entry ${entry} unexpectedly became ready.`);
      failures[entry] = failed.error;
      assert((await fetch(app.origin + '/n/deps/unsupported/')).status === 404, 'Failed prebundle left preview available.');
      assert(await pageA.evaluate(() => (window as any).proofMarker) === 'alpha', 'Failed preparation refreshed a healthy document.');
      await pageB.getByRole('button').click();
    }
    manifest(unsupported, ['lodash', 'mixed-entry']);
    const recovered = await cli('mount', unsupported, '--namespace', 'deps', '--name', 'unsupported');
    assert(recovered.status === 'ready', JSON.stringify(recovered));
    const pageRecovered = await browser.newPage(); await pageRecovered.goto(recovered.previewUrl + '?component=src%2FPanel.svelte');
    await pageRecovered.getByRole('heading', { name: 'unsupported' }).waitFor();
    assert(await pageRecovered.getByTestId('mixed').textContent() === 'ESM via CJS 4.17.21: ab|c', 'Recovery from failed prebundle did not render.');
    assert(await pageA.evaluate(() => (window as any).proofMarker) === 'alpha', 'Recovery refreshed alpha: ' + JSON.stringify(frames));
    observed('Missing package, Node builtin, and CSS-emitting entries fail preparation visibly; correcting only prebundle selection recovers the same mount with frozen installed dependencies, while existing pages stay interactive.');
    await cli('unmount', '--namespace', 'deps', '--name', 'beta');
    await pageB.getByText('Mount is not ready.', { exact: false }).waitFor();
    assert((await fetch(requestsB[0]!)).status === 403, 'Unmount left cached virtual dependency URL readable.');
    assert((await fetch(requestsA[0]!)).status === 200, 'Unmount revoked another source dependency.');
    await cli('mount', beta, '--namespace', 'deps', '--name', 'beta');
    await pageB.goto(mountedB.previewUrl + '?component=src%2FPanel.svelte');
    await pageB.getByRole('heading', { name: 'beta' }).waitFor();
    assert(await pageB.getByTestId('version').textContent() === '4.17.21', 'Remount lost dependency identity.');
    assert(await pageA.evaluate(() => (window as any).proofMarker) === 'alpha', 'Beta unmount/remount refreshed alpha: ' + JSON.stringify(frames));
    await pageA.getByRole('button', { name: 'Count 1' }).waitFor();
    observed('Unmount revokes previously loaded dependency URLs and releases source-local prebundle records; remount rebuilds its own entries without disturbing another source.');
    await pageA.screenshot({ path: join(evidenceDir, 'alpha.png'), fullPage: true });
    await pageB.screenshot({ path: join(evidenceDir, 'beta.png'), fullPage: true });
    assert(app.vite === originalVite && app.instanceId === originalInstance, 'Dependency mounting replaced the singleton.');
    writeFileSync(join(evidenceDir, 'result.json'), JSON.stringify({ at: new Date().toISOString(), observations, failures, requestsA, requestsB, versions: ['4.17.20', '4.17.21'], liveAgent: false }, null, 2));
    console.log('PASS: scoped dependency experiment.');
  }
} finally { await browser?.close(); await app?.stop(); rmSync(directory, { recursive: true, force: true }); }
