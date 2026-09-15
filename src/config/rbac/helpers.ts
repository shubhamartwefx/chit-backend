import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  Permission,
  USER_ROLES,
  UserRole,
} from '../constants';
import {
  ROLE_ASSIGNABLE_PERMISSIONS,
  ROLE_LOGIN_MINIMUM,
} from './role-permissions';
import {
  SUPER_ADMIN_TIER_PERMISSIONS,
  SuperAdminTier,
} from './super-admin-tiers';

export function isKnownPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

export function hasWildcard(permissions?: readonly string[] | null): boolean {
  return Array.isArray(permissions) && permissions.includes(PERMISSIONS.PLATFORM.ALL);
}

export function resolveSuperAdminTier(
  permissions: readonly string[]
): SuperAdminTier | null {
  if (hasWildcard(permissions)) {
    return 'full';
  }
  if (permissions.includes(PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER)) {
    return 'manager';
  }
  if (permissions.includes(PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR)) {
    return 'editor';
  }
  return null;
}

/**
 * Super Admin tier hierarchy: full > manager > editor.
 * Manager implicitly satisfies editor-level platform checks.
 */
function tierSatisfiesPlatformCheck(
  permissions: readonly string[],
  required: Permission
): boolean {
  const tier = resolveSuperAdminTier(permissions);
  if (!tier) {
    return permissions.includes(required);
  }

  if (required === PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR) {
    return tier === 'full' || tier === 'manager' || tier === 'editor';
  }
  if (required === PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER) {
    return tier === 'full' || tier === 'manager';
  }
  if (required === PERMISSIONS.PLATFORM.ALL) {
    return tier === 'full';
  }

  return permissions.includes(required);
}

export function hasPermission(
  permissions: readonly string[],
  required: Permission
): boolean {
  if (hasWildcard(permissions)) {
    return true;
  }

  if (
    required === PERMISSIONS.PLATFORM.ALL ||
    required === PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER ||
    required === PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR
  ) {
    return tierSatisfiesPlatformCheck(permissions, required);
  }

  return permissions.includes(required);
}

export function hasAllPermissions(
  permissions: readonly string[],
  required: readonly Permission[]
): boolean {
  return required.every((p) => hasPermission(permissions, p));
}

export function hasAnyPermission(
  permissions: readonly string[],
  options: readonly Permission[]
): boolean {
  return options.some((p) => hasPermission(permissions, p));
}

export function validatePermissionsForRole(
  role: UserRole,
  permissions: readonly string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const assignable = ROLE_ASSIGNABLE_PERMISSIONS[role];

  if (permissions.length === 0 && role === USER_ROLES.BRANCH_STORE) {
    errors.push('Assign at least one permission for branch store users');
  }

  for (const perm of permissions) {
    if (!isKnownPermission(perm)) {
      errors.push(`Unknown permission: ${perm}`);
      continue;
    }
    if (!(assignable as readonly string[]).includes(perm)) {
      errors.push(`Permission not assignable for role ${role}: ${perm}`);
    }
  }

  if (role === USER_ROLES.SUPER_ADMIN && permissions.length > 0) {
    const tier = resolveSuperAdminTier(permissions);
    if (!tier) {
      errors.push(
        'Super admin staff must have *, platform:super_admin:manager, or platform:super_admin:editor'
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function canLoginWithPermissions(
  role: UserRole,
  permissions?: readonly string[] | null
): boolean {
  const perms = permissions ?? [];

  if (hasWildcard(perms)) {
    return true;
  }

  const minimum = ROLE_LOGIN_MINIMUM[role];
  if (!minimum) {
    return false;
  }

  if (role === USER_ROLES.SUPER_ADMIN) {
    return resolveSuperAdminTier(perms) !== null;
  }

  if (role === USER_ROLES.BRANCH_STORE) {
    return perms.some((p) => (minimum as readonly string[]).includes(p));
  }

  return hasAllPermissions(perms, minimum as Permission[]);
}

export function permissionsForSuperAdminTier(
  tier: SuperAdminTier
): readonly string[] {
  return SUPER_ADMIN_TIER_PERMISSIONS[tier];
}

export function canCreateSuperAdminStaff(
  permissions: readonly string[]
): boolean {
  return hasWildcard(permissions);
}

export function canCreateBranchStoreUser(
  permissions: readonly string[]
): boolean {
  return (
    hasWildcard(permissions) ||
    hasPermission(permissions, PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER)
  );
}

export function canListPlatformUsers(
  permissions: readonly string[]
): boolean {
  return (
    hasWildcard(permissions) ||
    hasAnyPermission(permissions, [
      PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
      PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    ])
  );
}
