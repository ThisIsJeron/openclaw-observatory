import type { FastifyInstance } from 'fastify';
import { getSessions, getSession, getSessionEvents } from '../db/client.js';
import type { SessionSummary, SessionResponse } from '../types/events.js';

function toSessionResponse(session: SessionSummary): SessionResponse {
  const now = new Date();
  const lastEvent = new Date(session.last_event_at);
  const minutesSinceLastEvent = (now.getTime() - lastEvent.getTime()) / (1000 * 60);

  let status: SessionResponse['status'];
  if (session.is_ended) {
    status = 'ended';
  } else if (session.error_count > 0) {
    status = 'error';
  } else if (minutesSinceLastEvent > 5) {
    status = 'idle';
  } else {
    status = 'active';
  }

  return {
    sessionKey: session.session_key,
    gatewayId: session.gateway_id,
    parentSessionKey: session.parent_session_key,
    agentId: session.agent_id,
    channel: session.channel,
    startedAt: new Date(session.started_at).toISOString(),
    lastEventAt: new Date(session.last_event_at).toISOString(),
    eventCount: Number(session.event_count),
    turnCount: Number(session.turn_count),
    errorCount: Number(session.error_count),
    totalCost: Number(session.total_cost),
    maxContextUsed: session.max_context_used,
    contextMax: session.context_max,
    maxContextPercent: session.max_context_percent,
    isEnded: session.is_ended,
    status,
  };
}

export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
  // List sessions
  app.get('/api/v1/sessions', async (request, reply) => {
    try {
      const query = request.query as {
        gatewayId?: string;
        status?: string;
        limit?: string;
        offset?: string;
      };

      const sessions = await getSessions({
        gatewayId: query.gatewayId,
        status: query.status,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return reply.send({
        sessions: sessions.map(toSessionResponse),
        count: sessions.length,
      });
    } catch (err) {
      console.error('Error fetching sessions:', err);
      return reply.status(500).send({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // Get single session
  app.get('/api/v1/sessions/:key', async (request, reply) => {
    try {
      const params = request.params as { key: string };
      const session = await getSession(params.key);

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      return reply.send(toSessionResponse(session));
    } catch (err) {
      console.error('Error fetching session:', err);
      return reply.status(500).send({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // Get session events
  app.get('/api/v1/sessions/:key/events', async (request, reply) => {
    try {
      const params = request.params as { key: string };
      const query = request.query as {
        limit?: string;
        offset?: string;
        eventType?: string;
      };

      const events = await getSessionEvents(params.key, {
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        eventType: query.eventType,
      });

      // Transform to API format
      const transformedEvents = events.map(event => ({
        id: event.id,
        timestamp: event.timestamp.toISOString(),
        eventType: event.event_type,
        gatewayId: event.gateway_id,
        sessionKey: event.session_key,
        parentSessionKey: event.parent_session_key,
        agentId: event.agent_id,
        channel: event.channel,
        turnId: event.turn_id,
        messageId: event.message_id,
        tokens: event.tokens_input !== null ? {
          input: event.tokens_input,
          output: event.tokens_output,
          total: event.tokens_total,
          contextUsed: event.tokens_context_used,
          contextMax: event.tokens_context_max,
          percentUsed: event.tokens_percent_used,
        } : null,
        timing: event.duration_ms !== null ? {
          startMs: event.timing_start_ms,
          endMs: event.timing_end_ms,
          durationMs: event.duration_ms,
          ttftMs: event.ttft_ms,
        } : null,
        tool: event.tool_name ? {
          name: event.tool_name,
          error: event.tool_error,
        } : null,
        error: event.error_type ? {
          type: event.error_type,
          message: event.error_message,
          retriable: event.error_retriable,
        } : null,
        model: event.model_provider ? {
          provider: event.model_provider,
          modelId: event.model_id,
        } : null,
        cost: event.cost_total !== null ? {
          inputCost: event.cost_input,
          outputCost: event.cost_output,
          totalCost: event.cost_total,
        } : null,
        payload: event.payload,
      }));

      return reply.send({
        events: transformedEvents,
        count: transformedEvents.length,
      });
    } catch (err) {
      console.error('Error fetching session events:', err);
      return reply.status(500).send({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });
}
