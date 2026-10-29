import { cosineSimilarity } from './cosine';

/**
 * Counterfactual "Anti-Echo-Chamber" Orthogonal Serendipity Engine
 * & 2D Intent Vector Synthesizer (Gram-Schmidt Orthogonal Projection)
 */

export interface IntentRadarCoordinates {
  /** X-axis: -1.0 (Conservative Sniper Precision) <-> +1.0 (Orthogonal Serendipity Discovery) */
  axisDiscovery: number;
  /** Y-axis: -1.0 (Pragmatic Value / Budget Efficiency) <-> +1.0 (Flagship / Deep Spec Perfection) */
  axisTier: number;
}

export interface SerendipityCandidateEvaluation {
  id: string;
  /** Base cosine similarity to query vector */
  baseSimilarity: number;
  /** Magnitude of orthogonal novelty component relative to seen/dominant cluster centroid */
  orthogonalNovelty: number;
  /** Combined counterfactual serendipity score (0..1) */
  serendipityScore: number;
  /** True if this item breaks the filter bubble with high latent relevance */
  isSerendipityDiscovery: boolean;
  /** Human-readable explanation of why this item broke the echo chamber */
  discoveryReason: string;
}

export class SerendipityOrthogonalEngine {
  /**
   * Computes the Gram-Schmidt orthogonal projection of candidateVec relative to seenCentroidVec:
   * v_perp = v_candidate - (<v_candidate, c_seen> / ||c_seen||^2) * c_seen
   * Returns the L2 magnitude of the orthogonal residual and normalized orthogonal vector.
   */
  public static computeOrthogonalProjection(
    candidateVec: Float32Array | number[],
    seenCentroidVec: Float32Array | number[]
  ): { orthogonalVector: Float32Array; orthogonalMagnitude: number; cosineToSeen: number } {
    const dim = Math.min(candidateVec.length, seenCentroidVec.length);
    const ortho = new Float32Array(dim);

    let dot = 0;
    let seenNormSq = 0;
    let candNormSq = 0;

    for (let i = 0; i < dim; i++) {
      const c = candidateVec[i];
      const s = seenCentroidVec[i];
      dot += c * s;
      seenNormSq += s * s;
      candNormSq += c * c;
    }

    if (seenNormSq < 1e-9 || candNormSq < 1e-9) {
      for (let i = 0; i < dim; i++) ortho[i] = candidateVec[i];
      return { orthogonalVector: ortho, orthogonalMagnitude: 1.0, cosineToSeen: 0 };
    }

    const projScale = dot / seenNormSq;
    let orthoNormSq = 0;
    for (let i = 0; i < dim; i++) {
      const residual = candidateVec[i] - projScale * seenCentroidVec[i];
      ortho[i] = residual;
      orthoNormSq += residual * residual;
    }

    const candNorm = Math.sqrt(candNormSq) || 1;
    const seenNorm = Math.sqrt(seenNormSq) || 1;
    const cosineToSeen = Math.max(-1, Math.min(1, dot / (candNorm * seenNorm)));
    const orthogonalMagnitude = Math.min(1, Math.sqrt(orthoNormSq) / candNorm);

    return {
      orthogonalVector: ortho,
      orthogonalMagnitude: Math.round(orthogonalMagnitude * 10000) / 10000,
      cosineToSeen: Math.round(cosineToSeen * 10000) / 10000,
    };
  }

  /**
   * Computes the centroid vector of top-ranked (or previously viewed) items
   * representing the user's current "Echo Chamber".
   */
  public static computeEchoChamberCentroid(
    vectors: Array<Float32Array | number[]>,
    dim = 384
  ): Float32Array {
    const centroid = new Float32Array(dim);
    if (vectors.length === 0) return centroid;

    for (const vec of vectors) {
      const len = Math.min(dim, vec.length);
      for (let i = 0; i < len; i++) {
        centroid[i] += vec[i];
      }
    }

    let normSq = 0;
    for (let i = 0; i < dim; i++) {
      centroid[i] /= vectors.length;
      normSq += centroid[i] * centroid[i];
    }
    const norm = Math.sqrt(normSq) || 1;
    for (let i = 0; i < dim; i++) {
      centroid[i] /= norm;
    }
    return centroid;
  }

  /**
   * Evaluates a candidate item for "Anti-Echo-Chamber" serendipity discovery.
   * Ideal serendipity items have:
   * - Meaningful latent bridge to the query (baseSimilarity in [0.18, 0.78])
   * - High orthogonal projection magnitude relative to the dominant cluster centroid
   * - Cross-category bridge bonus when departing from the dominant category
   */
  public static evaluateCandidate(params: {
    id: string;
    category: string;
    dominantCategory: string;
    candidateVec: Float32Array | number[];
    queryVec: Float32Array | number[];
    echoCentroidVec: Float32Array | number[];
  }): SerendipityCandidateEvaluation {
    const { id, category, dominantCategory, candidateVec, queryVec, echoCentroidVec } = params;
    const baseSimilarity = Math.max(0, cosineSimilarity(queryVec, candidateVec));
    const { orthogonalMagnitude } = this.computeOrthogonalProjection(candidateVec, echoCentroidVec);

    // Bell-shaped sweet spot curve around similarity 0.48 (neither trivial clone nor random noise)
    const diffFromSweetSpot = Math.abs(baseSimilarity - 0.48);
    const bridgeAffinity = Math.max(0, 1 - (diffFromSweetSpot / 0.42) ** 2);

    const isCrossCategory =
      Boolean(category && dominantCategory) && category !== dominantCategory;
    const crossCategoryBonus = isCrossCategory ? 0.18 : 0;

    const rawSerendipity =
      orthogonalMagnitude * 0.52 + bridgeAffinity * 0.3 + crossCategoryBonus;
    const serendipityScore = Math.round(Math.min(1, Math.max(0, rawSerendipity)) * 10000) / 10000;

    const isSerendipityDiscovery =
      serendipityScore >= 0.56 &&
      orthogonalMagnitude >= 0.45 &&
      baseSimilarity >= 0.08 &&
      (isCrossCategory || orthogonalMagnitude >= 0.68);


    const discoveryReason = isCrossCategory
      ? `Межкатегорийный мост (${dominantCategory} → ${category}): ортогональная новизна ${Math.round(orthogonalMagnitude * 100)}% при латентной связи ${Math.round(baseSimilarity * 100)}%.`
      : `Ортогональный вектор Грама–Шмидта (${Math.round(orthogonalMagnitude * 100)}% вне эхо-камеры топ-выдачи).`;

    return {
      id,
      baseSimilarity: Math.round(baseSimilarity * 10000) / 10000,
      orthogonalNovelty: orthogonalMagnitude,
      serendipityScore,
      isSerendipityDiscovery,
      discoveryReason,
    };
  }

  /**
   * Synthesizes a steered query vector from 2D Intent Radar coordinates (axisDiscovery, axisTier).
   * Modulates the semantic concept manifold dimensions (320..383) and orthogonal discovery direction.
   */
  public static synthesizeSteeredQueryVector(
    baseQueryVec: Float32Array | number[],
    radar: IntentRadarCoordinates,
    echoCentroidVec?: Float32Array | number[]
  ): Float32Array {
    const dim = baseQueryVec.length;
    const out = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      out[i] = baseQueryVec[i];
    }

    const dx = Math.max(-1, Math.min(1, radar.axisDiscovery || 0));
    const dy = Math.max(-1, Math.min(1, radar.axisTier || 0));

    // If user steers toward positive Discovery (+X) and we have an echo centroid,
    // subtract a fraction of the dominant centroid to push the query vector into orthogonal subspaces.
    if (dx > 0.05 && echoCentroidVec && echoCentroidVec.length === dim) {
      const { orthogonalVector } = this.computeOrthogonalProjection(out, echoCentroidVec);
      const blend = dx * 0.42;
      for (let i = 0; i < dim; i++) {
        out[i] = out[i] * (1 - blend) + orthogonalVector[i] * blend;
      }
    }

    // Modulate structural & concept manifold harmonics based on Y-axis (Pragmatic <-> Flagship)
    if (Math.abs(dy) > 0.05 && dim >= 384) {
      for (let i = 320; i < 384; i++) {
        const harmonic = i % 2 === 0 ? 1 : -1;
        out[i] += dy * 0.08 * harmonic;
      }
    }

    // Re-normalize to unit L2 sphere
    let normSq = 0;
    for (let i = 0; i < dim; i++) {
      normSq += out[i] * out[i];
    }
    const norm = Math.sqrt(normSq) || 1;
    for (let i = 0; i < dim; i++) {
      out[i] /= norm;
    }

    return out;
  }
}
