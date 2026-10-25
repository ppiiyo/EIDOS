import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import {
  AuditLogger,
  RBACManager,
  TenantNamespaceManager,
} from '../services/multi-tenancy';

const merchandisingRuleSchema = z.object({
  semanticRelevance: z.number().min(0).max(1).optional(),
  profitMarginBoost: z.number().min(0).max(1).optional(),
  freshnessBoost: z.number().min(0).max(1).optional(),
  inventoryUrgency: z.number().min(0).max(1).optional(),
  diversityLambda: z.number().min(0).max(1).optional(),
  pinnedItemIds: z.array(z.string()).max(50).optional(),
});

export async function enterpriseRoutes(fastify: FastifyInstance): Promise<void> {
  const tenantManager = TenantNamespaceManager.getInstance();
  const auditLogger = AuditLogger.getInstance();

  /**
   * GET /v1/audit/logs
   * Returns tamper-evident audit logs for merchandising rule changes and RBAC operations.
   */
  fastify.get('/v1/audit/logs', { preHandler: authenticate }, async (request, reply) => {
    const role = RBACManager.resolveRole(request);
    if (!RBACManager.canManageCatalogAndConfig(role)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient RBAC permissions: admin role required to view audit logs.',
      });
    }

    const query = request.query as { tenantId?: string; limit?: string } | undefined;
    const headerTenantId = tenantManager.resolveTenantId(request);
    const effectiveTenant =
      query?.tenantId || (headerTenantId === 'default' ? undefined : headerTenantId);
    const limit = Math.min(Math.max(parseInt(query?.limit || '100', 10) || 100, 1), 500);
    const logs = auditLogger.getLogs(effectiveTenant, limit);

    return {
      tenantId: effectiveTenant || 'all',
      role,
      count: logs.length,
      logs,
    };
  });

  /**
   * POST /v1/merchandising/rules
   * Updates merchandising weights (Margin, Freshness, Pinning) for a tenant and records an Audit Log entry.
   */
  fastify.post('/v1/merchandising/rules', { preHandler: authenticate }, async (request, reply) => {
    const role = RBACManager.resolveRole(request);
    if (!RBACManager.canUpdateMerchandising(role)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Read-only API keys cannot modify merchandising rules. Required role: merchandiser or admin.',
      });
    }

    const parsed = merchandisingRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const tenantId = tenantManager.resolveTenantId(request);
    const auditEntry = auditLogger.record({
      tenantId,
      actorRole: role,
      action: 'UPDATE_MERCHANDISING_RULES',
      details: parsed.data,
    });

    return {
      status: 'updated',
      tenantId,
      role,
      rules: parsed.data,
      auditEntry,
    };
  });

  /**
   * GET /v1/tenants
   * Returns active tenant namespaces and resource quotas (Admin only).
   */
  fastify.get('/v1/tenants', { preHandler: authenticate }, async (request, reply) => {
    const role = RBACManager.resolveRole(request);
    if (!RBACManager.canManageCatalogAndConfig(role)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Admin role required to inspect cluster tenants.',
      });
    }

    return {
      tenants: tenantManager.listTenants(),
    };
  });
}
