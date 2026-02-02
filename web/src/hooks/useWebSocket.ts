import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: 'event' | 'alert' | 'connected' | 'pong';
  data?: unknown;
  message?: string;
}

interface Event {
  id: string;
  timestamp: string;
  eventType: string;
  sessionKey: string;
  gatewayId: string;
}

interface Alert {
  severity: string;
  message: string;
  sessionKey?: string;
  timestamp: string;
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/stream`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        if (message.type === 'event' && message.data) {
          const eventData = message.data as Event;
          setEvents(prev => [eventData, ...prev].slice(0, 100));
        }

        if (message.type === 'alert' && message.data) {
          const alertData = message.data as Omit<Alert, 'timestamp'>;
          setAlerts(prev => [{
            ...alertData,
            timestamp: new Date().toISOString(),
          }, ...prev].slice(0, 50));
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      wsRef.current = null;

      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, []);

  useEffect(() => {
    connect();

    // Ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connected, events, alerts };
}
