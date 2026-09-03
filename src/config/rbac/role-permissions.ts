import {
  AGENT_DEFAULT,
  BIDDER_DEFAULT,
  BRANCH_STORE_ASSIGNABLE,
  PERMISSIONS,
  USER_ROLES,
  UserRole,
} from '../constants';
import { SUPER_ADMIN_TIER_PERMISSIONS } from './super-admin-tiers';

/** Default permissions applied when a role is created without explicit assignment. */
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, readonly string[]> = {
  [USER_ROLES.SUPER_ADMIN]: SUPER_ADMIN_TIER_PERMISSIONS.full,
  [USER_ROLES.BRANCH_STORE]: [],
  [USER_ROLES.AGENT]: AGENT_DEFAULT,
  [USER_ROLES.BIDDER]: BIDDER_DEFAULT,
};

/** Permissions that can be assigned per role at user creation/update time. */
export const ROLE_ASSIGNABLE_PERMISSIONS: Record<UserRole, readonly string[]> =
  {
    [USER_ROLES.SUPER_ADMIN]: [
      PERMISSIONS.PLATFORM.ALL,
      PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
      PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    ],
    [USER_ROLES.BRANCH_STORE]: BRANCH_STORE_ASSIGNABLE,
    [USER_ROLES.AGENT]: AGENT_DEFAULT,
    [USER_ROLES.BIDDER]: BIDDER_DEFAULT,
  };

/** Minimum permissions required to log in per role. */
export const ROLE_LOGIN_MINIMUM: Record<UserRole, readonly string[]> = {
  [USER_ROLES.SUPER_ADMIN]: [
    PERMISSIONS.PLATFORM.ALL,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
  ],
  [USER_ROLES.BRANCH_STORE]: BRANCH_STORE_ASSIGNABLE,
  [USER_ROLES.AGENT]: AGENT_DEFAULT,
  [USER_ROLES.BIDDER]: BIDDER_DEFAULT,
};
