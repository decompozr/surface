export type Cursor = { epoch: string; sequence: number };
export type Snapshot<T> = { data: T; cursor: Cursor };
export function validCursor(value: unknown): value is Cursor {
  const c = value as Cursor | null;
  return !!c && typeof c.epoch === 'string' && c.epoch.length > 0 && c.epoch.length < 100 && Number.isSafeInteger(c.sequence) && c.sequence >= 0;
}

// A notification is a hint to read a snapshot, never a domain-state patch.
export class Replica<T> {
  private target?: Cursor;
  private wanted = 0;
  private applied = 0;
  private attempted = 0;
  private enabled = false;
  private closed = false;
  private running?: Promise<void>;
  private abort = new AbortController();
  constructor(private options: {
    read: (signal: AbortSignal) => Promise<Snapshot<T>>;
    dirty: () => boolean;
    apply: (data: T) => void;
    stale: () => void;
    error: (message: string) => void;
  }) {}
  connected(cursor: Cursor) {
    if (this.closed || !validCursor(cursor)) return;
    this.target = { ...cursor }; this.wanted++;
    void this.pump(); // Reconnect reads current state even if no replay is available.
  }
  notify(cursor: Cursor) {
    if (this.closed || !validCursor(cursor) || !this.target || cursor.epoch !== this.target.epoch || cursor.sequence <= this.target.sequence) return;
    this.target = { ...cursor }; this.wanted++; void this.pump();
  }
  load() { if (this.closed) return Promise.resolve(); this.enabled = true; this.wanted++; return this.pump(); }
  settled() { return this.running ?? Promise.resolve(); }
  stop() { this.closed = true; this.abort.abort(); }
  private pump(): Promise<void> {
    if (this.closed || !this.enabled) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.drain().finally(() => {
      this.running = undefined;
      if (!this.closed && this.wanted > this.attempted) void this.pump();
    });
    return this.running;
  }
  private async drain() {
    while (!this.closed && this.applied < this.wanted) {
      this.attempted = this.wanted;
      if (this.options.dirty()) { this.options.stale(); return; }
      const ticket = this.wanted;
      try {
        const snapshot = await this.options.read(this.abort.signal);
        if (this.closed) return;
        if (this.options.dirty()) { this.options.stale(); return; }
        if (ticket !== this.wanted) continue; // Discard delayed reads invalidated in flight.
        if (!validCursor(snapshot.cursor) || this.target && (snapshot.cursor.epoch !== this.target.epoch || snapshot.cursor.sequence < this.target.sequence)) throw new Error('Snapshot is out of date. Reconnect or load again.');
        this.target = { ...snapshot.cursor }; this.applied = ticket;
        this.options.apply(snapshot.data);
      } catch (error) {
        if (!this.closed) this.options.error(String(error));
        return; // No automatic retry of writes, and no busy loop on failed reads.
      }
    }
  }
}

export function watch<T>(url: string, token: string, replica: Replica<T>, status: (text: string) => void) {
  const abort = new AbortController();
  let attempt: AbortController | undefined;
  const cancelAttempt = () => attempt?.abort();
  abort.signal.addEventListener('abort',cancelAttempt);
  window.addEventListener('offline',cancelAttempt);
  const done = (async () => {
    while (!abort.signal.aborted) {
      try {
        attempt = new AbortController();
        const response = await fetch(url, { headers: { 'x-project-capability': token }, signal: attempt.signal, cache: 'no-store' });
        if ([401,403,404].includes(response.status)) { status('Access ended. Reopen this view.'); return; }
        if (!response.ok || !response.body) throw new Error('Stream unavailable');
        const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', ready = false;
        try {
          while (!abort.signal.aborted) {
            const timeout = setTimeout(cancelAttempt,2000);
            const part = await reader.read().finally(() => clearTimeout(timeout)); if (part.done) break;
            buffer += decoder.decode(part.value, { stream: true });
            if (buffer.length > 8192) throw new Error('Oversized event');
            let end: number;
            while ((end = buffer.indexOf('\n\n')) !== -1) {
              const frame = buffer.slice(0,end); buffer = buffer.slice(end+2);
              const type = frame.split('\n').find(line => line.startsWith('event: '))?.slice(7);
              const raw = frame.split('\n').find(line => line.startsWith('data: '))?.slice(6);
              if (!raw) continue; const cursor: unknown = JSON.parse(raw); if (!validCursor(cursor)) throw new Error('Invalid cursor');
              if (type === 'ready') { ready = true; replica.connected(cursor); status('Live updates connected'); }
              else if (type === 'cursor' && ready) replica.notify(cursor);
            }
          }
        } finally { await reader.cancel().catch(() => {}); }
      } catch { /* read-only subscription reconnects; mutations never replay */ }
      if (abort.signal.aborted) return;
      status('Disconnected. Reconnecting…');
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); abort.signal.removeEventListener('abort',finish); resolve(); };
        const timer = setTimeout(finish,250); abort.signal.addEventListener('abort',finish,{once:true});
      });
    }
  })().finally(() => { abort.signal.removeEventListener('abort',cancelAttempt); window.removeEventListener('offline',cancelAttempt); });
  return { done, stop() { abort.abort(); } };
}
