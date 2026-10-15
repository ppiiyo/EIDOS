import { DemoItem } from '../semantic/recommender';

export function renderCatalog(
  container: HTMLElement,
  items: DemoItem[],
  selectedId: string | null,
  onSelect: (id: string) => void
): void {
  container.innerHTML = '';

  for (const item of items) {
    const card = document.createElement('div');
    card.className = `product-card ${selectedId === item.id ? 'selected' : ''}`;
    card.id = `catalog-item-${item.id}`;
    card.setAttribute('data-testid', 'item-card');

    const numericPrice = typeof item.price === 'number'
      ? item.price
      : (parseFloat(String(item.price ?? '0').replace(/[^0-9.]/g, '')) || 0);

    card.innerHTML = `
      <div>
        <div class="product-title">${escapeHtml(item.title)}</div>
        <div class="product-desc">${escapeHtml(item.description)}</div>
      </div>
      <div class="product-meta">
        <span style="color: var(--accent-cyan); font-size: 0.75rem;">${escapeHtml(item.category)}</span>
        <span style="font-weight: 600;">$${numericPrice.toFixed(2)}</span>
      </div>
    `;

    card.addEventListener('click', () => onSelect(item.id));
    container.appendChild(card);
  }
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
