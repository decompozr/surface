import { InputError } from '../../contracts/errors.ts';

export const commentReply = (value: unknown) => {
  const data = value as { requestId?: unknown; result?: { message?: unknown; stage?: unknown } } | null;
  if (!data || typeof data.requestId !== 'string' || !data.requestId
    || !data.result || typeof data.result.message !== 'string'
    || !data.result.message.trim() || data.result.message.length > 20_000
    || Object.keys(data.result).some(key => !['message', 'stage'].includes(key))) {
    throw new InputError('Invalid comment reply.');
  }
  const { message, stage } = data.result;
  if (stage !== undefined && stage !== 'acknowledged' && stage !== 'completed') throw new InputError('Invalid reply stage.');
  return { requestId: data.requestId, result: { message, ...(stage ? { stage } : {}) } };
};
