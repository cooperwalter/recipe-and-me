export interface SentryWebhookPayload {
  action: 'created' | 'resolved' | 'assigned' | 'ignored';
  actor: {
    id: string;
    name: string;
    type: 'user' | 'application';
  };
  data: {
    issue?: SentryIssue;
    error?: SentryError;
  };
  installation: {
    uuid: string;
  };
}

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  permalink: string;
  logger: string | null;
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
  status: 'unresolved' | 'resolved' | 'ignored';
  statusDetails: Record<string, unknown>;
  isPublic: boolean;
  platform: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  type: 'error' | 'default';
  metadata: {
    value?: string;
    type?: string;
    filename?: string;
    function?: string;
  };
  numComments: number;
  assignedTo: unknown | null;
  isBookmarked: boolean;
  isSubscribed: boolean;
  hasSeen: boolean;
  annotations: string[];
  isUnhandled: boolean;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface SentryError {
  type: string;
  value: string;
  stacktrace?: {
    frames: Array<{
      filename: string;
      function: string;
      lineNo: number;
      colNo: number;
      absPath: string;
      context: Array<[number, string]>;
    }>;
  };
}