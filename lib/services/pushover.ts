import { getNotificationConfig } from '../env/notification-config';

export interface PushoverMessage {
  message: string;
  title?: string;
  priority?: -2 | -1 | 0 | 1 | 2; // -2: lowest, -1: low, 0: normal, 1: high, 2: emergency
  url?: string;
  url_title?: string;
  sound?: string;
  timestamp?: number;
  retry?: number; // Required for priority 2
  expire?: number; // Required for priority 2
}

export interface PushoverResponse {
  status: number;
  request: string;
  errors?: string[];
}

export class PushoverService {
  private readonly apiUrl = 'https://api.pushover.net/1/messages.json';
  private readonly userKey: string;
  private readonly appToken: string;

  constructor() {
    const config = getNotificationConfig();
    this.userKey = config.PUSHOVER_USER_KEY;
    this.appToken = config.PUSHOVER_APP_TOKEN;
  }

  async sendNotification(params: PushoverMessage): Promise<PushoverResponse> {
    // Validate emergency priority params
    if (params.priority === 2 && (!params.retry || !params.expire)) {
      throw new Error('Emergency priority requires retry and expire parameters');
    }

    const formData = new URLSearchParams({
      token: this.appToken,
      user: this.userKey,
      message: params.message,
      ...(params.title && { title: params.title }),
      ...(params.priority !== undefined && { priority: params.priority.toString() }),
      ...(params.url && { url: params.url }),
      ...(params.url_title && { url_title: params.url_title }),
      ...(params.sound && { sound: params.sound }),
      ...(params.timestamp && { timestamp: params.timestamp.toString() }),
      ...(params.retry && { retry: params.retry.toString() }),
      ...(params.expire && { expire: params.expire.toString() }),
    });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `Pushover API error: ${response.status} - ${JSON.stringify(data.errors || data)}`
        );
      }

      return data as PushoverResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to send Pushover notification: ${String(error)}`);
    }
  }

  async sendErrorNotification(
    errorMessage: string,
    errorTitle: string,
    url?: string,
    priority: PushoverMessage['priority'] = 1
  ): Promise<PushoverResponse> {
    return this.sendNotification({
      message: errorMessage,
      title: errorTitle,
      priority,
      url,
      url_title: url ? 'View in Sentry' : undefined,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }
}

// Export singleton instance getter to avoid instantiation during import
let pushoverServiceInstance: PushoverService | null = null;

export function getPushoverService(): PushoverService {
  if (!pushoverServiceInstance) {
    pushoverServiceInstance = new PushoverService();
  }
  return pushoverServiceInstance;
}