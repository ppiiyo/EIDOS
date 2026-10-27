export interface XaiExplanation {
  summary: string;
  primaryDriver: 'semantic' | 'lexical' | 'popularity';
  matchedTerms: string[];
}

export class XaiExplainer {
  public explain(
    query: string,
    docTitle: string,
    vectorScore: number,
    bm25Score: number,
    popularityScore: number
  ): XaiExplanation {
    const qTokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const dTokens = new Set(
      docTitle
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .split(/\s+/)
    );
    const matchedTerms = qTokens.filter((t) => dTokens.has(t));

    let primaryDriver: XaiExplanation['primaryDriver'] = 'semantic';
    if (bm25Score > vectorScore && bm25Score > popularityScore) {
      primaryDriver = 'lexical';
    } else if (popularityScore > vectorScore && popularityScore > bm25Score) {
      primaryDriver = 'popularity';
    }

    let summary = '';
    if (primaryDriver === 'lexical' && matchedTerms.length > 0) {
      summary = `Exact keyword match on "${matchedTerms.join(', ')}" (${Math.round(bm25Score * 100)}% lexical relevance).`;
    } else if (primaryDriver === 'semantic') {
      summary = `Strong semantic similarity (${Math.round(vectorScore * 100)}%) to your concept "${query}".`;
    } else {
      summary = `Trending item in this category (${Math.round(popularityScore * 100)}% popularity score).`;
    }

    return { summary, primaryDriver, matchedTerms };
  }
}
