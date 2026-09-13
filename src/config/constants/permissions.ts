/**
 * Permission catalog — grouped in fixed order:
 * platform → branches → agents → bidders → chits → reports → notifications
 */
export const PERMISSIONS = {
  PLATFORM: {
    ALL: '*',
    SUPER_ADMIN_EDITOR: 'platform:super_admin:editor',
    SUPER_ADMIN_MANAGER: 'platform:super_admin:manager',
  },
  BRANCHES: {
    READ: 'branches:read',
    WRITE: 'branches:write',
  },
  AGENTS: {
    READ: 'agents:read',
    WRITE: 'agents:write',
  },
  BIDDERS: {
    READ: 'bidders:read',
    WRITE: 'bidders:write',
  },
  CHITS: {
    READ: 'chits:read',
    WRITE: 'chits:write',
  },
  REPORTS: {
    READ: 'reports:read',
  },
  NOTIFICATIONS: {
    READ: 'notifications:read',
    WRITE: 'notifications:write',
  },
} as const;

/** Flat list of every domain permission (excludes platform tier markers and wildcard). */
export const DOMAIN_PERMISSIONS = [
  PERMISSIONS.BRANCHES.READ,
  PERMISSIONS.BRANCHES.WRITE,
  PERMISSIONS.AGENTS.READ,
  PERMISSIONS.AGENTS.WRITE,
  PERMISSIONS.BIDDERS.READ,
  PERMISSIONS.BIDDERS.WRITE,
  PERMISSIONS.CHITS.READ,
  PERMISSIONS.CHITS.WRITE,
  PERMISSIONS.REPORTS.READ,
  PERMISSIONS.NOTIFICATIONS.READ,
  PERMISSIONS.NOTIFICATIONS.WRITE,
] as const;

export type DomainPermission = (typeof DOMAIN_PERMISSIONS)[number];

export const PLATFORM_TIER_PERMISSIONS = [
  PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
  PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
] as const;

export type PlatformTierPermission =
  (typeof PLATFORM_TIER_PERMISSIONS)[number];

export const ALL_PERMISSIONS = [
  PERMISSIONS.PLATFORM.ALL,
  ...PLATFORM_TIER_PERMISSIONS,
  ...DOMAIN_PERMISSIONS,
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** Permissions Super Admin can assign to branch_store users. */
export const BRANCH_STORE_ASSIGNABLE = [...DOMAIN_PERMISSIONS] as const;

export type BranchStoreAssignablePermission =
  (typeof BRANCH_STORE_ASSIGNABLE)[number];

/** Fixed permission set assigned to agent users on creation. */
export const AGENT_DEFAULT = [
  PERMISSIONS.AGENTS.READ,
  PERMISSIONS.BIDDERS.READ,
  PERMISSIONS.BIDDERS.WRITE,
  PERMISSIONS.CHITS.READ,
  PERMISSIONS.CHITS.WRITE,
  PERMISSIONS.REPORTS.READ,
  PERMISSIONS.NOTIFICATIONS.READ,
] as const;

/** Fixed permission set assigned to bidder users on creation. */
export const BIDDER_DEFAULT = [
  PERMISSIONS.CHITS.READ,
  PERMISSIONS.REPORTS.READ,
  PERMISSIONS.NOTIFICATIONS.READ,
] as const;
