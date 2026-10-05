/** Narrow untrusted persisted JSON before using its fields. */
export const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const string = (value: unknown): value is string => typeof value === 'string';
export const digest = (value: unknown): boolean => string(value) && /^[a-f0-9]{64}$/.test(value);
export const commit = (value: unknown): value is string => string(value) && /^[a-f0-9]{40}$/.test(value);
