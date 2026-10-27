import { describe, it, expect } from 'vitest';
import { WebhookDispatcher } from '../../apps/api/src/webhooks/webhook-dispatcher';

describe('WebhookDispatcher', () => {
  it('dispatches subscribed events and signs payloads with HMAC-SHA256', async () => {
    const dispatcher = new WebhookDispatcher();
    dispatcher.register({
      id: 'sub_1',
      url: 'https://ops.example.com/hook',
      secret: 'whsec_test_secret',
      events: ['drift.detected'],
    });
    const res = await dispatcher.dispatch('drift.detected', { klDivergence: 0.42 });
    expect(res.delivered).toBe(1);
    expect(res.signatures[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});
