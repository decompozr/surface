import type { IncomingMessage } from 'node:http';
declare global {
  namespace App {
    interface Platform { req: IncomingMessage & { artifactStateDir?: string } }
    interface Locals { artifactStateDir: string }
  }
}
export {};
