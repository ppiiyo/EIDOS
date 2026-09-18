import { RecommendationResult } from '../semantic/recommender';

export function renderSearchResults(
  container: HTMLElement,
  results: RecommendationResult[]
): void {
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.875rem; text-align: center; padding: 2rem;">
        No semantic matches found above the similarity threshold.
      </div>
    `;
    return;
  }

  for (const res of results) {
    const card = document.createElement('div');
    card.className = 'product-card search-result-item';
    card.id = `search-item-${res.item.id}`;
    card.setAttribute('data-testid', 'rec-item');

    const scorePercent = (res.similarity * 100).toFixed(1);

    const numericPrice = typeof res.item.price === 'number'
      ? res.item.price
      : (parseFloat(String(res.item.price ?? '0').replace(/[^0-9.]/g, '')) || 0);

    card.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
          <div class="product-title" style="margin-bottom: 0;">${escapeHtml(res.item.title)}</div>
          <span class="score-tag">${scorePercent}% relevance</span>
        </div>
        <div class="product-desc">${escapeHtml(res.item.description)}</div>
      </div>
      <div class="product-meta">
        <span style="color: var(--accent-cyan);">${escapeHtml(res.item.category)}</span>
        <span style="font-weight: 600;">$${numericPrice.toFixed(2)}</span>
      </div>
    `;

    container.appendChild(card);
  }
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
