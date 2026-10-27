import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../../apps/api/src/services/vector-store';
import { ServerEmbedder } from '../../apps/api/src/services/embedder';
import {
  ShopifyWebhookConnector,
  ShopifyProductWebhookPayload,
} from '../../apps/api/src/connectors';
import { ApiQueryCache } from '../../apps/api/src/services/query-cache';

describe('PHASE 1 - Task 1.2: Shopify Webhook Integration Test', () => {
  let store: VectorStore;
  let embedder: ServerEmbedder;
  let shopifyConnector: ShopifyWebhookConnector;

  beforeEach(() => {
    store = new VectorStore();
    embedder = ServerEmbedder.getInstance();
    shopifyConnector = new ShopifyWebhookConnector(
      store,
      embedder,
      'shopify_production_secret_key'
    );
    ApiQueryCache.invalidateAll();
  });

  it('processes products/create, products/update, and products/delete Shopify webhooks with HMAC-SHA256 verification and automatic cache invalidation', async () => {
    const queryCache = ApiQueryCache.getInstance();
    queryCache.set('search:espresso-machine', { cached: true });

    // 1. products/create webhook with valid HMAC
    const createPayload: ShopifyProductWebhookPayload = {
      id: 88412093,
      title: 'La Marzocco Linea Micra Espresso Machine',
      body_html: '<p>Dual boiler rotary pump <strong>commercial grade</strong> home espresso machine.</p>',
      product_type: 'Coffee Equipment',
      tags: 'espresso, dual-boiler, italian',
      status: 'active',
      variants: [{ id: 1, price: '3900.00', inventory_quantity: 8 }],
    };
    const rawCreate = JSON.stringify(createPayload);
    const hmacCreate = shopifyConnector.computeHmacSignature(rawCreate);

    const createRes = await shopifyConnector.handleWebhook('products/create', createPayload, {
      rawBody: rawCreate,
      hmacHeader: hmacCreate,
      requireHmac: true,
    });

    expect(createRes.handled).toBe(true);
    expect(createRes.action).toBe('created');
    expect(store.get('shopify-88412093')?.title).toBe(
      'La Marzocco Linea Micra Espresso Machine'
    );
    expect(store.get('shopify-88412093')?.price).toBe(3900);
    expect(queryCache.get('search:espresso-machine')).toBeUndefined();

    // 2. products/update webhook
    queryCache.set('search:espresso-machine', { cached: true });
    const updatePayload: ShopifyProductWebhookPayload = {
      ...createPayload,
      title: 'La Marzocco Linea Mini R Espresso Machine',
      variants: [{ id: 1, price: '5900.00', inventory_quantity: 5 }],
    };
    const rawUpdate = JSON.stringify(updatePayload);
    const hmacUpdate = shopifyConnector.computeHmacSignature(rawUpdate);

    const updateRes = await shopifyConnector.handleWebhook('products/update', updatePayload, {
      rawBody: rawUpdate,
      hmacHeader: hmacUpdate,
      requireHmac: true,
    });

    expect(updateRes.action).toBe('updated');
    expect(store.get('shopify-88412093')?.title).toBe(
      'La Marzocco Linea Mini R Espresso Machine'
    );
    expect(store.get('shopify-88412093')?.price).toBe(5900);
    expect(queryCache.get('search:espresso-machine')).toBeUndefined();

    // 3. Rejects tampered webhook with invalid HMAC signature
    await expect(
      shopifyConnector.handleWebhook('products/update', updatePayload, {
        rawBody: rawUpdate,
        hmacHeader: 'invalid_signature_base64',
        requireHmac: true,
      })
    ).rejects.toThrow('Invalid Shopify HMAC-SHA256 webhook signature');

    // 4. products/delete webhook
    queryCache.set('search:espresso-machine', { cached: true });
    const deletePayload: ShopifyProductWebhookPayload = { id: 88412093 };
    const rawDelete = JSON.stringify(deletePayload);
    const hmacDelete = shopifyConnector.computeHmacSignature(rawDelete);

    const deleteRes = await shopifyConnector.handleWebhook('products/delete', deletePayload, {
      rawBody: rawDelete,
      hmacHeader: hmacDelete,
      requireHmac: true,
    });

    expect(deleteRes.action).toBe('deleted');
    expect(store.get('shopify-88412093')).toBeUndefined();
    expect(queryCache.get('search:espresso-machine')).toBeUndefined();
  });
});
