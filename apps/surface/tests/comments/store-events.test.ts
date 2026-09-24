import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../../src/lib/server/services/store.ts';

test('durable store changes notify subscribers and disconnect removes them', () => {
  const directory = mkdtempSync(join(tmpdir(), 'surface-events-'));
  try {
    const store = new Store(join(directory, 'state.json'));
    let calls = 0;
    const stop = store.subscribe(() => { calls++; expect(store.state.runtimes).toEqual([]); });
    store.subscribe(() => { throw new Error('broken observer'); });
    store.update(() => {});
    expect(calls).toBe(1);
    stop(); store.update(() => {});
    expect(calls).toBe(1);
  } finally { rmSync(directory, { recursive: true }); }
});
