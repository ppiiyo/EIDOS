export interface PriceRange {
  min?: number;
  max?: number;
  currency?: 'RUB' | 'USD' | 'EUR';
}

export interface ExtractedIntent {
  originalQuery: string;
  normalizedQuery: string;
  category?: string;
  categories?: string[];
  useCase?: string;
  useCases?: string[];
  priceRange?: PriceRange;
  confidence: number;
  matchedPatterns: string[];
  explanation: string;
}

export interface IntentPattern {
  id: string;
  regex: RegExp;
  priority: number;
  confidenceBoost: number;
  category?: string | string[];
  useCase?: string | string[];
  priceRange?: PriceRange | ((match: RegExpExecArray) => PriceRange | undefined);
  description: string;
}

const CATEGORY_SYNONYMS: Record<string, string> = {
  // Russian synonyms & inflections -> canonical category
  наушники: 'наушники',
  наушник: 'наушники',
  наушников: 'наушники',
  гарнитура: 'наушники',
  гарнитуру: 'наушники',
  гарнитуры: 'наушники',
  уши: 'наушники',
  вкладыши: 'наушники',
  затычки: 'наушники',
  аирподсы: 'наушники',
  airpods: 'наушники',
  ноутбук: 'ноутбуки',
  ноутбуки: 'ноутбуки',
  ноут: 'ноутбуки',
  ноуты: 'ноутбуки',
  лэптоп: 'ноутбуки',
  ультрабук: 'ноутбуки',
  макбук: 'ноутбуки',
  смартфон: 'смартфоны',
  смартфоны: 'смартфоны',
  телефон: 'смартфоны',
  телефоны: 'смартфоны',
  мобильник: 'смартфоны',
  айфон: 'смартфоны',
  кроссовки: 'кроссовки',
  кросовки: 'кроссовки',
  кеды: 'кроссовки',
  обувь: 'кроссовки',
  часы: 'умные часы',
  'умные часы': 'умные часы',
  смартчасы: 'умные часы',
  'смарт-часы': 'умные часы',
  клавиатура: 'клавиатуры',
  клавиатуры: 'клавиатуры',
  клава: 'клавиатуры',
  монитор: 'мониторы',
  мониторы: 'мониторы',
  камера: 'камеры',
  камеры: 'камеры',
  фотоаппарат: 'камеры',
  // English synonyms & inflections -> canonical category
  headphone: 'headphones',
  headphones: 'headphones',
  earbuds: 'headphones',
  earphones: 'headphones',
  headset: 'headphones',
  headsets: 'headphones',
  laptop: 'laptops',
  laptops: 'laptops',
  notebook: 'laptops',
  ultrabook: 'laptops',
  macbook: 'laptops',
  smartphone: 'smartphones',
  smartphones: 'smartphones',
  phone: 'smartphones',
  phones: 'smartphones',
  iphone: 'smartphones',
  sneakers: 'sneakers',
  shoes: 'sneakers',
  footwear: 'sneakers',
  smartwatch: 'smartwatches',
  smartwatches: 'smartwatches',
  watch: 'smartwatches',
  keyboard: 'keyboards',
  keyboards: 'keyboards',
  monitor: 'monitors',
  monitors: 'monitors',
};

const USE_CASE_SYNONYMS: Record<string, string> = {
  // Russian inflections -> canonical useCase
  бег: 'бег',
  бега: 'бег',
  пробежки: 'бег',
  пробежек: 'бег',
  марафона: 'бег',
  спорт: 'спорт',
  спорта: 'спорт',
  тренировок: 'спорт',
  тренировки: 'спорт',
  фитнеса: 'спорт',
  фитнес: 'спорт',
  зала: 'спорт',
  зал: 'спорт',
  игр: 'игры',
  игры: 'игры',
  гейминга: 'игры',
  гейминг: 'игры',
  киберспорта: 'игры',
  работы: 'работа',
  работа: 'работа',
  офиса: 'офис',
  офис: 'офис',
  звонков: 'работа',
  созвонов: 'работа',
  учебы: 'учеба',
  учёбы: 'учеба',
  учеба: 'учеба',
  студента: 'учеба',
  путешествий: 'путешествия',
  путешествия: 'путешествия',
  поездок: 'путешествия',
  самолета: 'путешествия',
  сна: 'сон',
  сон: 'сон',
  программирования: 'программирование',
  кодинга: 'программирование',
  разработки: 'программирование',
  монтажа: 'монтаж',
  дизайна: 'дизайн',
  // English inflections -> canonical useCase
  running: 'running',
  jogging: 'running',
  marathon: 'running',
  sport: 'sports',
  sports: 'sports',
  workout: 'workout',
  workouts: 'workout',
  gym: 'workout',
  fitness: 'workout',
  gaming: 'gaming',
  games: 'gaming',
  esports: 'gaming',
  work: 'work',
  working: 'work',
  office: 'office',
  calls: 'work',
  study: 'study',
  studying: 'study',
  school: 'study',
  college: 'study',
  travel: 'travel',
  traveling: 'travel',
  flights: 'travel',
  sleep: 'sleep',
  sleeping: 'sleep',
  coding: 'coding',
  programming: 'coding',
};

export class IntentDictionary {
  private readonly patterns: IntentPattern[];

  constructor(customPatterns?: IntentPattern[]) {
    this.patterns = (customPatterns ? [...customPatterns] : this.buildDefaultPatterns()).sort(
      (a, b) => b.priority - a.priority
    );
  }

  private buildDefaultPatterns(): IntentPattern[] {
    return [
      // 1. Explicit Category Capture Patterns (uses $1 group resolution)
      {
        id: 'ru_category_direct',
        regex:
          /(?:^|[^\p{L}\p{N}])(наушники|наушник|гарнитура|гарнитуру|уши|вкладыши|затычки|аирподсы|ноутбуки|ноутбук|ноут|ноуты|лэптоп|ультрабук|макбук|смартфоны|смартфон|телефон|телефоны|мобильник|айфон|кроссовки|кросовки|кеды|обувь|умные часы|смарт-часы|смартчасы|часы|клавиатура|клавиатуры|клава|монитор|мониторы|камера|камеры|фотоаппарат)(?=$|[^\p{L}\p{N}])/iu,
        priority: 80,
        confidenceBoost: 0.4,
        category: ['$1'],
        description: 'Russian product category extraction ($1)',
      },
      {
        id: 'en_category_direct',
        regex:
          /\b(headphones|headphone|earbuds|earphones|headsets|headset|airpods|laptops|laptop|notebook|ultrabook|macbook|smartphones|smartphone|phones|phone|iphone|sneakers|shoes|footwear|smartwatches|smartwatch|watch|keyboards|keyboard|monitors|monitor)\b/i,
        priority: 80,
        confidenceBoost: 0.4,
        category: ['$1'],
        description: 'English product category extraction ($1)',
      },

      // 2. High-priority specific compound category overrides (e.g., gaming laptop vs generic laptop)
      {
        id: 'ru_gaming_compound',
        regex: /(?:^|[^\p{L}\p{N}])игров(?:ой|ые|ая)\s+(ноутбук|ноутбуки|наушники|клавиатура|монитор)(?=$|[^\p{L}\p{N}])/iu,
        priority: 95,
        confidenceBoost: 0.55,
        category: ['$1'],
        useCase: ['игры'],
        description: 'Russian compound gaming category + useCase',
      },
      {
        id: 'en_gaming_compound',
        regex: /\bgaming\s+(laptop|laptops|headphones|headset|keyboard|monitor)\b/i,
        priority: 95,
        confidenceBoost: 0.55,
        category: ['$1'],
        useCase: ['gaming'],
        description: 'English compound gaming category + useCase',
      },

      // 3. Use-Case Patterns ("для <X>", "под <X>", "for <X>")
      {
        id: 'ru_use_case_for',
        regex:
          /(?:^|[^\p{L}\p{N}])(?:для|под)\s+(бега|бег|пробежки|пробежек|марафона|спорта|спорт|тренировок|тренировки|фитнеса|фитнес|зала|игр|игры|гейминга|киберспорта|работы|офиса|звонков|созвонов|учебы|учёбы|студента|путешествий|поездок|самолета|сна|программирования|кодинга|разработки|монтажа|дизайна)(?=$|[^\p{L}\p{N}])/iu,
        priority: 85,
        confidenceBoost: 0.35,
        useCase: ['$1'],
        description: 'Russian use-case extraction ("для $1")',
      },
      {
        id: 'ru_use_case_adjective',
        regex: /(?:^|[^\p{L}\p{N}])(бегов(?:ые|ой)|спортивн(?:ые|ый|ая)|офисн(?:ый|ые|ая))(?=$|[^\p{L}\p{N}])/iu,
        priority: 70,
        confidenceBoost: 0.3,
        useCase: ['$1'],
        description: 'Russian adjectival use-case extraction',
      },
      {
        id: 'en_use_case_for',
        regex:
          /\bfor\s+(running|jogging|marathon|sport|sports|workout|workouts|gym|fitness|gaming|games|esports|work|working|office|calls|study|studying|school|college|travel|traveling|flights|sleep|sleeping|coding|programming)\b/i,
        priority: 85,
        confidenceBoost: 0.35,
        useCase: ['$1'],
        description: 'English use-case extraction ("for $1")',
      },

      // 4. Price Range Patterns (Explicit numeric ranges have higher priority than qualitative terms)
      {
        id: 'price_between_ru_en',
        regex: /(?:от|from|between)\s*(\d{2,7})\s*(?:до|to|and|-)\s*(\d{2,7})/i,
        priority: 100,
        confidenceBoost: 0.35,
        priceRange: (m) => ({
          min: Number(m[1]),
          max: Number(m[2]),
        }),
        description: 'Explicit min-max price range',
      },
      {
        id: 'price_max_explicit',
        regex: /(?:до|дешевле|не\s+дороже|under|below|less\s+than|up\s+to|max)\s*\$?(\d{2,7})/i,
        priority: 95,
        confidenceBoost: 0.3,
        priceRange: (m) => ({
          max: Number(m[1]),
        }),
        description: 'Explicit maximum price ceiling',
      },
      {
        id: 'price_min_explicit',
        regex: /(?:от|дороже|свыше|over|above|more\s+than|min)\s*\$?(\d{2,7})/i,
        priority: 90,
        confidenceBoost: 0.3,
        priceRange: (m) => ({
          min: Number(m[1]),
        }),
        description: 'Explicit minimum price floor',
      },
      {
        id: 'price_budget_qualitative_ru',
        regex: /(?:^|[^\p{L}\p{N}])(недорог(?:ие|ой|ая|ое)|дешев(?:ые|ый|ая|ое)|дешёв(?:ые|ый|ая|ое)|бюджетн(?:ые|ый|ая|ое)|эконом)(?=$|[^\p{L}\p{N}])/iu,
        priority: 65,
        confidenceBoost: 0.25,
        priceRange: { max: 5000 },
        description: 'Qualitative budget price intent (RU -> max: 5000)',
      },
      {
        id: 'price_budget_qualitative_en',
        regex: /\b(cheap|budget|affordable|inexpensive|low-cost)\b/i,
        priority: 65,
        confidenceBoost: 0.25,
        priceRange: { max: 5000 },
        description: 'Qualitative budget price intent (EN -> max: 5000)',
      },
      {
        id: 'price_premium_qualitative',
        regex: /(?:^|[^\p{L}\p{N}])(премиум|премиальн(?:ые|ый|ая)|флагманск(?:ие|ий|ая)|дорог(?:ие|ой|ая)|топов(?:ые|ый|ая)|premium|flagship|luxury|high-end)(?=$|[^\p{L}\p{N}])/iu,
        priority: 60,
        confidenceBoost: 0.25,
        priceRange: { min: 15000 },
        description: 'Qualitative premium price intent (min: 15000)',
      },
    ];
  }

  private normalizeCategory(raw: string): string {
    const clean = raw.trim().toLowerCase();
    return CATEGORY_SYNONYMS[clean] || clean;
  }

  private normalizeUseCase(raw: string): string {
    const clean = raw.trim().toLowerCase();
    if (/^бегов/i.test(clean)) return 'бег';
    if (/^спортивн/i.test(clean)) return 'спорт';
    if (/^офисн/i.test(clean)) return 'офис';
    return USE_CASE_SYNONYMS[clean] || clean;
  }

  /**
   * Resolves capture group placeholders ($1, $2, ...) from regex match.
   * Fixes the bug where `category: ['$1']` returned literal string '$1' instead of `match[1]`.
   */
  private resolveTemplateValue(template: string, match: RegExpExecArray): string {
    if (!template.includes('$')) {
      return template.trim();
    }
    return template
      .replace(/\$(\d+)/g, (_full, groupIdx) => {
        const idx = Number(groupIdx);
        return match[idx] ? match[idx].trim() : '';
      })
      .trim();
  }

  public applyPattern(
    pattern: IntentPattern,
    match: RegExpExecArray,
    result: ExtractedIntent,
    fieldPriorities: { category: number; useCase: number; priceRange: number }
  ): void {
    // 1. Category extraction (correctly resolving '$1' capture groups)
    if (pattern.category !== undefined) {
      const templates = Array.isArray(pattern.category) ? pattern.category : [pattern.category];
      const resolvedCategories = templates
        .map((tpl) => this.resolveTemplateValue(tpl, match))
        .filter((val) => val.length > 0 && !val.startsWith('$'))
        .map((val) => this.normalizeCategory(val));

      if (resolvedCategories.length > 0) {
        const existingCategories = result.categories || [];
        const merged = Array.from(new Set([...existingCategories, ...resolvedCategories]));
        result.categories = merged;

        if (pattern.priority >= fieldPriorities.category || !result.category) {
          result.category = resolvedCategories[0];
          fieldPriorities.category = pattern.priority;
        }
      }
    }

    // 2. UseCase extraction (correctly resolving '$1' capture groups)
    if (pattern.useCase !== undefined) {
      const templates = Array.isArray(pattern.useCase) ? pattern.useCase : [pattern.useCase];
      const resolvedUseCases = templates
        .map((tpl) => this.resolveTemplateValue(tpl, match))
        .filter((val) => val.length > 0 && !val.startsWith('$'))
        .map((val) => this.normalizeUseCase(val));

      if (resolvedUseCases.length > 0) {
        const existingUseCases = result.useCases || [];
        const merged = Array.from(new Set([...existingUseCases, ...resolvedUseCases]));
        result.useCases = merged;

        if (pattern.priority >= fieldPriorities.useCase || !result.useCase) {
          result.useCase = resolvedUseCases[0];
          fieldPriorities.useCase = pattern.priority;
        }
      }
    }

    // 3. PriceRange extraction with priority precedence
    if (pattern.priceRange !== undefined) {
      const extractedRange =
        typeof pattern.priceRange === 'function'
          ? pattern.priceRange(match)
          : { ...pattern.priceRange };

      if (extractedRange && (extractedRange.min !== undefined || extractedRange.max !== undefined)) {
        if (pattern.priority >= fieldPriorities.priceRange || !result.priceRange) {
          result.priceRange = extractedRange;
          fieldPriorities.priceRange = pattern.priority;
        }
      }
    }

    result.matchedPatterns.push(pattern.id);
    result.confidence = Math.min(
      1,
      Math.round((result.confidence + pattern.confidenceBoost) * 100) / 100
    );
  }

  public extractIntent(query: string): ExtractedIntent {
    const originalQuery = typeof query === 'string' ? query : '';
    const normalizedQuery = originalQuery.trim().toLowerCase().replace(/\s+/g, ' ');

    const result: ExtractedIntent = {
      originalQuery,
      normalizedQuery,
      confidence: 0,
      matchedPatterns: [],
      explanation: 'No structured intent patterns matched; falling back to general hybrid search.',
    };

    if (!normalizedQuery) {
      result.explanation = 'Empty query: no intent extracted.';
      return result;
    }

    const fieldPriorities = {
      category: -1,
      useCase: -1,
      priceRange: -1,
    };

    for (const pattern of this.patterns) {
      const match = pattern.regex.exec(normalizedQuery);
      if (match) {
        this.applyPattern(pattern, match, result, fieldPriorities);
      }
    }

    const parts: string[] = [];
    if (result.category) parts.push(`category="${result.category}"`);
    if (result.useCase) parts.push(`useCase="${result.useCase}"`);
    if (result.priceRange) {
      const minStr = result.priceRange.min !== undefined ? `min:${result.priceRange.min}` : '';
      const maxStr = result.priceRange.max !== undefined ? `max:${result.priceRange.max}` : '';
      parts.push(`priceRange={${[minStr, maxStr].filter(Boolean).join(', ')}}`);
    }

    if (parts.length > 0) {
      result.explanation = `Extracted intent (${parts.join(', ')}) with confidence ${result.confidence.toFixed(2)} via [${result.matchedPatterns.join(', ')}].`;
    }

    return result;
  }
}

export const intentDictionary = new IntentDictionary();
