import { json } from '@sveltejs/kit';
import { status } from '$lib/server/state';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ locals }) => json(status(locals.artifactStateDir), { headers: { 'cache-control': 'no-store' } });
