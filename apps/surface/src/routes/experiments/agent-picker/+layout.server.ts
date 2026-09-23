import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { fixtureDirectory } from '$lib/server/agent-directory';
export function load({url}) {
  if(env.SURFACE_AGENT_PICKER_EXPERIMENT!=='1')error(404);
  const scenario=url.searchParams.get('scenario')??'normal';
  return {agents:fixtureDirectory(scenario),scenario};
}
