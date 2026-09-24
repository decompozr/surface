import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CommentDelivery, UnsubmittedCommentError, type Connection } from './delivery.ts';
import { validateBatch } from '../../comment-experiment/validate.ts';
import { InputError, type Service } from '../services/service.ts';
import type { RequestRecord } from '../services/store.ts';
import type { AgentAdapter } from '../agent-adapters/codex.ts';


/** One comment conversation per existing page request. Never changes its domain response/schema. */
export const mountedComments = (stateDir: string, service: Service, adapter: AgentAdapter) => {

  const bridgeFor = (record: RequestRecord, url: URL) => {
    let bridge = bridges.get(record.id);
    if (bridge) return bridge;
    const binding = service.store.state.bindings.find(item => item.id === record.bindingId)!;
    const directory = join(stateDir, 'mounted-comments', record.id);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const file = join(directory, 'connection.json');
    const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Connection : undefined;
    const scope = record.previewScope!;
    const connection: Connection = {
      threadId: binding.threadId, projectRoot: binding.projectRoot, socketPath: binding.socketPath,
      label: record.title, token: record.token, callbackToken: old?.callbackToken ?? randomBytes(32).toString('hex'),
      origin: url.origin, resultCli: join(import.meta.dir, '../../../../../../apps/cli/src/reply.ts'),
      resultPath: `/api/n/${scope.namespace}/${scope.name}/requests/${record.id}/comments/result`,
    };
    writeFileSync(file, JSON.stringify(connection), { mode: 0o600 });
    bridge = new CommentDelivery(directory, connection, adapter);
    bridges.set(record.id, bridge);
    return bridge;
  };


  const body = async (req: IncomingMessage, limit = 8_000_000) => {
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new InputError('Expected JSON.', 415);
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > limit) throw new InputError('Comment payload too large.', 413);
      chunks.push(Buffer.from(chunk));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new InputError('Invalid JSON.'); }
  };

  const bridges = new Map<string, CommentDelivery>();
  const streams = new Set<() => void>();
  const equal = (a: string, b: string) => {
    const left = Buffer.from(a), right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  };
  return {
    async route(req: IncomingMessage, res: ServerResponse, url: URL, json: (data: unknown, status?: number) => void,
      check: (record: RequestRecord) => { publicPath?: string; pages?: Record<string, string> }) {
      const match = /^\/api\/n\/([a-z0-9-]+)\/([a-z0-9-]+)\/requests\/([a-f0-9-]+)\/comments\/(batch|events|result)$/.exec(url.pathname);
      if (!match) return false;
      const record = service.get(match[3]!);
      const scope = record.previewScope;
      if (!scope || scope.namespace !== match[1] || scope.name !== match[2]) throw new InputError('Comments belong to a different mount.', 403);
      const bearer = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const operation = match[4];
      // Browser tokens never authorize replies. Callback remains usable after closing/unmounting.
      if (operation !== 'result') {
        if (!equal(bearer, record.token)) throw new InputError('Comment authorization required.', 401);
        check(record);
      } else {
        const file = join(stateDir, 'mounted-comments', record.id, 'connection.json');
        if (!existsSync(file) || !equal(bearer, JSON.parse(readFileSync(file, 'utf8')).callbackToken)) throw new InputError('Reply authorization required.', 401);
      }
      const bridge = bridgeFor(record, url);
      if (operation === 'batch' && req.method === 'GET') {
        const id = url.searchParams.get('id');
        if (id) json(bridge.view(id));
        else {
          try { json({ available: !record.closed, ...await bridge.inspect(), recipient: `codex:${bridge.connection.threadId}` }); }
          catch { json({ available: false, status: 'unavailable' }); }
        }
      } else if (operation === 'batch' && req.method === 'POST') {
        if (req.headers.origin !== url.origin) throw new InputError('Same-origin submission required.', 403);
        const batch = await body(req);
        if (!validateBatch(batch, `codex:${bridge.connection.threadId}`)) throw new InputError('Invalid comment batch.');
        const mount = check(record);
        const route = Object.entries(mount.pages ?? {}).find(([, component]) => component === scope.component)?.[0];
        const expectedPage = mount.publicPath && route !== undefined ? `${mount.publicPath}/${route}` : `/n/${scope.namespace}/${scope.name}/`;
        if (batch.page.replace(/\/$/, '') !== expectedPage.replace(/\/$/, '')) throw new InputError('Comments belong to a different page.', 403);
        const guard = () => {
          try { check(service.get(record.id)); } catch { throw new UnsubmittedCommentError('This mounted page is unavailable.'); }
          if (service.get(record.id).closed) throw new UnsubmittedCommentError('This page request is closed.');
        };
        try { json(await bridge.submit(batch, guard)); }
        catch (cause) { json({ message: cause instanceof Error ? cause.message : 'Delivery failed.', notSubmitted: cause instanceof UnsubmittedCommentError }, 409); }
      } else if (operation === 'result' && req.method === 'POST') {
        const data = await body(req, 50_000);
        if (!data || typeof data.requestId !== 'string' || typeof data.result?.message !== 'string' || data.result.message.length > 20_000) throw new InputError('Invalid reply.');
        const { stage, next } = data.result;
        if (stage !== undefined && !['acknowledged', 'completed'].includes(stage)) throw new InputError('Invalid reply stage.');
        if (next !== undefined && (stage !== 'acknowledged' || !['continue-original', 'address-now', 'later'].includes(next))) throw new InputError('Invalid next action.');
        json(bridge.service.result(data.requestId, data.result));
      } else if (operation === 'events' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' });
        const snapshot = () => {
          try { check(service.get(record.id)); } catch { close(); return; }
          const batches = bridge.service.store.state.requests.filter(item => item.runtimeId?.startsWith('comments:')).map(item => bridge.view(item.runtimeId!.slice(9)));
          if (!res.write('event: snapshot\ndata: ' + JSON.stringify({ batches }) + '\n\n')) close();
        };
        const close = () => { unsubscribe(); clearInterval(heartbeat); streams.delete(close); res.end(); };
        const unsubscribe = bridge.service.store.subscribe(snapshot);
        const heartbeat = setInterval(() => { try { check(service.get(record.id)); res.write(': heartbeat\n\n'); } catch { close(); } }, 15_000);
        streams.add(close); res.on('close', close); snapshot();
      } else throw new InputError('Method not allowed.', 405);
      return true;
    },
    stop() { for (const close of streams) close(); },
  };
};
