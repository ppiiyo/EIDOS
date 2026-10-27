import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { Sidebar } from '../../apps/workspace/src/components/Sidebar';
import {
  RankingPlayground,
  computeFallbackResults,
} from '../../apps/workspace/src/components/RankingPlayground';
import { AnalyticsView } from '../../apps/workspace/src/components/AnalyticsView';

describe('PHASE 2: Modern Responsive UI (Sidebar, Ranking Playground, Analytics Dashboard)', () => {
  it('Task 2.1: Sidebar renders 3 navigation groups, collapse toggle, mobile menu toggle, and Ranking Playground item', () => {
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        active: 'ranking',
        onSelect: () => {},
        uiLang: 'en',
      })
    );

    expect(html).toContain('Core Engine');
    expect(html).toContain('Playground &amp; Labs');
    expect(html).toContain('Analytics &amp; Ops');
    expect(html).toContain('data-testid="sidebar-collapse-toggle"');
    expect(html).toContain('data-testid="mobile-menu-toggle"');
    expect(html).toContain('data-testid="nav-ranking"');
    expect(html).toContain('Ranking Playground');
  });

  it('Task 2.2: RankingPlayground renders sliders, live score breakdown bars, and computes dynamic hybrid scores', () => {
    const html = renderToStaticMarkup(React.createElement(RankingPlayground, {}));

    expect(html).toContain('Interactive Ranking Playground');
    expect(html).toContain('data-testid="slider-alpha"');
    expect(html).toContain('data-testid="slider-diversity"');
    expect(html).toContain('data-testid="slider-freshness"');
    expect(html).toContain('data-testid="slider-popularity"');
    expect(html).toContain('Vector');
    expect(html).toContain('BM25');
    expect(html).toContain('Diversity');

    // Verify dynamic score calculation across different alpha & diversity weights
    const vectorHeavy = computeFallbackResults('wireless headphones', {
      alpha: 0.95,
      diversityLambda: 0.2,
      freshnessWeight: 0.1,
      popularityWeight: 0.1,
    });
    const keywordHeavy = computeFallbackResults('wireless headphones', {
      alpha: 0.05,
      diversityLambda: 0.9,
      freshnessWeight: 0.5,
      popularityWeight: 0.5,
    });

    expect(vectorHeavy.length).toBeGreaterThan(0);
    expect(keywordHeavy.length).toBeGreaterThan(0);
    expect(vectorHeavy[0].finalScore).not.toBe(keywordHeavy[0].finalScore);
    expect(keywordHeavy[0].diversityBonus).toBeGreaterThan(vectorHeavy[0].diversityBonus);
  });

  it('Task 2.3: AnalyticsView renders 4 KPI cards, Top Search Queries table, and Zero-Result Queries alert list', () => {
    const html = renderToStaticMarkup(React.createElement(AnalyticsView, {}));

    expect(html).toContain('data-testid="analytics-kpi-grid"');
    expect(html).toContain('Total Searches (24h)');
    expect(html).toContain('Avg Latency (p95)');
    expect(html).toContain('Search CTR');
    expect(html).toContain('Zero-Result Rate');
    expect(html).toContain('data-testid="top-queries-table"');
    expect(html).toContain('wireless noise cancelling headphones');
    expect(html).toContain('data-testid="zero-results-list"');
    expect(html).toContain('airpods pro max ultra');
    expect(html).toContain('+ Add Synonym');
  });
});
