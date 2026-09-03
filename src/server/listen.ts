import { Express } from 'express';
import { Server } from 'http';
import { env } from '../config/env';

export interface ListenResult {
  server: Server;
  port: number;
}

export interface ListenOptions {
  host?: string;
  maxAttempts?: number;
}

function isAddrInUseError(err: unknown): err is NodeJS.ErrnoException {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'EADDRINUSE'
  );
}

export async function listenWithPortFallback(
  app: Express,
  preferredPort: number,
  options: ListenOptions = {}
): Promise<ListenResult> {
  const host = options.host ?? '0.0.0.0';
  const maxAttempts =
    options.maxAttempts ?? env.PORT_FALLBACK_MAX_ATTEMPTS;
  const allowFallback = env.NODE_ENV === 'development';
  const lastPort = preferredPort + maxAttempts - 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = preferredPort + attempt;

    try {
      const server = await new Promise<Server>((resolve, reject) => {
        const instance = app.listen(port, host);

        instance.once('listening', () => resolve(instance));
        instance.once('error', (err) => {
          instance.close();
          reject(err);
        });
      });

      if (attempt > 0) {
        console.warn(
          `[server] Port ${preferredPort} was in use. Listening on ${port} instead.`
        );
      }

      return { server, port };
    } catch (err) {
      if (!isAddrInUseError(err)) {
        throw err;
      }

      if (!allowFallback || attempt === maxAttempts - 1) {
        throw new Error(
          `Port ${preferredPort}${maxAttempts > 1 ? `–${lastPort}` : ''} in use. ` +
            'Stop the other process or set PORT in .env.'
        );
      }

      console.warn(`[server] Port ${port} in use, trying ${port + 1}...`);
    }
  }

  throw new Error(
    `Unable to bind to port ${preferredPort}${maxAttempts > 1 ? `–${lastPort}` : ''}.`
  );
}
