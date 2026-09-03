/**
 * @deprecated Import from './constants' or './rbac' directly.
 * Kept for backward-compatible imports across the codebase.
 */
export {
  USER_ROLES,
  USER_STATUS,
  ROLE_URL_MAP,
  ROLE_URL_SLUGS,
  ROLE_DASHBOARD_PATH,
  ROLE_PRIMARY_SLUG,
  getRoleApiPrefix,
  getRoleApiPrefixes,
  isRoleUrlSlug,
  urlSlugToRole,
  roleToUrlSlug,
  toClientRole,
  fromClientRole,
  CLIENT_ROLE_ALIASES,
  PERMISSIONS,
  ALL_PERMISSIONS,
  DOMAIN_PERMISSIONS,
  BRANCH_STORE_ASSIGNABLE,
  AGENT_DEFAULT,
  BIDDER_DEFAULT,
} from './constants';

export type {
  UserRole,
  UserStatus,
  RoleUrlSlug,
  Permission,
  DomainPermission,
  BranchStoreAssignablePermission,
} from './constants';

/** @deprecated Use BRANCH_STORE_ASSIGNABLE */
export { BRANCH_STORE_ASSIGNABLE as ADMIN_PERMISSIONS } from './constants';

/** @deprecated Use getRoleApiPrefix(role) */
export { getRoleApiPrefixes as ROLE_API_PREFIX } from './constants';

export {
  API_VERSION,
  API_BASE_PATH,
  AUTH_API_PREFIX,
  buildApiPath,
} from './constants/api-version';

export {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  validatePermissionsForRole,
  canLoginWithPermissions,
  permissionsForSuperAdminTier,
  canCreateSuperAdminStaff,
  canCreateBranchStoreUser,
  canListPlatformUsers,
  resolveSuperAdminTier,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_ASSIGNABLE_PERMISSIONS,
  SUPER_ADMIN_TIER_PERMISSIONS,
  ROUTE_PERMISSIONS,
} from './rbac';

export type { SuperAdminTier } from './rbac';
