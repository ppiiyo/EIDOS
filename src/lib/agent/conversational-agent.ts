import { cosineSimilarity, SecurityGuardrails } from '@eidos/core';
import { CatalogItem } from '../../types';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  recommendedItems?: CatalogItem[];
}

export interface AgentResponse {
  text: string;
  items: CatalogItem[];
  explanation?: string;
}

interface ParsedIntent {
  type: 'recommend' | 'search' | 'similar' | 'filter' | 'greeting' | 'unknown';
  categoryAliases?: string[];
  maxPrice?: number;
  minPrice?: number;
  referenceItemTitle?: string;
  keywords: string[];
}

const MULTILINGUAL_CATEGORY_MAP: Array<{ triggers: string[]; aliases: string[] }> = [
  {
    triggers: ['электроник', 'гаджет', 'ноутбук', 'смартфон', 'наушник', 'electronics', 'gadget', 'laptop', 'audio'],
    aliases: ['электроника', 'техника', 'electronics', 'hardware', 'audio'],
  },
  {
    triggers: ['книг', 'литератур', 'чтени', 'book', 'reading'],
    aliases: ['книги', 'books', 'education'],
  },
  {
    triggers: ['фильм', 'кино', 'сериал', 'movie', 'cinema', 'sci-fi', 'фантастик'],
    aliases: ['фильмы', 'movies', 'sci-fi', 'cinema', 'thriller', 'documentary'],
  },
  {
    triggers: ['игр', 'гейм', 'game', 'gaming', 'rpg'],
    aliases: ['игры', 'games', 'gaming', 'anime'],
  },
  {
    triggers: ['одежд', 'пальто', 'кроссовк', 'fashion', 'clothing', 'спорт', 'sport'],
    aliases: ['одежда', 'спорт', 'fashion', 'clothing', 'sport'],
  },
  {
    triggers: ['кофе', 'дом', 'быт', 'coffee', 'home'],
    aliases: ['техника', 'дом', 'coffee', 'lifestyle'],
  },
];

function parseItemNumericPrice(priceStr?: string | number): number | null {
  if (typeof priceStr === 'number') return Number.isFinite(priceStr) ? priceStr : null;
  if (!priceStr) return null;
  const cleaned = String(priceStr).replace(/\s+/g, '').replace(/,/g, '.');
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return Number.isFinite(val) ? val : null;
}

export class ConversationalAgent {
  private items: CatalogItem[] = [];
  private embeddings = new Map<string, Float32Array>();
  private embedFn: (text: string) => Promise<Float32Array>;
  private history: AgentMessage[] = [];
  private lastCategoryAliases: string[] | undefined;
  private lastSemanticQuery = '';

  constructor(
    items: CatalogItem[],
    embeddings: Map<string, Float32Array>,
    embedFn: (text: string) => Promise<Float32Array>
  ) {
    this.items = items;
    this.embeddings = embeddings;
    this.embedFn = embedFn;
  }

  public updateCatalog(items: CatalogItem[], embeddings: Map<string, Float32Array>): void {
    this.items = items;
    this.embeddings = embeddings;
  }

  private extractIntent(rawText: string): ParsedIntent {
    const lower = rawText.toLowerCase().trim();

    if (/^(hi|hello|hey|привет|здравствуй|добрый день)\b/.test(lower) && lower.split(/\s+/).length <= 3) {
      return { type: 'greeting', keywords: [] };
    }

    let categoryAliases: string[] | undefined;
    for (const group of MULTILINGUAL_CATEGORY_MAP) {
      if (group.triggers.some((t) => lower.includes(t))) {
        categoryAliases = group.aliases;
        break;
      }
    }

    let maxPrice: number | undefined;
    let minPrice: number | undefined;

    const underMatch = lower.match(
      /(?:under|below|less than|cheaper than|max|до|дешевле|меньше|не дороже)\s*\$?(\d+(?:\s*\d+)*)/
    );
    if (underMatch) {
      maxPrice = parseFloat(underMatch[1].replace(/\s+/g, ''));
    }

    const overMatch = lower.match(
      /(?:over|above|more than|min|от|дороже|больше)\s*\$?(\d+(?:\s*\d+)*)/
    );
    if (overMatch) {
      minPrice = parseFloat(overMatch[1].replace(/\s+/g, ''));
    }

    let referenceItemTitle: string | undefined;
    for (const item of this.items) {
      if (lower.includes(item.title.toLowerCase())) {
        referenceItemTitle = item.title;
        break;
      }
    }

    const stopWords = new Set([
      'find', 'show', 'me', 'recommend', 'suggest', 'looking', 'for', 'something', 'like', 'similar', 'to',
      'a', 'an', 'the', 'in', 'with', 'and', 'or', 'under', 'over', 'below', 'above',
      'покажи', 'найди', 'посоветуй', 'подбери', 'что-то', 'похожее', 'на', 'для', 'до', 'дешевле', 'рублей', 'руб', 'а',
    ]);
    const keywords = lower
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));

    let type: ParsedIntent['type'] = 'search';
    if (referenceItemTitle && /(similar|like|похож|вроде|как)/.test(lower)) {
      type = 'similar';
    } else if (maxPrice !== undefined || minPrice !== undefined) {
      type = 'filter';
    } else if (/(recommend|suggest|посоветуй|подбери|порекомендуй)/.test(lower)) {
      type = 'recommend';
    }

    return {
      type,
      categoryAliases,
      maxPrice,
      minPrice,
      referenceItemTitle,
      keywords,
    };
  }

  public async respond(userMessage: string): Promise<AgentResponse> {
    const scan = SecurityGuardrails.scanAndSanitize(userMessage);
    const cleanMessage = scan.sanitizedInput || userMessage.replace(/[<>]/g, '');

    this.history.push({ role: 'user', content: cleanMessage, timestamp: Date.now() });

    const intent = this.extractIntent(cleanMessage);

    if (intent.type === 'greeting') {
      const text =
        'Привет! Я семантический NLU-агент Eidos. Опишите концепт, жанр, категорию или бюджет (например: «найди электронику для работы» или «а дешевле 15000 рублей»).';
      this.history.push({ role: 'assistant', content: text, timestamp: Date.now() });
      return { text, items: [] };
    }

    // Multi-turn context inheritance: if user refines only price ("а дешевле 15000"), keep previous category/query context
    const activeCategoryAliases = intent.categoryAliases ?? this.lastCategoryAliases;
    if (intent.categoryAliases) {
      this.lastCategoryAliases = intent.categoryAliases;
    }

    const semanticQuery =
      intent.keywords.length > 0
        ? intent.keywords.join(' ')
        : this.lastSemanticQuery || cleanMessage;
    if (intent.keywords.length > 0) {
      this.lastSemanticQuery = semanticQuery;
    }

    let candidates = [...this.items];

    if (activeCategoryAliases && activeCategoryAliases.length > 0) {
      const catFiltered = candidates.filter((item) => {
        const itemCat = item.category.toLowerCase();
        return activeCategoryAliases.some((alias) => itemCat.includes(alias));
      });
      if (catFiltered.length > 0) {
        candidates = catFiltered;
      }
    }

    if (intent.maxPrice !== undefined) {
      candidates = candidates.filter((item) => {
        const p = parseItemNumericPrice(item.price);
        return p !== null && p <= intent.maxPrice!;
      });
    }

    if (intent.minPrice !== undefined) {
      candidates = candidates.filter((item) => {
        const p = parseItemNumericPrice(item.price);
        return p !== null && p >= intent.minPrice!;
      });
    }

    if (candidates.length === 0) {
      const text = `По запросу «${cleanMessage}» не найдено позиций в заданных рамках бюджета. Попробуйте расширить ценовой диапазон.`;
      this.history.push({ role: 'assistant', content: text, timestamp: Date.now() });
      return { text, items: [] };
    }

    if (intent.type === 'similar' && intent.referenceItemTitle) {
      const refItem = this.items.find((i) => i.title === intent.referenceItemTitle);
      if (refItem && this.embeddings.has(String(refItem.id))) {
        const refVec = Array.from(this.embeddings.get(String(refItem.id))!);
        const scored = candidates
          .filter((i) => i.id !== refItem.id && this.embeddings.has(String(i.id)))
          .map((item) => ({
            item,
            score: cosineSimilarity(refVec, Array.from(this.embeddings.get(String(item.id))!)),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 4);

        const items = scored.map((s) => s.item);
        const text = `Позиции, семантически близкие к «${refItem.title}» в 384-мерном пространстве:`;
        this.history.push({
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
          recommendedItems: items,
        });
        return {
          text,
          items,
          explanation: `Ранжировано по косинусному сходству 384-d векторов к «${refItem.title}»`,
        };
      }
    }

    const queryVec = Array.from(await this.embedFn(semanticQuery));
    const scored = candidates
      .filter((i) => this.embeddings.has(String(i.id)))
      .map((item) => ({
        item,
        score: cosineSimilarity(queryVec, Array.from(this.embeddings.get(String(item.id))!)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const items = scored.map((s) => s.item);
    const filterNotes: string[] = [];
    if (activeCategoryAliases) filterNotes.push(`категория: ${activeCategoryAliases[0]}`);
    if (intent.maxPrice !== undefined) filterNotes.push(`до ${intent.maxPrice.toLocaleString('ru-RU')} ₽`);
    if (intent.minPrice !== undefined) filterNotes.push(`от ${intent.minPrice.toLocaleString('ru-RU')} ₽`);

    const text = `Найдено ${items.length} релевантных позиций по запросу «${cleanMessage}»${
      filterNotes.length ? ` (${filterNotes.join(', ')})` : ''
    }:`;
    this.history.push({
      role: 'assistant',
      content: text,
      timestamp: Date.now(),
      recommendedItems: items,
    });

    return {
      text,
      items,
      explanation: `Семантический 384-d поиск по ${candidates.length} кандидатам`,
    };
  }

  public getHistory(): AgentMessage[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
    this.lastCategoryAliases = undefined;
    this.lastSemanticQuery = '';
  }
}
