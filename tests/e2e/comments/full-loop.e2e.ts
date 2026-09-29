/** Real browser/HTTP/store/SSE; isolated provider protocol fixture, never a real agent socket. */
import { chromium, webkit, devices, expect } from '@playwright/test';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { rmSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = process.cwd();
const output = resolve(process.env.COMMENTS_E2E_OUTPUT ?? '.decompozr/surface/comments-full-e2e'); mkdirSync(output, { recursive: true });
const state = mkdtempSync(join(tmpdir(), 'surface-loop-'));
const socket = join(state, 'fixture.sock');
const token = crypto.randomUUID(), callbackToken = crypto.randomUUID();
const reservation = createNetServer(); await new Promise<void>(r => reservation.listen(0, '127.0.0.1', r));
const port = (reservation.address() as { port: number }).port; await new Promise<void>(r => reservation.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
const http = createServer(); const ws = new WebSocketServer({ server: http });
const activeRecipient = process.env.COMMENTS_E2E_ACTIVE !== '0';
let activeTurn = 'fixture-active-1';
let deliveries: { method: string; params: any }[] = [];
ws.on('connection', client => client.on('message', raw => {
  const message = JSON.parse(raw.toString()); if (message.id === undefined) return;
  let result: unknown;
  if (message.method === 'initialize') result = {};
  else if (message.method === 'thread/read') result = { thread: { id: 'e2e-fixture', cwd: root, status: { type: activeRecipient ? 'active' : 'idle' } } };
  else if (message.method === 'thread/turns/list') result = { data: [{ id: activeTurn, status: 'inProgress' }] };
  else if (message.method === 'turn/steer') { deliveries.push(message); result = { turnId: activeTurn }; }
  else if (message.method === 'thread/queue/add') { deliveries.push(message); result = { queuedSubmission: { id: `queue-${deliveries.length}` } }; }
  else if (message.method === 'turn/start') { deliveries.push(message); result = { turn: { id: `fixture-turn-${deliveries.length}`, status: 'completed' } }; }
  else { client.send(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Fixture does not implement ' + message.method } })); return; }
  client.send(JSON.stringify({ id: message.id, result }));
}));
await new Promise<void>(r => http.listen(socket, r));
writeFileSync(join(state, 'connection.json'), JSON.stringify({ threadId: 'e2e-fixture', projectRoot: root, socketPath: socket, label: 'Isolated E2E receiver', token, callbackToken, origin, resultPath: '/experiments/comments/result' }), { mode: 0o600 });
// Use the immutable, already-built preview release; never rebuild a running service.
if (!process.env.COMMENTS_E2E_BUILD_DIR) throw new Error('Use the comments runner to provide an isolated fixture build.');
const release = resolve(process.env.COMMENTS_E2E_BUILD_DIR);
const log = Bun.file(join(output, 'server.log'));
const server = Bun.spawn(['bun', 'build/index.js'], { cwd: release, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ORIGIN: origin, SURFACE_COMMENTS_ORIGIN: origin, SURFACE_COMMENTS_EXPERIMENT: '1', SURFACE_COMMENTS_STATE_DIR: state, BODY_SIZE_LIMIT: '8M' }, stdout: log, stderr: log });
try {
  await expect.poll(async () => { try { return (await fetch(origin + '/experiments/comments')).status; } catch { return 0; } }).toBe(200);
  for (const mobile of [false, true]) {
    const name = mobile ? 'mobile' : 'desktop';
    const browser = await (mobile ? webkit : chromium).launch();
    const context = await browser.newContext(mobile ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    const count = deliveries.length;
    try {
      await page.goto(origin + '/experiments/comments');
      const tools = page.getByRole('toolbar', { name: 'Comment tools', exact: true });
      await expect(tools.getByRole('button')).toHaveCount(3);
      await tools.getByRole('button', { name: 'Screenshot', exact: true }).click();
      await page.locator('#headline').click();
      await expect(page.getByAltText('Selected element screenshot preview')).toBeVisible();
      await page.locator('#comment').fill(`E2E ${name}: fixture submission`);
      await page.getByRole('button', { name: 'Add comment to draft' }).click();
      const send = page.getByRole('button', { name: 'Send 1 comments together' });
      await expect(page.getByRole('switch', { name: 'Steer delivery', exact: true })).toBeChecked();
      await expect(send).toBeDisabled();
      await page.evaluate(() => document.body.dataset.sameDocument = 'retained');
      await page.goto(origin + '/experiments/comments#connect=invalid-fixture-capability');
      await expect(send).toBeDisabled();
      await page.goto(origin + '/experiments/comments#connect=' + token);
      await expect(send).toBeEnabled();
      expect(await page.evaluate(() => document.body.dataset.sameDocument)).toBe('retained');
      await expect(page.getByText(`E2E ${name}: fixture submission`, { exact: true })).toBeVisible();
      if (activeRecipient) {
      // Change the active turn between the fresh GET observation and POST submission.
      await page.route('**/experiments/comments/batch', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        activeTurn = `changed-${name}`;
        await route.continue();
      });
      await send.click();
      await expect(page.getByRole('region', { name: 'Comment review' }).locator('.notice')).toContainText('Comments remain unsent');
      expect(deliveries.length).toBe(count);
      await page.unroute('**/experiments/comments/batch');
      await expect(send).toBeEnabled();
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
      await page.route('**/experiments/comments/batch', async route => {
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
      const stateData = () => JSON.parse(readFileSync(join(state, 'interactions.json'), 'utf8'));
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
        const args = [request.id, message, '--state-dir', state, ...(stage === 'acknowledged' ? ['--ack'] : [])];
        const command = Bun.spawn(['bun', resolve('apps/cli/src/reply.ts'), ...args], { stdout: 'pipe', stderr: 'pipe' });
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
      await expect(page.locator('.agent-reply')).toHaveText(`Recovered reply ${name}`);
      expect(deliveries.length).toBe(count + 1);
      expect(posts).toBe(1);
      expect(errors).toEqual([]);
      const pane = page.getByRole('complementary', { name: 'Comments and conversation' });
      await expect(pane).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export conversation JSON' })).toHaveCount(0);
      await expect(page.getByRole('contentinfo', { name: 'Connection status' }).getByRole('button', { name: 'Refresh agent' })).toBeVisible();
      await page.getByRole('button', { name: 'Close comments', exact: true }).click();
      await expect(pane).toBeHidden();
      await tools.getByRole('button', { name: 'Comment', exact: true }).click();
      await page.locator('#headline').click();
      await page.locator('#comment').fill('Latest draft ' + name);
      await page.getByRole('button', { name: 'Add comment to draft' }).click();
      await expect.poll(() => page.locator('.conversation').evaluate(node => {
        const scroller = node.parentElement!;
        return scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      })).toBeLessThan(2);
      await expect(page.getByText('Latest draft ' + name, { exact: true })).toBeInViewport();
      // Capture settled geometry, not an intermediate drawer animation frame.
      await expect.poll(async () => {
        const bounds = await pane.boundingBox();
        return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize()!.width + 1;
      }).toBe(true);
      await page.screenshot({ path: join(output, `${name}-result.png`), fullPage: true });
      console.log(`PASS ${name}: stale turn retains draft -> explicit refresh -> steer/queue + lost POST acknowledgement -> automatic monitoring -> concise result -> offline recovery -> reload; exactly one delivery`);
    } catch (error) { await page.screenshot({ path: join(output, `${name}-failure.png`), fullPage: true }); throw error; }
    finally { await context.tracing.stop({ path: join(output, `${name}-trace.zip`) }); await browser.close(); }
  }
  writeFileSync(join(output, 'report.json'), JSON.stringify({ status: 'passed', state, deliveries: deliveries.length, provider: 'isolated protocol fixture', activeRecipient, release, physicalDevice: false }, null, 2));
} finally { server.kill(); await server.exited; ws.close(); http.close(); rmSync(state, { recursive: true, force: true }); }
