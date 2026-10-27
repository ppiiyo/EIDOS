import { SecurityGuardrails } from '@eidos/core';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';
import { ApiQueryCache } from '../services/query-cache';
import { getCache, getSemanticCache } from '../services/cache';

export interface PostgresWal2JsonChange {
  kind: 'insert' | 'update' | 'delete';
  schema?: string;
  table: string;
  columnnames?: string[];
  columnvalues?: unknown[];
  oldkeys?: {
    keynames: string[];
    keyvalues: unknown[];
  };
}

export interface PostgresWal2JsonPayload {
  change: PostgresWal2JsonChange[];
  lsn?: string;
}

export interface PostgresCDCRowEvent {
  lsn: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface PostgresColumnMapping {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  price?: string;
  tags?: string;
  inStock?: string;
}

/**
 * Zero-ETL PostgreSQL Logical Replication (pgoutput / wal2json) Connector.
 * Processes row-level CDC events in a non-blocking pipeline:
 * parse row -> sanitize via SecurityGuardrails -> generate 384-d embedding -> upsert/delete in VectorStore -> invalidate caches.
 */
export class PostgresCDCConnector {
  private processedEvents = 0;
  private insertedCount = 0;
  private updatedCount = 0;
  private deletedCount = 0;
  private lastLsn = '0/0';
  private readonly mapping: Required<PostgresColumnMapping>;

  constructor(
    private readonly vectorStore: VectorStore,
    private readonly embedder: ServerEmbedder = ServerEmbedder.getInstance(),
    mapping?: PostgresColumnMapping
  ) {
    this.mapping = {
      id: mapping?.id ?? 'id',
      title: mapping?.title ?? 'title',
      description: mapping?.description ?? 'description',
      category: mapping?.category ?? 'category',
      price: mapping?.price ?? 'price',
      tags: mapping?.tags ?? 'tags',
      inStock: mapping?.inStock ?? 'in_stock',
    };
  }

  private mapColumnsToRecord(names: string[] = [], values: unknown[] = []): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < names.length; i++) {
      out[names[i]] = values[i];
    }
    return out;
  }

  /**
   * Processes a batch of logical replication events (`INSERT` / `UPDATE` / `DELETE`).
   */
  public async processBatch(events: PostgresCDCRowEvent[]): Promise<{
    inserted: number;
    updated: number;
    deleted: number;
    lastProcessedId: string;
  }> {
    let inserted = 0;
    let updated = 0;
    let deleted = 0;

    for (const evt of events) {
      this.lastLsn = evt.lsn || this.lastLsn;
      if (evt.op === 'DELETE') {
        const rawId = evt.before?.[this.mapping.id] ?? evt.after?.[this.mapping.id];
        if (rawId !== undefined && rawId !== null) {
          this.vectorStore.delete(String(rawId));
          deleted++;
          this.deletedCount++;
          this.processedEvents++;
        }
        continue;
      }

      const row = evt.after || {};
      const rawId = row[this.mapping.id];
      const rawTitle = row[this.mapping.title];
      if (!rawId || !rawTitle) continue;

      const cleanTitle = SecurityGuardrails.scanAndSanitize(String(rawTitle)).sanitizedInput;
      const cleanDesc = SecurityGuardrails.scanAndSanitize(
        String(row[this.mapping.description] ?? '')
      ).sanitizedInput;
      const category = String(row[this.mapping.category] ?? 'General');
      const price =
        row[this.mapping.price] !== undefined ? Number(row[this.mapping.price]) : undefined;

      const rawTags = row[this.mapping.tags];
      const tags = Array.isArray(rawTags)
        ? rawTags.map((t) => String(t))
        : typeof rawTags === 'string' && rawTags.trim().length > 0
        ? rawTags.split(',').map((t) => t.trim())
        : [];

      const textToEmbed = `${cleanTitle}. ${cleanDesc}. Category: ${category}. Tags: ${tags.join(', ')}`;
      const vec = await this.embedder.embed(textToEmbed);
      const embedding = Array.from(vec);

      this.vectorStore.upsert({
        id: String(rawId),
        title: cleanTitle,
        description: cleanDesc,
        category,
        tags,
        price,
        embedding,
      });

      if (evt.op === 'INSERT') {
        inserted++;
        this.insertedCount++;
      } else {
        updated++;
        this.updatedCount++;
      }
      this.processedEvents++;
    }

    if (inserted > 0 || updated > 0 || deleted > 0) {
      await this.invalidateCaches();
    }

    return {
      inserted,
      updated,
      deleted,
      lastProcessedId: this.lastLsn,
    };
  }

  /**
   * Processes a wal2json batch payload from PostgreSQL CDC stream.
   */
  public async processWalBatch(payload: PostgresWal2JsonPayload): Promise<{
    upserted: number;
    deleted: number;
    lastLsn: string;
  }> {
    let upserted = 0;
    let deleted = 0;

    for (const change of payload.change || []) {
      if (change.kind === 'delete') {
        const keyMap = this.mapColumnsToRecord(
          change.oldkeys?.keynames,
          change.oldkeys?.keyvalues
        );
        const rawId = keyMap[this.mapping.id];
        if (rawId !== undefined && rawId !== null) {
          this.vectorStore.delete(String(rawId));
          deleted++;
          this.deletedCount++;
          this.processedEvents++;
        }
        continue;
      }

      if (change.kind === 'insert' || change.kind === 'update') {
        const row = this.mapColumnsToRecord(change.columnnames, change.columnvalues);
        const rawId = row[this.mapping.id];
        const rawTitle = row[this.mapping.title];
        if (!rawId || !rawTitle) continue;

        const cleanTitle = SecurityGuardrails.scanAndSanitize(String(rawTitle)).sanitizedInput;
        const cleanDesc = SecurityGuardrails.scanAndSanitize(
          String(row[this.mapping.description] ?? '')
        ).sanitizedInput;
        const category = String(row[this.mapping.category] ?? 'General');
        const price =
          row[this.mapping.price] !== undefined ? Number(row[this.mapping.price]) : undefined;

        const rawTags = row[this.mapping.tags];
        const tags = Array.isArray(rawTags)
          ? rawTags.map((t) => String(t))
          : typeof rawTags === 'string' && rawTags.trim().length > 0
          ? rawTags.split(',').map((t) => t.trim())
          : [];

        const textToEmbed = `${cleanTitle}. ${cleanDesc}. Category: ${category}. Tags: ${tags.join(', ')}`;
        const vec = await this.embedder.embed(textToEmbed);
        const embedding = Array.from(vec);

        this.vectorStore.upsert({
          id: String(rawId),
          title: cleanTitle,
          description: cleanDesc,
          category,
          tags,
          price,
          embedding,
        });

        upserted++;
        if (change.kind === 'insert') this.insertedCount++;
        else this.updatedCount++;
        this.processedEvents++;
      }
    }

    if (payload.lsn) {
      this.lastLsn = payload.lsn;
    }

    if (upserted > 0 || deleted > 0) {
      await this.invalidateCaches();
    }

    return {
      upserted,
      deleted,
      lastLsn: this.lastLsn,
    };
  }

  private async invalidateCaches(): Promise<void> {
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
    const redisCache = getCache();
    await Promise.all([
      redisCache.invalidate('search:*'),
      redisCache.invalidate('recommend:*'),
    ]);
  }

  public getMetrics() {
    return {
      inserted: this.insertedCount,
      updated: this.updatedCount,
      deleted: this.deletedCount,
      processedEvents: this.processedEvents,
      lastProcessedId: this.lastLsn,
    };
  }

  public getStats(): { processedEvents: number; lastLsn: string } {
    return {
      processedEvents: this.processedEvents,
      lastLsn: this.lastLsn,
    };
  }
}

export interface MongoChangeEvent {
  _id?: { _data: string };
  operationType: 'insert' | 'update' | 'replace' | 'delete';
  documentKey: { _id: string | number };
  fullDocument?: {
    _id?: string | number;
    title?: string;
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    tags?: string[];
  };
}

/**
 * Zero-ETL MongoDB Change Streams Connector with at-least-once resume token tracking.
 */
export class MongoChangeStreamConnector {
  private processedEvents = 0;
  private insertedCount = 0;
  private updatedCount = 0;
  private deletedCount = 0;
  private lastResumeToken: string | null = null;
  private readonly seenEventTokens = new Set<string>();

  constructor(
    private readonly vectorStore: VectorStore,
    private readonly embedder: ServerEmbedder = ServerEmbedder.getInstance()
  ) {}

  public async handleEvent(event: MongoChangeEvent): Promise<boolean> {
    const token = event._id?._data || null;
    if (token && this.seenEventTokens.has(token)) {
      return false;
    }

    const docId = String(event.documentKey._id);

    if (event.operationType === 'delete') {
      this.vectorStore.delete(docId);
      if (token) {
        this.seenEventTokens.add(token);
        this.lastResumeToken = token;
      }
      this.deletedCount++;
      this.processedEvents++;
      await this.invalidateCaches();
      return true;
    }

    if (
      event.operationType === 'insert' ||
      event.operationType === 'update' ||
      event.operationType === 'replace'
    ) {
      const doc = event.fullDocument;
      if (!doc || (!doc.title && !doc.name)) {
        return false;
      }

      const cleanTitle = SecurityGuardrails.scanAndSanitize(
        String(doc.title || doc.name)
      ).sanitizedInput;
      const cleanDesc = SecurityGuardrails.scanAndSanitize(
        String(doc.description || '')
      ).sanitizedInput;
      const category = String(doc.category || 'General');
      const tags = Array.isArray(doc.tags) ? doc.tags.map(String) : [];
      const price = typeof doc.price === 'number' ? doc.price : undefined;

      const vec = await this.embedder.embed(
        `${cleanTitle}. ${cleanDesc}. Category: ${category}. Tags: ${tags.join(', ')}`
      );
      const embedding = Array.from(vec);

      this.vectorStore.upsert({
        id: docId,
        title: cleanTitle,
        description: cleanDesc,
        category,
        tags,
        price,
        embedding,
      });

      if (token) {
        this.seenEventTokens.add(token);
        this.lastResumeToken = token;
      }
      if (event.operationType === 'insert') this.insertedCount++;
      else this.updatedCount++;
      this.processedEvents++;
      await this.invalidateCaches();
      return true;
    }

    return false;
  }

  private async invalidateCaches(): Promise<void> {
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
    const redisCache = getCache();
    await Promise.all([
      redisCache.invalidate('search:*'),
      redisCache.invalidate('recommend:*'),
    ]);
  }

  public getMetrics() {
    return {
      inserted: this.insertedCount,
      updated: this.updatedCount,
      deleted: this.deletedCount,
      processedEvents: this.processedEvents,
      lastResumeToken: this.lastResumeToken,
    };
  }

  public getStats(): { processedEvents: number; lastResumeToken: string | null } {
    return {
      processedEvents: this.processedEvents,
      lastResumeToken: this.lastResumeToken,
    };
  }
}

export type ShopifyWebhookTopic = 'products/create' | 'products/update' | 'products/delete';

export interface ShopifyVariantPayload {
  id: number | string;
  price?: string | number;
  inventory_quantity?: number;
  sku?: string;
}

export interface ShopifyProductWebhookPayload {
  id: number | string;
  title?: string;
  body_html?: string;
  product_type?: string;
  vendor?: string;
  tags?: string | string[];
  status?: 'active' | 'draft' | 'archived';
  variants?: ShopifyVariantPayload[];
}

/**
 * Zero-ETL Shopify Webhook Connector (`products/create`, `products/update`, `products/delete`)
 * with HMAC-SHA256 signature verification, HTML stripping, SecurityGuardrails sanitization,
 * and automatic multi-tier cache invalidation.
 */
export class ShopifyWebhookConnector {
  private processedEvents = 0;
  private createdCount = 0;
  private updatedCount = 0;
  private deletedCount = 0;

  constructor(
    private readonly vectorStore: VectorStore,
    private readonly embedder: ServerEmbedder = ServerEmbedder.getInstance(),
    private readonly webhookSecret: string = process.env.SHOPIFY_WEBHOOK_SECRET || 'eidos_shopify_secret'
  ) {}

  /**
   * Computes base64 HMAC-SHA256 signature for a raw Shopify webhook payload.
   */
  public computeHmacSignature(rawBody: string): string {
    const crypto = require('crypto') as typeof import('crypto');
    return crypto.createHmac('sha256', this.webhookSecret).update(rawBody, 'utf8').digest('base64');
  }

  /**
   * Constant-time verification of X-Shopify-Hmac-Sha256 signature header.
   */
  public verifyHmacSignature(rawBody: string, hmacHeader?: string): boolean {
    if (!hmacHeader) return false;
    const crypto = require('crypto') as typeof import('crypto');
    const expected = this.computeHmacSignature(rawBody);
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(hmacHeader, 'utf8');
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  /**
   * Handles a Shopify product webhook event and invalidates search/recommendation caches.
   */
  public async handleWebhook(
    topic: ShopifyWebhookTopic,
    payload: ShopifyProductWebhookPayload,
    options?: { rawBody?: string; hmacHeader?: string; requireHmac?: boolean }
  ): Promise<{
    handled: boolean;
    action: 'created' | 'updated' | 'deleted' | 'ignored';
    itemId: string;
  }> {
    if (options?.requireHmac) {
      const raw = options.rawBody ?? JSON.stringify(payload);
      if (!this.verifyHmacSignature(raw, options.hmacHeader)) {
        throw new Error('Invalid Shopify HMAC-SHA256 webhook signature');
      }
    }

    const itemId = `shopify-${payload.id}`;

    if (topic === 'products/delete' || payload.status === 'archived') {
      this.vectorStore.delete(itemId);
      this.deletedCount++;
      this.processedEvents++;
      await this.invalidateCaches();
      return { handled: true, action: 'deleted', itemId };
    }

    if (topic === 'products/create' || topic === 'products/update') {
      if (!payload.title) {
        return { handled: false, action: 'ignored', itemId };
      }

      const strippedHtml = String(payload.body_html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const cleanTitle = SecurityGuardrails.scanAndSanitize(String(payload.title)).sanitizedInput;
      const cleanDesc = SecurityGuardrails.scanAndSanitize(strippedHtml).sanitizedInput;
      const category = String(payload.product_type || payload.vendor || 'General');

      const tags = Array.isArray(payload.tags)
        ? payload.tags.map((t) => String(t).trim()).filter(Boolean)
        : typeof payload.tags === 'string' && payload.tags.trim().length > 0
        ? payload.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const primaryVariant = payload.variants?.[0];
      const price =
        primaryVariant?.price !== undefined ? Number(primaryVariant.price) : 0;
      const inStock =
        primaryVariant?.inventory_quantity !== undefined
          ? primaryVariant.inventory_quantity > 0
          : true;

      const textToEmbed = `${cleanTitle}. ${cleanDesc}. Category: ${category}. Tags: ${tags.join(', ')}`;
      const vec = await this.embedder.embed(textToEmbed);

      this.vectorStore.upsert({
        id: itemId,
        title: cleanTitle,
        description: cleanDesc,
        category,
        tags,
        price,
        inStock,
        embedding: Array.from(vec),
      });

      if (topic === 'products/create') {
        this.createdCount++;
      } else {
        this.updatedCount++;
      }
      this.processedEvents++;
      await this.invalidateCaches();

      return {
        handled: true,
        action: topic === 'products/create' ? 'created' : 'updated',
        itemId,
      };
    }

    return { handled: false, action: 'ignored', itemId };
  }

  private async invalidateCaches(): Promise<void> {
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
    const redisCache = getCache();
    await Promise.all([
      redisCache.invalidate('search:*'),
      redisCache.invalidate('recommend:*'),
    ]);
  }

  public getMetrics() {
    return {
      created: this.createdCount,
      updated: this.updatedCount,
      deleted: this.deletedCount,
      processedEvents: this.processedEvents,
    };
  }
}

