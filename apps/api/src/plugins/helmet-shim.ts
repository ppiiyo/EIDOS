import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export interface HelmetOptions {
  contentSecurityPolicy?: {
    directives?: Record<string, string[]>;
  } | boolean;
}

const helmetPlugin: FastifyPluginAsync<HelmetOptions> = async (
  fastify: FastifyInstance,
  opts: HelmetOptions = {}
) => {
  let cspHeader =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:";

  if (
    opts.contentSecurityPolicy &&
    typeof opts.contentSecurityPolicy === 'object' &&
    opts.contentSecurityPolicy.directives
  ) {
    const directives = opts.contentSecurityPolicy.directives;
    const parts: string[] = [];
    for (const [key, values] of Object.entries(directives)) {
      const kebabKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      parts.push(`${kebabKey} ${values.join(' ')}`);
    }
    if (parts.length > 0) {
      cspHeader = parts.join('; ');
    }
  }

  fastify.addHook('onSend', async (_request, reply, payload) => {
    if (opts.contentSecurityPolicy !== false) {
      reply.header('content-security-policy', cspHeader);
    }
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'SAMEORIGIN');
    reply.header('x-xss-protection', '0');
    reply.header('strict-transport-security', 'max-age=15552000; includeSubDomains');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('cross-origin-opener-policy', 'same-origin');
    reply.header('cross-origin-resource-policy', 'same-origin');
    reply.header('x-dns-prefetch-control', 'off');
    reply.header('x-download-options', 'noopen');
    reply.header('x-permitted-cross-domain-policies', 'none');
    return payload;
  });
};

(helmetPlugin as any)[Symbol.for('skip-override')] = true;

export default helmetPlugin;
