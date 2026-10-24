/**
 * Cache poisoning protection.
 *
 * Prevents attackers from injecting malicious content into cache
 * by validating that cache keys and values are safe.
 */

/**
 * Fields that should NEVER be included in cache keys
 * (prevent cache poisoning via user-specific data)
 */
const FORBIDDEN_KEY_FIELDS = [
  'authorization',
  'cookie',
  'session',
  'user-id',
  'user_id',
  'userid',
  'token',
  'secret',
  'password',
];

/**
 * Headers that should NOT affect cache key
 */
const FORBIDDEN_HEADERS = [
  'authorization',
  'cookie',
  'x-user-id',
  'x-session-id',
  'user-agent', // Can be used for fingerprinting
];

/**
 * Validate that a cache key doesn't contain sensitive data
 */
export function isCacheKeySafe(key: string): boolean {
  const lowerKey = key.toLowerCase();

  for (const forbidden of FORBIDDEN_KEY_FIELDS) {
    if (lowerKey.includes(forbidden)) {
      return false;
    }
  }

  // Check for suspicious patterns
  if (lowerKey.includes('..')) return false; // Path traversal
  if (lowerKey.includes('\\x')) return false; // Hex encoding
  if (key.length > 1000) return false; // Too long

  return true;
}

/**
 * Validate that cached response doesn't contain sensitive user data
 */
export function isResponseCacheable(response: any): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  // Don't cache responses with user-specific data
  if (response.userId || response.user_id || response.sessionId) {
    return false;
  }

  // Don't cache authentication tokens
  if (response.token || response.accessToken || response.refreshToken) {
    return false;
  }

  // Don't cache private/personal data
  if (response.email || response.phone || response.address) {
    return false;
  }

  return true;
}

/**
 * Sanitize request headers for cache key generation
 * Removes sensitive headers that shouldn't affect caching
 */
export function sanitizeHeadersForCache(
  headers: Record<string, string | string[] | undefined>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // Skip forbidden headers
    if (FORBIDDEN_HEADERS.includes(lowerKey)) {
      continue;
    }

    // Skip x- headers that might contain user data
    if (
      lowerKey.startsWith('x-') &&
      (lowerKey.includes('user') || lowerKey.includes('session') || lowerKey.includes('auth'))
    ) {
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.join(',');
    }
  }

  return sanitized;
}

/**
 * Generate safe cache key from request
 */
export function generateSafeCacheKey(
  endpoint: string,
  body: any,
  headers?: Record<string, string | string[] | undefined>
): string {
  // Start with endpoint
  const keyParts = [endpoint];

  // Add normalized body
  if (body && typeof body === 'object') {
    const sortedBody = Object.keys(body)
      .sort()
      .reduce<Record<string, any>>((obj, key) => ({ ...obj, [key]: body[key] }), {});
    keyParts.push(JSON.stringify(sortedBody));
  }

  // Add sanitized headers (only if needed)
  if (headers) {
    const sanitized = sanitizeHeadersForCache(headers);
    if (Object.keys(sanitized).length > 0) {
      keyParts.push(JSON.stringify(sanitized));
    }
  }

  const key = keyParts.join(':');

  // Final safety check
  if (!isCacheKeySafe(key)) {
    throw new Error(`Unsafe cache key detected: ${key.substring(0, 100)}...`);
  }

  return key;
}
