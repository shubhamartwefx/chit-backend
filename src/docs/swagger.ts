import { Express, NextFunction, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env';
import { buildOpenApiDocument } from './openapi';

/**
 * Mount Swagger UI at /api/docs and raw OpenAPI JSON at /api/docs.json.
 * Use Authorize with the JWT from POST /auth/{role}/verify-otp.
 */
export function registerSwagger(app: Express): void {
  const document = buildOpenApiDocument(env.PORT);

  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.json(document);
  });

  app.use(
    '/api/docs',
    (_req: Request, res: Response, next: NextFunction) => {
      // Swagger UI needs inline scripts/styles; relax CSP for this mount only.
      res.removeHeader('Content-Security-Policy');
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(document, {
      explorer: true,
      customSiteTitle: 'Saina Chit Funds API',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        filter: true,
        docExpansion: 'list',
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    })
  );
}
