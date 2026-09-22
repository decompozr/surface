import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => json(
  locals.surfaceRuntime
    ? { service: 'surface', status: 'ready', runtime: locals.surfaceRuntime }
    : { service: 'surface', status: 'unavailable' },
  { status: locals.surfaceRuntime ? 200 : 503, headers: { 'cache-control': 'no-store' } },
);
