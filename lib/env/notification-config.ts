import { z } from 'zod';

const notificationEnvSchema = z.object({
  PUSHOVER_USER_KEY: z.string().min(1, 'PUSHOVER_USER_KEY is required'),
  PUSHOVER_APP_TOKEN: z.string().min(1, 'PUSHOVER_APP_TOKEN is required'),
  SENTRY_WEBHOOK_SECRET: z.string().min(1, 'SENTRY_WEBHOOK_SECRET is required'),
});

export type NotificationEnv = z.infer<typeof notificationEnvSchema>;

let cachedConfig: NotificationEnv | null = null;

// For testing purposes
export function clearConfigCache() {
  cachedConfig = null;
}

export function getNotificationConfig(): NotificationEnv {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    cachedConfig = notificationEnvSchema.parse({
      PUSHOVER_USER_KEY: process.env.PUSHOVER_USER_KEY,
      PUSHOVER_APP_TOKEN: process.env.PUSHOVER_APP_TOKEN,
      SENTRY_WEBHOOK_SECRET: process.env.SENTRY_WEBHOOK_SECRET,
    });
    return cachedConfig;
  } catch (error) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.warn('Notification environment variables not configured:', error);
      // Return mock values for development/testing
      cachedConfig = {
        PUSHOVER_USER_KEY: 'mock_user_key',
        PUSHOVER_APP_TOKEN: 'mock_app_token',
        SENTRY_WEBHOOK_SECRET: 'mock_webhook_secret',
      };
      return cachedConfig;
    }
    throw new Error(
      'Missing required notification environment variables. Please check your .env file.'
    );
  }
}

// Build-time validation is removed since these are optional features
// The webhook endpoint will handle missing config gracefully at runtime