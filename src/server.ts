import { createApp } from './app';
import {
  API_BASE_PATH,
  API_VERSION,
} from './config/constants/api-version';
import { connectDatabase } from './config/db';
import { env } from './config/env';
import { listenWithPortFallback } from './server/listen';

async function bootstrap() {
  await connectDatabase();
  const app = createApp();
  const { port } = await listenWithPortFallback(app, env.PORT);

  console.log(`chit-backend listening on http://localhost:${port}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`API version: ${API_VERSION}  →  base path: ${API_BASE_PATH}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
