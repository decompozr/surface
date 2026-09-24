import type { DeliveryIntent } from '../interactions/index.ts';


const database = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Persisted database identity: keep existing user drafts across source refactors.
    const request = indexedDB.open('surface-comment-experiment-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const readState = async (key = 'conversation'): Promise<State> => {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const request = tx.objectStore('state').get(key);
      tx.oncomplete = () => {
        try { resolve(restoreState(request.result)); } catch (error) { reject(error); }
      };
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
};

export const writeState = async (state: State, key = 'conversation'): Promise<void> => {
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
};

export type Target = { id: string; label: string; selector: string; text: string; revision: string };
export type Capture = { png: string; width: number; height: number; capturedAt: string; method: 'dom-render'; bounds: { x: number; y: number; width: number; height: number } };
export type Comment = { id: string; target: Target; text: string; capture?: Capture };
export type Batch = { id: string; createdAt: string; page: string; revision: string; recipient: 'local-fixture' | `codex:${string}`; comments: Comment[]; delivery?: DeliveryIntent; deliveryMode?: string; queuedSubmissionId?: string; status: 'pending' | 'accepted' | 'failed' | 'unknown'; receipt?: string; requestId?: string; result?: { message?: string; stage?: 'acknowledged' | 'completed' }; error?: string };
export type Draft = { target: Target | null; text: string; capture?: Capture; editing?: string };
export type State = { version: 1; draft: Draft; comments: Comment[]; batches: Batch[] };
export const emptyState = (): State => ({ version: 1, draft: { target: null, text: '' }, comments: [], batches: [] });

/** Unknown stored formats are preserved for explicit reconciliation, never reset. */
export const restoreState = (value: unknown): State => {
  if (value === undefined) return emptyState();
  const saved = value as Partial<State> | null;
  if (!saved || saved.version !== 1 || !saved.draft || typeof saved.draft.text !== 'string'
    || !Array.isArray(saved.comments) || !Array.isArray(saved.batches)) {
    throw new Error('Unsupported or invalid stored comments. Existing data was not changed.');
  }
  return saved as State;
};
