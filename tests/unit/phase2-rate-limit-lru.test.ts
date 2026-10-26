import { describe, it, expect, afterEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  demoRateLimit,
  clearRateLimitStore,
  getRateLimitStoreSize,
  hasRateLimitKey,
  MAX_IPS,
} from '../../apps/api/src/middleware/rate-limit-demo';

function createMockRequest(ip: string, demoMode = true, limit = 10): FastifyRequest {
  return {
    ip,
    demoMode,
    demoRateLimit: limit,
  } as unknown as FastifyRequest;
}

function createMockReply(): {
  reply: FastifyReply;
  getStatus: () => number | null;
  getPayload: () => unknown;
} {
  let statusCode: number | null = null;
  let payload: unknown = null;

  const reply = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    send(body: unknown) {
      payload = body;
      return this;
    },
  } as unknown as FastifyReply;

  return {
    reply,
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
}

describe('PHASE 2: Memory Leak Prevention (Rate Limiting LRU & Bounded Store)', () => {
  afterEach(() => {
    clearRateLimitStore();
    vi.restoreAllMocks();
  });

  it('ignores requests when demoMode is false', async () => {
    const req = createMockRequest('10.0.0.1', false, 2);
    const { reply, getStatus } = createMockReply();

    await demoRateLimit(req, reply);
    expect(getStatus()).toBeNull();
    expect(getRateLimitStoreSize()).toBe(0);
  });

  it('enforces demoRateLimit per IP and returns 429 when exceeded', async () => {
    const ip = '192.168.1.50';
    const limit = 3;

    for (let i = 0; i < limit; i++) {
      const req = createMockRequest(ip, true, limit);
      const { reply, getStatus } = createMockReply();
      await demoRateLimit(req, reply);
      expect(getStatus()).toBeNull();
    }

    const blockedReq = createMockRequest(ip, true, limit);
    const { reply, getStatus, getPayload } = createMockReply();
    await demoRateLimit(blockedReq, reply);

    expect(getStatus()).toBe(429);
    expect(getPayload()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Demo key rate limit exceeded (3 req/min). Get your own API key for production use.',
    });
  });

  it('bounds store size to MAX_IPS (10,000) and evicts least recently used (LRU) IPs', async () => {
    expect(MAX_IPS).toBe(10_000);

    // Fill the store up to MAX_IPS
    for (let i = 0; i < MAX_IPS; i++) {
      const req = createMockRequest(`10.0.${Math.floor(i / 256)}.${i % 256}`, true, 10);
      const { reply } = createMockReply();
      await demoRateLimit(req, reply);
    }

    expect(getRateLimitStoreSize()).toBe(MAX_IPS);
    expect(hasRateLimitKey('10.0.0.0')).toBe(true);
    expect(hasRateLimitKey('10.0.0.1')).toBe(true);

    // Touch '10.0.0.0' so it becomes most-recently-used and '10.0.0.1' becomes the oldest (LRU)
    {
      const touchReq = createMockRequest('10.0.0.0', true, 10);
      const { reply } = createMockReply();
      await demoRateLimit(touchReq, reply);
    }

    // Insert 5 new unique IPs beyond MAX_IPS
    for (let i = 0; i < 5; i++) {
      const overflowReq = createMockRequest(`172.16.0.${i}`, true, 10);
      const { reply } = createMockReply();
      await demoRateLimit(overflowReq, reply);
    }

    // Store size must never exceed MAX_IPS
    expect(getRateLimitStoreSize()).toBe(MAX_IPS);

    // '10.0.0.0' was recently accessed so it must still be retained
    expect(hasRateLimitKey('10.0.0.0')).toBe(true);

    // '10.0.0.1' through '10.0.0.5' were the oldest untouched keys, so they must be evicted
    expect(hasRateLimitKey('10.0.0.1')).toBe(false);
    expect(hasRateLimitKey('10.0.0.2')).toBe(false);
    expect(hasRateLimitKey('10.0.0.5')).toBe(false);
    expect(hasRateLimitKey('10.0.0.6')).toBe(true);
  });

  it('lazily sweeps expired records without background timers', async () => {
    let fakeNow = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    // Add 50 IPs at t = 0
    for (let i = 0; i < 50; i++) {
      const req = createMockRequest(`10.1.0.${i}`, true, 10);
      const { reply } = createMockReply();
      await demoRateLimit(req, reply);
    }
    expect(getRateLimitStoreSize()).toBe(50);

    // Advance time past the 60s window
    fakeNow += 61_000;

    // Send 60 requests to trigger the lazy sweep interval (every 100th request total)
    for (let i = 0; i < 60; i++) {
      const req = createMockRequest(`10.2.0.${i}`, true, 10);
      const { reply } = createMockReply();
      await demoRateLimit(req, reply);
    }

    // The 50 expired records from 10.1.0.* should have been lazily swept, leaving only the 60 active 10.2.0.* records
    expect(getRateLimitStoreSize()).toBe(60);
    expect(hasRateLimitKey('10.1.0.0')).toBe(false);
    expect(hasRateLimitKey('10.2.0.0')).toBe(true);
  });

  it('clearRateLimitStore() empties the store completely', async () => {
    const req = createMockRequest('192.0.2.1', true, 10);
    const { reply } = createMockReply();
    await demoRateLimit(req, reply);
    expect(getRateLimitStoreSize()).toBe(1);

    clearRateLimitStore();
    expect(getRateLimitStoreSize()).toBe(0);
  });
});
