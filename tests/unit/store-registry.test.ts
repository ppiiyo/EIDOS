import { describe, it, expect, beforeEach } from 'vitest';
import {
  StoreError,
  StoreRegistry,
  withTimeout,
} from '../../apps/api/src/services/store-registry';
import { VectorStore } from '../../apps/api/src/services/vector-store';

describe('PHASE 2: StoreRegistry, StoreError & withTimeout Unit Tests', () => {
  let registry: StoreRegistry;

  beforeEach(() => {
    registry = new StoreRegistry(new VectorStore());
  });

  it('StoreError serializes structured statusCode, code, error, and details', () => {
    const err = new StoreError('STORE_NOT_FOUND', "Index 'analytics_v2' not found", 404, {
      tenantId: 'default',
      indexName: 'analytics_v2',
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StoreError);
    expect(err.code).toBe('STORE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.toJSON()).toEqual({
      statusCode: 404,
      error: 'Not Found',
      code: 'STORE_NOT_FOUND',
      message: "Index 'analytics_v2' not found",
      details: {
        tenantId: 'default',
        indexName: 'analytics_v2',
      },
    });
  });

  it('withTimeout resolves fast promises and rejects slow promises with 504 OPERATION_TIMEOUT', async () => {
    const fastResult = await withTimeout(Promise.resolve('ok'), 200, 'fastOp');
    expect(fastResult).toBe('ok');

    const slowPromise = new Promise<string>((resolve) => {
      const t = setTimeout(() => resolve('late'), 500);
      t.unref?.();
    });

    await expect(withTimeout(slowPromise, 25, 'slowSearch')).rejects.toMatchObject({
      name: 'StoreError',
      code: 'OPERATION_TIMEOUT',
      statusCode: 504,
    });
  });

  it('validates tenantId and indexName against invalid characters', () => {
    expect(() => StoreRegistry.validateTenantId('valid_tenant-1')).not.toThrow();
    expect(() => StoreRegistry.validateTenantId('')).toThrowError(StoreError);
    expect(() => StoreRegistry.validateTenantId('../etc/passwd')).toThrowError(StoreError);

    expect(() => StoreRegistry.validateIndexName('products_2026')).not.toThrow();
    expect(() => StoreRegistry.validateIndexName('invalid space!')).toThrowError(StoreError);
  });

  it('manages index lifecycle and prevents duplicate creation or deleting default index', () => {
    const created = registry.createIndex(
      {
        name: 'custom_catalog',
        dimension: 384,
        quantization: 'int8',
      },
      'default'
    );

    expect(created.name).toBe('custom_catalog');
    expect(registry.getStore('default', 'custom_catalog')).toBe(created.store);

    // Duplicate index creation throws 409 Conflict
    expect(() =>
      registry.createIndex({ name: 'custom_catalog' }, 'default')
    ).toThrowError(
      expect.objectContaining({
        code: 'STORE_ALREADY_EXISTS',
        statusCode: 409,
      })
    );

    // Cannot delete primary default index
    expect(() => registry.deleteIndex('default', 'default')).toThrowError(
      expect.objectContaining({
        code: 'CANNOT_DELETE_DEFAULT',
        statusCode: 400,
      })
    );

    // Deleting custom index succeeds, subsequent lookup without createIfMissing throws 404
    expect(registry.deleteIndex('custom_catalog', 'default')).toBe(true);
    expect(() =>
      registry.getStore('default', 'custom_catalog', { createIfMissing: false })
    ).toThrowError(
      expect.objectContaining({
        code: 'STORE_NOT_FOUND',
        statusCode: 404,
      })
    );
  });

  it('enforces per-tenant item and index quotas with 429 QUOTA_EXCEEDED', () => {
    registry.setTenantQuota('startup_tenant', { maxItems: 2, maxIndexes: 2 });

    const store = registry.getStore('startup_tenant', 'default');
    const dummyVec = new Array(384).fill(0.05);

    registry.assertItemQuota('startup_tenant', 'default', 2);
    store.upsert({
      id: '1',
      title: 'Item 1',
      description: 'Desc',
      category: 'Cat',
      tags: [],
      embedding: dummyVec,
    });
    store.upsert({
      id: '2',
      title: 'Item 2',
      description: 'Desc',
      category: 'Cat',
      tags: [],
      embedding: dummyVec,
    });

    expect(() => registry.assertItemQuota('startup_tenant', 'default', 1)).toThrowError(
      expect.objectContaining({
        code: 'QUOTA_EXCEEDED',
        statusCode: 429,
      })
    );
  });
});
