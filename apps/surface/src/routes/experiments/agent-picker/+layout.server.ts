import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { discoverAgents } from '../../../adapters/discovery';
import { fixtureDirectory } from '$lib/server/agent-directory';
export async function load({url}) {
  if(env.SURFACE_AGENT_PICKER_EXPERIMENT!=='1')error(404);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))error(403,'Experiment is loopback-only.');
  if(env.SURFACE_AGENT_DIRECTORY_SOCKET && env.SURFACE_AGENT_DIRECTORY_ROOT) {
    try { return {agents:await discoverAgents(env.SURFACE_AGENT_DIRECTORY_ROOT,env.SURFACE_AGENT_DIRECTORY_SOCKET),scenario:'live-readonly'}; }
    catch { return {agents:{available:false,worktree:[],project:[]},scenario:'live-readonly'}; }
  }
  const scenario=url.searchParams.get('scenario')??'normal';
  return {agents:fixtureDirectory(scenario),scenario};
}
