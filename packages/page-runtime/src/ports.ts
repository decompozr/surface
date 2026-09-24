import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ProjectRuntime, ProjectOutcome } from '@decompozr/surface-contracts/projects';
export type InteractionMount = { namespace: string; name: string; source: string; projectRoot: string; status: string; components: string[]; publicPath?: string; pages?: Record<string, string> };
export interface InteractionPort {
  route(req: IncomingMessage, res: ServerResponse, url: URL, authorized: boolean, body: () => Promise<unknown>, json: (value: unknown, status?: number) => void): Promise<boolean>;
  checkPage(id: string, namespace: string, name: string, component: string): unknown;
  commentContext(id: string): { recipient: string; label: string; live: boolean };
  stop(): Promise<void>;
}
export type ProjectRequest = { pathname: string; method?: string; authorized: boolean; readBody(): Promise<unknown>; json(outcome: ProjectOutcome, status: number): void };
export interface RuntimeIntegration {
  interactions(options: { stateDir: string; find(namespace: string, name: string): InteractionMount }): InteractionPort;
  projects(options: { stateDir: string; runtime: ProjectRuntime; schedule<T>(operation: () => Promise<T>): Promise<T> }): (request: ProjectRequest) => Promise<boolean>;
  presentation: { allowedPaths: string[]; browserClient: string; shellSource: string; beforeComponent: string };
}
