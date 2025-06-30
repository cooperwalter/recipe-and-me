import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPushoverService } from '@/lib/services/pushover';
import { getNotificationConfig } from '@/lib/env/notification-config';
import type { SentryWebhookPayload } from '@/lib/types/sentry-webhook';

// Verify Sentry webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  // Early return if lengths don't match
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Get signature from headers
    const signature = request.headers.get('sentry-hook-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Verify signature
    const config = getNotificationConfig();
    const isValid = verifySignature(rawBody, signature, config.SENTRY_WEBHOOK_SECRET);
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    const payload: SentryWebhookPayload = JSON.parse(rawBody);

    // Only process new issues
    if (payload.action !== 'created' || !payload.data.issue) {
      return NextResponse.json({ status: 'ignored' });
    }

    const issue = payload.data.issue;
    
    // Determine priority based on error level
    const priorityMap = {
      fatal: 2,
      error: 1,
      warning: 0,
      info: -1,
      debug: -2,
    } as const;
    
    const priority = priorityMap[issue.level] ?? 0;

    // Format the message
    const message = formatErrorMessage(issue);
    const title = `🚨 ${issue.project.name}: ${issue.title}`;

    // Send Pushover notification
    const pushoverService = getPushoverService();
    await pushoverService.sendErrorNotification(
      message,
      title,
      issue.permalink,
      priority === 2 ? 1 : priority // Cap at high priority (1) to avoid emergency
    );

    return NextResponse.json({ status: 'sent' });
  } catch (error) {
    console.error('Webhook error:', error);
    
    // Still return 200 to acknowledge receipt
    return NextResponse.json(
      { error: 'Internal error', status: 'failed' },
      { status: 200 }
    );
  }
}

function formatErrorMessage(issue: NonNullable<SentryWebhookPayload['data']['issue']>): string {
  const parts = [
    `Level: ${issue.level}`,
    `First seen: ${new Date(issue.firstSeen).toLocaleString()}`,
    `Users affected: ${issue.userCount}`,
    `Occurrences: ${issue.count}`,
  ];

  if (issue.culprit) {
    parts.push(`Location: ${issue.culprit}`);
  }

  if (issue.metadata.value) {
    parts.push(`\nError: ${issue.metadata.value}`);
  }

  return parts.join('\n');
}