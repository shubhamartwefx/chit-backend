import { PERMISSIONS } from '../constants/permissions';

/**
 * Declarative route → permission map for audit and middleware reference.
 * Format: "METHOD /path" (Express route pattern, no API prefix).
 */
export const ROUTE_PERMISSIONS = {
  'POST /super-admin/branch-stores': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'GET /super-admin/branch-stores': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'POST /super-admin/agents': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'GET /super-admin/agents': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'POST /super-admin/bidders': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'GET /super-admin/bidders': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'POST /super-admin/staff': [PERMISSIONS.PLATFORM.ALL],
  'GET /super-admin/staff': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  /** @deprecated alias */
  'POST /super-admin/admins': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  /** @deprecated alias */
  'GET /super-admin/admins': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'GET /branch-store/health': [],
  'GET /branch-store/agents': [PERMISSIONS.AGENTS.READ],
  'GET /agent/health': [],
  'GET /bidder/health': [],
  'GET /chits': [PERMISSIONS.CHITS.READ],
  'GET /chits/summary': [PERMISSIONS.CHITS.READ],
  'GET /chits/:id': [PERMISSIONS.CHITS.READ],
  'POST /chits': [PERMISSIONS.CHITS.WRITE],
  'PATCH /chits/:id': [PERMISSIONS.CHITS.WRITE],
  'DELETE /chits/:id': [PERMISSIONS.CHITS.WRITE],
  'POST /super-admin/users/:userId/block': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'POST /super-admin/users/:userId/unblock': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
} as const;

export type RoutePermissionKey = keyof typeof ROUTE_PERMISSIONS;
