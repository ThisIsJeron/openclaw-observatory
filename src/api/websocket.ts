import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { ObservatoryEvent } from '../types/events.js';

// Store connected WebSocket clients
const clients = new Set<WebSocket>();

export function broadcastEvent(event: ObservatoryEvent): void {
  const message = JSON.stringify({
    type: 'event',
    data: event,
  });

  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}

export function broadcastAlert(alert: { severity: string; message: string; sessionKey?: string }): void {
  const message = JSON.stringify({
    type: 'alert',
    data: alert,
  });

  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

export async function registerWebSocketRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/stream', { websocket: true }, (socket) => {
    // Add client to set
    clients.add(socket);
    console.log(`WebSocket client connected. Total clients: ${clients.size}`);

    // Send welcome message
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Observatory event stream',
    }));

    // Handle messages from client
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle ping/pong for keepalive
        if (message.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }

        // Handle subscription to specific sessions
        if (message.type === 'subscribe') {
          // Could implement filtered subscriptions here
          socket.send(JSON.stringify({
            type: 'subscribed',
            filter: message.filter,
          }));
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      clients.delete(socket);
      console.log(`WebSocket client disconnected. Total clients: ${clients.size}`);
    });

    // Handle errors
    socket.on('error', (err: Error) => {
      console.error('WebSocket error:', err);
      clients.delete(socket);
    });
  });
}

export function getConnectedClientCount(): number {
  return clients.size;
}
