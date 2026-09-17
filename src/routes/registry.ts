import { Router } from 'express';
import { buildApiPath } from '../config/constants/api-version';
import authRoutes from '../modules/auth/auth.routes';
import superAdminRoutes from '../modules/super-admin/super-admin.routes';
import branchStoreRoutes from '../modules/branch-store/branch-store.routes';
import adminRoutes from '../modules/admin/admin.routes';
import agentRoutes from '../modules/agent/agent.routes';
import bidderRoutes from '../modules/bidder/bidder.routes';
import chitRoutes from '../modules/chits/chit.routes';
import reportsRoutes from '../modules/reports/reports.routes';

export interface RouteMount {
  module: string;
  segment: string;
  path: string;
  router: Router;
  deprecated?: boolean;
}

export function createRouteRegistry(): RouteMount[] {
  return [
    {
      module: 'auth',
      segment: 'auth',
      path: buildApiPath('auth'),
      router: authRoutes,
    },
    {
      module: 'super-admin',
      segment: 'super-admin',
      path: buildApiPath('super-admin'),
      router: superAdminRoutes,
    },
    {
      module: 'branch-store',
      segment: 'branch-store',
      path: buildApiPath('branch-store'),
      router: branchStoreRoutes,
    },
    {
      module: 'admin',
      segment: 'admin',
      path: buildApiPath('admin'),
      router: adminRoutes,
      deprecated: true,
    },
    {
      module: 'agent',
      segment: 'agent',
      path: buildApiPath('agent'),
      router: agentRoutes,
    },
    {
      module: 'bidder',
      segment: 'bidder',
      path: buildApiPath('bidder'),
      router: bidderRoutes,
    },
    {
      module: 'chits',
      segment: 'chits',
      path: buildApiPath('chits'),
      router: chitRoutes,
    },
    {
      module: 'reports',
      segment: 'reports',
      path: buildApiPath('reports'),
      router: reportsRoutes,
    },
  ];
}
