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
  'GET /branch-store/bidders': [PERMISSIONS.BIDDERS.READ],
  'POST /branch-store/bidders': [PERMISSIONS.BIDDERS.WRITE],
  'POST /branch-store/bidders/:id/block': [PERMISSIONS.BIDDERS.WRITE],
  'POST /branch-store/bidders/:id/unblock': [PERMISSIONS.BIDDERS.WRITE],
  'GET /agent/health': [],
  'GET /agent/bidders': [PERMISSIONS.BIDDERS.READ],
  'POST /agent/bidders': [PERMISSIONS.BIDDERS.WRITE],
  'POST /agent/bidders/:id/block': [PERMISSIONS.BIDDERS.WRITE],
  'POST /agent/bidders/:id/unblock': [PERMISSIONS.BIDDERS.WRITE],
  'GET /bidder/health': [],
  'POST /bidder/chits/:id/join': [PERMISSIONS.CHITS.READ],
  'GET /chits': [PERMISSIONS.CHITS.READ],
  'GET /chits/summary': [PERMISSIONS.CHITS.READ],
  'GET /chits/:id': [PERMISSIONS.CHITS.READ],
  'POST /chits': [PERMISSIONS.CHITS.WRITE],
  'PATCH /chits/:id': [PERMISSIONS.CHITS.WRITE],
  'DELETE /chits/:id': [PERMISSIONS.CHITS.WRITE],
  'POST /chits/:id/members': [PERMISSIONS.CHITS.WRITE],
  'PATCH /chits/:id/members/:bidderId': [PERMISSIONS.CHITS.WRITE],
  'DELETE /chits/:id/members/:bidderId': [PERMISSIONS.CHITS.WRITE],
  'GET /chits/:id/installments': [PERMISSIONS.CHITS.READ],
  'POST /chits/:id/installments': [PERMISSIONS.CHITS.WRITE],
  'GET /chits/:id/auction-rounds': [PERMISSIONS.CHITS.READ],
  'POST /chits/:id/auction-rounds': [PERMISSIONS.CHITS.WRITE],
  'GET /chits/:id/auction-rounds/:roundId': [PERMISSIONS.CHITS.READ],
  'POST /chits/:id/auction-rounds/:roundId/bids': [PERMISSIONS.CHITS.READ],
  'POST /chits/:id/auction-rounds/:roundId/close': [PERMISSIONS.CHITS.WRITE],
  'GET /reports/overview': [PERMISSIONS.REPORTS.READ],
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
