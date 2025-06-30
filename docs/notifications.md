# Push Notifications Setup

This guide explains how to set up push notifications for your Recipe Keeper application using Sentry for error tracking and Pushover for mobile notifications.

## Overview

The notification system consists of:
1. **Sentry** - Monitors your application for errors
2. **Webhook Endpoint** - Receives alerts from Sentry
3. **Pushover** - Sends push notifications to your devices

## Prerequisites

1. A Sentry account (free tier is sufficient)
2. A Pushover account and app ($5 one-time purchase per platform)
3. Environment variables configured in production

## Setup Instructions

### 1. Pushover Setup

1. Create a Pushover account at [pushover.net](https://pushover.net)
2. Purchase the app for your platform ($5 one-time)
3. Create an application in Pushover:
   - Go to [pushover.net/apps/build](https://pushover.net/apps/build)
   - Name: "Recipe Keeper Alerts" (or your preference)
   - Type: Application
   - Icon: Upload a custom icon if desired
4. Note your:
   - User Key (from your dashboard)
   - API Token/Key (from your application)

### 2. Sentry Setup

1. Create a project in Sentry for your Recipe Keeper app
2. Go to Settings → Integrations → Webhooks
3. Create a new Internal Integration:
   - Name: "Pushover Notifications"
   - Webhook URL: `https://your-domain.com/api/webhooks/sentry`
   - Generate and save the Client Secret (this is your webhook secret)
4. Configure which events trigger webhooks:
   - Issue Created ✓
   - Issue Resolved (optional)
   - Issue Assigned (optional)

### 3. Environment Variables

Add these to your production environment (e.g., Vercel):

```env
# Pushover Configuration
PUSHOVER_USER_KEY=your_pushover_user_key
PUSHOVER_APP_TOKEN=your_pushover_app_token

# Sentry Webhook Secret
SENTRY_WEBHOOK_SECRET=your_sentry_webhook_secret
```

### 4. Deploy and Test

1. Deploy your application with the new environment variables
2. Trigger a test error in Sentry
3. You should receive a push notification on your device

## Notification Priority Levels

The system automatically sets notification priority based on error severity:

- **Fatal errors**: High priority (alert sound)
- **Errors**: High priority (alert sound)
- **Warnings**: Normal priority
- **Info**: Low priority (no sound)
- **Debug**: Lowest priority (silent)

## Customization

You can customize notifications by modifying `/app/api/webhooks/sentry/route.ts`:

- Change notification format
- Add custom sounds
- Filter which errors trigger notifications
- Add rate limiting

## Troubleshooting

### Not receiving notifications?

1. Check environment variables are set correctly
2. Verify webhook URL in Sentry matches your deployment
3. Check Sentry webhook logs for delivery status
4. Test Pushover directly using their API

### Getting too many notifications?

1. Configure Sentry alert rules to filter events
2. Implement rate limiting in the webhook endpoint
3. Adjust priority thresholds in the code

## Security Considerations

- The webhook endpoint verifies signatures to ensure requests are from Sentry
- Environment variables are validated at build time
- No sensitive information is logged
- Webhook always returns 200 OK to prevent information leakage

## Testing Locally

For local development, the system uses mock values when environment variables are not set. To test with real services locally:

1. Create a `.env.local` file with your credentials
2. Use ngrok to expose your local webhook endpoint
3. Update Sentry webhook URL to your ngrok URL
4. Trigger test errors to verify the flow

## Alternative Services

If you prefer different notification services:

- **Slack/Discord**: Modify the webhook to send to their webhook URLs
- **Email**: Use SendGrid or similar email API
- **SMS**: Integrate Twilio for SMS notifications
- **Multiple Channels**: Send to multiple services from the same webhook

## Monitoring the Monitor

Consider setting up additional monitoring for the webhook endpoint itself:
- Add the `/api/webhooks/sentry` endpoint to your uptime monitoring
- Log webhook processing times and failures
- Set up alerts if the webhook starts failing

For more details on the implementation, see the source code in:
- `/lib/services/pushover.ts` - Pushover service
- `/app/api/webhooks/sentry/route.ts` - Webhook endpoint
- `/lib/env/notification-config.ts` - Environment configuration