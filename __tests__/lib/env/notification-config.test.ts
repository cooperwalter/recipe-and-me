import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getNotificationConfig, clearConfigCache } from '@/lib/env/notification-config';

describe('getNotificationConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear the cached config
    clearConfigCache();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('in development/test environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should return mock values when environment variables are missing', () => {
      delete process.env.PUSHOVER_USER_KEY;
      delete process.env.PUSHOVER_APP_TOKEN;
      delete process.env.SENTRY_WEBHOOK_SECRET;

      const config = getNotificationConfig();
      
      expect(config).toEqual({
        PUSHOVER_USER_KEY: 'mock_user_key',
        PUSHOVER_APP_TOKEN: 'mock_app_token',
        SENTRY_WEBHOOK_SECRET: 'mock_webhook_secret',
      });
    });

    it('should return actual values when environment variables are set', () => {
      process.env.PUSHOVER_USER_KEY = 'real_user_key';
      process.env.PUSHOVER_APP_TOKEN = 'real_app_token';
      process.env.SENTRY_WEBHOOK_SECRET = 'real_webhook_secret';

      const config = getNotificationConfig();
      
      expect(config).toEqual({
        PUSHOVER_USER_KEY: 'real_user_key',
        PUSHOVER_APP_TOKEN: 'real_app_token',
        SENTRY_WEBHOOK_SECRET: 'real_webhook_secret',
      });
    });

    it('should cache the configuration', () => {
      process.env.PUSHOVER_USER_KEY = 'initial_key';
      process.env.PUSHOVER_APP_TOKEN = 'initial_token';
      process.env.SENTRY_WEBHOOK_SECRET = 'initial_secret';

      const config1 = getNotificationConfig();
      
      // Change environment variables
      process.env.PUSHOVER_USER_KEY = 'changed_key';
      
      const config2 = getNotificationConfig();
      
      // Should return cached values
      expect(config2).toEqual(config1);
    });
  });

  describe('in production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should throw error when environment variables are missing', () => {
      delete process.env.PUSHOVER_USER_KEY;
      delete process.env.PUSHOVER_APP_TOKEN;
      delete process.env.SENTRY_WEBHOOK_SECRET;

      expect(() => getNotificationConfig()).toThrow(
        'Missing required notification environment variables. Please check your .env file.'
      );
    });

    it('should throw error when some environment variables are missing', () => {
      process.env.PUSHOVER_USER_KEY = 'key';
      process.env.PUSHOVER_APP_TOKEN = 'token';
      // Missing SENTRY_WEBHOOK_SECRET

      expect(() => getNotificationConfig()).toThrow(
        'Missing required notification environment variables. Please check your .env file.'
      );
    });

    it('should return config when all environment variables are set', () => {
      process.env.PUSHOVER_USER_KEY = 'prod_user_key';
      process.env.PUSHOVER_APP_TOKEN = 'prod_app_token';
      process.env.SENTRY_WEBHOOK_SECRET = 'prod_webhook_secret';

      const config = getNotificationConfig();
      
      expect(config).toEqual({
        PUSHOVER_USER_KEY: 'prod_user_key',
        PUSHOVER_APP_TOKEN: 'prod_app_token',
        SENTRY_WEBHOOK_SECRET: 'prod_webhook_secret',
      });
    });

    it('should validate that environment variables are not empty strings', () => {
      process.env.PUSHOVER_USER_KEY = '';
      process.env.PUSHOVER_APP_TOKEN = 'token';
      process.env.SENTRY_WEBHOOK_SECRET = 'secret';

      expect(() => getNotificationConfig()).toThrow(
        'Missing required notification environment variables. Please check your .env file.'
      );
    });
  });

  describe('build-time validation', () => {
    it('should not exit process in test environment', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      process.env.NODE_ENV = 'test';
      delete process.env.PUSHOVER_USER_KEY;

      // Clear cache and test
      clearConfigCache();
      
      // Should return mock values in test environment
      const config = getNotificationConfig();
      expect(config).toEqual({
        PUSHOVER_USER_KEY: 'mock_user_key',
        PUSHOVER_APP_TOKEN: 'mock_app_token',
        SENTRY_WEBHOOK_SECRET: 'mock_webhook_secret',
      });

      expect(mockExit).not.toHaveBeenCalled();
      mockExit.mockRestore();
    });
  });
});