import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuditLogger, RBACManager } from '../services/multi-tenancy';
import { WebhookDispatcher, WebhookSubscription } from '../webhooks/webhook-dispatcher';

export interface EngineSettingsState {
  hnsw: {
    M: number;
    efConstruction: number;
    efSearch: number;
    quantization: 'fp32' | 'fp16' | 'int8' | 'binary';
    hybridAlpha: number;
  };
  rateLimit: {
    maxRequestsPerMinute: number;
    burstLimit: number;
    enabled: boolean;
  };
  security: {
    piiRedaction: boolean;
    xssSanitization: boolean;
    promptInjectionGuard: boolean;
  };
  webhooks: Array<{
    id: string;
    url: string;
    secret: string;
    events: WebhookSubscription['events'];
    active: boolean;
    createdAt: string;
  }>;
}

const settingsUpdateSchema = z.object({
  hnsw: z
    .object({
      M: z.number().int().min(4).max(128).optional(),
      efConstruction: z.number().int().min(16).max(512).optional(),
      efSearch: z.number().int().min(8).max(512).optional(),
      quantization: z.enum(['fp32', 'fp16', 'int8', 'binary']).optional(),
      hybridAlpha: z.number().min(0).max(1).optional(),
    })
    .optional(),
  rateLimit: z
    .object({
      maxRequestsPerMinute: z.number().int().min(10).max(100_000).optional(),
      burstLimit: z.number().int().min(5).max(10_000).optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
  security: z
    .object({
      piiRedaction: z.boolean().optional(),
      xssSanitization: z.boolean().optional(),
      promptInjectionGuard: z.boolean().optional(),
    })
    .optional(),
});

const createWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8).max(128).default('whsec_eidos_default_secret'),
  events: z
    .array(z.enum(['drift.detected', 'ab_test.concluded', 'index.degraded']))
    .min(1)
    .default(['drift.detected', 'index.degraded']),
});

const currentSettings: EngineSettingsState = {
  hnsw: {
    M: 16,
    efConstruction: 128,
    efSearch: 64,
    quantization: 'int8',
    hybridAlpha: 0.65,
  },
  rateLimit: {
    maxRequestsPerMinute: 1200,
    burstLimit: 200,
    enabled: true,
  },
  security: {
    piiRedaction: true,
    xssSanitization: true,
    promptInjectionGuard: true,
  },
  webhooks: [
    {
      id: 'wh_prod_alerts',
      url: 'https://hooks.enterprise.internal/eidos/events',
      secret: 'whsec_9f8a7b6c5d4e3f2a1b0c',
      events: ['drift.detected', 'index.degraded'],
      active: true,
      createdAt: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    },
  ],
};

const webhookDispatcher = new WebhookDispatcher();
webhookDispatcher.register({
  id: currentSettings.webhooks[0].id,
  url: currentSettings.webhooks[0].url,
  secret: currentSettings.webhooks[0].secret,
  events: currentSettings.webhooks[0].events,
});

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/v1/settings', async () => {
    return {
      settings: currentSettings,
    };
  });

  fastify.put('/v1/settings', async (request, reply) => {
    const parsed = settingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const data = parsed.data;
    if (data.hnsw) {
      currentSettings.hnsw = { ...currentSettings.hnsw, ...data.hnsw };
    }
    if (data.rateLimit) {
      currentSettings.rateLimit = { ...currentSettings.rateLimit, ...data.rateLimit };
    }
    if (data.security) {
      currentSettings.security = { ...currentSettings.security, ...data.security };
    }

    AuditLogger.getInstance().record({
      tenantId: 'default',
      actorRole: RBACManager.resolveRole(request),
      action: 'settings.update',
      details: data as Record<string, unknown>,
    });

    return reply.status(200).send({
      success: true,
      settings: currentSettings,
    });
  });

  fastify.post('/v1/settings/webhooks', async (request, reply) => {
    const parsed = createWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const wh = {
      id: `wh_${Date.now().toString(36)}`,
      url: parsed.data.url,
      secret: parsed.data.secret,
      events: parsed.data.events,
      active: true,
      createdAt: new Date().toISOString(),
    };

    currentSettings.webhooks.push(wh);
    webhookDispatcher.register({
      id: wh.id,
      url: wh.url,
      secret: wh.secret,
      events: wh.events,
    });

    AuditLogger.getInstance().record({
      tenantId: 'default',
      actorRole: RBACManager.resolveRole(request),
      action: 'webhook.register',
      resourceId: wh.id,
      details: { url: wh.url, events: wh.events },
    });

    return reply.status(201).send({
      success: true,
      webhook: wh,
    });
  });

  fastify.delete<{ Params: { id: string } }>('/v1/settings/webhooks/:id', async (request, reply) => {
    const idx = currentSettings.webhooks.findIndex((w) => w.id === request.params.id);
    if (idx === -1) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Webhook '${request.params.id}' not found`,
      });
    }

    const [removed] = currentSettings.webhooks.splice(idx, 1);
    return reply.status(200).send({
      success: true,
      deletedId: removed.id,
    });
  });
}
