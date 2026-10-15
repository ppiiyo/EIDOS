import { describe, it, expect } from 'vitest';
import { CandidateFusion } from '../../adaptive/candidate-fusion';
import { Candidate } from '../../adaptive/types';

describe('CandidateFusion', () => {
  const dummyVec = new Float32Array([0.1, 0.2]);

  it('RRF fuses candidates correctly with reciprocal rank scores', () => {
    const fusion = new CandidateFusion({ fusionMethod: 'rrf', rrfConstantK: 60 });
    const sources = new Map<string, Candidate[]>();

    sources.set('stream1', [
      { id: 'item-A', source: 'similarity', rawScore: 0.9, embedding: dummyVec },
      { id: 'item-B', source: 'similarity', rawScore: 0.8, embedding: dummyVec },
    ]);

    sources.set('stream2', [
      { id: 'item-B', source: 'user_affinity', rawScore: 0.95, embedding: dummyVec },
      { id: 'item-C', source: 'user_affinity', rawScore: 0.7, embedding: dummyVec },
    ]);

    // item-B appears in both streams at top ranks -> should score highest overall
    const fused = fusion.fuse(sources, 5);

    expect(fused.length).toBe(3);
    expect(fused[0].id).toBe('item-B');
    expect(fused[0].fusedScore).toBeGreaterThan(fused[1].fusedScore);
  });

  it('weighted fusion averages candidate scores', () => {
    const fusion = new CandidateFusion({ fusionMethod: 'weighted' });
    const sources = new Map<string, Candidate[]>();

    sources.set('s1', [
      { id: 'item-1', source: 'similarity', rawScore: 0.8, embedding: dummyVec },
      { id: 'item-2', source: 'similarity', rawScore: 0.4, embedding: dummyVec },
    ]);

    const fused = fusion.fuse(sources, 2);
    expect(fused[0].id).toBe('item-1');
    expect(fused[0].fusedScore).toBeCloseTo(0.8, 2);
    expect(fused[1].id).toBe('item-2');
    expect(fused[1].fusedScore).toBeCloseTo(0.4, 2);
  });

  it('deduplicates items appearing across multiple sources', () => {
    const fusion = new CandidateFusion();
    const sources = new Map<string, Candidate[]>();

    sources.set('src1', [{ id: 'dup', source: 'similarity', rawScore: 0.5, embedding: dummyVec }]);
    sources.set('src2', [{ id: 'dup', source: 'user_affinity', rawScore: 0.6, embedding: dummyVec }]);
    sources.set('src3', [{ id: 'dup', source: 'popularity', rawScore: 0.7, embedding: dummyVec }]);

    const fused = fusion.fuse(sources, 10);
    expect(fused.length).toBe(1);
    expect(fused[0].id).toBe('dup');
  });
});
