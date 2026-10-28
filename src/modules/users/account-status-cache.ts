import { UserStatus } from '../../config/constants';
import { User } from './user.model';

export type CachedAccountStatus = {
  status: UserStatus;
  statusReason: string | null;
};

type CacheEntry = {
  value: CachedAccountStatus;
  expiresAt: number;
};

const TTL_MS = 45_000;
const MAX_ENTRIES = 5_000;

const cache = new Map<string, CacheEntry>();

function pruneIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size <= MAX_ENTRIES) return;
  // Drop oldest insertion-order entries until under cap.
  const overflow = cache.size - MAX_ENTRIES;
  let removed = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

/**
 * Cached user status for authenticate middleware.
 * Misses hit Mongo; hits skip the Atlas round-trip for ~45s.
 */
export async function getAccountStatus(
  userId: string
): Promise<CachedAccountStatus | null> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  if (hit) cache.delete(userId);

  const account = await User.findById(userId)
    .select('status statusReason')
    .lean();

  if (!account) {
    cache.delete(userId);
    return null;
  }

  const value: CachedAccountStatus = {
    status: account.status as UserStatus,
    statusReason: account.statusReason ?? null,
  };

  cache.set(userId, { value, expiresAt: now + TTL_MS });
  pruneIfNeeded();
  return value;
}

export function invalidateAccountStatus(userId: string): void {
  cache.delete(userId);
}

export function invalidateAllAccountStatuses(): void {
  cache.clear();
}
