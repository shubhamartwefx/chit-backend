export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  BRANCH_STORE: 'branch_store',
  AGENT: 'agent',
  BIDDER: 'bidder',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];
