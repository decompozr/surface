import type { DeliveryIntent } from '../../client/index';
export const REVISION = 'comment-playground-v2';
export type Target = { id: string; label: string; selector: string; text: string; revision: string };
export type Capture = { png: string; width: number; height: number; capturedAt: string; method: 'dom-render'; bounds: { x: number; y: number; width: number; height: number } };
export type Comment = { id: string; target: Target; text: string; capture?: Capture };
export type Batch = { id: string; createdAt: string; page: string; revision: string; recipient: 'local-fixture' | `codex:${string}`; comments: Comment[]; handling?: 'by-the-way' | 'after-current'; delivery?: DeliveryIntent; deliveryMode?: string; queuedSubmissionId?: string; status: 'pending' | 'accepted' | 'failed' | 'unknown'; receipt?: string; requestId?: string; result?: { message?: string; stage?: 'acknowledged' | 'completed'; next?: 'continue-original' | 'address-now' | 'later' }; error?: string };
export type Draft = { target: Target | null; text: string; capture?: Capture; editing?: string };
export type State = { version: 1; draft: Draft; comments: Comment[]; batches: Batch[] };
export const emptyState = (): State => ({ version: 1, draft: { target: null, text: '' }, comments: [], batches: [] });

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('surface-comment-experiment-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readState(key = 'conversation'): Promise<State> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const request = tx.objectStore('state').get(key);
      tx.oncomplete = () => resolve(request.result?.version === 1 ? request.result : emptyState());
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function writeState(state: State, key = 'conversation'): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(state, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'));
    });
  } finally { db.close(); }
}
