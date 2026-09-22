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
  'GET /agent/pdfs': [PERMISSIONS.CHITS.READ],
  'POST /agent/pdfs': [PERMISSIONS.CHITS.WRITE],
  'GET /agent/pdfs/:id': [PERMISSIONS.CHITS.READ],
  'PATCH /agent/pdfs/:id': [PERMISSIONS.CHITS.WRITE],
  'DELETE /agent/pdfs/:id': [PERMISSIONS.CHITS.WRITE],
  'GET /agent/reports': [PERMISSIONS.REPORTS.READ],
  'GET /agent/subscription-plans': [PERMISSIONS.CHITS.READ],
  'GET /agent/tutorials': [PERMISSIONS.CHITS.READ],
  'POST /agent/tutorials': [PERMISSIONS.CHITS.WRITE],
  'GET /agent/tutorials/:id': [PERMISSIONS.CHITS.READ],
  'PATCH /agent/tutorials/:id': [PERMISSIONS.CHITS.WRITE],
  'DELETE /agent/tutorials/:id': [PERMISSIONS.CHITS.WRITE],
  'GET /agent/calendar-events': [PERMISSIONS.CHITS.READ],
  'POST /agent/calendar-events': [PERMISSIONS.CHITS.WRITE],
  'GET /agent/calendar-events/:id': [PERMISSIONS.CHITS.READ],
  'PATCH /agent/calendar-events/:id': [PERMISSIONS.CHITS.WRITE],
  'DELETE /agent/calendar-events/:id': [PERMISSIONS.CHITS.WRITE],
  'GET /super-admin/subscription-plans': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'POST /super-admin/subscription-plans': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'PUT /super-admin/subscription-plans': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'PATCH /super-admin/subscription-plans/:id': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
  'DELETE /super-admin/subscription-plans/:id': [
    PERMISSIONS.PLATFORM.SUPER_ADMIN_EDITOR,
    PERMISSIONS.PLATFORM.SUPER_ADMIN_MANAGER,
    PERMISSIONS.PLATFORM.ALL,
  ],
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
  'POST /chits/:id/members/:bidderId/reports': [PERMISSIONS.CHITS.WRITE],
  'PATCH /chits/:id/members/:bidderId/reports/:reportId': [
    PERMISSIONS.CHITS.WRITE,
  ],
  'DELETE /chits/:id/members/:bidderId/reports/:reportId': [
    PERMISSIONS.CHITS.WRITE,
  ],
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
