import { SteeringConfig, SteeringModifier } from './types';

/**
 * Normalizes a Float32Array vector to unit L2 norm.
 */
function normalizeL2(v: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) {
    sumSq += v[i] * v[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm <= 1e-12) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i] / norm;
  }
  return out;
}

/**
 * Computes cosine similarity between two vectors.
 */
function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 1e-12 ? dot / denom : 0;
}

/**
 * VectorSteering enables conversational steering and arithmetic refinement of recommendation vectors.
 * Allows users to steer results with positive ("like this, but in white/minimalist") and
 * negative modifiers ("without heavy RGB lighting"), enforcing angular boundary constraints.
 */
export class VectorSteering {
  /**
   * Applies directional modifier vectors to a base query/item vector in latent space.
   *
   * @param baseVector - Original reference vector
   * @param modifiers - Array of positive and negative modifier vectors with weights
   * @param config - Steering hyperparameters (baseWeight, maxAngularDeviation, normalization)
   * @returns Steered and normalized target vector
   */
  public static steer(
    baseVector: Float32Array,
    modifiers: SteeringModifier[],
    config?: Partial<SteeringConfig>
  ): Float32Array {
    const baseWeight = config?.baseWeight ?? 1.0;
    const maxDeviation = config?.maxAngularDeviation ?? 0.75; // Cosine distance ceiling (1 - cos)
    const normalization = config?.normalization ?? 'l2';

    const dim = baseVector.length;
    const steered = new Float32Array(dim);

    // Apply base vector
    for (let i = 0; i < dim; i++) {
      steered[i] = baseVector[i] * baseWeight;
    }

    // Apply directional modifiers
    for (const mod of modifiers) {
      const sign = mod.type === 'positive' ? 1.0 : -1.0;
      const effectiveWeight = mod.weight * sign;
      const modVec = mod.vector;
      const limit = Math.min(dim, modVec.length);

      for (let i = 0; i < limit; i++) {
        steered[i] += modVec[i] * effectiveWeight;
      }
    }

    let result = normalization === 'l2' ? normalizeL2(steered) : steered;

    // Angular deviation guard: ensure steer does not completely invert base query
    const baseNorm = normalizeL2(baseVector);
    const cosDist = 1.0 - cosine(baseNorm, result);

    if (cosDist > maxDeviation) {
      // Linearly interpolate back towards base vector to respect maxDeviation constraint
      const blend = maxDeviation / Math.max(1e-6, cosDist);
      const bounded = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        bounded[i] = baseNorm[i] * (1 - blend) + result[i] * blend;
      }
      result = normalization === 'l2' ? normalizeL2(bounded) : bounded;
    }

    return result;
  }

  /**
   * Computes a semantic difference delta vector between two entities:
   * delta = target - origin.
   *
   * @param originVector - Starting vector
   * @param targetVector - Target conceptual vector
   * @returns Normalized difference vector representing the semantic shift
   */
  public static computeDelta(originVector: Float32Array, targetVector: Float32Array): Float32Array {
    const dim = Math.min(originVector.length, targetVector.length);
    const delta = new Float32Array(dim);

    for (let i = 0; i < dim; i++) {
      delta[i] = targetVector[i] - originVector[i];
    }

    return normalizeL2(delta);
  }
}
