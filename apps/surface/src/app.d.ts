import type { IncomingMessage } from 'node:http';
import type { RuntimeStatus } from './lib/runtime-status';

declare global {
  namespace App {
    interface Platform { req: IncomingMessage & { surfaceRuntime?: RuntimeStatus } }
    interface Locals { surfaceRuntime?: RuntimeStatus }
  }
}
export {};
