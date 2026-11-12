#!/usr/bin/env python3
"""securityPlugin must break encapsulation so CSP/CORS/rate-limit apply to all routes."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/plugins/security.ts"
if not p.exists():
    raise SystemExit(0)
s = p.read_text(encoding="utf-8")
changed = False

old_rl = """  await fastify.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  });
"""
new_rl = """  await fastify.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    keyGenerator: (req) => {
      const apiKey = req.headers['x-api-key'];
      if (typeof apiKey === 'string' && apiKey.trim()) return `k:${apiKey.trim()}`;
      return req.ip || 'anon';
    },
  });
"""
if "keyGenerator" not in s and old_rl in s:
    s = s.replace(old_rl, new_rl)
    changed = True
    print("+ rateLimit keyGenerator")

if "skip-override" not in s:
    s = s.rstrip() + "\n\n(securityPlugin as any)[Symbol.for('skip-override')] = true;\n"
    changed = True
    print("+ skip-override")

if "Guarantee baseline security headers" not in s and "keyGenerator" in s:
    block = """  await fastify.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    keyGenerator: (req) => {
      const apiKey = req.headers['x-api-key'];
      if (typeof apiKey === 'string' && apiKey.trim()) return `k:${apiKey.trim()}`;
      return req.ip || 'anon';
    },
  });
"""
    hook = block + """
  // Guarantee baseline security headers even if a downstream plugin skips onSend.
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (!reply.getHeader('content-security-policy')) {
      reply.header(
        'content-security-policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:"
      );
    }
    if (!reply.getHeader('x-content-type-options')) reply.header('x-content-type-options', 'nosniff');
    if (!reply.getHeader('x-frame-options')) reply.header('x-frame-options', 'SAMEORIGIN');
    if (!reply.getHeader('referrer-policy')) reply.header('referrer-policy', 'no-referrer');
    if (!reply.getHeader('cross-origin-opener-policy')) reply.header('cross-origin-opener-policy', 'same-origin');
    if (!reply.getHeader('strict-transport-security')) {
      reply.header('strict-transport-security', 'max-age=15552000; includeSubDomains');
    }
    return payload;
  });
"""
    if block in s:
        s = s.replace(block, hook)
        changed = True
        print("+ header guarantee")

if changed:
    p.write_text(s, encoding="utf-8")
else:
    print("security already patched" if "skip-override" in s else "patterns missing")
