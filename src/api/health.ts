import type { FastifyInstance } from 'fastify';
import { healthCheck } from '../db/client.js';
import { getConnectedClientCount } from './websocket.js';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // Health check endpoint
  app.get('/api/v1/health', async (_request, reply) => {
    try {
      const dbHealth = await healthCheck();

      const health = {
        status: dbHealth.database ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        checks: {
          database: dbHealth.database,
          websocketClients: getConnectedClientCount(),
        },
        ...(dbHealth.error && { error: dbHealth.error }),
      };

      const statusCode = dbHealth.database ? 200 : 503;
      return reply.status(statusCode).send(health);
    } catch (err) {
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // Readiness check (for Kubernetes)
  app.get('/api/v1/ready', async (_request, reply) => {
    try {
      const dbHealth = await healthCheck();
      if (dbHealth.database) {
        return reply.status(200).send({ ready: true });
      }
      return reply.status(503).send({ ready: false, error: dbHealth.error });
    } catch (err) {
      return reply.status(503).send({
        ready: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // Liveness check (for Kubernetes)
  app.get('/api/v1/live', async (_request, reply) => {
    return reply.status(200).send({ alive: true });
  });
}
