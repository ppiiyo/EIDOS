import {
  CatalogItemInput,
  EidosClientConfig,
  IngestResponse,
  RecommendationRequest,
  RecommendationResponse,
  SearchRequest,
  SearchResponse,
} from './types';

/**
 * Official EIDOS Client for interacting with the EIDOS REST API.
 */
export class EidosClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: EidosClientConfig) {
    if (!config.baseUrl) {
      throw new Error('EIDOS SDK error: baseUrl is required');
    }
    if (!config.apiKey) {
      throw new Error('EIDOS SDK error: apiKey is required');
    }

    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  /**
   * Retrieves semantic recommendations based on a source item ID.
   */
  async recommend(request: RecommendationRequest): Promise<RecommendationResponse> {
    return this.post<RecommendationResponse>('/v1/recommend', request);
  }

  /**
   * Performs semantic natural language search over the indexed catalog.
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    return this.post<SearchResponse>('/v1/search', request);
  }

  /**
   * Batch uploads items to the EIDOS semantic vector store.
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
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`EIDOS Health check failed: HTTP ${response.status}`);
      }

      return (await response.json()) as { status: string; version: string; itemsCount: number };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
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
        throw new Error(`EIDOS API Error: ${errorMessage}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
