import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PushoverService, PushoverMessage } from '@/lib/services/pushover';
import { getNotificationConfig } from '@/lib/env/notification-config';

// Mock the config module
vi.mock('@/lib/env/notification-config');

// Mock fetch
global.fetch = vi.fn();

describe('PushoverService', () => {
  let service: PushoverService;
  const mockFetch = vi.mocked(global.fetch);
  const mockGetConfig = vi.mocked(getNotificationConfig);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock config
    mockGetConfig.mockReturnValue({
      PUSHOVER_USER_KEY: 'test_user_key',
      PUSHOVER_APP_TOKEN: 'test_app_token',
      SENTRY_WEBHOOK_SECRET: 'test_secret',
    });

    service = new PushoverService();
  });

  describe('sendNotification', () => {
    it('should send a basic notification successfully', async () => {
      const mockResponse = { status: 1, request: 'test-request-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const message: PushoverMessage = {
        message: 'Test notification',
      };

      const result = await service.sendNotification(message);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.pushover.net/1/messages.json',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining('token=test_app_token'),
        }
      );

      const body = (mockFetch.mock.calls[0][1]?.body as string);
      expect(body).toContain('user=test_user_key');
      expect(body).toContain('message=Test+notification');
    });

    it('should send a notification with all optional parameters', async () => {
      const mockResponse = { status: 1, request: 'test-request-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const message: PushoverMessage = {
        message: 'Test notification',
        title: 'Test Title',
        priority: 1,
        url: 'https://example.com',
        url_title: 'Click here',
        sound: 'pushover',
        timestamp: 1234567890,
      };

      await service.sendNotification(message);

      const body = (mockFetch.mock.calls[0][1]?.body as string);
      expect(body).toContain('title=Test+Title');
      expect(body).toContain('priority=1');
      expect(body).toContain('url=https%3A%2F%2Fexample.com');
      expect(body).toContain('url_title=Click+here');
      expect(body).toContain('sound=pushover');
      expect(body).toContain('timestamp=1234567890');
    });

    it('should validate emergency priority parameters', async () => {
      const message: PushoverMessage = {
        message: 'Emergency!',
        priority: 2,
        // Missing retry and expire
      };

      await expect(service.sendNotification(message)).rejects.toThrow(
        'Emergency priority requires retry and expire parameters'
      );
    });

    it('should send emergency notification with required params', async () => {
      const mockResponse = { status: 1, request: 'test-request-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const message: PushoverMessage = {
        message: 'Emergency!',
        priority: 2,
        retry: 60,
        expire: 3600,
      };

      await service.sendNotification(message);

      const body = (mockFetch.mock.calls[0][1]?.body as string);
      expect(body).toContain('priority=2');
      expect(body).toContain('retry=60');
      expect(body).toContain('expire=3600');
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        status: 0,
        errors: ['invalid token'],
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse,
      } as Response);

      const message: PushoverMessage = {
        message: 'Test notification',
      };

      await expect(service.sendNotification(message)).rejects.toThrow(
        'Pushover API error: 400 - ["invalid token"]'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const message: PushoverMessage = {
        message: 'Test notification',
      };

      await expect(service.sendNotification(message)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('sendErrorNotification', () => {
    it('should send error notification with default priority', async () => {
      const mockResponse = { status: 1, request: 'test-request-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const timestamp = Math.floor(Date.now() / 1000);
      await service.sendErrorNotification(
        'Error occurred in production',
        'Production Error'
      );

      expect(mockFetch).toHaveBeenCalled();
      const body = (mockFetch.mock.calls[0][1]?.body as string);
      expect(body).toContain('message=Error+occurred+in+production');
      expect(body).toContain('title=Production+Error');
      expect(body).toContain('priority=1'); // Default high priority
      expect(body).toMatch(/timestamp=\d+/);
    });

    it('should send error notification with URL', async () => {
      const mockResponse = { status: 1, request: 'test-request-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.sendErrorNotification(
        'Error details',
        'Error Title',
        'https://sentry.io/issues/123'
      );

      const body = (mockFetch.mock.calls[0][1]?.body as string);
      expect(body).toContain('url=https%3A%2F%2Fsentry.io%2Fissues%2F123');
      expect(body).toContain('url_title=View+in+Sentry');
    });

    it('should send error notification with custom priority', async () => {
      const mockResponse = { status: 1, request: 'test-request-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.sendErrorNotification(
        'Low priority error',
        'Warning',
        undefined,
        -1
      );

      const body = (mockFetch.mock.calls[0][1]?.body as string);
      expect(body).toContain('priority=-1');
    });
  });
});