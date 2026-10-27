import * as crypto from 'node:crypto';

export interface WebhookSubscription {
  id: string;
  url: string;
  secret: string;
  events: ('drift.detected' | 'ab_test.concluded' | 'index.degraded')[];
}

export class WebhookDispatcher {
  private subs: WebhookSubscription[] = [];

  register(sub: WebhookSubscription): void {
    this.subs.push(sub);
  }

  signPayload(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  async dispatch(
    event: WebhookSubscription['events'][number],
    data: Record<string, unknown>
  ): Promise<{ delivered: number; signatures: string[] }> {
    const targets = this.subs.filter((s) => s.events.includes(event));
    const body = JSON.stringify({ event, timestamp: Date.now(), data });
    const signatures = targets.map((t) => this.signPayload(body, t.secret));
    return { delivered: targets.length, signatures };
  }
}
