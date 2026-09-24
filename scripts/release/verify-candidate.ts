/** Installed acceptance only: owns a new fixture home, never the user's installation. */
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, realpathSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { previous: { type: 'string' }, candidate: { type: 'string' }, output: { type: 'string' } } });
if (!values.previous || !values.candidate || !values.output) throw new Error('Use --previous ARCHIVE --candidate ARCHIVE --output NEW_DIRECTORY');
const output = resolve(values.output); mkdirSync(output);
const home = realpathSync(mkdtempSync('/tmp/surface-rc-'));
const project = join(home, 'review-project');
const env: Record<string, string | undefined> = { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', SURFACE_HOME: home };
delete env.SURFACE_STATE_DIR;
const reservation = createServer(); await new Promise<void>(r => reservation.listen(0, '127.0.0.1', r));
const port = (reservation.address() as { port: number }).port; await new Promise<void>(r => reservation.close(() => r()));
let running = false;
async function command(args: string[], cwd = home) {
  const child = Bun.spawn(args, { cwd, env, stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (code) throw new Error(`${args[0]}: ${err}${out}`);
  return out.trim();
}
async function extract(file: string) {
  const archive = resolve(file), digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
  expect(digest).toBe(readFileSync(archive + '.sha256', 'utf8').split(/\s/)[0]);
  await command(['tar', '-xzf', archive, '-C', output]);
  const directory = join(output, basename(archive).replace(/\.tar\.gz$/, ''));
  return { archive, digest, directory, metadata: JSON.parse(readFileSync(join(directory, 'surface-release.json'), 'utf8')) };
}
const previous = await extract(values.previous), candidate = await extract(values.candidate);
writeFileSync(join(output, 'intake.json'), JSON.stringify({ home, project, port, previous, candidate }, null, 2));
mkdirSync(join(project, 'ui/routes'), { recursive: true });
writeFileSync(join(project, 'ui/package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
writeFileSync(join(project, 'ui/artifact.json'), JSON.stringify({ framework: 'svelte', components: 'routes', routes: 'routes' }));
writeFileSync(join(project, 'ui/routes/+page.svelte'), '<main style="padding:24px"><h1 id="release-title">Surface release candidate</h1><p>Project source and comments survive a version change.</p></main>');
await command(['git', 'init', '-q', '-b', 'main'], project);
// Installation owns an empty home. Project source stays beside it, not inside it.
const installationHome = home + '-install';
// Keep the fixture home short enough for the lifecycle Unix socket.
env.SURFACE_HOME = installationHome;
const launcher = join(installationHome, 'bin/surface');
async function installed(...args: string[]) { return JSON.parse(await command([launcher, ...args], project)); }
async function start() { const result = await installed('start', '--port', String(port)); running = true; return result; }
async function stop() { await installed('stop'); running = false; }
const browser = await chromium.launch();
try {
  const old = JSON.parse(await command([join(previous.directory, 'install'), '--home', installationHome]));
  writeFileSync(join(installationHome, 'e2e-fixture.json'), JSON.stringify({ purpose: 'isolated-release-verification' }));
  await start();
  await installed('project', 'init', '--name', 'Surface release acceptance');
  const registered = await installed('project', 'register'); expect(registered.ok).toBe(true);
  const added = await installed('project', 'add', '--source', 'ui', '--name', 'Release review'); expect(added.ok).toBe(true);
  const artifact = JSON.parse(readFileSync(join(project, 'artifact.project.json'), 'utf8')).artifacts[0].id;
  const mounted = await installed('project', 'mount', '--artifact', artifact); expect(mounted.ok).toBe(true);
  const preview = mounted.data.previewUrl;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  await page.goto(preview, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Select and comment', exact: true }).click();
  await page.locator('#release-title').click();
  await page.getByRole('button', { name: 'Comment on selected element', exact: true }).click();
  await page.locator('#comment').fill('Preserve this draft through upgrade and rollback.');
  await page.getByRole('button', { name: 'Add comment to draft' }).click();
  const workspaceBefore = await installed('workspace', 'list');
  await stop();
  // Populate durable accepted comment and independent domain results on the previous version.
  async function comments(releaseId: string, scenario: 'idle' | 'active', folder: string) {
    const app = join(installationHome, 'releases', releaseId, 'apps/surface');
    const child = Bun.spawn([process.execPath, resolve('apps/surface/comments/mounted.e2e.ts')], {
      env: { ...process.env, COMMENTS_E2E_INSTALLED_HOME: installationHome, COMMENTS_E2E_INSTALLED_PORT: String(port), COMMENTS_E2E_APP_DIR: app, COMMENTS_E2E_ACTIVE: scenario === 'active' ? '1' : '0', COMMENTS_E2E_OUTPUT: join(output, folder) },
      stdout: Bun.file(join(output, folder + '.log')), stderr: 'inherit',
    });
    if (await child.exited) throw new Error('Installed comment flow failed: ' + folder);
  }
  await comments(old.release, 'idle', 'previous-idle');
  const state = join(installationHome, 'state');
  const records = [join(state, 'interactions.json'), ...readdirSync(join(state, 'mounted-comments')).map(id => join(state, 'mounted-comments', id, 'interactions.json'))];
  const stored = records.map(path => ({ path, value: readFileSync(path, 'utf8') }));
  const source = readFileSync(join(project, 'ui/routes/+page.svelte'), 'utf8');
  async function retained(label: string) {
    await page.goto(preview, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Open comments/ }).click();
    await expect(page.getByText('Preserve this draft through upgrade and rollback.', { exact: true })).toBeVisible();
    for (const record of stored) expect(readFileSync(record.path, 'utf8')).toBe(record.value);
    expect(readFileSync(join(project, 'ui/routes/+page.svelte'), 'utf8')).toBe(source);
    const workspaces = await installed('workspace', 'list');
    expect(JSON.stringify(workspaces)).toContain(registered.data.workspaceId);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(output, label + '.png') });
  }
  const next = JSON.parse(await command([join(candidate.directory, 'install'), '--home', installationHome]));
  await start(); await retained('upgraded'); await stop();
  await installed('rollback', '--release', old.release); await start(); await retained('rolled-back'); await stop();
  await installed('rollback', '--release', next.release); await start(); await retained('restored-candidate');
  const payload = join(installationHome, 'releases', next.release);
  const requireInstalled = createRequire(join(payload, 'apps/surface/mcp/package.json'));
  const { Client } = requireInstalled('@modelcontextprotocol/client');
  const { StdioClientTransport } = requireInstalled('@modelcontextprotocol/client/stdio');
  const client = new Client({ name: 'candidate-acceptance', version: '1' });
  try {
    await client.connect(new StdioClientTransport({ command: launcher, args: ['mcp'], env, stderr: 'pipe' }));
    const result = await client.callTool({ name: 'surface_project_list', arguments: { projectRoot: project } });
    expect(result.structuredContent.data.workspaceId).toBe(registered.data.workspaceId);
  } finally { await client.close(); }
  await stop();
  await comments(next.release, 'idle', 'candidate-idle');
  await comments(next.release, 'active', 'candidate-active');
  await context.tracing.stop({ path: join(output, 'lifecycle-trace.zip') });
  const report = { status: 'passed', installationHome, previous: previous.metadata.commit, candidate: candidate.metadata.commit, candidateArchive: candidate.archive, candidateSha256: candidate.digest, provider: JSON.parse(readFileSync(join(payload, '.surface-design-system.json'), 'utf8')), preview, port, release: next.release, preservedRecords: stored.length, workspaceBefore, checks: ['bundled launcher and runtime on system-only PATH', 'public project registration, mount, binding and requests', 'browser draft across upgrade, rollback and restoration', 'durable comment and domain results retained', 'project source and workspace identity retained', 'installed MCP listing', 'installed previous idle and candidate idle/active Chromium/WebKit flows'], physicalDevice: false, liveAgentDelivery: false };
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  writeFileSync(join(output, 'failure.json'), JSON.stringify({ installationHome, error: String(error) }, null, 2)); throw error;
} finally {
  await browser.close();
  if (running) await stop();
}
