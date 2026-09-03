import {
  DOMAIN_PERMISSIONS,
  PERMISSIONS,
} from '../constants/permissions';

export type SuperAdminTier = 'full' | 'manager' | 'editor';

/** Domain read permissions granted to super_admin editor tier. */
export const SUPER_ADMIN_EDITOR_DOMAIN = DOMAIN_PERMISSIONS.filter((p) =>
  p.endsWith(':read')
);

/** Domain read + write permissions granted to super_admin manager tier. */
export const SUPER_ADMIN_MANAGER_DOMAIN = [...DOMAIN_PERMISSIONS];

/** Resolved permission bundles per super_admin tier. */
export const SUPER_ADMIN_TIER_PERMISSIONS: Record<
  SuperAdminTier,
  readonly string[]
> = {
  full: [PERMISSIONS.PLATFORM.ALL],
  manager: [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    ...SUPER_ADMIN_MANAGER_DOMAIN,
  ],
  editor: [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    ...SUPER_ADMIN_EDITOR_DOMAIN,
  ],
};

export const SUPER_ADMIN_TIERS = ['full', 'manager', 'editor'] as const;
