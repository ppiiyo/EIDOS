import { describe, it, expect } from 'vitest';
import { normalizeVector } from '@eidos/core';
import { NeuralCrossEncoderReranker } from '../../apps/api/src/services/reranker';

describe('EIDOS v3.2 - Stage-2 CPU Neural Cross-Encoder Reranker', () => {
  it('promotes semantically and lexically aligned candidates to #1 and executes under 10ms for 20 items', () => {
    const reranker = new NeuralCrossEncoderReranker();
    const query = 'wireless noise cancelling headphones for travel';
    const queryVector = normalizeVector(
      Array.from({ length: 384 }, (_, i) => Math.sin(i * 0.1) + 0.5)
    );

    // Generate 20 Stage-1 RRF candidates where candidate #7 has the exact phrase and aligned vector
    const candidates = Array.from({ length: 20 }, (_, idx) => {
      const isTarget = idx === 7;
      const vector = isTarget
        ? queryVector.slice()
        : normalizeVector(Array.from({ length: 384 }, (__, j) => Math.cos((idx + 1) * j * 0.05)));

      return {
        id: `cand-${idx}`,
        title: isTarget
          ? 'Sony Wireless Noise Cancelling Headphones for Travel'
          : `Generic Audio Accessory Cable Model ${idx}`,
        description: isTarget
          ? 'Active noise cancelling over-ear wireless headphones designed for airplane travel'
          : `Standard replacement adapter cord ${idx}`,
        category: 'Electronics',
        tags: isTarget ? ['wireless', 'noise', 'cancelling', 'travel'] : ['cable', 'adapter'],
        vector,
        // Give non-target slightly higher initial RRF score to verify Stage-2 Cross-Encoder promotion
        rrfScore: isTarget ? 0.65 : 0.72 - idx * 0.01,
      };
    });

    // Warm up V8 JIT before measuring steady-state latency
    for (let w = 0; w < 5; w++) {
      reranker.rerank(query, queryVector, candidates, 0.75);
    }

    let elapsedMs = Infinity;
    let reranked = reranker.rerank(query, queryVector, candidates, 0.75);
    for (let attempt = 0; attempt < 3; attempt++) {
      const start = performance.now();
      reranked = reranker.rerank(query, queryVector, candidates, 0.75);
      elapsedMs = Math.min(elapsedMs, performance.now() - start);
    }

    expect(elapsedMs).toBeLessThan(10);
    expect(reranked.length).toBe(20);
    // Target candidate #7 must be promoted to rank #1 after Cross-Encoder interaction scoring
    expect(reranked[0].id).toBe('cand-7');
    expect(reranked[0].crossEncoderScore).toBeGreaterThan(reranked[1].crossEncoderScore);
  });
});
