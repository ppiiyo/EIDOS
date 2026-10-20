/**
 * Validates that a vector is non-empty and all its elements are finite numbers.
 * Throws RangeError on empty vector or NaN / Infinity coordinates.
 */
export function assertValidVector(
  vec: number[] | Float32Array | Float64Array,
  label = 'Vector'
): void {
  if (!vec || vec.length === 0) {
    throw new RangeError(`${label} must be a non-empty vector`);
  }
  for (let i = 0; i < vec.length; i++) {
    if (!Number.isFinite(vec[i])) {
      throw new RangeError(
        `${label} contains non-finite value (${vec[i]}) at index ${i}`
      );
    }
  }
}

/**
 * Computes cosine similarity between two numeric or typed array vectors.
 * Returns a value normalized between -1.0 and 1.0 (or 0.0 for orthogonal/zero vectors).
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score
 */
export function cosineSimilarity(
  a: number[] | Float32Array,
  b: number[] | Float32Array
): number {
  assertValidVector(a, 'Vector A');
  assertValidVector(b, 'Vector B');

  if (a.length !== b.length) {
    throw new RangeError(
      `Vector dimension mismatch: vector A has length ${a.length}, vector B has length ${b.length}`
    );
  }

  const length = a.length;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator <= 1e-12 || !Number.isFinite(denominator)) {
    return 0;
  }

  const similarity = dotProduct / denominator;
  if (!Number.isFinite(similarity) || Number.isNaN(similarity)) {
    return 0;
  }
  // Guard against slight floating point overshoot
  return Math.max(-1, Math.min(1, similarity));
}

/**
 * Normalizes a vector to unit length (L2 norm).
 *
 * @param vector - Input vector
 * @returns Unit normalized vector
 */
export function normalizeVector(vector: number[] | Float32Array): Float32Array {
  assertValidVector(vector, 'Vector');
  const length = vector.length;
  const result = new Float32Array(length);

  let sumSquares = 0;
  for (let i = 0; i < length; i++) {
    sumSquares += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSquares);
  if (norm <= 1e-12) {
    return result;
  }

  for (let i = 0; i < length; i++) {
    result[i] = vector[i] / norm;
  }

  return result;
}
