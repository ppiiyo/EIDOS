import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { QueryInspector } from '../../../apps/workspace/src/components/QueryInspector';

describe('Phase 3: QueryInspector X-Ray UI Component — 4 Unit Tests', () => {
  it('1. Renders extractedIntent badges (category, useCase, priceRange) and latencyMs', () => {
    const html = renderToStaticMarkup(
      <QueryInspector
        query="недорогие наушники для бега"
        latencyMs={4.2}
        extractedIntent={{
          category: 'наушники',
          useCase: 'бег',
          priceRange: { max: 5000 },
          confidence: 0.95,
        }}
        results={[
          {
            id: 'item-1',
            title: 'Sport RunPods Pro',
            score: 0.91,
            explanation: {
              denseComponent: 0.65,
              sparseBm25Component: 0.26,
              rrfScore: 0.032,
              mmrPenalty: 0,
              businessBoost: 0.05,
            },
          },
        ]}
      />
    );

    expect(html).toContain('Категория: наушники');
    expect(html).toContain('Сценарий: бег');
    expect(html).toContain('до 5000 ₽');
    expect(html).toContain('4.2 ms');
  });

  it('2. Renders stacked explanation bar (dense blue, sparse green, boost orange, negative mmrPenalty red with margin-left:auto)', () => {
    const html = renderToStaticMarkup(
      <QueryInspector
        results={[
          {
            id: 'item-2',
            title: 'Quantum Audio Headphones',
            score: 0.84,
            explanation: {
              denseComponent: 0.55,
              sparseBm25Component: 0.3,
              rrfScore: 0.029,
              businessBoost: 0.08,
              mmrPenalty: -0.12,
            },
          },
        ]}
      />
    );

    expect(html).toContain('data-testid="bar-dense"');
    expect(html).toContain('bg-blue-500');
    expect(html).toContain('data-testid="bar-sparse"');
    expect(html).toContain('bg-emerald-500');
    expect(html).toContain('data-testid="bar-boost"');
    expect(html).toContain('bg-amber-500');
    expect(html).toContain('data-testid="bar-mmr-penalty"');
    expect(html).toContain('bg-red-500');
    expect(html).toContain('margin-left:auto');
  });

  it('3. Renders Empty State ("Нет результатов для отображения") when results is empty', () => {
    const html = renderToStaticMarkup(<QueryInspector results={[]} latencyMs={1.5} />);
    expect(html).toContain('data-testid="inspector-empty-state"');
    expect(html).toContain('Нет результатов для отображения');
  });

  it('4. Safely handles missing or undefined result.explanation without throwing TypeError', () => {
    expect(() =>
      renderToStaticMarkup(
        <QueryInspector
          results={[
            {
              id: 'item-no-exp',
              title: 'Legacy Result Without Explanation',
              score: 0.75,
              explanation: undefined,
            },
            {
              id: 'item-null-exp',
              title: 'Legacy Result With Null Explanation',
              score: 0.62,
              explanation: null,
            },
          ]}
        />
      )
    ).not.toThrow();

    const html = renderToStaticMarkup(
      <QueryInspector
        results={[
          {
            id: 'item-no-exp',
            title: 'Legacy Result Without Explanation',
            score: 0.75,
          },
        ]}
      />
    );
    expect(html).toContain('Legacy Result Without Explanation');
    expect(html).toContain('75.0%');
  });
});
