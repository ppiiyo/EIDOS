# EIDOS Integration Guide

This guide details how to integrate EIDOS Semantic Recommender into existing e-commerce backends, Shopify, and headless architectures.

---

## 1. Shopify Integration

You can integrate EIDOS into Shopify themes via liquid and a lightweight frontend snippet:

```html
<!-- snippets/eidos-recommendations.liquid -->
<div id="eidos-recommended-container" class="eidos-grid" data-product-id="{{ product.id }}">
  <div class="eidos-skeleton">Loading semantic recommendations...</div>
</div>

<script>
  (async function() {
    const container = document.getElementById('eidos-recommended-container');
    const productId = container.dataset.productId;

    try {
      const response = await fetch('https://api.your-domain.com/v1/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_STOREFRONT_PUBLIC_KEY'
        },
        body: JSON.stringify({ itemId: productId, limit: 4 })
      });

      const data = await response.json();
      container.innerHTML = data.recommendations.map(item => `
        <div class="product-card">
          <h4>${item.title}</h4>
          <span class="price">$${item.price}</span>
          <span class="match-score">${Math.round(item.score * 100)}% match</span>
        </div>
      `).join('');
    } catch (err) {
      container.style.display = 'none';
    }
  })();
</script>
```

---

## 2. WordPress / WooCommerce Integration

In your theme's `functions.php`:

```php
add_action('woocommerce_after_single_product_summary', 'render_eidos_recommendations', 25);

function render_eidos_recommendations() {
    global $product;
    $product_id = (string) $product->get_id();
    
    $api_url = 'https://api.your-domain.com/v1/recommend';
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . EIDOS_API_KEY,
            'Content-Type'  => 'application/json'
        ],
        'body' => wp_json_encode([
            'itemId' => $product_id,
            'limit'  => 4
        ]),
        'timeout' => 2 // Avoid stalling WooCommerce render
    ]);

    if (is_wp_error($response)) {
        return;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    if (empty($body['recommendations'])) {
        return;
    }

    echo '<div class="eidos-related-section"><h3>Semantically Related Items</h3><ul>';
    foreach ($body['recommendations'] as $rec) {
        echo '<li>' . esc_html($rec['title']) . ' (' . round($rec['score'] * 100) . '% semantic match)</li>';
    }
    echo '</ul></div>';
}
```

---

## 3. Node.js / Next.js Server Components

```tsx
// app/products/[id]/page.tsx
import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_API_URL!,
  apiKey: process.env.EIDOS_API_KEY!,
});

export default async function ProductPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const recs = await eidos.recommend({
    itemId: id,
    limit: 4,
    diversityFactor: 0.75,
  });

  return (
    <section className="recommendations-row">
      <h2>Recommended For You</h2>
      <div className="grid grid-cols-4 gap-4">
        {recs.recommendations.map((item) => (
          <div key={item.id} className="border p-4 rounded-lg">
            <h3 className="font-medium text-sm">{item.title}</h3>
            <p className="text-xs text-neutral-500">{item.category}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```
