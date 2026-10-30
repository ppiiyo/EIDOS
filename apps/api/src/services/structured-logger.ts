import * as crypto from 'crypto';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface OperationalLogEvent {
  id: string;
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  tenantId?: string;
  indexName?: string;
  keyId?: string;
  ip?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

/**
 * Masks an API key or Bearer token so full secrets are never written to logs.
 */
export function maskApiKey(rawKey?: string | null): string {
  if (!rawKey || typeof rawKey !== 'string') return 'anonymous';
  const trimmed = rawKey.trim();
  if (!trimmed) return 'anonymous';
  const hashSuffix = crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 8);
  if (trimmed.length <= 8) {
    return `key_${hashSuffix}`;
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-2)} (id:${hashSuffix})`;
}

/**
 * Computes a short deterministic hash and safe preview of a search query.
 */
export function summarizeQueryForLog(query: string): { queryHash: string; queryPreview: string } {
  const clean = (query || '').trim();
  const queryHash = crypto.createHash('sha256').update(clean.toLowerCase()).digest('hex').slice(0, 12);
  const queryPreview = clean.length > 48 ? `${clean.slice(0, 48)}...` : clean;
  return { queryHash, queryPreview };
}

/**
 * Structured Operational Logger & In-Memory Ring Buffer for EIDOS Production Observability.
 * Emits structured JSON to stdout when configured (or in production) and retains the latest
 * N operational events for `GET /v1/admin/logs`.
 */
export class OperationalLogStore {
  private static instance: OperationalLogStore | null = null;
  private readonly buffer: OperationalLogEvent[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  public static getInstance(): OperationalLogStore {
    if (!OperationalLogStore.instance) {
      OperationalLogStore.instance = new OperationalLogStore();
    }
    return OperationalLogStore.instance;
  }

  public record(
    level: LogLevel,
    event: string,
    fields: Omit<OperationalLogEvent, 'id' | 'timestamp' | 'level' | 'event'> = {}
  ): OperationalLogEvent {
    const entry: OperationalLogEvent = {
      id: `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      level,
      event,
      ...fields,
    };

    if (this.buffer.length >= this.maxEntries) {
      this.buffer.shift();
    }
    this.buffer.push(entry);

    if (process.env.EIDOS_STDOUT_JSON_LOGS === 'true') {
      process.stdout.write(JSON.stringify(entry) + '\n');
    }

    return entry;
  }

  public getRecentLogs(options?: {
    limit?: number;
    level?: LogLevel;
    event?: string;
    tenantId?: string;
  }): OperationalLogEvent[] {
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
    let filtered = this.buffer;

    if (options?.level) {
      filtered = filtered.filter((e) => e.level === options.level);
    }
    if (options?.event) {
      filtered = filtered.filter((e) => e.event.includes(options.event!));
    }
    if (options?.tenantId) {
      filtered = filtered.filter((e) => e.tenantId === options.tenantId);
    }

    return filtered.slice(-limit).reverse();
  }

  public clear(): void {
    this.buffer.length = 0;
  }
}
