import { describe, it, expect } from 'vitest';
import { QueryParser } from '../../packages/core/src/search/query-understanding';

describe('Task 3.2: Query Understanding Pipeline (QueryParser)', () => {
  it('extracts maxPrice, cheap intent, and gaming category from English query', () => {
    const parser = new QueryParser();
    const res = parser.parse('cheap gaming headphones under $150');

    expect(res.maxPrice).toBe(150);
    expect(res.intent).toBe('cheap');
    expect(res.category).toBe('gaming');
    expect(res.cleanQuery).toContain('headphones');
  });

  it('extracts minPrice, maxPrice, and premium intent from Russian/English queries', () => {
    const parser = new QueryParser();
    const res = parser.parse('премиум audio мониторы от 200 до 800');

    expect(res.minPrice).toBe(200);
    expect(res.maxPrice).toBe(800);
    expect(res.intent).toBe('premium');
    expect(res.category).toBe('audio');
  });
});
