import { basename } from 'node:path';
type Directory = { projects: { id: string; commonDir: string; workspaces: { id: string; root: string; branch: string; status: string }[] }[] };
/** Only registered, ready route mounts are navigable. Never enumerate the filesystem. */
export function navigationTree(mounts: NavigationMount[], directory: Directory): NavigationNode[] {
  const result: NavigationNode[] = [];
  for (const project of directory.projects) {
    const representative = mounts.find(mount => mount.publicPath && project.workspaces.some(workspace => workspace.root === mount.projectRoot));
    const label = representative?.publicPath?.split('/')[2]?.replaceAll('-', ' ') ?? basename(project.commonDir.replace(/\/\.git$/, ''));
    const node: NavigationNode = { id: project.id, label, children: [] };
    for (const workspace of project.workspaces.filter(item => item.status === 'active')) {
      const worktree: NavigationNode = { id: workspace.id, label: basename(workspace.root) === workspace.branch ? workspace.branch : `${basename(workspace.root)} · ${workspace.branch}`, children: [] };
      for (const mount of mounts.filter(item => item.status === 'ready' && item.projectRoot === workspace.root && item.publicPath && Object.keys(item.pages ?? {}).length)) {
        const folder: NavigationNode = { id: mount.namespace + '/' + mount.name, label: basename(mount.source), href: mount.publicPath + '/', children: [] };
        for (const route of Object.keys(mount.pages!).sort()) {
          if (!route) { folder.children.push({ id: folder.id + ':home', label: 'Home', href: folder.href, children: [] }); continue; }
          let parent = folder;
          const segments = route.split('/');
          for (let index = 0; index < segments.length; index++) {
            const path = segments.slice(0, index + 1).join('/');
            const id = folder.id + ':' + path;
            let child = parent.children.find(item => item.id === id);
            if (!child) { child = { id, label: segments[index]!, href: mount.publicPath + '/' + path, children: [] }; parent.children.push(child); }
            parent = child;
          }
        }
        worktree.children.push(folder);
      }
      if (worktree.children.length) node.children.push(worktree);
    }
    if (node.children.length) result.push(node);
  }
  return result;
}
import type { NavigationNode, NavigationMount } from '../../contracts/navigation.ts';
export type { NavigationNode, NavigationMount } from '../../contracts/navigation.ts';
