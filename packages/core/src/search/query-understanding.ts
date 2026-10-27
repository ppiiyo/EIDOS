export interface ParsedQuery {
  cleanQuery: string;
  intent: 'discovery' | 'specific' | 'cheap' | 'premium';
  maxPrice?: number;
  minPrice?: number;
  category?: string;
}

const CATEGORIES = ['audio', 'laptops', 'monitors', 'accessories', 'gaming', 'wearables'];

export class QueryParser {
  public parse(rawQuery: string): ParsedQuery {
    let q = rawQuery.toLowerCase().trim();
    let maxPrice: number | undefined;
    let minPrice: number | undefined;
    let intent: ParsedQuery['intent'] = 'discovery';

    // Extract "under $X" or "до X"
    const underMatch = q.match(/(?:under|below|less than|до)\s*\$?(\d+)/i);
    if (underMatch) {
      maxPrice = parseInt(underMatch[1], 10);
      q = q.replace(underMatch[0], '').trim();
    }

    // Extract "over $X" or "от X"
    const overMatch = q.match(/(?:over|above|more than|от)\s*\$?(\d+)/i);
    if (overMatch) {
      minPrice = parseInt(overMatch[1], 10);
      q = q.replace(overMatch[0], '').trim();
    }

    if (/(?:^|\s)(cheap|budget|affordable|недорогие|бюджетные)(?=\s|$)/i.test(rawQuery)) {
      intent = 'cheap';
    } else if (/(?:^|\s)(pro|ultra|premium|luxury|топ|премиум)(?=\s|$)/i.test(rawQuery)) {
      intent = 'premium';
    } else if (rawQuery.trim().split(/\s+/).length >= 4) {
      intent = 'specific';
    }

    let detectedCategory: string | undefined;
    for (const cat of CATEGORIES) {
      if (q.includes(cat)) {
        detectedCategory = cat;
        break;
      }
    }

    return {
      cleanQuery: q.replace(/\s+/g, ' ').trim() || rawQuery.trim(),
      intent,
      maxPrice,
      minPrice,
      category: detectedCategory,
    };
  }
}
