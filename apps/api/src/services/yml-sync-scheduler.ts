import { getPersistenceStore } from './persistence-store';
import { safeFetchText } from './safe-fetch';
import { parseYmlOrCommerceMl } from './yml-parser';
import { StoreRegistry } from './store-registry';
import { ServerEmbedder } from './embedder';
import { ApiQueryCache } from './query-cache';
import { getCache, CacheKeys, getSemanticCache } from './cache';

export interface YmlSyncConfig {
  tenantId: string;
  indexName: string;
  feedUrl: string;
  enabled: boolean;
  intervalMinutes: number; // e.g., 60 = hourly, 1440 = daily
  authoritativeDelete: boolean; // remove items missing from latest feed
  lastRunAt: string | null;
  lastStatus: 'never' | 'running' | 'success' | 'error';
  lastError: string | null;
  lastParsedCount: number;
  lastIndexedCount: number;
  lastDeletedCount: number;
  lastDurationMs: number;
  nextRunAt: string | null;
  updatedAt: string;
}

const NAMESPACE = 'yml_sync_configs';

export class YmlSyncScheduler {
  private static instance: YmlSyncScheduler | null = null;
  private configs = new Map<string, YmlSyncConfig>();
  private runningLocks = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private embedder: ServerEmbedder;
  private storeRegistry: StoreRegistry;

  constructor(deps?: { embedder?: ServerEmbedder; storeRegistry?: StoreRegistry }) {
    this.embedder = deps?.embedder || ServerEmbedder.getInstance();
    this.storeRegistry = deps?.storeRegistry || StoreRegistry.getInstance();
    this.hydrate();
  }

  public static getInstance(deps?: { embedder?: ServerEmbedder; storeRegistry?: StoreRegistry }): YmlSyncScheduler {
    if (!YmlSyncScheduler.instance) {
      YmlSyncScheduler.instance = new YmlSyncScheduler(deps);
    } else if (deps?.embedder) {
      YmlSyncScheduler.instance.embedder = deps.embedder;
    }
    return YmlSyncScheduler.instance;
  }

  public static resetInstanceForTests(deps?: { embedder?: ServerEmbedder; storeRegistry?: StoreRegistry }): YmlSyncScheduler {
    if (YmlSyncScheduler.instance) {
      YmlSyncScheduler.instance.stop();
    }
    YmlSyncScheduler.instance = new YmlSyncScheduler(deps);
    return YmlSyncScheduler.instance;
  }

  private key(tenantId: string, indexName = 'default'): string {
    return `${tenantId || 'default'}:${indexName || 'default'}`;
  }

  private hydrate(): void {
    const saved = getPersistenceStore().read<YmlSyncConfig[]>(NAMESPACE, []);
    this.configs.clear();
    for (const c of saved) {
      if (c && c.tenantId) {
        // Recover stuck 'running' status from an unclean shutdown
        if (c.lastStatus === 'running') {
          c.lastStatus = 'error';
          c.lastError = 'Interrupted by server restart';
        }
        this.configs.set(this.key(c.tenantId, c.indexName), c);
      }
    }
  }

  private persist(): void {
    getPersistenceStore().write(NAMESPACE, Array.from(this.configs.values()));
  }

  public getConfig(tenantId = 'default', indexName = 'default'): YmlSyncConfig {
    const k = this.key(tenantId, indexName);
    const existing = this.configs.get(k);
    if (existing) return { ...existing };
    return {
      tenantId,
      indexName,
      feedUrl: '',
      enabled: false,
      intervalMinutes: 360,
      authoritativeDelete: false,
      lastRunAt: null,
      lastStatus: 'never',
      lastError: null,
      lastParsedCount: 0,
      lastIndexedCount: 0,
      lastDeletedCount: 0,
      lastDurationMs: 0,
      nextRunAt: null,
      updatedAt: new Date().toISOString(),
    };
  }

  public list(tenantId?: string): YmlSyncConfig[] {
    const all = Array.from(this.configs.values());
    if (!tenantId) return all;
    return all.filter((c) => c.tenantId === tenantId);
  }

  public upsertConfig(input: {
    tenantId?: string;
    indexName?: string;
    feedUrl: string;
    enabled?: boolean;
    intervalMinutes?: number;
    authoritativeDelete?: boolean;
  }): YmlSyncConfig {
    const tenantId = input.tenantId || 'default';
    const indexName = input.indexName || 'default';
    const k = this.key(tenantId, indexName);
    const prev = this.getConfig(tenantId, indexName);

    const intervalMinutes = Math.min(Math.max(Number(input.intervalMinutes) || prev.intervalMinutes || 60, 5), 10_080);
    const enabled = input.enabled !== undefined ? Boolean(input.enabled) : prev.enabled;
    const feedUrl = String(input.feedUrl ?? prev.feedUrl).trim();

    const nextRunAt =
      enabled && feedUrl
        ? new Date(Date.now() + intervalMinutes * 60_000).toISOString()
        : null;

    const updated: YmlSyncConfig = {
      ...prev,
      tenantId,
      indexName,
      feedUrl,
      enabled,
      intervalMinutes,
      authoritativeDelete:
        input.authoritativeDelete !== undefined ? Boolean(input.authoritativeDelete) : prev.authoritativeDelete,
      nextRunAt,
      updatedAt: new Date().toISOString(),
    };

    this.configs.set(k, updated);
    this.persist();
    return { ...updated };
  }

  /**
   * Executes an immediate YML sync for (tenantId, indexName).
   * Protected by per-tenant/index mutex and SSRF-safe fetcher.
   */
  public async runNow(
    tenantId = 'default',
    indexName = 'default',
    overrideUrl?: string,
    overrideXml?: string
  ): Promise<YmlSyncConfig> {
    const k = this.key(tenantId, indexName);
    if (this.runningLocks.has(k)) {
      throw new Error(`YML_SYNC_ALREADY_RUNNING: Sync already in progress for ${k}`);
    }

    const cfg = this.getConfig(tenantId, indexName);
    const targetUrl = (overrideUrl || cfg.feedUrl || '').trim();
    const rawXml = (overrideXml || '').trim();
    if (!targetUrl && !rawXml) {
      throw new Error('YML_SYNC_MISSING_URL: No feedUrl configured');
    }

    this.runningLocks.add(k);
    const startMs = Date.now();
    cfg.feedUrl = targetUrl || cfg.feedUrl;
    cfg.lastStatus = 'running';
    cfg.lastError = null;
    this.configs.set(k, cfg);
    this.persist();

    try {
      let xmlContent = rawXml;
      if (!xmlContent) {
        const fetched = await safeFetchText(targetUrl, {
          timeoutMs: 25_000,
          maxBytes: 50 * 1024 * 1024,
          maxRedirects: 3,
          headers: { Accept: 'application/xml, text/xml, */*' },
        });

        if (fetched.status < 200 || fetched.status >= 300) {
          throw new Error(`Remote YML server responded with HTTP ${fetched.status}`);
        }
        xmlContent = fetched.body;
      }

      const items = parseYmlOrCommerceMl(xmlContent, 50_000);
      if (items.length === 0) {
        throw new Error('YML feed parsed 0 valid offers (<offer> or <Товар>)');
      }

      const store = this.storeRegistry.getOrCreateStore(tenantId, indexName);
      this.storeRegistry.assertItemQuota(tenantId, indexName, items.length);

      const seenIds = new Set<string>();
      let indexedCount = 0;
      const BATCH_SIZE = 100;

      for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
        const chunk = items.slice(offset, offset + BATCH_SIZE);
        const texts = chunk.map((it) => `${it.title}. ${it.category}. ${it.description}`);
        const vectors = await this.embedder.embedBatch(texts);

        for (let i = 0; i < chunk.length; i++) {
          const it = chunk[i];
          seenIds.add(String(it.id));
          store.upsert({
            id: it.id,
            sku: it.sku,
            brand: it.brand,
            title: it.title,
            description: it.description,
            category: it.category,
            price: it.price,
            inStock: it.inStock,
            url: it.url,
            imageUrl: it.imageUrl ?? null,
            tags: it.tags,
            embedding: Array.from(vectors[i]),
          });
          indexedCount++;
        }
      }

      let deletedCount = 0;
      if (cfg.authoritativeDelete && seenIds.size > 0) {
        for (const existing of store.getAll()) {
          if (!seenIds.has(String(existing.id))) {
            if (store.delete(String(existing.id))) {
              deletedCount++;
            }
          }
        }
      }

      await store.saveSnapshotAsync();
      ApiQueryCache.invalidateAll();
      getSemanticCache().clear();
      const cache = getCache();
      await Promise.all([
        cache.invalidate('search:*'),
        cache.invalidate('recommend:*'),
        cache.del(CacheKeys.catalogStats()),
      ]);

      const nowIso = new Date().toISOString();
      const updated: YmlSyncConfig = {
        ...cfg,
        lastRunAt: nowIso,
        lastStatus: 'success',
        lastError: null,
        lastParsedCount: items.length,
        lastIndexedCount: indexedCount,
        lastDeletedCount: deletedCount,
        lastDurationMs: Math.max(1, Date.now() - startMs),
        nextRunAt: cfg.enabled
          ? new Date(Date.now() + cfg.intervalMinutes * 60_000).toISOString()
          : null,
        updatedAt: nowIso,
      };
      this.configs.set(k, updated);
      this.persist();
      return { ...updated };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const nowIso = new Date().toISOString();
      const failed: YmlSyncConfig = {
        ...cfg,
        lastRunAt: nowIso,
        lastStatus: 'error',
        lastError: msg,
        lastDurationMs: Math.max(1, Date.now() - startMs),
        nextRunAt: cfg.enabled
          ? new Date(Date.now() + cfg.intervalMinutes * 60_000).toISOString()
          : null,
        updatedAt: nowIso,
      };
      this.configs.set(k, failed);
      this.persist();
      throw err;
    } finally {
      this.runningLocks.delete(k);
    }
  }

  /**
   * Starts background tick loop (checks every 30s for due feeds, plus overdue catch-up on boot).
   */
  public start(tickMs = 30_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, tickMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
    // Immediate overdue check on boot
    void this.tick();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async tick(nowMs = Date.now()): Promise<void> {
    for (const cfg of this.configs.values()) {
      if (!cfg.enabled || !cfg.feedUrl) continue;
      const k = this.key(cfg.tenantId, cfg.indexName);
      if (this.runningLocks.has(k)) continue;

      const dueMs = cfg.nextRunAt ? Date.parse(cfg.nextRunAt) : 0;
      if (!dueMs || nowMs >= dueMs) {
        try {
          await this.runNow(cfg.tenantId, cfg.indexName);
        } catch (err) {
          console.error(`[YmlSyncScheduler] Scheduled sync failed for ${k}:`, err);
        }
      }
    }
  }
}

export function getYmlSyncScheduler(deps?: {
  embedder?: ServerEmbedder;
  storeRegistry?: StoreRegistry;
}): YmlSyncScheduler {
  return YmlSyncScheduler.getInstance(deps);
}
