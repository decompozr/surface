import type { NavigationNode } from '../../../src/server/navigation';
import type { IncomingMessage } from 'node:http';
import type { RuntimeStatus } from './lib/runtime-status';

declare global {
  namespace App {
    interface Platform { req: IncomingMessage & { surfaceNavigation?: NavigationNode[]; surfaceRuntime?: RuntimeStatus } }
    interface Locals { surfaceNavigation?: NavigationNode[]; surfaceRuntime?: RuntimeStatus }
  }
}
export {};
