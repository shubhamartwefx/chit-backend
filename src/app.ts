import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { registerSwagger } from './docs/swagger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { registerHealthRoute, registerRoutes } from './routes';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      // Allow Swagger UI assets in non-production; production can tighten later.
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    })
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  registerHealthRoute(app);
  registerSwagger(app);
  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
