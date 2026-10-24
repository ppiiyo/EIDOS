# Shopify Webhook & Storefront Integration Example

Synchronize your Shopify product catalog with EIDOS in real time using Shopify Webhooks (`products/create`, `products/update`, `products/delete`) and automatically invalidate Redis caches on inventory changes.

## 1. Shopify Webhook Handler (Node.js / Fastify / Express)

```typescript
import crypto from 'crypto';

const EIDOS_API_URL = process.env.EIDOS_API_URL || 'http://localhost:3000';
const EIDOS_API_KEY = process.env.EIDOS_API_KEY || 'test-key';
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';

export function verifyShopifyHmac(rawBody: Buffer, hmacHeader: string): boolean {
  const digest = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

export async function handleShopifyProductUpsert(shopifyProduct: any) {
  const firstVariant = shopifyProduct.variants?.[0];
  const price = firstVariant ? parseFloat(firstVariant.price) : undefined;

  // POST /v1/catalog/items automatically embeds the item and invalidates Redis search:* & recommend:*
  const response = await fetch(`${EIDOS_API_URL}/v1/catalog/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': EIDOS_API_KEY,
    },
    body: JSON.stringify({
      id: `shopify-${shopifyProduct.id}`,
      title: shopifyProduct.title,
      description: (shopifyProduct.body_html || '').replace(/<[^>]+>/g, ' ').trim(),
      category: shopifyProduct.product_type || 'General',
      tags: typeof shopifyProduct.tags === 'string'
        ? shopifyProduct.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [],
      price,
    }),
  });

  return response.json();
}

export async function handleShopifyProductDelete(shopifyProductId: string | number) {
  // DELETE /v1/catalog/items/:id removes the item from HNSW & BM25 and invalidates Redis caches
  const response = await fetch(`${EIDOS_API_URL}/v1/catalog/items/shopify-${shopifyProductId}`, {
    method: 'DELETE',
    headers: {
      'x-api-key': EIDOS_API_KEY,
    },
  });

  return response.json();
}
```
