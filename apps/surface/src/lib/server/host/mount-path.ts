import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { inspectGit } from '../workspaces/identity.ts';

function segment(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || slug.length > 64) throw new Error('A readable route name must contain 1–64 lowercase letters, digits or hyphens.');
  return slug;
}

/** Names are captured on first mount; UUIDs remain the authoritative identities. */
export async function readableMountPath(mount: { projectRoot: string; source: string }) {
  const sourceManifest = join(mount.source, 'artifact.json');
  if (!existsSync(sourceManifest) || !JSON.parse(readFileSync(sourceManifest, 'utf8')).routes) return undefined;
  const manifest = JSON.parse(readFileSync(join(mount.projectRoot, 'artifact.project.json'), 'utf8'));
  const git = await inspectGit(mount.projectRoot);
  return `/workspace/${segment(manifest.name)}/${git.gitDir === git.commonDir ? 'main' : segment(basename(git.root))}/${segment(basename(mount.source))}`;
}
