import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  allowedPorts?: number[];
  headers?: Record<string, string>;
}

const DEFAULT_ALLOWED_PORTS = [80, 443, 8080, 8443];

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr4(ipInt: number, base: string, maskBits: number): boolean {
  const baseInt = ipv4ToInt(base);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();

  // IPv4-mapped IPv6: ::ffff:127.0.0.1 or ::ffff:7f00:1
  if (normalized.startsWith('::ffff:')) {
    const tail = normalized.slice('::ffff:'.length);
    if (net.isIPv4(tail)) {
      return isPrivateOrReservedIp(tail);
    }
    const hexMatch = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateOrReservedIp(v4);
    }
    return true;
  }

  if (net.isIPv4(normalized)) {
    const n = ipv4ToInt(normalized);
    return (
      inCidr4(n, '0.0.0.0', 8) ||
      inCidr4(n, '10.0.0.0', 8) ||
      inCidr4(n, '100.64.0.0', 10) ||     // CGNAT
      inCidr4(n, '127.0.0.0', 8) ||       // Loopback
      inCidr4(n, '169.254.0.0', 16) ||    // Link-local / Cloud IMDS (169.254.169.254)
      inCidr4(n, '172.16.0.0', 12) ||     // RFC1918
      inCidr4(n, '192.0.0.0', 24) ||
      inCidr4(n, '192.0.2.0', 24) ||
      inCidr4(n, '192.168.0.0', 16) ||    // RFC1918
      inCidr4(n, '198.18.0.0', 15) ||     // Benchmark
      inCidr4(n, '198.51.100.0', 24) ||
      inCidr4(n, '203.0.113.0', 24) ||
      inCidr4(n, '224.0.0.0', 4) ||       // Multicast
      inCidr4(n, '240.0.0.0', 4)          // Reserved / broadcast
    );
  }

  if (net.isIPv6(normalized)) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7 ULA
    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true; // fe80::/10 link-local
    }
    if (normalized.startsWith('ff')) return true; // multicast
    if (normalized.startsWith('2001:db8')) return true; // documentation
    return false;
  }

  // Unknown format -> block
  return true;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

export async function validateAndResolvePublicUrl(
  rawUrl: string,
  allowedPorts: number[] = DEFAULT_ALLOWED_PORTS
): Promise<{ parsed: URL; resolvedIp: string; family: 4 | 6 }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('SSRF_BLOCKED: Invalid URL syntax');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SSRF_BLOCKED: Only http and https protocols are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new Error('SSRF_BLOCKED: Credentials in URL are not allowed');
  }

  const port = parsed.port
    ? Number(parsed.port)
    : parsed.protocol === 'https:'
      ? 443
      : 80;

  if (!allowedPorts.includes(port)) {
    throw new Error(`SSRF_BLOCKED: Port ${port} is not in allowed list`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.Nip.io'.toLowerCase()) ||
    hostname.endsWith('.sslip.io')
  ) {
    throw new Error(`SSRF_BLOCKED: Disallowed hostname "${hostname}"`);
  }

  // Reject octal / hex / integer-encoded IPv4 literals (e.g. 0x7f000001, 2130706433, 0177.0.0.1)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(hostname) || hostname.split('.').some((p) => /^0\d+$/.test(p))) {
    throw new Error('SSRF_BLOCKED: Non-canonical IP literal is not allowed');
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4 || ipVersion === 6) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error(`SSRF_BLOCKED: Private or reserved IP ${hostname}`);
    }
    return { parsed, resolvedIp: hostname, family: ipVersion };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`SSRF_BLOCKED: DNS lookup failed for "${hostname}"`);
  }

  if (!records || records.length === 0) {
    throw new Error(`SSRF_BLOCKED: No DNS records for "${hostname}"`);
  }

  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error(`SSRF_BLOCKED: Host "${hostname}" resolved to private IP ${rec.address}`);
    }
  }

  const chosen = records[0];
  return {
    parsed,
    resolvedIp: chosen.address,
    family: chosen.family === 6 ? 6 : 4,
  };
}

export async function safeFetchText(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 50 * 1024 * 1024; // 50 MB default
  const maxRedirects = options.maxRedirects ?? 3;
  const allowedPorts = options.allowedPorts ?? DEFAULT_ALLOWED_PORTS;

  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const { parsed, resolvedIp, family } = await validateAndResolvePublicUrl(currentUrl, allowedPorts);

    const result = await new Promise<{
      status: number;
      headers: http.IncomingHttpHeaders;
      body: string;
    }>((resolve, reject) => {
      const isHttps = parsed.protocol === 'https:';
      const mod = isHttps ? https : http;

      const req = mod.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: `${parsed.pathname}${parsed.search}`,
          method: 'GET',
          headers: {
            'User-Agent': 'EIDOS-SafeFetcher/4.0',
            Accept: '*/*',
            Host: parsed.host,
            ...(options.headers || {}),
          },
          timeout: timeoutMs,
          // Pin connection to the validated IP to defeat DNS rebinding (TOCTOU)
          lookup: (_host, _opts, cb) => {
            cb(null, resolvedIp, family);
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            resolve({ status, headers: res.headers, body: '' });
            return;
          }

          const chunks: Buffer[] = [];
          let received = 0;

          res.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (received > maxBytes) {
              req.destroy(new Error(`SSRF_BODY_TOO_LARGE: Exceeded ${maxBytes} bytes`));
              return;
            }
            chunks.push(chunk);
          });

          res.on('end', () => {
            resolve({
              status,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });

          res.on('error', reject);
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error(`SSRF_TIMEOUT: Request timed out after ${timeoutMs}ms`));
      });

      req.on('error', reject);
      req.end();
    });

    if (result.status >= 300 && result.status < 400 && result.headers.location) {
      if (hop === maxRedirects) {
        throw new Error(`SSRF_BLOCKED: Too many redirects (>${maxRedirects})`);
      }
      const nextUrl = new URL(String(result.headers.location), parsed).toString();
      currentUrl = nextUrl;
      continue;
    }

    return {
      status: result.status,
      headers: result.headers,
      body: result.body,
      finalUrl: currentUrl,
    };
  }

  throw new Error('SSRF_BLOCKED: Redirect loop');
}
