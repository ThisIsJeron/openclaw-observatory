import type { FastifyInstance } from 'fastify';
import { IngestRequestSchema } from '../types/events.js';
import { insertEvents } from '../db/client.js';
import { config } from '../config.js';
import { broadcastEvent } from './websocket.js';

export async function registerIngestRoutes(app: FastifyInstance): Promise<void> {
  // Authentication middleware
  app.addHook('preHandler', async (request, reply) => {
    if (config.requireAuth) {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing authorization header' });
      }
      const token = authHeader.slice(7);
      if (token !== config.authToken) {
        return reply.status(403).send({ error: 'Invalid token' });
      }
    }
  });

  // Event ingestion endpoint
  app.post('/api/v1/ingest', async (request, reply) => {
    try {
      const parsed = IngestRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.issues,
        });
      }

      const { events } = parsed.data;

      // Insert events into database
      await insertEvents(events);

      // Broadcast to WebSocket clients for real-time updates
      for (const event of events) {
        broadcastEvent(event);
      }

      return reply.status(200).send({
        success: true,
        received: events.length,
      });
    } catch (err) {
      console.error('Error ingesting events:', err);
      return reply.status(500).send({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });
}
