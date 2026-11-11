const SESSION_ADMIN_KEY_STORAGE = 'eidos_admin_api_key';
const SESSION_DEMO_KEY_STORAGE = 'eidos_public_demo_key';

/**
 * Resolves the active API key for Studio / Admin / Lab requests.
 * Priority:
 *  1. Session storage (entered by admin in /admin login screen)
 *  2. Local storage (legacy session fallback)
 *  3. Explicit build-time env var `VITE_EIDOS_PUBLIC_DEMO_KEY` (ONLY for read-only demo endpoints)
 *
 * NEVER falls back to hardcoded dev/admin keys.
 */
export function getActiveApiKey(options?: { allowPublicDemoKey?: boolean }): string {
  if (typeof window !== 'undefined') {
    try {
      const sessionKey =
        window.sessionStorage.getItem(SESSION_ADMIN_KEY_STORAGE) ||
        window.sessionStorage.getItem('eidos_admin_key') ||
        window.localStorage.getItem(SESSION_ADMIN_KEY_STORAGE) ||
        window.localStorage.getItem('eidos_api_key') ||
        '';
      if (sessionKey.trim()) {
        return sessionKey.trim();
      }
    } catch {
      // Ignore storage access errors in restricted iframes
    }
  }

  if (options?.allowPublicDemoKey) {
    const envDemoKey =
      (typeof import.meta !== 'undefined' &&
        (import.meta as any).env &&
        ((import.meta as any).env.VITE_EIDOS_PUBLIC_DEMO_KEY as string)) ||
      '';
    if (envDemoKey.trim()) {
      return envDemoKey.trim();
    }
  }

  return '';
}

export function setSessionAdminKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  try {
    if (trimmed) {
      window.sessionStorage.setItem(SESSION_ADMIN_KEY_STORAGE, trimmed);
    } else {
      window.sessionStorage.removeItem(SESSION_ADMIN_KEY_STORAGE);
      window.localStorage.removeItem(SESSION_ADMIN_KEY_STORAGE);
      window.localStorage.removeItem('eidos_api_key');
    }
  } catch {}
}

export function buildAuthHeaders(
  extraHeaders?: Record<string, string>,
  options?: { allowPublicDemoKey?: boolean; explicitKey?: string }
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  };
  const key = (options?.explicitKey ?? getActiveApiKey(options)).trim();
  if (key) {
    headers['x-api-key'] = key;
  }
  return headers;
}
