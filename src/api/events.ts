import type { FastifyInstance } from 'fastify';
import { queryEvents } from '../db/client.js';

export async function registerEventRoutes(app: FastifyInstance): Promise<void> {
  // Query events
  app.get('/api/v1/events', async (request, reply) => {
    try {
      const query = request.query as {
        type?: string;
        gatewayId?: string;
        sessionKey?: string;
        startTime?: string;
        endTime?: string;
        limit?: string;
        offset?: string;
      };

      const events = await queryEvents({
        eventType: query.type,
        gatewayId: query.gatewayId,
        sessionKey: query.sessionKey,
        startTime: query.startTime,
        endTime: query.endTime,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
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
      console.error('Error querying events:', err);
      return reply.status(500).send({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });
}
