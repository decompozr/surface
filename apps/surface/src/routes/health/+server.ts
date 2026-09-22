import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json(
  { service: 'surface', status: 'ready' },
  { headers: { 'cache-control': 'no-store' } },
);
