import type { FastifyInstance } from 'fastify';
import { getMetricsSummary, getHourlyMetrics, getGateways, getAlerts } from '../db/client.js';

export async function registerMetricsRoutes(app: FastifyInstance): Promise<void> {
  // Get metrics summary
  app.get('/api/v1/metrics/summary', async (request, reply) => {
    try {
      const metrics = await getMetricsSummary();

      // Calculate rates per hour
      const hourlyMetrics = await getHourlyMetrics(1);
      const lastHour = hourlyMetrics[0];

      return reply.send({
        ...metrics,
        turnsPerHour: lastHour?.turns || 0,
        errorsPerHour: lastHour?.errors || 0,
        costPerHour: lastHour?.totalCost || 0,
      });
    } catch (err) {
      console.error('Error fetching metrics summary:', err);
      return reply.status(500).send({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // Get hourly metrics
  app.get('/api/v1/metrics/hourly', async (request, reply) => {
    try {
      const query = request.query as { hours?: string };
      const hours = query.hours ? parseInt(query.hours, 10) : 24;

      const metrics = await getHourlyMetrics(hours);

      return reply.send({
        metrics,
        count: metrics.length,
      });
    } catch (err) {
      console.error('Error fetching hourly metrics:', err);
      return reply.status(500).send({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // Get gateways
  app.get('/api/v1/gateways', async (request, reply) => {
    try {
      const gateways = await getGateways();

      return reply.send({
        gateways,
        count: gateways.length,
      });
    } catch (err) {
      console.error('Error fetching gateways:', err);
      return reply.status(500).send({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // Get alerts
  app.get('/api/v1/alerts', async (request, reply) => {
    try {
      const query = request.query as {
        resolved?: string;
        limit?: string;
      };

      const alerts = await getAlerts({
        resolved: query.resolved === 'true' ? true : query.resolved === 'false' ? false : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
      });

      return reply.send({
        alerts,
        count: alerts.length,
      });
    } catch (err) {
      console.error('Error fetching alerts:', err);
      return reply.status(500).send({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });
}
