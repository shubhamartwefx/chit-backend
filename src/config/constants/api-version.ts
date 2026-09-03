import { env } from '../env';

/** Normalizes "1" → "v1", "v2" → "v2". */
export function normalizeApiVersion(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (/^v\d+$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    return `v${trimmed}`;
  }
  return trimmed;
}

export const API_VERSION = normalizeApiVersion(env.API_VERSION);

export const API_ROOT = '/api';

export const API_BASE_PATH = `${API_ROOT}/${API_VERSION}`;

export function buildApiPath(...segments: string[]): string {
  const suffix = segments.filter(Boolean).join('/');
  return suffix ? `${API_BASE_PATH}/${suffix}` : API_BASE_PATH;
}

export const AUTH_API_PREFIX = buildApiPath('auth');
