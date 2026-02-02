import type { ObservatoryEvent, AlertRule } from '../types/events.js';
import { getAlertRules, createAlert } from '../db/client.js';
import { broadcastAlert } from '../api/websocket.js';
import { config } from '../config.js';

// Track last alert time per rule to implement cooldown
const lastAlertTime = new Map<string, number>();

export async function checkAlerts(event: ObservatoryEvent): Promise<void> {
  try {
    const rules = await getAlertRules();

    for (const rule of rules) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastTime = lastAlertTime.get(rule.id);
      if (lastTime && Date.now() - lastTime < rule.cooldownSeconds * 1000) {
        continue;
      }

      // Evaluate condition
      if (evaluateCondition(rule, event)) {
        await triggerAlert(rule, event);
        lastAlertTime.set(rule.id, Date.now());
      }
    }
  } catch (err) {
    console.error('Error checking alerts:', err);
  }
}

function evaluateCondition(rule: AlertRule, event: ObservatoryEvent): boolean {
  const condition = rule.condition.toLowerCase();

  // Context usage checks
  if (condition.includes('tokens_percent_used')) {
    const percentUsed = event.tokens?.percentUsed;
    if (percentUsed === undefined) return false;

    const match = condition.match(/tokens_percent_used\s*>\s*([\d.]+)/);
    if (match) {
      const threshold = parseFloat(match[1]);
      return percentUsed > threshold;
    }
  }

  // Event type checks
  if (condition.includes('event_type')) {
    const match = condition.match(/event_type\s*=\s*(\S+)/);
    if (match) {
      return event.eventType === match[1];
    }
  }

  // Duration checks
  if (condition.includes('duration_ms')) {
    const durationMs = event.timing?.durationMs;
    if (durationMs === undefined) return false;

    const match = condition.match(/duration_ms\s*>\s*(\d+)/);
    if (match) {
      const threshold = parseInt(match[1], 10);
      return durationMs > threshold;
    }
  }

  return false;
}

function interpolateMessage(template: string, event: ObservatoryEvent): string {
  return template
    .replace(/{session_key}/g, event.sessionKey)
    .replace(/{gateway_id}/g, event.gatewayId)
    .replace(/{event_type}/g, event.eventType)
    .replace(/{tokens_percent_used}/g, event.tokens?.percentUsed?.toFixed(1) || 'N/A')
    .replace(/{error_message}/g, event.error?.message || 'N/A')
    .replace(/{duration_ms}/g, event.timing?.durationMs?.toString() || 'N/A')
    .replace(/{tool_name}/g, event.tool?.name || 'N/A');
}

async function triggerAlert(rule: AlertRule, event: ObservatoryEvent): Promise<void> {
  const message = interpolateMessage(rule.messageTemplate, event);

  console.log(`[ALERT] ${rule.severity.toUpperCase()}: ${message}`);

  // Create alert record
  const alert = await createAlert({
    ruleId: rule.id,
    severity: rule.severity,
    message,
    sessionKey: event.sessionKey,
    gatewayId: event.gatewayId,
    metadata: {
      eventType: event.eventType,
      ruleName: rule.name,
    },
  });

  // Broadcast to WebSocket clients
  broadcastAlert({
    severity: rule.severity,
    message,
    sessionKey: event.sessionKey,
  });

  // Send webhook if configured
  if (config.alertWebhookUrl) {
    await sendWebhook(alert, rule);
  }
}

async function sendWebhook(alert: { severity: string; message: string; sessionKey: string | null }, rule: AlertRule): Promise<void> {
  try {
    const payload = {
      text: `[${rule.severity.toUpperCase()}] ${alert.message}`,
      severity: rule.severity,
      session: alert.sessionKey,
      rule: rule.name,
      timestamp: new Date().toISOString(),
    };

    await fetch(config.alertWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Failed to send webhook:', err);
  }
}
