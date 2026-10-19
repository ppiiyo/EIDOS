# kostra44SIP Integration Guide

This guide details how to integrate kostra44SIP Semantic Recommender into existing e-commerce backends, Shopify, and headless architectures.

---

## 1. Shopify Integration

You can integrate kostra44SIP into Shopify themes via liquid and a lightweight frontend snippet:

```html
<!-- snippets/kostra44sip-recommendations.liquid -->
<div id="kostra44sip-recommended-container" class="kostra44sip-grid" data-product-id="{{ product.id }}">
  <div class="kostra44sip-skeleton">Loading semantic recommendations...</div>
</div>

<script>
  (async function() {
    const container = document.getElementById('kostra44sip-recommended-container');
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
add_action('woocommerce_after_single_product_summary', 'render_kostra44sip_recommendations', 25);

function render_kostra44sip_recommendations() {
    global $product;
    $product_id = (string) $product->get_id();
    
    $api_url = 'https://api.your-domain.com/v1/recommend';
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . KOSTRA44SIP_API_KEY,
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

    echo '<div class="kostra44sip-related-section"><h3>Semantically Related Items</h3><ul>';
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
import { KostraClient } from '@kostra44sip/sdk';

const kostra44sip = new KostraClient({
  baseUrl: process.env.kostra44SIP_API_URL!,
  apiKey: process.env.KOSTRA44SIP_API_KEY!,
});

export default async function ProductPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const recs = await kostra44sip.recommend({
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
