export interface XaiExplanation {
  summary: string;
  primaryDriver: 'semantic' | 'lexical' | 'popularity' | 'serendipity' | 'kinetic';
  matchedTerms: string[];
}

export class XaiExplainer {
  public explain(
    query: string,
    docTitle: string,
    vectorScore: number,
    bm25Score: number,
    popularityScore: number,
    serendipityScore = 0,
    kineticBonus = 0
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
    if (serendipityScore >= 0.56 && serendipityScore > vectorScore * 0.85) {
      primaryDriver = 'serendipity';
    } else if (kineticBonus >= 0.08) {
      primaryDriver = 'kinetic';
    } else if (bm25Score > vectorScore && bm25Score > popularityScore) {
      primaryDriver = 'lexical';
    } else if (popularityScore > vectorScore && popularityScore > bm25Score) {
      primaryDriver = 'popularity';
    }

    let summary = '';
    if (primaryDriver === 'serendipity') {
      summary = `Counterfactual Anti-Echo-Chamber discovery (${Math.round(serendipityScore * 100)}% orthogonal novelty to your session bubble).`;
    } else if (primaryDriver === 'kinetic') {
      summary = `Boosted by real-time Kinetic Attention physics (+${Math.round(kineticBonus * 100)}% micro-hesitation & comparison fit).`;
    } else if (primaryDriver === 'lexical' && matchedTerms.length > 0) {
      summary = `Exact keyword match on "${matchedTerms.join(', ')}" (${Math.round(bm25Score * 100)}% lexical relevance).`;
    } else if (primaryDriver === 'semantic') {
      summary = `Strong semantic similarity (${Math.round(vectorScore * 100)}%) to your concept "${query}".`;
    } else {
      summary = `Trending item in this category (${Math.round(popularityScore * 100)}% popularity score).`;
    }

    return { summary, primaryDriver, matchedTerms };
  }
}

