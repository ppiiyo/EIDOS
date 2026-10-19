import { describe, it, expect } from 'vitest';
import { CLIPEmbedder } from '../src/multimodal/clip-embedder';

describe('CLIPEmbedder (Multimodal v3.5.0)', () => {
  it('computes cross-modal embeddings and retrieves red sneakers for "красные кроссовки" in <100ms', async () => {
    const clip = new CLIPEmbedder();
    await clip.init();

    const start = performance.now();
    const textVec = await clip.embedText('красные кроссовки для бега');
    const imgVec = await clip.embedImage('https://cdn.kostra44sip.dev/products/red-sneakers-runmax.jpg');
    const elapsedMs = performance.now() - start;

    expect(textVec.length).toBeGreaterThanOrEqual(384);
    expect(imgVec.length).toBe(textVec.length);
    expect(elapsedMs).toBeLessThan(100);

    const visualCatalog = [
      {
        id: 'sku-laptop',
        imageUrl: 'https://cdn.kostra44sip.dev/products/silver-laptop-probook.jpg',
        title: 'Ноутбук ProBook Ultra',
        tags: ['laptop', 'silver'],
      },
      {
        id: 'sku-sneakers',
        imageUrl: 'https://cdn.kostra44sip.dev/products/red-running-sneakers.jpg',
        title: 'Красные беговые кроссовки RunMax',
        tags: ['red', 'sneakers', 'кроссовки'],
      },
      {
        id: 'sku-coffee',
        imageUrl: 'https://cdn.kostra44sip.dev/products/black-espresso-machine.jpg',
        title: 'Кофемашина Barista Pro',
        tags: ['coffee', 'espresso'],
      },
    ];

    const ranked = await clip.searchImagesByText('красные кроссовки', visualCatalog, 3);
    expect(ranked[0].item.id).toBe('sku-sneakers');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
