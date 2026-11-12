#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/routes/demo.ts"
s = p.read_text(encoding="utf-8")
if "EIDOS_ENABLE_DEMO_MUTATIONS" in s:
    print("already")
    raise SystemExit(0)
guard = '''
function assertDemoMutationsAllowed(reply: FastifyReply): boolean {
  const enabled = process.env.EIDOS_ENABLE_DEMO_MUTATIONS;
  const allowed =
    process.env.NODE_ENV === 'production'
      ? enabled === 'true'
      : enabled !== 'false';
  if (!allowed) {
    reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Demo catalog mutations disabled. Set EIDOS_ENABLE_DEMO_MUTATIONS=true to enable.',
    });
    return false;
  }
  return true;
}

'''
m = re.search(r'(export async function \w+\([^)]*\)[^{]*\{)', s)
if not m:
    raise SystemExit('export missing')
s = s[: m.end()] + '\n' + guard + s[m.end() :]
s = s.replace(
    "async (request: FastifyRequest, reply: FastifyReply) => {\n      const demoStore = getDemoStore(fastify);\n      if (demoStore.hasProductionCatalogItems()) {\n        return reply.status(409).send({ error: 'DEMO_DISABLED_FOR_PRODUCTION_CATALOG' });\n      }\n\n      const body",
    "async (request: FastifyRequest, reply: FastifyReply) => {\n      if (!assertDemoMutationsAllowed(reply)) return;\n      const demoStore = getDemoStore(fastify);\n      if (demoStore.hasProductionCatalogItems()) {\n        return reply.status(409).send({ error: 'DEMO_DISABLED_FOR_PRODUCTION_CATALOG' });\n      }\n\n      const body",
    1,
)
s = s.replace(
    "async (_request: FastifyRequest, reply: FastifyReply) => {\n      const demoStore = getDemoStore(fastify);\n      if (demoStore.hasProductionCatalogItems()) {\n        return reply.status(409).send({ error: 'DEMO_DISABLED_FOR_PRODUCTION_CATALOG' });\n      }\n      await demoStore.clear();",
    "async (_request: FastifyRequest, reply: FastifyReply) => {\n      if (!assertDemoMutationsAllowed(reply)) return;\n      const demoStore = getDemoStore(fastify);\n      if (demoStore.hasProductionCatalogItems()) {\n        return reply.status(409).send({ error: 'DEMO_DISABLED_FOR_PRODUCTION_CATALOG' });\n      }\n      await demoStore.clear();",
    1,
)
p.write_text(s, encoding="utf-8")
print("demo gate written")
