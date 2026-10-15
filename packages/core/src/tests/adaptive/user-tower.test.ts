import { describe, it, expect } from 'vitest';
import { UserTower } from '../../adaptive/user-tower';

describe('UserTower', () => {
  it('buildProfile averages embeddings taking recency into account', async () => {
    const tower = new UserTower({ recencyDecay: 0.5, categoryDiversityWeight: 0, normalization: 'none' });
    const mockEmbeddings: Record<string, Float32Array> = {
      i1: new Float32Array([1.0, 0.0]),
      i2: new Float32Array([0.0, 2.0]),
    };

    const profile = await tower.buildProfile(
      'u1',
      ['i1', 'i2'],
      async (id) => mockEmbeddings[id] || new Float32Array([0, 0]),
      () => 'Tech'
    );

    // i2 is newest: weight = 1.0; i1 is older: weight = 0.5.
    // Total weight = 1.5
    // Dim 0 = (1.0 * 0.5) / 1.5 = 1/3
    // Dim 1 = (2.0 * 1.0) / 1.5 = 4/3
    expect(profile.userId).toBe('u1');
    expect(profile.embedding[0]).toBeCloseTo(1 / 3, 4);
    expect(profile.embedding[1]).toBeCloseTo(4 / 3, 4);
  });

  it('empty history produces profile with zero embedding and empty categories', async () => {
    const tower = new UserTower();
    const profile = await tower.buildProfile(
      'u_empty',
      [],
      async () => new Float32Array(384),
      () => 'General'
    );

    expect(profile.history.length).toBe(0);
    expect(profile.embedding.length).toBe(384);
    expect(profile.embedding.every((v) => v === 0)).toBe(true);
    expect(tower.getEmbedding('u_empty')).not.toBeNull();
  });

  it('L2 normalization produces unit norm vector', async () => {
    const tower = new UserTower({ normalization: 'l2' });
    const mockEmbeddings: Record<string, Float32Array> = {
      i1: new Float32Array([3.0, 4.0]),
    };

    const profile = await tower.buildProfile(
      'u_norm',
      ['i1'],
      async (id) => mockEmbeddings[id],
      () => 'Cat'
    );

    const norm = Math.hypot(...Array.from(profile.embedding));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('evictOldProfiles removes expired profiles', async () => {
    const tower = new UserTower();
    await tower.buildProfile('u_old', [], async () => new Float32Array(2), () => 'A');

    const profile = tower.getProfile('u_old');
    expect(profile).not.toBeNull();

    // Manually backdate profile
    if (profile) {
      profile.updatedAt = Date.now() - 50000;
    }

    tower.evictOldProfiles(10000);
    expect(tower.getProfile('u_old')).toBeNull();
  });
});
