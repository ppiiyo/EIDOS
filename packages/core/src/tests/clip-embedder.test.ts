import { describe, it, expect } from 'vitest';
import { CLIPEmbedder } from '../multimodal/clip-embedder';

describe('CLIPEmbedder (Task 2.2 Multimodal Support)', () => {
  it('computes L2-normalized 512-d image and text embeddings in < 200ms', async () => {
    const embedder = new CLIPEmbedder();
    await embedder.init();

    const t0 = performance.now();
    const imgVec = await embedder.embedImage('https://example.com/catalog/ergonomic-keyboard-dark.jpg');
    const txtVec = await embedder.embedText('ergonomic mechanical keyboard dark');
    const elapsedMs = performance.now() - t0;

    expect(imgVec).toBeInstanceOf(Float32Array);
    expect(txtVec).toBeInstanceOf(Float32Array);
    expect(imgVec.length).toBe(512);
    expect(txtVec.length).toBe(512);
    expect(elapsedMs).toBeLessThan(200);

    // Verify L2 normalization
    let normImg = 0;
    let normTxt = 0;
    for (let i = 0; i < 512; i++) {
      normImg += imgVec[i] * imgVec[i];
      normTxt += txtVec[i] * txtVec[i];
    }
    expect(Math.sqrt(normImg)).toBeCloseTo(1.0, 4);
    expect(Math.sqrt(normTxt)).toBeCloseTo(1.0, 4);
  });

  it('supports cross-modal text-to-image search (e.g. "красные кроссовки")', async () => {
    const embedder = new CLIPEmbedder();
    const catalogImages = [
      {
        id: 'sku-sneakers',
        imageUrl: 'https://cdn.kostra44sip.dev/images/red-sneakers-runmax.png',
        title: 'RunMax Crimson Sneakers',
        tags: ['red', 'sneaker', 'running'],
      },
      {
        id: 'sku-coffee',
        imageUrl: 'https://cdn.kostra44sip.dev/images/espresso-barista.png',
        title: 'Specialty Espresso Machine',
        tags: ['coffee', 'espresso'],
      },
    ];

    const results = await embedder.searchImagesByText('красные кроссовки', catalogImages, 2);
    expect(results.length).toBe(2);
    expect(results[0].item.id).toBe('sku-sneakers');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});
