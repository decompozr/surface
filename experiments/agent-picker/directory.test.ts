import {test,expect} from 'bun:test';
import {fixtureDirectory} from '../../apps/surface/src/lib/server/agent-directory';
test('scopes by project and worktree; keeps idle recipients',()=>{const d=fixtureDirectory('normal');expect(d.worktree.map(a=>a.id)).toEqual(['fixture-a','fixture-b']);expect(d.project.map(a=>a.id)).toEqual(['fixture-c']);});
test('unknown connectivity differs from deleted recipient',()=>{expect(fixtureDirectory('offline').available).toBe(false);const d=fixtureDirectory('deleted');expect(d.available).toBe(true);expect(d.worktree.map(a=>a.id)).toEqual(['fixture-b']);});
