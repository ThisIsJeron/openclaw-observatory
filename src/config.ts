import 'dotenv/config';

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3200', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgres://observatory:observatory@localhost:5432/observatory',

  // Authentication
  authToken: process.env.OBSERVATORY_TOKEN || '',

  // Alerting
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || '',

  // Retention
  retentionDays: parseInt(process.env.RETENTION_DAYS || '30', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Node environment
  nodeEnv: process.env.NODE_ENV || 'development',

  // Derived values
  get isDevelopment() {
    return this.nodeEnv === 'development';
  },

  get isProduction() {
    return this.nodeEnv === 'production';
  },

  get requireAuth() {
    return !!this.authToken;
  },
};

export type Config = typeof config;
