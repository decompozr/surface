/** Version 1 project operations. Transports authorize callers before executing these operations. */
export const projectOperations = ['init', 'add', 'list', 'register', 'mount', 'unmount', 'archive', 'restore'] as const;
export type ProjectOperation = typeof projectOperations[number];
export type ProjectOperationInput = {
  operation: ProjectOperation;
  /** Absolute path; the service canonicalizes aliases before binding identity. */
  projectRoot: string;
  artifactId?: string;
  /** Project-relative existing source folder, used only by add. */
  source?: string;
  name?: string;
};
export type ProjectScope = { namespace: string; name: string };
export type ProjectMount = ProjectScope & {
  source: string;
  projectRoot: string;
  status: string;
  error?: string;
  previewUrl?: string;
};
/** Runtime ownership stays behind this port; the project service has no HTTP or framework dependency. */
export interface ProjectRuntime {
  namespace(name: string): Promise<unknown>;
  mount(input: ProjectScope & { source: string; projectRoot: string }): Promise<ProjectMount>;
  listMounts(): Promise<ProjectMount[]>;
  unmount(scope: ProjectScope): Promise<ProjectMount>;
}
export type ProjectOutcome = {
  version: 1;
  ok: boolean;
  status: 'ok' | 'rejected' | 'failed';
  data?: unknown;
  error?: { code: string; message: string };
};
export type ProjectArtifact = { id: string; name: string; source: string; archived: boolean };
export type ProjectManifest = { version: 1; projectId: string; name: string; artifacts: ProjectArtifact[] };

/** Host-owned identity integration. Resolve/validate workspace identity before any manifest mutation. */
export type ProjectIdentityResolver = (root: string, manifest: ProjectManifest, operation: ProjectOperation) => Promise<{ namespace: string; workspaceId: string }>;
