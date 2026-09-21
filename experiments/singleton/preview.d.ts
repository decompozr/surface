/** Copy into a mounted TypeScript project's included declarations for editor/type-check support. */
declare module 'virtual:artifact-preview' {
  import type { Writable } from 'svelte/store';
  /** Preview-session state. Same key/version survives component HMR; full navigation resets it. */
  export function previewState<T>(key: string, initial: T, version?: number | string): Writable<T>;
}
