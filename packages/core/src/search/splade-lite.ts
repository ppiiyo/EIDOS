const SYNONYM_MAP: Record<string, Record<string, number>> = {
  laptop: { notebook: 0.8, macbook: 0.7, computer: 0.6, pc: 0.5 },
  headphones: { earbuds: 0.8, audio: 0.6, headset: 0.75, airpods: 0.7 },
  cheap: { budget: 0.85, affordable: 0.8, discount: 0.6 },
  gaming: { esports: 0.75, rgb: 0.5, fps: 0.6 },
  phone: { smartphone: 0.9, mobile: 0.75, iphone: 0.7, android: 0.7 },
  ноутбук: { лэптоп: 0.85, компьютер: 0.6, макбук: 0.7 },
  наушники: { гарнитура: 0.8, аирподс: 0.7, звук: 0.6 },
};

export class SpladeLite {
  public encode(text: string): Map<string, number> {
    const tokens = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean);
    const weights = new Map<string, number>();

    for (const token of tokens) {
      weights.set(token, (weights.get(token) || 0) + 1.0);
      const expansions = SYNONYM_MAP[token];
      if (expansions) {
        for (const [syn, weight] of Object.entries(expansions)) {
          weights.set(syn, Math.max(weights.get(syn) || 0, weight));
        }
      }
    }

    // Apply log(1 + ReLU(w)) activation as in SPLADE paper
    for (const [term, w] of weights.entries()) {
      weights.set(term, Math.log1p(Math.max(0, w)));
    }
    return weights;
  }

  public score(
    queryWeights: Map<string, number>,
    docWeights: Map<string, number>
  ): number {
    let dot = 0;
    for (const [term, qw] of queryWeights.entries()) {
      const dw = docWeights.get(term);
      if (dw !== undefined) {
        dot += qw * dw;
      }
    }
    return dot;
  }
}
