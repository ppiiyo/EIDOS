/**
 * BM25 (Okapi) Sparse Keyword Search Engine with Universal Multilingual & CJK Tokenization.
 * Supports Latin, Cyrillic, Japanese (Kanji/Hiragana/Katakana), Chinese (Hanzi), Korean (Hangul), Arabic, etc.
 * Formula: score(D, Q) = Σ IDF(qi) * (f(qi, D) * (k1 + 1)) / (f(qi, D) + k1 * (1 - b + b * |D| / avgdl))
 */
import { tokenizeCJK } from '../bm25/cjk-tokenizer';

export interface BM25Document {
  id: string | number;
  text?: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface BM25SearchResult {
  id: string;
  score: number;
}

const CJK_SEQ_REGEX = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+/g;

export class BM25Index {
  private documents: Map<string, string[]> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private termFrequency: Map<string, Map<string, number>> = new Map();
  private postings: Map<string, Map<string, number>> = new Map();
  private documentLengths: Map<string, number> = new Map();
  private totalDocumentLength: number = 0;
  private avgDocumentLength: number = 0;
  private readonly k1: number; // Term frequency saturation parameter (default 1.5)
  private readonly b: number; // Document length normalization parameter (default 0.75)

  constructor(k1: number = 1.5, b: number = 0.75) {
    if (!Number.isFinite(k1) || k1 <= 0) {
      throw new RangeError(`BM25 k1 must be a finite number > 0, got ${k1}`);
    }
    if (!Number.isFinite(b) || b < 0 || b > 1) {
      throw new RangeError(`BM25 b must be in range [0, 1], got ${b}`);
    }
    this.k1 = k1;
    this.b = b;
  }

  /**
   * Static helper that tokenizes and normalizes input text across all languages including CJK (Japanese, Chinese, Korean).
   * Delegates base unigram/word segmentation to tokenizeCJK and supplements compound CJK sequences with bigrams/trigrams.
   */
  public static tokenize(text: string): string[] {
    const tokens = tokenizeCJK(text);
    if (tokens.length === 0) return tokens;

    const normalized = text.toLowerCase().trim();
    const cjkMatches = normalized.match(CJK_SEQ_REGEX);
    if (cjkMatches) {
      for (const seq of cjkMatches) {
        for (let i = 0; i < seq.length; i++) {
          if (i + 1 < seq.length) {
            tokens.push(seq.slice(i, i + 2));
          }
          if (i + 2 < seq.length) {
            tokens.push(seq.slice(i, i + 3));
          }
        }
      }
    }

    return tokens;
  }

  /**
   * Instance method delegating to static tokenizer.
   */
  public tokenize(text: string): string[] {
    return BM25Index.tokenize(text);
  }

  /**
   * Adds or updates a document in the BM25 sparse index.
   * Supports both (docId, text) and ({ id, title, description, category, tags }).
   */
  public addDocument(docOrId: string | number | BM25Document, text?: string): void {
    let id: string;
    let combinedText: string;

    if (typeof docOrId === 'object' && docOrId !== null) {
      id = String(docOrId.id);
      combinedText = [
        docOrId.text || '',
        docOrId.title || '',
        docOrId.description || '',
        docOrId.category || '',
        ...(docOrId.tags || []),
      ]
        .filter(Boolean)
        .join(' ');
    } else {
      id = String(docOrId);
      combinedText = text || '';
    }

    const tokens = this.tokenize(combinedText);

    // If document already exists, remove old counts first
    if (this.documents.has(id)) {
      this.removeDocument(id);
    }

    this.documents.set(id, tokens);
    this.documentLengths.set(id, tokens.length);
    this.totalDocumentLength += tokens.length;

    // Compute Term Frequency for this document and update inverted posting lists
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    this.termFrequency.set(id, tf);

    for (const [token, count] of tf.entries()) {
      this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
      let postingMap = this.postings.get(token);
      if (!postingMap) {
        postingMap = new Map<string, number>();
        this.postings.set(token, postingMap);
      }
      postingMap.set(id, count);
    }

    this.avgDocumentLength = this.documents.size > 0 ? this.totalDocumentLength / this.documents.size : 0;
  }

  /**
   * Removes a document from the index.
   */
  public removeDocument(docId: string | number): void {
    const id = String(docId);
    const tf = this.termFrequency.get(id);
    if (!tf) return;

    const oldLen = this.documentLengths.get(id) || 0;
    this.totalDocumentLength = Math.max(0, this.totalDocumentLength - oldLen);

    for (const token of tf.keys()) {
      const currentDf = this.documentFrequency.get(token) || 0;
      if (currentDf <= 1) {
        this.documentFrequency.delete(token);
      } else {
        this.documentFrequency.set(token, currentDf - 1);
      }
      const postingMap = this.postings.get(token);
      if (postingMap) {
        postingMap.delete(id);
        if (postingMap.size === 0) {
          this.postings.delete(token);
        }
      }
    }

    this.documents.delete(id);
    this.documentLengths.delete(id);
    this.termFrequency.delete(id);
    this.avgDocumentLength = this.documents.size > 0 ? this.totalDocumentLength / this.documents.size : 0;
  }

  /**
   * Searches the BM25 index with a textual query and returns ranked document IDs using inverted postings.
   */
  public search(query: string, limit: number = 10): BM25SearchResult[] {
    if (!Number.isFinite(limit) || limit < 1) {
      throw new RangeError(`BM25 search limit must be >= 1, got ${limit}`);
    }
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.documents.size === 0) {
      return [];
    }

    const scores = new Map<string, number>();
    const N = this.documents.size;
    const avgdl = this.avgDocumentLength || 1.0;
    const k1 = this.k1;
    const b = this.b;
    const k1Plus1 = k1 + 1.0;
    const baseNorm = k1 * (1.0 - b);
    const lenNormFactor = (k1 * b) / avgdl;

    for (let i = 0; i < queryTokens.length; i++) {
      const token = queryTokens[i];
      const postingMap = this.postings.get(token);
      if (!postingMap || postingMap.size === 0) continue;

      const df = postingMap.size;
      // Robertson-Sparck Jones IDF formula with add-1 smoothing
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1.0);

      for (const [docId, termFreq] of postingMap.entries()) {
        const docLength = this.documentLengths.get(docId) || avgdl;
        const denominator = termFreq + baseNorm + lenNormFactor * docLength;
        const score = idf * ((termFreq * k1Plus1) / (denominator || 1e-6));

        scores.set(docId, (scores.get(docId) || 0) + score);
      }
    }

    if (scores.size === 0) return [];

    // Fast Top-K extraction
    const results: BM25SearchResult[] = [];
    for (const [id, score] of scores.entries()) {
      if (results.length < limit) {
        results.push({ id, score });
        if (results.length === limit) {
          results.sort((a, b) => b.score - a.score);
        }
      } else if (score > results[limit - 1].score) {
        results[limit - 1] = { id, score };
        // Insertion bubble up for small limit
        let idx = limit - 1;
        while (idx > 0 && results[idx].score > results[idx - 1].score) {
          const tmp = results[idx - 1];
          results[idx - 1] = results[idx];
          results[idx] = tmp;
          idx--;
        }
      }
    }

    if (results.length < limit) {
      results.sort((a, b) => b.score - a.score);
    }

    return results;
  }

  /**
   * Returns total indexed documents.
   */
  public size(): number {
    return this.documents.size;
  }
}
