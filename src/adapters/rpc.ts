import WebSocket from 'ws';

export class RpcError extends Error {}
export class TransportError extends Error {}
export interface Rpc {
  call<T = unknown>(method: string, params: unknown): Promise<T>;
  close(): void;
}

/** WebSocket over the existing Unix socket; never starts or stops a Codex daemon. */
export class CodexRpc implements Rpc {
  private socket: WebSocket;
  private pending = new Map<number, {
    resolve(value: unknown): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private sequence = 0;
  private closed = false;
  private constructor(socketPath: string, private timeoutMs: number) {
    this.socket = new WebSocket(`ws+unix://${socketPath}:/`, {
      // Codex 0.154.0 closes this local handshake when compression is offered.
      perMessageDeflate: false,
      handshakeTimeout: timeoutMs, maxPayload: 16 * 1024 * 1024,
    });
    this.socket.on('message', bytes => {
      try {
        const message = JSON.parse(bytes.toString());
        if (message.method) {
          if (message.id !== undefined) {
            this.write({ id: message.id, error: { code: -32601, message: 'Surface cannot handle interactive approval requests. Use the owning Codex client.' } });
          }
          return;
        }
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new RpcError(message.error.message ?? 'Codex rejected the request.'));
        else pending.resolve(message.result);
      } catch { this.fail(new TransportError('Invalid Codex control message.')); }
    });
    this.socket.on('error', () => this.fail(new TransportError('Codex control connection failed.')));
    this.socket.on('close', () => this.fail(new TransportError('Codex control connection closed.')));
  }
  static async connect(socketPath: string, timeoutMs = 15_000): Promise<CodexRpc> {
    const rpc = new CodexRpc(socketPath, timeoutMs);
    try {
      await new Promise<void>((resolve, reject) => {
        rpc.socket.once('open', resolve);
        rpc.socket.once('error', () => reject(new TransportError('Unable to open the Codex Unix socket.')));
        rpc.socket.once('close', () => reject(new TransportError('Codex connection closed before initialization.')));
      });
      await rpc.call('initialize', {
        clientInfo: { name: 'surface', title: 'Surface', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      });
      rpc.write({ method: 'initialized', params: {} });
      return rpc;
    } catch (error) { rpc.close(); throw error; }
  }
  private write(message: unknown) {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) throw new TransportError('Codex control connection is closed.');
    this.socket.send(JSON.stringify(message), error => {
      if (error) this.fail(new TransportError('Failed to write to the Codex control connection.'));
    });
  }
  call<T>(method: string, params: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new TransportError(`Codex ${method} timed out; acceptance may be unknown.`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer });
      try { this.write({ id, method, params }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  private fail(error: Error) {
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
    this.closed = true;
  }
  close() {
    this.fail(new TransportError('Surface disconnected.'));
    this.socket.close();
  }
}
