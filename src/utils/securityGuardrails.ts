/**
 * EIDOS Enterprise Security Guardrails & Vector Safety Engine.
 * Protects against:
 * 1. Prompt Injection & Malicious Jailbreak attempts in conversational queries
 * 2. Cross-Site Scripting (XSS) and Script Injection in catalog search
 * 3. Vector Space Numerical Poisoning (NaN, Infinity, Denormalized Vectors)
 * 4. Denial of Service (Oversized Query Flooding & Rate Limit Violations)
 */

export interface SecurityScanResult {
  readonly isSafe: boolean;
  readonly sanitizedInput: string;
  readonly threatsDetected: string[];
  readonly riskScore: number; // 0.0 (safe) to 1.0 (critical attack)
}

export class SecurityGuardrails {
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /reveal\s+(system\s+)?(prompt|instructions)/i,
    /you\s+are\s+now\s+in\s+developer\s+mode/i,
    /jailbreak/i,
    /<script[\s\S]*?>[\s\S]*?<\/script>/i,
    /javascript:/i,
    /drop\s+table/i,
    /union\s+select/i,
    /exec\s*\(/i,
    /\${[\s\S]*?}/, // Template injection
  ];

  /**
   * Sanitizes and scans text query for malicious injection or exploit payloads.
   */
  public static scanAndSanitize(input: string): SecurityScanResult {
    if (!input || typeof input !== 'string') {
      return { isSafe: true, sanitizedInput: '', threatsDetected: [], riskScore: 0 };
    }

    const threats: string[] = [];
    let risk = 0;

    // 1. Length guardrail (prevent memory exhaustion / regex DoS)
    const MAX_QUERY_LEN = 500;
    let clean = input.slice(0, MAX_QUERY_LEN);
    if (input.length > MAX_QUERY_LEN) {
      threats.push('PAYLOAD_TRUNCATED_OVERSIZE');
      risk += 0.2;
    }

    // 2. Prompt injection and jailbreak pattern matching
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(clean)) {
        threats.push(`INJECTION_DETECTED: ${pattern.source.slice(0, 30)}`);
        risk += 0.5;
        // Strip or neutralize malicious pattern
        clean = clean.replace(pattern, '[SECURITY_FILTERED]');
      }
    }

    // 3. HTML / Script tag stripping
    clean = clean.replace(/<[^>]*>?/gm, '');

    // 4. Control characters stripping
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    const isSafe = threats.length === 0;

    return {
      isSafe,
      sanitizedInput: clean.trim(),
      threatsDetected: threats,
      riskScore: Math.min(1.0, risk),
    };
  }

  /**
   * Validates mathematical vector integrity:
   * Asserts zero NaNs, zero Infinities, correct dimensions (384), and valid L2 norm.
   */
  public static validateVectorBounds(
    vector: Float32Array | number[],
    expectedDim: number = 384
  ): { isValid: boolean; error?: string; corrected?: Float32Array } {
    if (!vector || vector.length !== expectedDim) {
      return {
        isValid: false,
        error: `Invalid vector dimension: expected ${expectedDim}, got ${vector?.length || 0}`,
      };
    }

    let sumSq = 0;
    let hasNaN = false;
    let hasInf = false;

    for (let i = 0; i < vector.length; i++) {
      const v = vector[i];
      if (Number.isNaN(v)) {
        hasNaN = true;
        break;
      }
      if (!Number.isFinite(v)) {
        hasInf = true;
        break;
      }
      sumSq += v * v;
    }

    if (hasNaN) {
      return { isValid: false, error: 'Vector contains NaN values (Numerical Poisoning detected).' };
    }
    if (hasInf) {
      return { isValid: false, error: 'Vector contains Infinity values (Numerical Overflow detected).' };
    }

    const norm = Math.sqrt(sumSq);
    if (norm === 0) {
      return { isValid: false, error: 'Vector has zero magnitude.' };
    }

    // Return safely L2-normalized vector if slightly out of bounds
    const out = new Float32Array(expectedDim);
    for (let i = 0; i < expectedDim; i++) {
      out[i] = vector[i] / norm;
    }

    return { isValid: true, corrected: out };
  }
}
