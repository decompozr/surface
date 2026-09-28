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
writeFileSync(join(project, 'ui/artifact.json'), JSON.stringify({ framework: 'svelte', components: 'routes', routes: 'routes' }));
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
const artifactId = crypto.randomUUID();
writeFileSync(join(project, 'artifact.project.json'), JSON.stringify({ version: 1, projectId: crypto.randomUUID(), name: `Mounted comments ${project.slice(-6)}`, artifacts: [{ id: artifactId, name: 'Review', source: 'ui', archived: false }] }));
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
const mount = (installedHome ? await installedCLI('project', 'mount', '--artifact', artifactId) : await api('/api/v1/projects/operations', { operation: 'mount', projectRoot: project, artifactId })).data;
const binding = installedHome ? await installedCLI('bind', '--project', project, '--thread', 'e2e-fixture', '--socket', socket) : await api('/api/bindings', { projectRoot: project, threadId: 'e2e-fixture', socketPath: socket });
const input = { bindingId: binding.id, namespace: mount.namespace, name: mount.name, component: 'routes/+page.svelte', title: 'Mounted page comments', schema: { type: 'object', required: ['domainChoice'], properties: { domainChoice: { type: 'string' } }, additionalProperties: false } };
  for (const mobile of [false, true]) {
    const name = mobile ? 'mobile' : 'desktop';
    const browser = await (mobile ? webkit : chromium).launch();
    const context = await browser.newContext(mobile ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    const count = deliveries.length;
    writeFileSync(join(project, 'ui/schema.json'), JSON.stringify(input.schema));
    const parent = installedHome ? await installedCLI('request', '--binding', binding.id, '--namespace', mount.namespace, '--name', mount.name, '--component', input.component, '--title', input.title, '--schema-file', join(project, 'ui/schema.json')) : await api('/api/requests', input);
    const preview = new URL(parent.previewUrl); preview.hash = '';
    const token = parent.token;
    const endpoint = `/api/n/${mount.namespace}/${mount.name}/requests/${parent.id}/comments`;
    const commentsState = join(state, 'mounted-comments', parent.id);
    try {
      await page.goto(preview.href);
      await expect(page.getByRole('button', { name: 'Toggle navigation', exact: true }).getByRole('img', { name: 'Surface', exact: true })).toBeVisible();
      const navigation = page.getByRole('complementary', { name: 'Workspace navigation' });
      // Sample the real mounted page throughout opening, not only its final position.
      const frames = await page.evaluate(async () => {
        const main = document.querySelector('#surface-page-content')!;
        const drawer = document.querySelector('#surface-navigation')!;
        const measure = () => {
          const pageBounds = main.getBoundingClientRect(), navBounds = drawer.getBoundingClientRect();
          return { x: pageBounds.x, y: pageBounds.y, width: pageBounds.width, navX: navBounds.x, navWidth: navBounds.width,
            labels: Array.from(drawer.querySelectorAll('a')).map(link => link.getBoundingClientRect().height) };
        };
        const samples = [measure()];
        (document.querySelector('[aria-controls="surface-navigation"]') as HTMLButtonElement).click();
        for (let i = 0; i < 24; i++) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          samples.push(measure());
        }
        return samples;
      });
      for (const frame of frames) {
        expect(frame.width).toBe(frames[0].width);
        expect(frame.y).toBe(frames[0].y);
        expect(frame.navWidth).toBe(frames[0].navWidth);
        expect(frame.labels).toEqual(frames[0].labels);
        expect(Math.abs((frame.x - frames[0].x) - (frame.navX - frames[0].navX))).toBeLessThan(1);
      }
      expect(frames.at(-1)!.x - frames[0].x).toBeCloseTo(frames[0].navWidth, 0);

      await expect.poll(async () => { const bounds = await navigation.boundingBox(); return !!bounds && bounds.width >= 279 && Math.abs(bounds.x) <= 1; }).toBe(true);
      await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
      if (mobile) for (const link of await navigation.getByRole('link').all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // Geometry above deliberately used a programmatic click. Audit actual touch/mouse modality separately.
      const navToggle = page.getByRole('button', { name: 'Toggle navigation', exact: true });
      await (mobile ? navToggle.tap() : navToggle.click());
      await expect(navigation).toBeHidden();
      await (mobile ? navToggle.tap() : navToggle.click());
      await expect.poll(async () => Math.abs((await navigation.boundingBox())?.x ?? 999)).toBeLessThan(1);
      await expect(navigation).toBeFocused();
      await page.screenshot({ path: join(output, name + '-navigation.png'), fullPage: true });
      await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
      if (mobile) await verifyEdgeSwipes(page, false, output, name);
      await page.getByRole('button', { name: /Open comments/ }).click();
      const emptyReview = page.getByRole('region', { name: 'Comment review', exact: true });
      await expect(emptyReview.getByText('No comments yet. Select an element to start.', { exact: true })).toBeVisible();
      await expect(emptyReview.getByRole('button', { name: /Send .* comments together/ })).toHaveCount(0);
      await expect(emptyReview).not.toContainText(input.title);
      await expect.poll(async () => { const bounds = await emptyReview.boundingBox(); return !!bounds && bounds.width >= 348 && bounds.x + bounds.width <= page.viewportSize()!.width + 1; }).toBe(true);
      await page.screenshot({ path: join(output, name + '-empty-comments.png'), fullPage: true });
      await page.getByRole('button', { name: 'Close comments', exact: true }).click();
      await page.getByRole('button', { name: 'Project counter 0', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Project counter 1', exact: true })).toBeVisible();
      await page.getByRole('textbox', { name: 'Project draft', exact: true }).fill('Keep my project draft');
      await page.getByRole('button', { name: 'Select and comment', exact: true }).click();
      await page.getByRole('button', { name: 'Project counter 1', exact: true }).locator('span').click();
      await expect(page.locator('.target-label')).toContainText('button');
      await expect(page.getByRole('button', { name: 'Project counter 1', exact: true })).toBeVisible();
      await page.locator('#option-a h2').click();
      const parentAction = page.getByRole('button', { name: 'Select parent element' });
      await expect(parentAction).toBeVisible();
      await parentAction.click();
      await expect(parentAction).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      expect(await page.getByRole('toolbar', { name: 'Selected element actions' }).evaluate(node => {
        const button = node.querySelector('button')!.getBoundingClientRect();
        const label = node.querySelector('.target-label')!.getBoundingClientRect();
        return label.right <= button.left + 1;
      })).toBe(true);
      await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
      await page.locator('#headline').click();
      const selectedTools = page.getByRole('toolbar', { name: 'Selected element actions' });
      await expect(selectedTools.locator('.target-label')).toHaveText('h1#headline');
      expect(await selectedTools.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
      expect(await selectedTools.evaluate(el => getComputedStyle(el, '::before').backgroundColor)).toBe('rgb(255, 255, 255)');
      expect((await selectedTools.boundingBox())!.width).toBeLessThan(300);
      await page.screenshot({ path: join(output, name + '-selection.png'), fullPage: true });
      await page.getByRole('button', { name: 'Capture selected element', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Select parent element' })).toHaveCount(0);
      await expect(page.getByAltText('Selected element screenshot preview')).toBeVisible();
      await page.locator('#comment').fill(`E2E ${name}: fixture submission`);
      await page.getByRole('button', { name: 'Add comment to draft' }).click();
      await page.getByRole('button', { name: /Open comments/ }).click();
      const send = page.getByRole('button', { name: 'Send 1 comments together' });
      await expect(page.getByRole('switch', { name: 'Steer delivery', exact: true })).toBeChecked();
      await expect(send).toBeDisabled();
      await page.evaluate(() => document.body.dataset.sameDocument = 'retained');
      await page.goto(preview.href + '#token=invalid-fixture-capability');
      await expect(send).toBeDisabled();
      await page.goto(preview.href + '#token=' + token);
      await expect(send).toBeEnabled();
      await expect(page.getByRole('region', { name: 'Agent recipient', exact: true })).toContainText('e2e-fixture');
      await expect(page.getByRole('textbox', { name: 'Project draft', exact: true })).toHaveValue('Keep my project draft');
      expect(await page.evaluate(() => document.body.dataset.sameDocument)).toBe('retained');
      await expect(page.getByText(`E2E ${name}: fixture submission`, { exact: true })).toBeVisible();
      const refresh = page.getByRole('button', { name: 'Refresh agent', exact: true });
      await (mobile ? refresh.tap() : refresh.click());
      await expect(page.getByText('Agent refreshed.', { exact: true })).toBeVisible();
      await expect(refresh).toHaveText('');
      const connected = page.getByRole('button', { name: 'Connected; show connection details', exact: true });
      await expect(connected).toBeVisible();
      await expect(connected).toHaveText('');
      if (mobile) expect(await refresh.evaluate(node => getComputedStyle(node, '::before').backgroundColor)).toBe('rgba(0, 0, 0, 0)');
      await expect.poll(async () => { const bounds = await emptyReview.boundingBox(); return !!bounds && bounds.width >= 348 && bounds.x + bounds.width <= page.viewportSize()!.width + 1; }).toBe(true);
      await page.screenshot({ path: join(output, name + '-refresh-feedback.png'), fullPage: true });
      const inspectionURL = preview.origin + endpoint + '/batch';
      await page.route(inspectionURL, route => route.fulfill({ status: 503, body: 'Isolated refresh failure' }));
      await (mobile ? refresh.tap() : refresh.click());
      await expect(page.getByText('Agent unavailable. Try again.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Agent unavailable; show connection details', exact: true })).toBeVisible();
      expect(deliveries.length).toBe(count);
      await page.unroute(inspectionURL);
      await (mobile ? refresh.tap() : refresh.click());
      await expect(connected).toBeVisible();
      if (activeRecipient) {
      // A turn change must retain the unsent draft until an explicit refresh/send.
      activeTurn = `changed-${name}`;
      await send.click();
      await expect(page.getByRole('region', { name: 'Comment review' }).locator('.notice')).toContainText('Comments remain unsent');
      expect(deliveries.length).toBe(count);
      await expect(send).toBeDisabled();
      await page.getByRole('button', { name: 'Refresh agent', exact: true }).click();
      await expect(send).toBeEnabled();
      await expect(page.getByText('Agent refreshed.', { exact: true })).toBeVisible();
      }
      if (mobile) {
        await page.locator('label').filter({ has: page.getByRole('switch', { name: 'Steer delivery', exact: true }) }).tap();
        await expect(page.getByRole('switch', { name: 'Steer delivery', exact: true })).not.toBeChecked();
        await expect(page.getByText('Queue', { exact: true })).toBeVisible();
      }
      await page.waitForTimeout(200); // Let the shared Switch finish its visual transition.
      await page.screenshot({ path: join(output, `${name}-send-choice.png`), fullPage: true });
      // Drop the POST acknowledgement after server acceptance; inspection is GET-only.
      let posts = 0;
      await page.route('**' + endpoint + '/batch', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        posts++; const response = await route.fetch(); expect(response.status()).toBe(200);
        await route.abort('connectionreset');
      });
      await send.click();
      await expect(page.getByText(activeRecipient && mobile ? 'Queued' : 'Delivered', { exact: true })).toBeVisible();
      await expect(page.getByText('Agent acknowledged', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Check submission', exact: true })).toHaveCount(0);
      await expect(page.getByText('Waiting for reply…', { exact: true })).toBeVisible();
      expect(posts).toBe(1);
      expect(deliveries.at(-1)?.method).toBe(activeRecipient ? mobile ? 'thread/queue/add' : 'turn/steer' : 'turn/start');
      expect(deliveries.length).toBe(count + 1);
      const stateData = () => JSON.parse(readFileSync(join(commentsState, 'interactions.json'), 'utf8'));
      const request = stateData().requests.at(-1);
      expect(request.response.data.comments[0].text).toContain(name);
      const event = JSON.parse(deliveries.at(-1)!.params.input[0].text);
      expect(event.type).toBe('surface.comments'); expect(event.requestId).toBe(request.id);
      expect(Object.keys(event).sort()).toEqual(['comments', 'replyTo', 'requestId', 'type']);
      expect(event.comments[0].text).toContain(name);
      const image = request.response.data.comments[0].capture.imagePath;
      expect(event.comments[0].imagePath).toBe(image);
      expect(readFileSync(image).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      // Publish through the actual callback CLI and assert push without refreshing.
      const reply = async (message: string, stage = 'completed') => {
        const args = [request.id, message, '--state-dir', commentsState, ...(stage === 'acknowledged' ? ['--ack'] : [])];
        const reply = join(release, '../../apps/cli/src/reply.ts');
        const command = Bun.spawn([installedHome ? resolve(release, '../../.distribution/bun') : process.execPath, reply, ...args], { stdout: 'pipe', stderr: 'pipe' });
        expect(await command.exited).toBe(0);
      };
      if (mobile) {
      await reply(`Received ${name}; continuing the original task.`, 'acknowledged');
      await expect(page.getByText('Agent acknowledged', { exact: true })).toBeVisible();
      await expect(page.locator('.agent-reply')).toHaveText(`Received ${name}; continuing the original task.`);
      await expect(page.getByText('Agent replied', { exact: true })).toHaveCount(0);
      await page.screenshot({ path: join(output, `${name}-acknowledged.png`), fullPage: true });
      }
      await reply(`Fixture reply ${name}`);
      await expect(page.locator('.agent-reply')).toHaveText(`Fixture reply ${name}`);
      await expect(page.locator('.reply-wait')).toHaveCount(0);
      // Receive a changed durable result while offline, then reconnect without replay.
      await expect(page.getByRole('button', { name: 'Connected; show connection details', exact: true })).toBeVisible();
      await context.setOffline(true);
      await expect(page.getByText('Connection lost. Reconnecting…', { exact: true })).toBeVisible({ timeout: 15000 });
      await reply(`Recovered reply ${name}`);
      await context.setOffline(false);
      await expect(page.locator('.agent-reply')).toHaveText(`Recovered reply ${name}`, { timeout: 15000 });
      await expect(page.getByText('Live updates reconnected.', { exact: true })).toBeVisible();
      await page.reload();
      await page.getByRole('button', { name: /Open comments/ }).click();
      await expect(page.locator('.agent-reply')).toHaveText(`Recovered reply ${name}`);
      expect(deliveries.length).toBe(count + 1);
      expect(posts).toBe(1);
      expect(errors).toEqual([]);
      const pane = page.getByRole('complementary', { name: 'Comments and conversation' });
      await expect(pane).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export conversation JSON' })).toHaveCount(0);
      await expect(page.getByRole('contentinfo', { name: 'Connection status' }).getByRole('button', { name: 'Refresh agent' })).toBeVisible();
      await page.getByRole('button', { name: 'Close comments', exact: true }).click();
      await page.getByRole('button', { name: 'Select and comment', exact: true }).click();
      await page.locator('#headline').click();
      await page.getByRole('button', { name: 'Comment on selected element', exact: true }).click();
      await page.locator('#comment').fill('Latest draft ' + name);
      await page.getByRole('button', { name: 'Add comment to draft' }).click();
      await page.getByRole('button', { name: /Open comments/ }).click();
      await expect.poll(() => page.locator('.conversation').evaluate(node => {
        const scroller = node.parentElement!;
        return scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      })).toBeLessThan(2);
      await expect(page.getByRole('button', { name: 'Dismiss Added to draft', exact: true })).toHaveCount(0);
      await expect(page.getByText('Latest draft ' + name, { exact: true })).toBeInViewport();
      // Capture settled geometry, not an intermediate drawer animation frame.
      await expect.poll(async () => {
        const bounds = await pane.boundingBox();
        return !!bounds && Math.abs(bounds.width - Math.min(350, page.viewportSize()!.width - 24)) < 1 && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize()!.width + 1;
      }).toBe(true);
      await page.screenshot({ path: join(output, `${name}-result.png`), fullPage: true });
      if (mobile) {
        await page.setViewportSize({ width: 320, height: 568 });
        await expect.poll(async () => Math.abs((await pane.boundingBox())!.width - 296)).toBeLessThan(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: join(output, `${name}-narrow-review.png`) });
        await page.getByRole('button', { name: 'Close comments', exact: true }).click();
        await expect(pane).not.toBeVisible();
        await page.setViewportSize({ width: 390, height: 400 });
        await page.locator('#headline').click();
        await page.getByRole('button', { name: 'Comment on selected element', exact: true }).click();
        await page.locator('#comment').fill('Retain the constrained-height draft');
        const editor = page.getByRole('region', { name: 'Comment on selected element', exact: true });
        await expect.poll(async () => {
          const bounds = await editor.boundingBox();
          return !!bounds && bounds.y >= 0 && bounds.y + bounds.height <= 356;
        }).toBe(true);
        await page.screenshot({ path: join(output, `${name}-short-editor.png`) });
        await page.getByRole('button', { name: 'Close comment editor', exact: true }).click();
        await page.setViewportSize({ width: 390, height: 664 });
      }
      // Separate page/request drafts, capability scope, and original domain response remain intact.
      const domainRecord = await api(`/api/requests/${parent.id}`);
      expect(domainRecord.response).toBeUndefined();
      expect(domainRecord.schema).toEqual(input.schema);
      const foreign = await api('/api/requests', input);
      const unauthorized = await fetch(origin + endpoint + '/batch', { headers: { authorization: `Bearer ${foreign.token}` } });
      expect(unauthorized.status).toBe(401);
      expect((await fetch(origin + endpoint + '/result', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' })).status).toBe(401);
      await page.goto(foreign.previewUrl);
      await page.getByRole('button', { name: /Open comments/ }).click();
      await expect(page.locator('.comment-card')).toHaveCount(0);
      await expect(page.locator('.batch')).toHaveCount(0);
      await page.goto(mount.previewUrl + 'second');
      await page.getByRole('button', { name: /Open comments/ }).click();
      await expect(page.locator('.comment-card')).toHaveCount(0);
      await expect(page.locator('.batch')).toHaveCount(0);
      await page.goto(preview.href + '#token=' + token);
      await page.getByRole('button', { name: /Open comments/ }).click();
      await expect(page.getByText('Latest draft ' + name, { exact: true })).toBeVisible();
      expect(deliveries.length).toBe(count + 1);
      await page.getByRole('button', { name: 'Close comments', exact: true }).click();
      const domainMode = page.getByRole('combobox', { name: 'Delivery mode', exact: true });
      await expect(domainMode).toBeEnabled();
      if (activeRecipient) await domainMode.selectOption('steer');
      await page.getByRole('button', { name: 'Send domain choice', exact: true }).click();
      await expect(page.getByTestId('domain-status')).toHaveText('accepted');
      expect(deliveries.length).toBe(count + 2);
      expect((await api(`/api/requests/${parent.id}`)).response.data).toEqual({ domainChoice: 'keep' });
      await api(`/api/requests/${parent.id}/result`, { message: 'Domain result preserved' });
      await expect(page.getByTestId('domain-result')).toHaveText('Domain result preserved');
      await page.getByRole('button', { name: /Open comments/ }).click();
      await expect(page.locator('.agent-reply')).toHaveText(`Recovered reply ${name}`);
      expect(posts).toBe(1);
      if (process.env.COMMENTS_E2E_BASELINE !== '1') {
      // A future stored format must never be silently replaced by an empty draft.
      const unsupportedKey = await page.evaluate(async () => {
        const key = JSON.parse(document.getElementById('artifact-preview-context')!.textContent!).commentsStorageKey;
        await new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('surface-comment-experiment-v1', 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result, tx = db.transaction('state', 'readwrite');
            tx.objectStore('state').put({ version: 999, preserved: 'future user draft' }, key);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
          };
        });
        return key;
      });
      await page.reload();
      await page.getByRole('button', { name: /Open comments/ }).click();
      await expect(page.getByRole('alert')).toContainText('Existing data is preserved');
      const unsupportedState = await page.evaluate(key => new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('surface-comment-experiment-v1', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction('state', 'readonly');
          const read = tx.objectStore('state').get(key);
          tx.oncomplete = () => { db.close(); resolve(read.result); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      }), unsupportedKey);
      expect(unsupportedState).toEqual({ version: 999, preserved: 'future user draft' });
      await expect.poll(async () => {
        const bounds = await pane.boundingBox();
        return !!bounds && bounds.width >= 296 && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize()!.width + 1;
      }).toBe(true);
      await page.screenshot({ path: join(output, `${name}-unsupported-storage.png`), fullPage: true, animations: 'disabled' });
      }
      expect(errors).toEqual([]);
      console.log(`PASS mounted ${name}: stale turn retains draft -> explicit refresh -> steer/queue + lost POST acknowledgement -> automatic monitoring -> concise result -> offline recovery -> reload; exactly one comment delivery, plus an independent domain form/result`);
    } catch (error) { await page.screenshot({ path: join(output, `${name}-failure.png`), fullPage: true }); throw error; }
    finally { await context.tracing.stop({ path: join(output, `${name}-trace.zip`) }); await browser.close(); }
  }
  writeFileSync(join(output, 'report.json'), JSON.stringify({ status: 'passed', state, deliveries: deliveries.length, provider: 'isolated protocol fixture', activeRecipient, release, installedHome, project, origin, physicalDevice: false, storageGuard: process.env.COMMENTS_E2E_BASELINE !== '1' }, null, 2));
} finally { await app?.stop(); ws.close(); http.close(); rmSync(project, { recursive: true, force: true }); if (!installedHome) rmSync(state, { recursive: true, force: true }); }
