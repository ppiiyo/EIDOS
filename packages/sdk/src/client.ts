import {
  CatalogItemInput,
  EidosClientConfig,
  IngestResponse,
  ReadyResponse,
  RecommendationRequest,
  RecommendationResponse,
  SearchRequest,
  SearchResponse,
  SuggestRequest,
  SuggestResponse,
} from './types';

/**
 * Official Eidos Client for interacting with the Eidos REST API.
 */
export class EidosClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly tenantId?: string;
  private readonly indexName?: string;

  constructor(config: EidosClientConfig) {
    if (!config.baseUrl) {
      throw new Error('Eidos SDK error: baseUrl is required');
    }
    if (!config.apiKey) {
      throw new Error('Eidos SDK error: apiKey is required');
    }

    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.tenantId = config.tenantId?.trim() || undefined;
    this.indexName = config.indexName?.trim() || undefined;
  }

  /**
   * Retrieves semantic recommendations based on a source item ID.
   */
  async recommend(request: RecommendationRequest): Promise<RecommendationResponse> {
    return this.post<RecommendationResponse>('/v1/recommend', request, {
      tenantId: request.tenantId,
      indexName: request.indexName,
    });
  }

  /**
   * Performs semantic natural language search over the indexed catalog.
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    return this.post<SearchResponse>('/v1/search', request, {
      tenantId: request.tenantId,
      indexName: request.indexName,
    });
  }

  /**
   * Performs low-latency autocomplete / typeahead search over the indexed catalog.
   */
  async suggest(request: SuggestRequest): Promise<SuggestResponse> {
    return this.post<SuggestResponse>('/v1/suggest', request, {
      tenantId: request.tenantId,
      indexName: request.indexName,
    });
  }

  /**
   * Upserts a single item into the Eidos semantic vector store.
   */
  async upsertItem(item: CatalogItemInput): Promise<IngestResponse> {
    return this.post<IngestResponse>('/v1/catalog/upsert', item);
  }

  /**
   * Upserts a batch of items via /v1/catalog/upsert (chunks of up to 500 items).
   */
  async upsertBatch(items: CatalogItemInput[]): Promise<IngestResponse> {
    return this.post<IngestResponse>('/v1/catalog/upsert', { items });
  }

  /**
   * Batch uploads items to the Eidos semantic vector store.
   */
  async ingestCatalog(items: CatalogItemInput[]): Promise<IngestResponse> {
    return this.post<IngestResponse>('/v1/catalog', { items });
  }

  /**
   * Checks API health status and uptime.
   */
  async health(): Promise<{ status: string; version: string; itemsCount: number }> {
    const url = `${this.baseUrl}/v1/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Eidos Health check failed: HTTP ${response.status}`);
      }

      return (await response.json()) as { status: string; version: string; itemsCount: number };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Checks API readiness probe (/v1/ready).
   */
  async ready(): Promise<ReadyResponse> {
    const url = `${this.baseUrl}/v1/ready`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Eidos Ready check failed: HTTP ${response.status}`);
      }

      return (await response.json()) as ReadyResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(
    extra?: { contentType?: string; tenantId?: string; indexName?: string }
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'x-api-key': this.apiKey,
      Accept: 'application/json',
    };
    if (extra?.contentType) {
      headers['Content-Type'] = extra.contentType;
    }
    const effectiveTenant = extra?.tenantId || this.tenantId;
    const effectiveIndex = extra?.indexName || this.indexName;
    if (effectiveTenant) {
      headers['x-tenant-id'] = effectiveTenant;
    }
    if (effectiveIndex) {
      headers['x-index-name'] = effectiveIndex;
    }
    return headers;
  }

  private async post<T>(
    endpoint: string,
    body: unknown,
    scope?: { tenantId?: string; indexName?: string }
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders({
          contentType: 'application/json',
          tenantId: scope?.tenantId,
          indexName: scope?.indexName,
        }),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errorBody = (await response.json()) as { message?: string; error?: string };
          errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch {
          // ignore parsing error
        }
        throw new Error(`Eidos API Error: ${errorMessage}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
