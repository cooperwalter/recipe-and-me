import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/webhooks/sentry/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getPushoverService } from '@/lib/services/pushover';
import { getNotificationConfig } from '@/lib/env/notification-config';
import type { SentryWebhookPayload } from '@/lib/types/sentry-webhook';

vi.mock('@/lib/services/pushover');
vi.mock('@/lib/env/notification-config');

describe('POST /api/webhooks/sentry', () => {
  const mockSendErrorNotification = vi.fn();
  const mockGetPushoverService = vi.mocked(getPushoverService);
  const mockGetConfig = vi.mocked(getNotificationConfig);
  const webhookSecret = 'test-webhook-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({
      PUSHOVER_USER_KEY: 'test_user',
      PUSHOVER_APP_TOKEN: 'test_token',
      SENTRY_WEBHOOK_SECRET: webhookSecret,
    });
    
    // Mock the pushover service
    mockGetPushoverService.mockReturnValue({
      sendErrorNotification: mockSendErrorNotification,
      sendNotification: vi.fn(),
    } as any);
  });

  function createSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  function createRequest(payload: any, signature?: string): NextRequest {
    const body = JSON.stringify(payload);
    const headers = new Headers();
    
    if (signature !== undefined) {
      headers.set('sentry-hook-signature', signature);
    }

    return new NextRequest('http://localhost/api/webhooks/sentry', {
      method: 'POST',
      headers,
      body,
    });
  }

  const createValidPayload = (): SentryWebhookPayload => ({
    action: 'created',
    actor: {
      id: '1',
      name: 'Sentry',
      type: 'application',
    },
    data: {
      issue: {
        id: '123',
        shortId: 'PROJ-123',
        title: 'TypeError: Cannot read property of undefined',
        culprit: 'app/components/Recipe.tsx in handleSubmit',
        permalink: 'https://sentry.io/organizations/test/issues/123/',
        logger: null,
        level: 'error',
        status: 'unresolved',
        statusDetails: {},
        isPublic: false,
        platform: 'javascript',
        project: {
          id: '1',
          name: 'recipe-keeper',
          slug: 'recipe-keeper',
        },
        type: 'error',
        metadata: {
          value: "Cannot read property 'name' of undefined",
          type: 'TypeError',
          filename: 'app/components/Recipe.tsx',
          function: 'handleSubmit',
        },
        numComments: 0,
        assignedTo: null,
        isBookmarked: false,
        isSubscribed: true,
        hasSeen: false,
        annotations: [],
        isUnhandled: true,
        count: '5',
        userCount: 3,
        firstSeen: '2024-01-01T10:00:00Z',
        lastSeen: '2024-01-01T11:00:00Z',
      },
    },
    installation: {
      uuid: 'test-installation',
    },
  });

  it('should process valid webhook with correct signature', async () => {
    const payload = createValidPayload();
    const payloadString = JSON.stringify(payload);
    const signature = createSignature(payloadString, webhookSecret);
    const request = createRequest(payload, signature);

    mockSendErrorNotification.mockResolvedValueOnce({
      status: 1,
      request: 'test-request',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: 'sent' });

    expect(mockSendErrorNotification).toHaveBeenCalledWith(
      expect.stringContaining('Level: error'),
      '🚨 recipe-keeper: TypeError: Cannot read property of undefined',
      'https://sentry.io/organizations/test/issues/123/',
      1 // High priority
    );

    const notificationMessage = mockSendErrorNotification.mock.calls[0][0];
    expect(notificationMessage).toContain('Users affected: 3');
    expect(notificationMessage).toContain('Occurrences: 5');
    expect(notificationMessage).toContain('Location: app/components/Recipe.tsx in handleSubmit');
    expect(notificationMessage).toContain("Error: Cannot read property 'name' of undefined");
  });

  it('should reject request without signature', async () => {
    const payload = createValidPayload();
    const request = createRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Missing signature' });
    expect(mockSendErrorNotification).not.toHaveBeenCalled();
  });

  it('should reject request with invalid signature', async () => {
    const payload = createValidPayload();
    const request = createRequest(payload, 'invalid-signature');

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Invalid signature' });
    expect(mockSendErrorNotification).not.toHaveBeenCalled();
  });

  it('should ignore non-created actions', async () => {
    const payload = { ...createValidPayload(), action: 'resolved' as const };
    const payloadString = JSON.stringify(payload);
    const signature = createSignature(payloadString, webhookSecret);
    const request = createRequest(payload, signature);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: 'ignored' });
    expect(mockSendErrorNotification).not.toHaveBeenCalled();
  });

  it('should ignore payloads without issue data', async () => {
    const payload = {
      ...createValidPayload(),
      data: {},
    };
    const payloadString = JSON.stringify(payload);
    const signature = createSignature(payloadString, webhookSecret);
    const request = createRequest(payload, signature);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: 'ignored' });
    expect(mockSendErrorNotification).not.toHaveBeenCalled();
  });

  it('should handle different error levels with appropriate priorities', async () => {
    const levels: Array<[SentryWebhookPayload['data']['issue']['level'], number]> = [
      ['fatal', 1], // Capped from 2 to 1
      ['error', 1],
      ['warning', 0],
      ['info', -1],
      ['debug', -2],
    ];

    for (const [level, expectedPriority] of levels) {
      vi.clearAllMocks();
      
      const payload = createValidPayload();
      payload.data.issue!.level = level;
      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString, webhookSecret);
      const request = createRequest(payload, signature);

      mockSendErrorNotification.mockResolvedValueOnce({
        status: 1,
        request: 'test-request',
      });

      await POST(request);

      expect(mockSendErrorNotification).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expectedPriority
      );
    }
  });

  it('should handle notification service errors gracefully', async () => {
    const payload = createValidPayload();
    const payloadString = JSON.stringify(payload);
    const signature = createSignature(payloadString, webhookSecret);
    const request = createRequest(payload, signature);

    mockSendErrorNotification.mockRejectedValueOnce(new Error('Pushover API error'));

    const response = await POST(request);
    const data = await response.json();

    // Should still return 200 to acknowledge receipt
    expect(response.status).toBe(200);
    expect(data).toEqual({ error: 'Internal error', status: 'failed' });
  });

  it('should handle malformed JSON gracefully', async () => {
    const headers = new Headers();
    headers.set('sentry-hook-signature', 'any-signature');
    
    const request = new NextRequest('http://localhost/api/webhooks/sentry', {
      method: 'POST',
      headers,
      body: 'invalid json',
    });

    const response = await POST(request);
    const data = await response.json();

    // With malformed JSON, it should return 401 for invalid signature
    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Invalid signature' });
  });

  it('should format message without optional fields', async () => {
    const payload = createValidPayload();
    payload.data.issue!.culprit = '';
    payload.data.issue!.metadata = {};
    
    const payloadString = JSON.stringify(payload);
    const signature = createSignature(payloadString, webhookSecret);
    const request = createRequest(payload, signature);

    mockSendErrorNotification.mockResolvedValueOnce({
      status: 1,
      request: 'test-request',
    });

    await POST(request);

    const notificationMessage = mockSendErrorNotification.mock.calls[0][0];
    expect(notificationMessage).not.toContain('Location:');
    expect(notificationMessage).not.toContain('Error:');
    expect(notificationMessage).toContain('Level: error');
    expect(notificationMessage).toContain('Users affected: 3');
  });
});