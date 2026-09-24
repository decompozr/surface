/** Copy into a mounted TypeScript project's included declarations for editor/type-check support. */
declare module 'virtual:surface-preview' {
  import type { Writable } from 'svelte/store';
  /** Preview-session state. Same key/version survives component HMR; full navigation resets it. */
  export const previewState: <T>(key: string, initial: T, version?: number | string) => Writable<T>;
}

/** The singleton host supplies this module; do not add it as a package dependency. */
declare module 'virtual:surface-interactions' {
  export type DeliveryIntent = { mode: 'queue' | 'steer' | 'start'; expectedStatus: string; expectedTurnId?: string };
  export type Recipient = { threadId: string; status: string; turnId?: string; canSubmit: boolean };
  export type Interaction = {
    recipientSelection?: boolean;
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
  export const createInteractionClient: (options?: { api: string; requestId: string; token: string }) => {
    read(): Promise<Interaction>;
    recipient(): Promise<Recipient>;
    configureDelivery(intent?: DeliveryIntent): void;
    directory(): Promise<{ available: boolean; worktree: { id: string; title: string; status: string; workspaceId: string; projectRoot: string }[]; project: { id: string; title: string; status: string; workspaceId: string; projectRoot: string }[]; checkedAt: string }>;
    takeOver(threadId: string): Promise<Interaction & { token: string }>;
    submit(data: Record<string, unknown>, responseId: string, delivery?: DeliveryIntent): Promise<Interaction>;
    waitForResult(options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<Record<string, unknown>>;
  };
}
