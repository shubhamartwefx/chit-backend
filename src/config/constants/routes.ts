import { USER_ROLES, UserRole } from './roles';
import { buildApiPath } from './api-version';

/** URL path segment (kebab) ↔ internal role enum. Includes FE-compatible aliases. */
export const ROLE_URL_MAP = {
  'super-admin': USER_ROLES.SUPER_ADMIN,
  /** @deprecated FE alias — maps to branch_store */
  admin: USER_ROLES.BRANCH_STORE,
  'branch-store': USER_ROLES.BRANCH_STORE,
  agent: USER_ROLES.AGENT,
  bidder: USER_ROLES.BIDDER,
} as const;

export type RoleUrlSlug = keyof typeof ROLE_URL_MAP;

export const ROLE_URL_SLUGS = Object.keys(ROLE_URL_MAP) as RoleUrlSlug[];

export function isRoleUrlSlug(value: string): value is RoleUrlSlug {
  return value in ROLE_URL_MAP;
}

export function urlSlugToRole(slug: RoleUrlSlug): UserRole {
  return ROLE_URL_MAP[slug];
}

export function roleToUrlSlug(role: UserRole): RoleUrlSlug {
  const entry = Object.entries(ROLE_URL_MAP).find(([, r]) => r === role);
  if (!entry) {
    throw new Error(`Unknown role: ${role}`);
  }
  return entry[0] as RoleUrlSlug;
}

/** Primary auth slug per role (used in docs and seed output). */
export const ROLE_PRIMARY_SLUG: Record<UserRole, RoleUrlSlug> = {
  [USER_ROLES.SUPER_ADMIN]: 'super-admin',
  [USER_ROLES.BRANCH_STORE]: 'branch-store',
  [USER_ROLES.AGENT]: 'agent',
  [USER_ROLES.BIDDER]: 'bidder',
};

/** Post-login dashboard paths — must match current FE routes. */
export const ROLE_DASHBOARD_PATH: Record<UserRole, string> = {
  [USER_ROLES.SUPER_ADMIN]: '/dashboard/index',
  [USER_ROLES.BRANCH_STORE]: '/admin-dashboard/index',
  [USER_ROLES.AGENT]: '/agent-dashboard/index',
  [USER_ROLES.BIDDER]: '/Bidder-dashboard/Home',
};

/** API mount prefix for a role module (dynamic version). */
export function getRoleApiPrefix(role: UserRole): string {
  return buildApiPath(ROLE_PRIMARY_SLUG[role]);
}

/** @deprecated Use getRoleApiPrefix(role) — kept for backward-compatible imports. */
export function getRoleApiPrefixes(): Record<UserRole, string> {
  return {
    [USER_ROLES.SUPER_ADMIN]: getRoleApiPrefix(USER_ROLES.SUPER_ADMIN),
    [USER_ROLES.BRANCH_STORE]: getRoleApiPrefix(USER_ROLES.BRANCH_STORE),
    [USER_ROLES.AGENT]: getRoleApiPrefix(USER_ROLES.AGENT),
    [USER_ROLES.BIDDER]: getRoleApiPrefix(USER_ROLES.BIDDER),
  };
}

/**
 * Role value returned in auth API responses for FE compatibility.
 * Internal DB/JWT uses branch_store; FE still expects admin until migrated.
 */
export const CLIENT_ROLE_ALIASES: Partial<Record<UserRole, string>> = {
  [USER_ROLES.BRANCH_STORE]: 'admin',
};

export function toClientRole(role: UserRole): string {
  return CLIENT_ROLE_ALIASES[role] ?? role;
}

/**
 * Resolve a role from FE/client-facing value back to internal enum.
 */
export function fromClientRole(value: string): UserRole | null {
  if (value === 'admin') {
    return USER_ROLES.BRANCH_STORE;
  }
  if (Object.values(USER_ROLES).includes(value as UserRole)) {
    return value as UserRole;
  }
  return null;
}
