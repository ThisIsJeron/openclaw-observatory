import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { initializeDatabase, pool } from './db/client.js';
import { registerIngestRoutes } from './api/ingest.js';
import { registerSessionRoutes } from './api/sessions.js';
import { registerEventRoutes } from './api/events.js';
import { registerMetricsRoutes } from './api/metrics.js';
import { registerWebSocketRoutes } from './api/websocket.js';
import { registerHealthRoutes } from './api/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.isDevelopment ? {
        target: 'pino-pretty',
        options: { colorize: true },
      } : undefined,
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: config.isDevelopment ? true : false,
    credentials: true,
  });

  await app.register(fastifyWebsocket);

  // Serve static files (React frontend)
  const webDistPath = path.join(__dirname, '..', 'web', 'dist');
  await app.register(fastifyStatic, {
    root: webDistPath,
    prefix: '/',
  });

  // Initialize database with retry
  let dbInitialized = false;
  for (let i = 0; i < 30; i++) {
    try {
      await initializeDatabase();
      dbInitialized = true;
      break;
    } catch (err) {
      console.log(`Waiting for database... (attempt ${i + 1}/30)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!dbInitialized) {
    console.error('Failed to connect to database after 30 attempts');
    process.exit(1);
  }

  // Register API routes
  await registerHealthRoutes(app);
  await registerIngestRoutes(app);
  await registerSessionRoutes(app);
  await registerEventRoutes(app);
  await registerMetricsRoutes(app);
  await registerWebSocketRoutes(app);

  // SPA fallback - serve index.html for non-API routes
  app.setNotFoundHandler(async (request, reply) => {
    if (!request.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({ error: 'Not found' });
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await app.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Observatory server running at http://${config.host}:${config.port}`);
    console.log(`Auth required: ${config.requireAuth}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
