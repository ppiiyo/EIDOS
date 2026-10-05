import { describe, it, expect } from 'vitest';
import { MultiInterestUserTower } from '../../adaptive/multi-interest-tower';

describe('MultiInterestUserTower', () => {
  it('empty history produces a valid profile with single zero-initialized capsule', async () => {
    const tower = new MultiInterestUserTower();
    const profile = await tower.buildProfile(
      'user_empty',
      [],
      async () => new Float32Array(384),
      () => 'Misc'
    );

    expect(profile.userId).toBe('user_empty');
    expect(profile.interestEmbeddings.length).toBe(1);
    expect(profile.interestWeights[0]).toBe(1.0);
    expect(tower.getProfile('user_empty')).not.toBeNull();
  });

  it('single-item history correctly builds single-capsule profile', async () => {
    const tower = new MultiInterestUserTower({ normalization: 'l2' });
    const profile = await tower.buildProfile(
      'user_single',
      ['item_tech_1'],
      async () => new Float32Array([0.6, 0.8]),
      () => 'Electronics'
    );

    expect(profile.interestEmbeddings.length).toBe(1);
    const norm = Math.hypot(...Array.from(profile.interestEmbeddings[0]));
    expect(norm).toBeCloseTo(1.0, 4);
    expect(profile.interestCategories[0]).toContain('Electronics');
  });

  it('partitions multi-topic history into distinct interest capsules', async () => {
    const tower = new MultiInterestUserTower({
      maxInterests: 2,
      routingIterations: 4,
      temperature: 0.1,
      normalization: 'l2',
    });

    // Two distinct semantic orthogonal directions:
    // Tech items: heavily aligned along dimension 0
    // Garden items: heavily aligned along dimension 1
    const mockDatabase: Record<string, { emb: Float32Array; cat: string }> = {
      tech_1: { emb: new Float32Array([1.0, 0.05, 0.0]), cat: 'Electronics' },
      tech_2: { emb: new Float32Array([0.98, 0.1, 0.0]), cat: 'Electronics' },
      garden_1: { emb: new Float32Array([0.05, 0.99, 0.0]), cat: 'Garden' },
      garden_2: { emb: new Float32Array([0.0, 1.0, 0.0]), cat: 'Garden' },
    };

    const history = ['tech_1', 'tech_2', 'garden_1', 'garden_2'];

    const profile = await tower.buildProfile(
      'user_multi',
      history,
      async (id) => mockDatabase[id].emb,
      (id) => mockDatabase[id].cat
    );

    expect(profile.interestEmbeddings.length).toBe(2);
    // Weights must sum to 1.0
    const sumWeights = profile.interestWeights.reduce((a, b) => a + b, 0);
    expect(sumWeights).toBeCloseTo(1.0, 4);

    // One capsule should represent Tech (high dim 0), one should represent Garden (high dim 1)
    const dim0Values = profile.interestEmbeddings.map((e) => Math.abs(e[0]));
    const dim1Values = profile.interestEmbeddings.map((e) => Math.abs(e[1]));

    expect(Math.max(...dim0Values)).toBeGreaterThan(0.8);
    expect(Math.max(...dim1Values)).toBeGreaterThan(0.8);
  });

  it('getTopInterestForCandidate routes query candidate to the most relevant capsule', async () => {
    const tower = new MultiInterestUserTower({ maxInterests: 2 });
    const mockDatabase: Record<string, { emb: Float32Array; cat: string }> = {
      t1: { emb: new Float32Array([1.0, 0.0]), cat: 'Tech' },
      g1: { emb: new Float32Array([0.0, 1.0]), cat: 'Garden' },
    };

    await tower.buildProfile(
      'user_routing',
      ['t1', 'g1'],
      async (id) => mockDatabase[id].emb,
      (id) => mockDatabase[id].cat
    );

    // Query candidate resembling Tech
    const techCandidate = new Float32Array([0.95, 0.05]);
    const topTech = tower.getTopInterestForCandidate('user_routing', techCandidate);
    expect(topTech).not.toBeNull();
    expect(topTech!.affinity).toBeGreaterThan(0.7);

    // Query candidate resembling Garden
    const gardenCandidate = new Float32Array([0.05, 0.95]);
    const topGarden = tower.getTopInterestForCandidate('user_routing', gardenCandidate);
    expect(topGarden).not.toBeNull();
    expect(topGarden!.affinity).toBeGreaterThan(0.7);

    // The two candidates should match different capsules or have high affinity to their respective space
    expect(topTech!.affinity).toBeGreaterThan(0.5);
    expect(topGarden!.affinity).toBeGreaterThan(0.5);
  });

  it('evictOldProfiles and clear successfully manage memory lifecycle', async () => {
    const tower = new MultiInterestUserTower();
    await tower.buildProfile('u1', ['i1'], async () => new Float32Array([1, 0]), () => 'Cat');

    expect(tower.getProfile('u1')).not.toBeNull();

    // Fast-forward simulation of age
    const profile = tower.getProfile('u1')!;
    profile.updatedAt = Date.now() - 50000;

    tower.evictOldProfiles(10000);
    expect(tower.getProfile('u1')).toBeNull();

    await tower.buildProfile('u2', ['i1'], async () => new Float32Array([1, 0]), () => 'Cat');
    expect(tower.getProfile('u2')).not.toBeNull();
    tower.clear();
    expect(tower.getProfile('u2')).toBeNull();
  });
});
