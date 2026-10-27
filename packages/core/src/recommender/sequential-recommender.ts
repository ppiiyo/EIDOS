export class SequentialRecommender {
  private sessions = new Map<string, string[]>();

  public recordInteraction(sessionId: string, itemId: string): void {
    const history = this.sessions.get(sessionId) || [];
    history.push(itemId);
    if (history.length > 20) history.shift();
    this.sessions.set(sessionId, history);
  }

  public computeSessionVector(
    sessionId: string,
    itemEmbeddings: Map<string, Float32Array>,
    decay = 0.7
  ): Float32Array | null {
    const history = this.sessions.get(sessionId);
    if (!history || history.length === 0) return null;

    let dim = 0;
    let sumVec: Float32Array | null = null;
    let totalWeight = 0;

    for (let i = history.length - 1; i >= 0; i--) {
      const vec = itemEmbeddings.get(history[i]);
      if (!vec) continue;

      if (!sumVec) {
        dim = vec.length;
        sumVec = new Float32Array(dim);
      }

      const age = history.length - 1 - i;
      const weight = Math.pow(decay, age);
      totalWeight += weight;

      for (let d = 0; d < dim; d++) {
        sumVec[d] += vec[d] * weight;
      }
    }

    if (!sumVec || totalWeight === 0) return null;

    // L2 Normalize
    let norm = 0;
    for (let d = 0; d < dim; d++) {
      sumVec[d] /= totalWeight;
      norm += sumVec[d] * sumVec[d];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let d = 0; d < dim; d++) sumVec[d] /= norm;
    }

    return sumVec;
  }
}
