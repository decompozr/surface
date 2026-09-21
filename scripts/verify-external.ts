/** Opt-in integration proof. Installs pinned template dependencies in temporary projects.
 * Uses a clearly identified fixture agent; never invokes a model or existing conversation.
 */
import { chromium } from '@playwright/test';
import { mkdtempSync, realpathSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startServer } from '../src/server/index.ts';
const root = resolve(import.meta.dir, '..');
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'artifact-external-proof-')));
const stateDir = join(directory, 'state');
const delivered: string[] = [];
const app = startServer({ stateDir, cliPath: join(root, 'src/cli/index.ts'), uiDir: join(root, 'examples/svelte-feedback/dist'), port: 0,
  adapter: { inspect: async () => ({ status: 'idle' }), deliver: async (_binding, message) => { delivered.push(message); return { mode: 'start', turnId: 'explicit-test-fixture' }; } },
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function command(args: string[], cwd = root) {
  const child = Bun.spawn(args, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [out, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code) throw new Error(`${args.join(' ')} failed (${code})\n${out}\n${error}`);
  return out;
}
async function cli(...args: string[]) { return JSON.parse(await command([process.execPath, join(root, 'src/cli/index.ts'), ...args, '--state-dir', stateDir], directory)); }
const evidence: Record<string, unknown>[] = [];
try {
  for (const framework of ['svelte', 'vanilla']) {
    const project = join(directory, framework);
    await cli('init', '--directory', project, '--framework', framework);
    await command([process.execPath, 'install'], project);
    await command([process.execPath, 'run', 'check'], project);
    await command([process.execPath, 'run', 'build'], project);
    console.log(`${framework}: installed, type-checked, built outside the Artifact checkout`);
    const definition = await cli('register', '--project', project, '--directory', project, '--command-json', JSON.stringify([process.execPath, 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '{port}', '--strictPort']));
    const runtime = await cli('mount', '--runtime', definition.id);
    assert(runtime.status === 'ready', JSON.stringify(runtime));
    app.service.store.update(state => state.bindings.push({ id: framework, projectRoot: project, socketPath: '/fixture', threadId: 'explicit-fixture' }));
    const request = await cli('request', '--binding', framework, '--runtime', runtime.id, '--schema-file', join(project, 'interaction.schema.json'), '--title', 'Independent project proof');
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(request.previewUrl);
    await page.getByLabel('Your message').fill(`Hello from ${framework}`);
    await page.getByRole('button', { name: 'Send to agent' }).click();
    await page.getByRole('status').filter({ hasText: 'Submission accepted' }).waitFor();
    const inspected = await cli('inspect', '--request', request.id);
    assert(inspected.response.data.message === `Hello from ${framework}`, 'Browser data did not arrive intact.');
    // This publication is a fixture, not evidence of a new live model turn.
    await cli('result', '--request', request.id, '--data', JSON.stringify({ message: `${framework} round trip complete`, received: inspected.response.data }));
    await page.getByLabel('Agent result').filter({ hasText: `${framework} round trip complete` }).waitFor();
    await page.reload();
    await page.getByLabel('Agent result').filter({ hasText: `${framework} round trip complete` }).waitFor();
    assert(await page.getByRole('button').isDisabled(), 'Reloaded submitted request must stay disabled.');
    if (framework === 'svelte') {
      const sourcePath = join(project, 'src/App.svelte');
      const source = readFileSync(sourcePath, 'utf8');
      writeFileSync(sourcePath, source.replace('A page for your next idea.', 'Source changes are live.'));
      await page.getByRole('heading', { name: 'Source changes are live.' }).waitFor();
      writeFileSync(sourcePath, source + '\n<script>');
      await page.locator('vite-error-overlay').waitFor();
      writeFileSync(sourcePath, source.replace('A page for your next idea.', 'Recovered from a compile error.'));
      await page.getByRole('heading', { name: 'Recovered from a compile error.' }).waitFor();
      await page.getByLabel('Agent result').filter({ hasText: 'svelte round trip complete' }).waitFor();
      console.log('svelte: hot update and compile-error recovery observed in Chromium');
    }
    mkdirSync(join(root, '.artifact/verification'), { recursive: true });
    await page.screenshot({ path: join(root, `.artifact/verification/${framework}-external.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile viewport overflows.');
    await page.screenshot({ path: join(root, `.artifact/verification/${framework}-mobile.png`), fullPage: true });
    assert(errors.length === 0, errors.join('\n'));
    const oldUrl = runtime.previewUrl;
    await cli('stop', '--runtime', runtime.id);
    let stopped = false;
    try { await fetch(oldUrl); } catch { stopped = true; }
    assert(stopped, 'Stopped runtime still accepts connections.');
    const restarted = await cli('mount', '--runtime', runtime.id);
    assert(restarted.status === 'ready', 'Runtime could not restart.');
    evidence.push({ framework, outsideCheckout: true, typeCheck: 'pass', build: 'pass', browserSubmission: 'pass', cliResultInBrowser: 'pass', sourceRecovery: framework === 'svelte' ? 'pass' : 'not exercised', stopRestart: 'pass', adapter: 'fixture' });
    await page.close();
    console.log(`${framework}: browser/CLI round trip, mobile layout, stop and restart passed`);
  }
  assert(delivered.length === 2, 'Expected exactly one delivery per project.');
  const runtimes = await cli('runtimes');
  assert(runtimes.length === 2 && runtimes.every((runtime: { status: string }) => runtime.status === 'ready'), 'Two runtimes did not coexist.');
  await cli('doctor');
  writeFileSync(join(root, '.artifact/verification/external.json'), JSON.stringify({ at: new Date().toISOString(), evidence, concurrentRuntimes: 2, liveAgent: false }, null, 2));
  console.log('PASS: two independent project runtimes; no model messages sent.');
} finally {
  await browser.close(); await app.stop(); rmSync(directory, { recursive: true, force: true });
}
