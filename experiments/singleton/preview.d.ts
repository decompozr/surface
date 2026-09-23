/** Copy into a mounted TypeScript project's included declarations for editor/type-check support. */
declare module 'virtual:surface-preview' {
  import type { Writable } from 'svelte/store';
  /** Preview-session state. Same key/version survives component HMR; full navigation resets it. */
  export function previewState<T>(key: string, initial: T, version?: number | string): Writable<T>;
}

/** The singleton host supplies this module; do not add it as a package dependency. */
declare module 'virtual:surface-client' {
  export type DeliveryIntent = { mode: 'queue' | 'steer' | 'start'; expectedStatus: string; expectedTurnId?: string };
  export type Recipient = { threadId: string; status: string; turnId?: string; canSubmit: boolean };
  export type Interaction = {
    id: string;
    title: string;
    closed: boolean;
    schema: Record<string, unknown>;
    response?: {
      id: string;
      status: 'delivering' | 'accepted' | 'failed' | 'unknown';
      error?: string;
      data: Record<string, unknown>;
    };
    result?: Record<string, unknown>;
  };
  /** Reads the request capability and mount scope from the returned interaction preview URL. */
  export function createSurfaceClient(options?: { api: string; requestId: string; token: string }): {
    read(): Promise<Interaction>;
    recipient(): Promise<Recipient>;
    submit(data: Record<string, unknown>, responseId: string, delivery?: DeliveryIntent): Promise<Interaction>;
    waitForResult(options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<Record<string, unknown>>;
  };
  export const createArtifactClient: typeof createSurfaceClient;
}

/** Compatibility declarations for sources mounted before the Surface rename. */
declare module 'virtual:artifact-preview' { export * from 'virtual:surface-preview'; }
declare module 'virtual:artifact-client' { export * from 'virtual:surface-client'; }
