import type { NavigationNode } from './lib/server/http/navigation.ts';
import type { IncomingMessage } from 'node:http';
import type { RuntimeStatus } from './lib/runtime-status.ts';

declare global {
  namespace App {
    interface Platform { req: IncomingMessage & { surfaceNavigation?: NavigationNode[]; surfaceRuntime?: RuntimeStatus } }
    interface Locals { surfaceNavigation?: NavigationNode[]; surfaceRuntime?: RuntimeStatus }
  }
}
export {};
