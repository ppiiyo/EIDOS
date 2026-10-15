/**
 * BM25 (Okapi) Sparse Keyword Search Engine.
 * Formula: score(D, Q) = Σ IDF(qi) * (f(qi, D) * (k1 + 1)) / (f(qi, D) + k1 * (1 - b + b * |D| / avgdl))
 */
export interface BM25Document {
  id: string | number;
  text: string;
}

export interface BM25SearchResult {
  id: string;
  score: number;
}

export class BM25Index {
  private documents: Map<string, string[]> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private termFrequency: Map<string, Map<string, number>> = new Map();
  private documentLengths: Map<string, number> = new Map();
  private avgDocumentLength: number = 0;
  private readonly k1: number; // Term frequency saturation parameter (default 1.5)
  private readonly b: number; // Document length normalization parameter (default 0.75)

  constructor(k1: number = 1.5, b: number = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  /**
   * Tokenizes, stems and normalizes input text.
   */
  public tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 2);
  }

  /**
   * Adds or updates a document in the BM25 sparse index.
   */
  public addDocument(docId: string | number, text: string): void {
    const id = String(docId);
    const tokens = this.tokenize(text);

    // If document already exists, remove old counts first
    if (this.documents.has(id)) {
      this.removeDocument(id);
    }

    this.documents.set(id, tokens);
    this.documentLengths.set(id, tokens.length);

    // Compute Term Frequency for this document
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    this.termFrequency.set(id, tf);

    // Update global Document Frequency
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
    }

    this.recalculateAvgLength();
  }

  /**
   * Removes a document from the index.
   */
  public removeDocument(docId: string | number): void {
    const id = String(docId);
    const tokens = this.documents.get(id);
    if (!tokens) return;

    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      const currentDf = this.documentFrequency.get(token) || 0;
      if (currentDf <= 1) {
        this.documentFrequency.delete(token);
      } else {
        this.documentFrequency.set(token, currentDf - 1);
      }
    }

    this.documents.delete(id);
    this.documentLengths.delete(id);
    this.termFrequency.delete(id);
    this.recalculateAvgLength();
  }

  /**
   * Searches the BM25 index with a textual query and returns ranked document IDs.
   */
  public search(query: string, limit: number = 10): BM25SearchResult[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.documents.size === 0) {
      return [];
    }

    const scores = new Map<string, number>();
    const N = this.documents.size;
    const avgdl = this.avgDocumentLength || 1.0;

    for (const token of queryTokens) {
      const df = this.documentFrequency.get(token) || 0;
      if (df === 0) continue;

      // Robertson-Sparck Jones IDF formula with add-1 smoothing
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1.0);

      for (const [docId, tfMap] of this.termFrequency.entries()) {
        const termFreq = tfMap.get(token) || 0;
        if (termFreq === 0) continue;

        const docLength = this.documentLengths.get(docId) || avgdl;
        const denominator = termFreq + this.k1 * (1.0 - this.b + (this.b * docLength) / avgdl);
        const score = idf * ((termFreq * (this.k1 + 1.0)) / (denominator || 1e-6));

        scores.set(docId, (scores.get(docId) || 0) + score);
      }
    }

    return Array.from(scores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Returns total indexed documents.
   */
  public size(): number {
    return this.documents.size;
  }

  private recalculateAvgLength(): void {
    if (this.documents.size === 0) {
      this.avgDocumentLength = 0;
      return;
    }
    let total = 0;
    for (const len of this.documentLengths.values()) {
      total += len;
    }
    this.avgDocumentLength = total / this.documents.size;
  }
}
