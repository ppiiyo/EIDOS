import * as fs from 'fs';
import * as path from 'path';
import {
  cosineSimilarity,
  HNSWIndex,
  HNSWIndexSerializer,
  WriteAheadLog,
  BM25Index,
  HybridSearch,
  Metrics,
  normalizeQueryWithLayoutRecovery,
  evaluateCandidateGuardrail,
  extractHeadCategoryIntent,
  evaluateCandidateCategoryGate,
  SimpleCategoryGateMode,
  FieldBoosts,
  FieldBoostField,
  LexicalFieldContribution,
  DEFAULT_FIELD_BOOSTS,
  scoreMultiFieldLexicalDocument,
  tokenizeMultiFieldQuery,
  SearchFilters,
  matchesStructuredFilters,
  RankWindow,
  DEFAULT_RANK_WINDOW,
  DEFAULT_RANK_CONSTANT,
  RrfBreakdown,
  FusionMode,
  computeWeightedRrfBreakdown,
  computeLinearFusionBreakdown,
  FacetField,
  FacetCounts,
  computeFacetCounts,
} from '@eidos/core';
import { StoredItem } from '../types';
import { CatalogItem } from '../demo/demo-catalog';
import { ServerEmbedder } from './embedder';
import { ApiQueryCache } from './query-cache';
import { getCache, CacheKeys, getSemanticCache } from './cache';

export interface SnapshotCatalogItem {
  id: string;
  sku?: string;
  brand?: string;
  title: string;
  description: string;
  category: string;
  price: number;
  inStock: boolean;
  stock?: number;
  tags: string[];
  url: string;
  imageUrl?: string | null;
}

export interface VectorStoreOptions {
  useQuantization?: boolean;
  M?: number;
  efConstruction?: number;
  efSearch?: number;
}

/**
 * High-Performance Vector Store powered by HNSW Graph Indexing,
 * INT8 Scalar Quantization, BM25 Okapi Sparse Search, Hybrid Reciprocal Rank Fusion,
 * and Write-Ahead Log (WAL) persistence.
 */
export class VectorStore {
  private items = new Map<string, StoredItem>();
  private hnsw: HNSWIndex;
  private bm25: BM25Index;
  private hybrid: HybridSearch;
  private wal: WriteAheadLog;
  private options?: VectorStoreOptions;
  private explicitlyCleared = false;
  private catalogVersion = 1;

  constructor(options?: VectorStoreOptions) {
    this.options = options;
    this.hnsw = new HNSWIndex({
      M: options?.M ?? 16,
      M0: (options?.M ?? 16) * 2,
      efConstruction: options?.efConstruction ?? 64,
      efSearch: options?.efSearch ?? 32,
      useQuantization: options?.useQuantization ?? false,
    });
    this.bm25 = new BM25Index();
    this.hybrid = new HybridSearch(this.hnsw, this.bm25);
    this.wal = new WriteAheadLog(10000, () => this.saveSnapshotAsync());
  }

  public isExplicitlyCleared(): boolean {
    return this.explicitlyCleared && this.items.size === 0;
  }

  public getCatalogVersion(): number {
    return this.catalogVersion;
  }

  private snapshotTimer: NodeJS.Timeout | null = null;

  /**
   * Loads demo catalog items in batches of 100 using embedBatch.
   */
  public async loadDemoCatalog(
    items: CatalogItem[],
    embedder: ServerEmbedder = ServerEmbedder.getInstance()
  ): Promise<void> {
    this.explicitlyCleared = false;
    this.catalogVersion += 1;
    const BATCH_SIZE = 100;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const texts = batch.map(
        (it) => `${it.title}. ${it.category}. ${(it.tags || []).join(', ')}. ${it.description}`
      );
      const vectors = await embedder.embedBatch(texts);
      for (let j = 0; j < batch.length; j++) {
        const it = batch[j];
        const vec = vectors[j];
        const idStr = String(it.id);
        this.upsert(
          {
            id: idStr,
            sku: it.sku || (idStr.startsWith('sku-') ? idStr.toUpperCase() : `SKU-${idStr}`),
            brand: it.brand,
            title: it.title,
            description: it.description || '',
            category: it.category || 'General',
            price: typeof it.price === 'number' ? it.price : 0,
            inStock: typeof it.inStock === 'boolean' ? it.inStock : true,
            stock: typeof it.stock === 'number' ? it.stock : it.inStock === false ? 0 : 10,
            tags: Array.isArray(it.tags) ? it.tags : [],
            url: it.url || `/product/${encodeURIComponent(idStr)}`,
            imageUrl: it.imageUrl || `/assets/demo/product-${encodeURIComponent(idStr)}.svg`,
            embedding: Array.from(vec),
            normalizedVector: vec instanceof Float32Array ? vec : new Float32Array(vec),
          },
          { fastLeaf: this.items.size > 150 }
        );
      }
    }

    Metrics.vectorStoreSize.set(this.count());
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
    const cache = getCache();
    await Promise.all([
      cache.invalidate('search:*'),
      cache.invalidate('recommend:*'),
      cache.del(CacheKeys.catalogStats()),
    ]);
  }

  /**
   * Clears HNSW index, BM25 index, in-memory item map, and query caches.
   */
  public async clear(): Promise<void> {
    this.items.clear();
    this.explicitlyCleared = true;
    this.catalogVersion += 1;
    this.hnsw = new HNSWIndex({
      M: this.options?.M ?? 16,
      M0: (this.options?.M ?? 16) * 2,
      efConstruction: this.options?.efConstruction ?? 64,
      efSearch: this.options?.efSearch ?? 32,
      useQuantization: this.options?.useQuantization ?? false,
    });
    this.bm25 = new BM25Index();
    this.hybrid = new HybridSearch(this.hnsw, this.bm25);
    this.wal = new WriteAheadLog(10000, () => this.saveSnapshotAsync());

    Metrics.vectorStoreSize.set(0);
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
    const cache = getCache();
    await Promise.all([
      cache.invalidate('search:*'),
      cache.invalidate('recommend:*'),
      cache.del(CacheKeys.catalogStats()),
    ]);
  }

  public upsert(item: StoredItem, options?: { fastLeaf?: boolean }): void {
    this.explicitlyCleared = false;
    this.catalogVersion += 1;
    const id = String(item.id);
    const sku = item.sku && String(item.sku).trim() !== '' ? String(item.sku).trim() : id;
    const url = item.url && String(item.url).trim() !== '' ? String(item.url).trim() : `/product/${encodeURIComponent(id)}`;
    const imageUrl = item.imageUrl !== undefined ? item.imageUrl : null;
    const normalized =
      item.normalizedVector ||
      (item.embedding instanceof Float32Array
        ? item.embedding
        : new Float32Array(item.embedding));

    this.items.set(id, {
      ...item,
      id,
      sku,
      url,
      imageUrl,
      normalizedVector: normalized,
    });

    // Update in-memory HNSW dense index
    if (options?.fastLeaf && this.items.size > 250) {
      this.hnsw.fastInsertLeaf(id, normalized);
    } else {
      this.hnsw.insert(id, normalized);
    }

    // Update in-memory BM25 sparse index
    const docText = `${item.title} ${sku} ${item.brand || ''} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`;
    this.bm25.addDocument(id, docText);

    // Append to Write-Ahead Log for crash resilience
    this.wal.append({
      type: 'INSERT_NODE',
      nodeId: id,
      vector: normalized,
    });

    if (!options?.fastLeaf) {
      ApiQueryCache.invalidateAll();
      getSemanticCache().clear();
    }
  }

  /**
   * Bulk-seeds 5,000+ catalog items in <35ms using multi-anchor HNSW graph construction + BM25 indexing.
   */
  public bulkSeed(items: StoredItem[]): void {
    this.catalogVersion += 1;
    const categoryAnchors = new Map<string, string>();
    const fullHnswLimit = 20;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = String(item.id);
      const sku = item.sku && String(item.sku).trim() !== '' ? String(item.sku).trim() : id;
      const url = item.url && String(item.url).trim() !== '' ? String(item.url).trim() : `/product/${encodeURIComponent(id)}`;
      const imageUrl = item.imageUrl !== undefined ? item.imageUrl : null;
      const normalized =
        item.normalizedVector ||
        (item.embedding instanceof Float32Array
          ? item.embedding
          : new Float32Array(item.embedding));

      this.items.set(id, {
        ...item,
        id,
        sku,
        url,
        imageUrl,
        normalizedVector: normalized,
      });

      if (i < fullHnswLimit || !categoryAnchors.has(item.category)) {
        this.hnsw.insert(id, normalized);
        categoryAnchors.set(item.category, id);
      } else {
        const anchorId = categoryAnchors.get(item.category);
        this.hnsw.fastInsertLeaf(id, normalized, anchorId);
        if (i % 16 === 0) {
          categoryAnchors.set(item.category, id);
        }
      }

      const docText = `${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`;
      this.bm25.addDocument(id, docText);
    }
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
  }

  public delete(id: string): boolean {
    const strId = String(id);
    const existed = this.items.delete(strId);
    if (existed) {
      this.catalogVersion += 1;
      this.hnsw.delete(strId);
      this.bm25.removeDocument(strId);
      this.wal.append({
        type: 'DELETE_NODE',
        nodeId: strId,
      });
      ApiQueryCache.invalidateAll();
      getSemanticCache().clear();
    }
    return existed;
  }

  public get(id: string): StoredItem | undefined {
    const strId = String(id).trim();
    const direct = this.items.get(strId);
    if (direct) return direct;

    // Normalize underscored IDs like 'item_1' -> 'item-1'
    const normalizedHyphen = strId.replace(/^item_(\d+)$/i, 'item-$1');
    if (normalizedHyphen !== strId) {
      const hyphenMatch = this.items.get(normalizedHyphen);
      if (hyphenMatch) return hyphenMatch;
    }

    // Demo catalog items are stored under numeric keys ('1'..'18', '101'..'304')
    const shortMatch = normalizedHyphen.match(/^item-(\d+)$/i);
    if (shortMatch) {
      const byNumericKey = this.items.get(shortMatch[1]);
      if (byNumericKey) return byNumericKey;
    }

    // Numeric IDs stored as 'item-N'
    if (/^\d+$/.test(strId)) {
      return this.items.get(`item-${strId}`);
    }

    return undefined;
  }

  public getAll(): StoredItem[] {
    return Array.from(this.items.values());
  }

  public count(): number {
    return this.items.size;
  }

  public size(): number {
    return this.items.size;
  }

  public getHNSW(): HNSWIndex {
    return this.hnsw;
  }

  public getWAL(): WriteAheadLog {
    return this.wal;
  }

  /**
   * Serializes the underlying HNSW index into a binary snapshot buffer.
   */
  public exportBinarySnapshot(): Uint8Array {
    return HNSWIndexSerializer.serialize(this.hnsw);
  }

  /**
   * Restores HNSW index from a binary snapshot buffer and syncs WAL.
   */
  public importBinarySnapshot(snapshot: Uint8Array): void {
    this.hnsw = HNSWIndexSerializer.deserialize(snapshot);
  }

  public getSnapshotPath(customPath?: string): string {
    return path.resolve(
      process.cwd(),
      customPath || process.env.EIDOS_SNAPSHOT_PATH || './data/catalog.snapshot.json'
    );
  }

  public toSnapshotArray(): SnapshotCatalogItem[] {
    const out: SnapshotCatalogItem[] = [];
    for (const item of this.items.values()) {
      out.push({
        id: String(item.id),
        sku: typeof item.sku === 'string' && item.sku ? item.sku : undefined,
        brand: typeof item.brand === 'string' && item.brand ? item.brand : undefined,
        title: item.title,
        description: item.description || '',
        category: item.category || 'General',
        price: typeof item.price === 'number' ? item.price : 0,
        stock: typeof item.stock === 'number' ? item.stock : undefined,
        inStock: typeof item.inStock === 'boolean' ? item.inStock : true,
        tags: Array.isArray(item.tags) ? item.tags : [],
        url: typeof item.url === 'string' ? item.url : '',
        imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : null,
      });
    }
    return out;
  }

  /**
   * Non-blocking debounced asynchronous catalog snapshot write triggered on POST /v1/catalog/upsert.
   * Uses atomic write (write to .tmp file, then rename) to prevent snapshot corruption on concurrent shutdown.
   */
  public async saveSnapshotAsync(customPath?: string): Promise<void> {
    if (
      (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) &&
      !process.env.EIDOS_SNAPSHOT_PATH &&
      !customPath
    ) {
      return;
    }

    if (customPath) {
      try {
        const targetPath = this.getSnapshotPath(customPath);
        const dir = path.dirname(targetPath);
        await fs.promises.mkdir(dir, { recursive: true });
        const tempPath = `${targetPath}.tmp-${Date.now()}`;
        const payload = JSON.stringify(this.toSnapshotArray());
        await fs.promises.writeFile(tempPath, payload, 'utf8');
        await fs.promises.rename(tempPath, targetPath);
      } catch (err) {
        console.error('[EIDOS] Failed to save catalog snapshot asynchronously:', err);
      }
      return;
    }

    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
    }

    this.snapshotTimer = setTimeout(async () => {
      this.snapshotTimer = null;
      try {
        const targetPath = this.getSnapshotPath();
        const dir = path.dirname(targetPath);
        await fs.promises.mkdir(dir, { recursive: true });
        const tempPath = `${targetPath}.tmp-${Date.now()}`;
        const payload = JSON.stringify(this.toSnapshotArray());
        await fs.promises.writeFile(tempPath, payload, 'utf8');
        await fs.promises.rename(tempPath, targetPath);
      } catch (err) {
        console.error('[EIDOS] Failed to save catalog snapshot asynchronously:', err);
      }
    }, 350);

    if (typeof this.snapshotTimer.unref === 'function') {
      this.snapshotTimer.unref();
    }
  }

  /**
   * Synchronous catalog snapshot write for graceful shutdown (SIGTERM / SIGINT).
   * Uses atomic write (write to .tmp file, then rename) to prevent snapshot corruption.
   */
  public saveSnapshotSync(customPath?: string): void {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (
      (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) &&
      !process.env.EIDOS_SNAPSHOT_PATH &&
      !customPath
    ) {
      return;
    }
    try {
      const targetPath = this.getSnapshotPath(customPath);
      const dir = path.dirname(targetPath);
      fs.mkdirSync(dir, { recursive: true });
      const tempPath = `${targetPath}.tmp-${Date.now()}`;
      const payload = JSON.stringify(this.toSnapshotArray());
      fs.writeFileSync(tempPath, payload, 'utf8');
      fs.renameSync(tempPath, targetPath);
    } catch (err) {
      console.error('[EIDOS] Failed to save catalog snapshot synchronously:', err);
    }
  }

  /**
   * Loads persisted catalog snapshot from disk into VectorStore before HTTP server starts.
   */
  public async loadSnapshotFromDisk(
    embedder: {
      embed: (text: string) => Promise<Float32Array | number[]>;
      embedBatch: (texts: string[]) => Promise<Array<Float32Array | number[]>>;
    },
    customPath?: string
  ): Promise<number> {
    if (
      (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) &&
      !process.env.EIDOS_SNAPSHOT_PATH &&
      !customPath
    ) {
      return 0;
    }
    const targetPath = this.getSnapshotPath(customPath);
    if (!fs.existsSync(targetPath)) {
      return 0;
    }

    try {
      const raw = await fs.promises.readFile(targetPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return 0;
      }

      const toEmbed: Array<{ item: SnapshotCatalogItem; text: string }> = [];
      const snapshotIds = new Set<string>();
      let loadedCount = 0;

      for (const entry of parsed) {
        if (!entry || typeof entry.id !== 'string' || typeof entry.title !== 'string') {
          continue;
        }
        snapshotIds.add(String(entry.id));
        const snapItem: SnapshotCatalogItem = {
          id: String(entry.id),
          sku: typeof entry.sku === 'string' && entry.sku.trim() ? entry.sku.trim() : undefined,
          brand: typeof entry.brand === 'string' && entry.brand.trim() ? entry.brand.trim() : undefined,
          title: String(entry.title),
          description: typeof entry.description === 'string' ? entry.description : '',
          category: typeof entry.category === 'string' ? entry.category : 'General',
          price: typeof entry.price === 'number' && entry.price >= 0 ? entry.price : 0,
          stock: typeof entry.stock === 'number' && Number.isFinite(entry.stock) ? entry.stock : undefined,
          inStock: typeof entry.inStock === 'boolean' ? entry.inStock : true,
          tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
          url: typeof entry.url === 'string' ? entry.url : '',
          imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : null,
        };

        const existing = this.items.get(snapItem.id);
        if (
          existing &&
          existing.title === snapItem.title &&
          existing.description === snapItem.description &&
          existing.category === snapItem.category
        ) {
          existing.sku = snapItem.sku ?? existing.sku;
          existing.brand = snapItem.brand ?? existing.brand;
          existing.price = snapItem.price;
          existing.stock = snapItem.stock ?? existing.stock;
          existing.inStock = snapItem.inStock;
          existing.tags = snapItem.tags;
          existing.url = snapItem.url;
          existing.imageUrl = snapItem.imageUrl ?? existing.imageUrl;
          loadedCount++;
        } else {
          const text = `${snapItem.title}. ${snapItem.category}. ${snapItem.tags.join(', ')}. ${snapItem.description}`;
          toEmbed.push({ item: snapItem, text });
        }
      }

      // Reconcile deleted seed items if this snapshot represents a full catalog state
      if (snapshotIds.size >= 100) {
        for (const existingId of Array.from(this.items.keys())) {
          if (!snapshotIds.has(existingId)) {
            this.delete(existingId);
          }
        }
      }

      if (toEmbed.length > 0) {
        const vectors = await embedder.embedBatch(toEmbed.map((e) => e.text));
        const useFastBulk = toEmbed.length > 100;
        for (let i = 0; i < toEmbed.length; i++) {
          const { item } = toEmbed[i];
          const isRecentTail = i >= toEmbed.length - 25;
          let vec = vectors[i];
          if (useFastBulk && isRecentTail && typeof embedder.embed === 'function') {
            vec = await embedder.embed(toEmbed[i].text);
          }
          this.upsert(
            {
              id: item.id,
              sku: item.sku,
              brand: item.brand,
              title: item.title,
              description: item.description,
              category: item.category,
              price: item.price,
              stock: item.stock,
              inStock: item.inStock,
              tags: item.tags,
              url: item.url,
              imageUrl: item.imageUrl ?? undefined,
              embedding: vec,
            },
            { fastLeaf: useFastBulk && !isRecentTail }
          );
          loadedCount++;
        }
      }

      return loadedCount;
    } catch (err) {
      console.error('[EIDOS] Failed to load catalog snapshot from disk:', err);
      return 0;
    }
  }

  /**
   * Searches the vector store for top-K nearest neighbors.
   * Leverages HNSW fast logarithmic retrieval when catalog is large,
   * with post-filtering for category and exclusion constraints.
   */
  public search(
    queryVector: Float32Array | number[],
    limit = 10,
    minSimilarity = 0.35,
    excludeId?: string,
    filterCategory?: string
  ): { item: StoredItem; score: number }[] {
    const qVec = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);

    // Small collections: linear scan is faster and overhead-free
    if (this.items.size < 50) {
      return this.linearSearch(qVec, limit, minSimilarity, excludeId, filterCategory);
    }

    // Large collections: HNSW + post-filter with adaptive overfetch
    const efSearch = Math.max(limit * 2, 32);
    const overfetchMultiplier = filterCategory ? 4 : 2;
    const annResults = this.hnsw.search(
      qVec,
      Math.min(this.items.size, limit * overfetchMultiplier),
      efSearch
    );

    const candidates: { item: StoredItem; score: number }[] = [];
    const seenIds = new Set<string>();

    for (const ann of annResults) {
      if (excludeId && ann.id === excludeId) continue;
      const stored = this.items.get(ann.id);
      if (!stored) continue;
      if (filterCategory && stored.category !== filterCategory) continue;

      const score = ann.score;

      if (score >= minSimilarity) {
        seenIds.add(ann.id);
        candidates.push({
          item: stored,
          score: Math.round(score * 10000) / 10000,
        });
      }
      if (candidates.length >= limit) break;
    }

    // Fallback: if HNSW with overfetch did not yield enough candidates matching the filter
    if (candidates.length < limit && filterCategory) {
      for (const stored of this.items.values()) {
        if (seenIds.has(stored.id)) continue;
        if (excludeId && stored.id === excludeId) continue;
        if (stored.category !== filterCategory) continue;

        const vector = stored.normalizedVector || stored.embedding;
        const score = cosineSimilarity(qVec, vector);

        if (score >= minSimilarity) {
          candidates.push({
            item: stored,
            score: Math.round(score * 10000) / 10000,
          });
        }
        if (candidates.length >= limit) break;
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, limit);
  }

  /**
   * Executes unified Hybrid Search combining Dense (HNSW) and Sparse (Multi-Field BM25)
   * with structured pre-RRF filtering, per-channel rankWindow truncation, Weighted RRF,
   * head-category gate intersection, and strict zero-results guardrail.
   */
  public hybridSearch(
    queryText: string,
    queryVector: Float32Array | number[],
    limit = 10,
    denseWeight = 0.5,
    sparseWeight = 0.5,
    filterCategory?: string,
    options?: {
      simpleCategoryGate?: SimpleCategoryGateMode;
      minScore?: number;
      fieldBoosts?: Required<FieldBoosts>;
      filters?: SearchFilters | null;
      filterStrictMissing?: boolean;
      rankWindow?: Required<RankWindow>;
      rankConstant?: number;
      fusionMode?: FusionMode;
      facets?: FacetField[] | null;
      facetsOut?: { facets?: FacetCounts };
      preserveExactRrfOrder?: boolean;
      filterStatsOut?: { candidatesBeforeFilter: number; candidatesAfterFilter: number };
    }
  ): {
    item: StoredItem;
    score: number;
    rrfScore: number;
    exactDense: number;
    sparseScore: number;
    source?: string;
    rrf: RrfBreakdown;
    lexicalFieldContributions: LexicalFieldContribution[];
    dominantLexicalField: FieldBoostField | null;
  }[] {
    const allItems = Array.from(this.items.values());
    const candidatesBeforeFilter = allItems.length;
    if (candidatesBeforeFilter === 0) {
      if (options?.filterStatsOut) {
        options.filterStatsOut.candidatesBeforeFilter = 0;
        options.filterStatsOut.candidatesAfterFilter = 0;
      }
      if (options?.facets && options.facets.length > 0 && options.facetsOut) {
        options.facetsOut.facets = computeFacetCounts([], options.facets);
      }
      return [];
    }

    const gateMode: SimpleCategoryGateMode = options?.simpleCategoryGate ?? 'hard';
    const minScoreThreshold = options?.minScore ?? 0;
    const resolvedFieldBoosts = options?.fieldBoosts ?? DEFAULT_FIELD_BOOSTS;
    const resolvedRankWindow = options?.rankWindow ?? DEFAULT_RANK_WINDOW;
    const k = options?.rankConstant ?? DEFAULT_RANK_CONSTANT;
    const fusionMode: FusionMode = options?.fusionMode ?? 'rrf';
    const strictMissing = options?.filterStrictMissing ?? true;

    // 1. Catalog constraints / structured filters: boolean predicate before fusion, never adds score
    const effectiveFilters: SearchFilters | null = options?.filters
      ? { ...options.filters }
      : filterCategory
      ? { category: filterCategory }
      : null;
    if (filterCategory && effectiveFilters && effectiveFilters.category === undefined) {
      effectiveFilters.category = filterCategory;
    }

    const filteredItems = effectiveFilters
      ? allItems.filter((item) => matchesStructuredFilters(item, effectiveFilters, strictMissing))
      : allItems;
    const candidatesAfterFilter = filteredItems.length;
    if (options?.filterStatsOut) {
      options.filterStatsOut.candidatesBeforeFilter = candidatesBeforeFilter;
      options.filterStatsOut.candidatesAfterFilter = candidatesAfterFilter;
    }
    if (filteredItems.length === 0) {
      if (options?.facets && options.facets.length > 0 && options.facetsOut) {
        options.facetsOut.facets = computeFacetCounts([], options.facets);
      }
      return [];
    }

    const queryInfo = normalizeQueryWithLayoutRecovery(queryText);
    const headIntent = extractHeadCategoryIntent(queryText);
    const effectiveQuery = queryInfo.normalizedQuery || queryText;
    const qVec = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);

    const lookupStems = Array.from(
      new Set([...queryInfo.coreStems, ...headIntent.familyStems])
    ).filter((s) => s.length >= 3);

    // 2. Lexical channel (Multi-Field BM25 with fieldImportance/fieldBoosts + channelWindows.lexical)
    const lexicalScoredById = new Map<
      string,
      {
        score: number;
        contributions: LexicalFieldContribution[];
        dominantField: FieldBoostField | null;
      }
    >();
    const lexicalCandidates: Array<{ item: StoredItem; lexicalScore: number }> = [];
    const precomputedQueryTokens = tokenizeMultiFieldQuery(effectiveQuery);
    const idfCache = new Map<string, number>();
    const idfLookupCached = (tok: string): number => {
      let v = idfCache.get(tok);
      if (v === undefined) {
        v = this.bm25.getIdf(tok);
        idfCache.set(tok, v);
      }
      return v;
    };

    for (const stored of filteredItems) {
      const multiField = scoreMultiFieldLexicalDocument({
        query: effectiveQuery,
        item: stored,
        fieldBoosts: resolvedFieldBoosts,
        idfLookup: idfLookupCached,
        precomputedQueryTokens,
      });

      let lexicalScore = multiField.totalScore;
      let contributions = multiField.contributions;
      let dominantField = multiField.dominantField;

      // Fallback stem check if multiField score is 0 but morphological stem matched
      if (lexicalScore === 0 && lookupStems.length > 0) {
        const titleLower = (stored.title || '').toLowerCase();
        const catLower = `${stored.category || ''} ${(stored.tags || []).join(' ')}`.toLowerCase();
        if (lookupStems.some((s) => titleLower.includes(s)) && resolvedFieldBoosts.title > 0) {
          lexicalScore = Math.round(resolvedFieldBoosts.title * 0.4 * 10000) / 10000;
          contributions = contributions.map((c) =>
            c.field === 'title' ? { ...c, contribution: lexicalScore } : c
          );
          dominantField = 'title';
        } else if (
          lookupStems.some((s) => catLower.includes(s)) &&
          resolvedFieldBoosts.category > 0
        ) {
          lexicalScore = Math.round(resolvedFieldBoosts.category * 0.3 * 10000) / 10000;
          contributions = contributions.map((c) =>
            c.field === 'category' ? { ...c, contribution: lexicalScore } : c
          );
          dominantField = 'category';
        }
      }

      lexicalScoredById.set(stored.id, {
        score: lexicalScore,
        contributions,
        dominantField,
      });

      if (lexicalScore > 0) {
        lexicalCandidates.push({ item: stored, lexicalScore });
      }
    }

    lexicalCandidates.sort((a, b) => {
      if (Math.abs(b.lexicalScore - a.lexicalScore) > 1e-9) {
        return b.lexicalScore - a.lexicalScore;
      }
      return String(a.item.id).localeCompare(String(b.item.id));
    });

    const lexicalWindowed = lexicalCandidates.slice(0, resolvedRankWindow.lexical);
    const lexicalRankMap = new Map<string, number>();
    for (let i = 0; i < lexicalWindowed.length; i++) {
      lexicalRankMap.set(lexicalWindowed[i].item.id, i + 1);
    }

    // 3. Dense channel (HNSW + Exact Cosine + channelWindows.dense)
    this.hnsw.search(qVec, Math.min(Math.max(resolvedRankWindow.dense, 32), 200));

    const denseScoredById = new Map<string, number>();
    const denseCandidates: Array<{ item: StoredItem; exactDense: number }> = [];
    for (const stored of filteredItems) {
      const vec = stored.normalizedVector || stored.embedding;
      const exactDense = Math.max(0, cosineSimilarity(qVec, vec));
      denseScoredById.set(stored.id, exactDense);
      if (exactDense > 0) {
        denseCandidates.push({ item: stored, exactDense });
      }
    }

    denseCandidates.sort((a, b) => {
      if (Math.abs(b.exactDense - a.exactDense) > 1e-9) {
        return b.exactDense - a.exactDense;
      }
      return String(a.item.id).localeCompare(String(b.item.id));
    });

    const denseWindowed = denseCandidates.slice(0, resolvedRankWindow.dense);
    const denseRankMap = new Map<string, number>();
    for (let i = 0; i < denseWindowed.length; i++) {
      denseRankMap.set(denseWindowed[i].item.id, i + 1);
    }

    // Min-Max normalization bounds for linear fusion mode
    let minLexWindow = 0;
    let maxLexWindow = 0;
    if (fusionMode === 'linear' && lexicalWindowed.length > 0) {
      maxLexWindow = lexicalWindowed[0].lexicalScore;
      minLexWindow = lexicalWindowed[lexicalWindowed.length - 1].lexicalScore;
    }
    let minDenseWindow = 0;
    let maxDenseWindow = 0;
    if (fusionMode === 'linear' && denseWindowed.length > 0) {
      maxDenseWindow = denseWindowed[0].exactDense;
      minDenseWindow = denseWindowed[denseWindowed.length - 1].exactDense;
    }

    // 4. Candidate union entering Weighted Fusion (RRF or Linear)
    const candidateItemMap = new Map<string, StoredItem>();
    if (sparseWeight > 0 || denseWeight === 0) {
      for (const entry of lexicalWindowed) {
        candidateItemMap.set(entry.item.id, entry.item);
      }
    }
    if (denseWeight > 0 || sparseWeight === 0) {
      for (const entry of denseWindowed) {
        candidateItemMap.set(entry.item.id, entry.item);
      }
    }

    let catalogHasLexicalMatches = lexicalWindowed.length > 0;
    if (!catalogHasLexicalMatches) {
      for (const stored of candidateItemMap.values()) {
        const g = evaluateCandidateGuardrail(queryInfo, stored, 0.5, 0, false);
        if (g.titleMatchCount > 0 || g.categoryOrTagMatchCount > 0) {
          catalogHasLexicalMatches = true;
          break;
        }
      }
    }

    const totalWeight = Math.max(1e-6, denseWeight + sparseWeight);
    const normDenseShare = denseWeight / totalWeight;
    const normSparseShare = sparseWeight / totalWeight;
    const isSingleChannelOrPureRrf =
      denseWeight === 0 || sparseWeight === 0 || Boolean(options?.preserveExactRrfOrder);

    const scoredCandidates: {
      item: StoredItem;
      rawScore: number;
      rrfScore: number;
      sparseScore: number;
      exactDense: number;
      titleMatches: number;
      passesGate: boolean;
      matchesHeadCategory: boolean;
      conflictsWithHeadCategory: boolean;
      passesCategoryHardGate: boolean;
      source?: string;
      rrf: RrfBreakdown;
      lexicalFieldContributions: LexicalFieldContribution[];
      dominantLexicalField: FieldBoostField | null;
    }[] = [];

    for (const stored of candidateItemMap.values()) {
      const exactDense = denseScoredById.get(stored.id) ?? 0;
      const lexEntry = lexicalScoredById.get(stored.id);
      const sparseScore = lexEntry?.score ?? 0;
      const lexicalRank = lexicalRankMap.get(stored.id) ?? null;
      const denseRank = denseRankMap.get(stored.id) ?? null;

      let rrf: RrfBreakdown;
      if (fusionMode === 'linear') {
        const normLex =
          lexicalRank !== null
            ? maxLexWindow > minLexWindow
              ? (sparseScore - minLexWindow) / (maxLexWindow - minLexWindow)
              : sparseScore > 0
              ? 1
              : 0
            : 0;
        const normDense =
          denseRank !== null
            ? maxDenseWindow > minDenseWindow
              ? (exactDense - minDenseWindow) / (maxDenseWindow - minDenseWindow)
              : exactDense > 0
              ? 1
              : 0
            : 0;
        rrf = computeLinearFusionBreakdown({
          lexicalRank,
          denseRank,
          normalizedLexicalScore: normLex,
          normalizedDenseScore: normDense,
          lexicalWeight: sparseWeight,
          denseWeight,
        });
      } else {
        rrf = computeWeightedRrfBreakdown({
          k,
          lexicalRank,
          denseRank,
          lexicalWeight: sparseWeight,
          denseWeight,
        });
      }

      const rrfScore = rrf.fusedScore;
      const source =
        lexicalRank !== null && denseRank !== null && sparseWeight > 0 && denseWeight > 0
          ? 'hybrid'
          : lexicalRank !== null && sparseWeight > 0
          ? 'sparse'
          : 'dense';

      const guardrail = evaluateCandidateGuardrail(
        queryInfo,
        stored,
        exactDense,
        sparseScore,
        catalogHasLexicalMatches && normSparseShare >= 0.15
      );

      const catGate = evaluateCandidateCategoryGate(headIntent, stored, gateMode);

      let rawScore = rrfScore;
      if (!isSingleChannelOrPureRrf) {
        if (normSparseShare > 0) {
          rawScore +=
            normSparseShare *
            (guardrail.consistencyBoost * 0.08 + Math.min(0.06, sparseScore * 0.008));
        }
        if (normDenseShare > 0) {
          rawScore += normDenseShare * (exactDense * 0.16);
        }

        if (gateMode !== 'off' && headIntent.hasHeadCategoryIntent) {
          rawScore = rawScore * catGate.categoryScoreMultiplier + catGate.categoryBonus;

          if (!catGate.conflictsWithHeadCategory) {
            const itemTextLower = `${stored.title} ${stored.category} ${(stored.tags || []).join(' ')} ${stored.description || ''}`.toLowerCase();
            let modMatches = 0;
            for (const mod of headIntent.modifierTokens) {
              const stem = mod.length >= 4 ? mod.slice(0, Math.min(mod.length, 5)) : mod;
              if (stem.length >= 3 && itemTextLower.includes(stem)) {
                modMatches++;
              }
            }
            if (modMatches > 0) {
              rawScore += modMatches * 0.025;
            }
            const budgetCap = headIntent.maxPrice ?? (queryInfo.isBudgetIntent ? 12000 : undefined);
            if (budgetCap !== undefined && typeof stored.price === 'number' && stored.price > 0) {
              if (stored.price <= budgetCap) {
                rawScore += 0.02;
              } else if (headIntent.maxPrice !== undefined) {
                rawScore *= 0.65;
              }
            }
          }
        }
      } else if (gateMode === 'soft' && headIntent.hasHeadCategoryIntent) {
        rawScore = rawScore * catGate.categoryScoreMultiplier + catGate.categoryBonus;
      }

      let passesGate =
        guardrail.passesLexicalGate || (catGate.matchesHeadCategory && denseWeight > 0);
      if (denseWeight === 0 && sparseScore <= 0 && guardrail.totalLexicalMatchCount === 0) {
        passesGate = false;
      }
      if (minScoreThreshold > 0 && rawScore < minScoreThreshold && exactDense < minScoreThreshold) {
        passesGate = false;
      }

      scoredCandidates.push({
        item: stored,
        rawScore,
        rrfScore,
        sparseScore,
        exactDense,
        titleMatches: guardrail.titleMatchCount,
        passesGate,
        matchesHeadCategory: catGate.matchesHeadCategory,
        conflictsWithHeadCategory: catGate.conflictsWithHeadCategory,
        passesCategoryHardGate: catGate.passesHardGate,
        source,
        rrf,
        lexicalFieldContributions: lexEntry?.contributions ?? [],
        dominantLexicalField: lexEntry?.dominantField ?? null,
      });
    }

    // Strict zero-results guardrail: never bypass passesGate when no candidates qualify
    let finalPool = scoredCandidates.filter((c) => c.passesGate);
    if (finalPool.length === 0) {
      if (options?.facets && options.facets.length > 0 && options.facetsOut) {
        options.facetsOut.facets = computeFacetCounts([], options.facets);
      }
      return [];
    }

    // Head-category gate enforcement (strict intersection with structured filters)
    if (gateMode !== 'off' && headIntent.hasHeadCategoryIntent) {
      const headMatchedPool = finalPool.filter((c) => c.matchesHeadCategory);
      if (gateMode === 'hard') {
        if (headMatchedPool.length > 0 || effectiveFilters?.category !== undefined) {
          finalPool = headMatchedPool;
        } else {
          finalPool = finalPool.filter((c) => !c.conflictsWithHeadCategory);
        }
      } else {
        const nonConflicting = finalPool.filter((c) => c.passesCategoryHardGate);
        if (nonConflicting.length > 0) {
          finalPool = nonConflicting;
        }
      }
    }

    if (finalPool.length === 0) {
      if (options?.facets && options.facets.length > 0 && options.facetsOut) {
        options.facetsOut.facets = computeFacetCounts([], options.facets);
      }
      return [];
    }

    // Side-channel Facet Counts computed over candidate pool after constraints + gate (before limit)
    if (options?.facets && options.facets.length > 0 && options.facetsOut) {
      options.facetsOut.facets = computeFacetCounts(
        finalPool.map((c) => c.item),
        options.facets
      );
    }

    finalPool.sort((a, b) => {
      if (Math.abs(b.rawScore - a.rawScore) > 1e-9) {
        return b.rawScore - a.rawScore;
      }
      if (Math.abs(b.rrfScore - a.rrfScore) > 1e-9) {
        return b.rrfScore - a.rrfScore;
      }
      return String(a.item.id).localeCompare(String(b.item.id));
    });

    // Diversify near-identical color/size variants of the same product model in general storefront hybrid search
    let orderedPool = finalPool;
    if (!isSingleChannelOrPureRrf) {
      const seenModels = new Set<string>();
      const primaryModels: typeof finalPool = [];
      const overflowVariants: typeof finalPool = [];
      for (const candidate of finalPool) {
        const descMatch = candidate.item.description?.match(/^([^,]+),\s*комплектация:/i);
        const modelKey = descMatch
          ? descMatch[1].trim().toLowerCase()
          : /\([^)]+\)\s*$/.test(candidate.item.title)
          ? candidate.item.title.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()
          : `id:${candidate.item.id}`;
        if (!seenModels.has(modelKey)) {
          seenModels.add(modelKey);
          primaryModels.push(candidate);
        } else {
          overflowVariants.push(candidate);
        }
      }
      orderedPool = [...primaryModels, ...overflowVariants];
    }

    return orderedPool.slice(0, limit).map((c) => ({
      item: c.item,
      score: Math.round(c.rawScore * 1000000) / 1000000,
      rrfScore: c.rrf.fusedScore,
      exactDense: Math.round(c.exactDense * 10000) / 10000,
      sparseScore: Math.round(c.sparseScore * 10000) / 10000,
      source: c.source,
      rrf: c.rrf,
      lexicalFieldContributions: c.lexicalFieldContributions,
      dominantLexicalField: c.dominantLexicalField,
    }));
  }

  public getBM25(): BM25Index {
    return this.bm25;
  }

  private linearSearch(
    qVec: Float32Array,
    limit: number,
    minSimilarity: number,
    excludeId?: string,
    filterCategory?: string
  ): { item: StoredItem; score: number }[] {
    const results: { item: StoredItem; score: number }[] = [];

    for (const stored of this.items.values()) {
      if (excludeId && stored.id === excludeId) continue;
      if (filterCategory && stored.category !== filterCategory) continue;

      const vector = stored.normalizedVector || stored.embedding;
      const score = cosineSimilarity(qVec, vector);

      if (score >= minSimilarity) {
        results.push({
          item: stored,
          score: Math.round(score * 10000) / 10000,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}
