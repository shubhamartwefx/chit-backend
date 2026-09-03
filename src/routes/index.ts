import { Express, Request, Response } from 'express';
import { API_MESSAGES, API_STATUS } from '../common/status';
import { sendSuccess } from '../common/response';
import { createRouteRegistry } from './registry';

export function registerHealthRoute(app: Express): void {
  app.get('/health', (_req: Request, res: Response) => {
    sendSuccess(
      res,
      { service: 'chit-backend', status: 'up' },
      API_MESSAGES.HEALTH_OK,
      API_STATUS.OK.httpStatus
    );
  });
}

export function registerRoutes(app: Express): void {
  const registry = createRouteRegistry();

  for (const mount of registry) {
    app.use(mount.path, mount.router);
  }
}

export { createRouteRegistry } from './registry';
export type { RouteMount } from './registry';
