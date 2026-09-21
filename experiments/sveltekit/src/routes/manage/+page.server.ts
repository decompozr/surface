import { status } from '$lib/server/state';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => status(locals.artifactStateDir);
