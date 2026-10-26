/// <reference path="../types/fastify.d.ts" />
import { FastifyRequest, FastifyReply } from 'fastify';

export const MAX_IPS = 10_000;
const WINDOW_MS = 60_000;
const LAZY_SWEEP_INTERVAL = 100;

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const demoRequests = new Map<string, RateLimitRecord>();
let requestCounter = 0;

function evictExpired(now: number): void {
  for (const [ip, entry] of demoRequests.entries()) {
    if (entry.resetAt < now) {
      demoRequests.delete(ip);
    }
  }
}

function enforceCapacity(now: number): void {
  if (demoRequests.size < MAX_IPS) {
    return;
  }

  // First try to reclaim space from expired entries
  evictExpired(now);

  // Evict least-recently-used (oldest insertion order in Map) entries until below MAX_IPS
  while (demoRequests.size >= MAX_IPS) {
    const oldestKey = demoRequests.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    demoRequests.delete(oldestKey);
  }
}

export function clearRateLimitStore(): void {
  demoRequests.clear();
  requestCounter = 0;
}

export function getRateLimitStoreSize(): number {
  return demoRequests.size;
}

export function hasRateLimitKey(ip: string): boolean {
  return demoRequests.has(ip);
}

export async function demoRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.demoMode) return;

  const key = request.ip || 'unknown';
  const now = Date.now();

  requestCounter = (requestCounter + 1) % LAZY_SWEEP_INTERVAL;
  if (requestCounter === 0) {
    evictExpired(now);
  }

  const record = demoRequests.get(key);
  const limit = request.demoRateLimit || 10;

  if (!record || record.resetAt < now) {
    if (demoRequests.has(key)) {
      demoRequests.delete(key);
    }
    enforceCapacity(now);
    demoRequests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  // Refresh LRU position by re-inserting the accessed key at the end of the Map
  demoRequests.delete(key);
  demoRequests.set(key, record);

  if (record.count >= limit) {
    reply.status(429).send({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Demo key rate limit exceeded (${limit} req/min). Get your own API key for production use.`,
    });
    return;
  }

  record.count++;
}

