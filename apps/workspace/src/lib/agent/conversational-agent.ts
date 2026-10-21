import { cosineSimilarity, SecurityGuardrails } from "@eidos/core";
import { CatalogItem } from '../../types';
import { detectTextLanguage, SupportedLanguage } from '../../utils/recommenderEngine';

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
    triggers: [
      'электроник', 'гаджет', 'ноутбук', 'смартфон', 'наушник',
      'electronics', 'gadget', 'laptop', 'audio', 'headphones',
      'ガジェット', 'ノートpc', 'パソコン', 'ヘッドホン', 'イヤホン', 'プログラミング', 'it',
    ],
    aliases: ['электроника', 'техника', 'electronics', 'hardware', 'audio', 'ガジェット', 'プログラミング', '音楽'],
  },
  {
    triggers: ['книг', 'литератур', 'чтени', 'book', 'reading', 'novel', '本', '書籍', '文学'],
    aliases: ['книги', 'books', 'education', '映画・考察', 'プログラミング・it'],
  },
  {
    triggers: [
      'фильм', 'кино', 'сериал', 'movie', 'cinema', 'sci-fi', 'фантастик', 'documentary',
      '映画', 'ドキュメンタリー', '宇宙', '科学', '考察', '纪录片', 'película',
    ],
    aliases: ['фильмы', 'movies', 'sci-fi', 'cinema', 'thriller', 'documentary', '科学・宇宙', '映画・考察', '科学纪录片'],
  },
  {
    triggers: ['игр', 'гейм', 'game', 'gaming', 'rpg', 'ゲーム', '実況', 'サイバーパンク'],
    aliases: ['игры', 'games', 'gaming', 'anime', 'ゲーム実況', 'アニメ'],
  },
  {
    triggers: [
      'одежд', 'пальто', 'кроссовк', 'fashion', 'clothing', 'спорт', 'sport', 'running', 'marathon',
      'スポーツ', 'ランニング', 'マラソン', 'フィットネス',
    ],
    aliases: ['одежда', 'спорт', 'fashion', 'clothing', 'sport', 'スポーツ・フィットネス'],
  },
  {
    triggers: ['кофе', 'дом', 'быт', 'coffee', 'espresso', 'home', 'コーヒー', 'エスプレッソ', 'カフェ', 'vlog'],
    aliases: ['техника', 'дом', 'coffee', 'lifestyle', 'vlog・ライフスタイル'],
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

    if (
      /^(hi|hello|hey|привет|здравствуй|добрый день|こんにちは|こんばんは|はじめまして)\b/i.test(lower) &&
      lower.split(/\s+/).length <= 3
    ) {
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

    const underMatch =
      lower.match(/(?:under|below|less than|cheaper than|max|до|дешевле|меньше|не дороже)\s*[$¥]?\s*(\d+(?:\s*\d+)*)/) ||
      lower.match(/(\d+(?:\s*\d+)*)\s*(?:円|ドル|ルーブル)?\s*(?:以下|未満|以内)/);
    if (underMatch) {
      maxPrice = parseFloat(underMatch[1].replace(/\s+/g, ''));
    }

    const overMatch =
      lower.match(/(?:over|above|more than|min|от|дороже|больше)\s*[$¥]?\s*(\d+(?:\s*\d+)*)/) ||
      lower.match(/(\d+(?:\s*\d+)*)\s*(?:円|ドル|ルーブル)?\s*(?:以上|超)/);
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
      'おすすめ', '探して', '教えて', '見せて', '似た', 'みたいな',
    ]);
    const keywords = lower
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w) && !/^\d+$/.test(w));

    let type: ParsedIntent['type'] = 'search';
    if (referenceItemTitle && /(similar|like|похож|вроде|как|似た|みたい|近い)/.test(lower)) {
      type = 'similar';
    } else if (maxPrice !== undefined || minPrice !== undefined) {
      type = 'filter';
    } else if (/(recommend|suggest|посоветуй|подбери|порекомендуй|おすすめ|推薦|紹介)/.test(lower)) {
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

  private resolveLang(cleanMessage: string): SupportedLanguage {
    const msgLang = detectTextLanguage(cleanMessage);
    if (msgLang === 'ja' || msgLang === 'zh' || msgLang === 'ru') return msgLang;
    const corpusSample = this.items.slice(0, 3).map((i) => i.title).join(' ');
    const corpusLang = detectTextLanguage(corpusSample);
    if (msgLang === 'en' && /[a-z]{3,}/i.test(cleanMessage)) return 'en';
    return corpusLang;
  }

  public async respond(userMessage: string): Promise<AgentResponse> {
    const scan = SecurityGuardrails.scanAndSanitize(userMessage);
    const cleanMessage = scan.sanitizedInput || userMessage.replace(/[<>]/g, '');
    const lang = this.resolveLang(cleanMessage);

    this.history.push({ role: 'user', content: cleanMessage, timestamp: Date.now() });

    const intent = this.extractIntent(cleanMessage);

    if (intent.type === 'greeting') {
      const text =
        lang === 'ja'
          ? 'こんにちは！Eidos セマンティックNLUエージェントです。探したいテーマ、ジャンル、予算、または似たアイテム名を入力してください（例：「宇宙とブラックホールの科学動画を探して」）。'
          : lang === 'en'
          ? 'Hello! I am the Eidos Semantic NLU Agent. Describe a concept, genre, category, or budget constraint (e.g., "recommend sci-fi movies about space and time").'
          : 'Привет! Я семантический NLU-агент Eidos. Опишите концепт, жанр, категорию или бюджет (например: «найди электронику для работы» или «а дешевле 15000 рублей»).';
      this.history.push({ role: 'assistant', content: text, timestamp: Date.now() });
      return { text, items: [] };
    }

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
      const text =
        lang === 'ja'
          ? `「${cleanMessage}」に一致する条件のアイテムが見つかりませんでした。予算や条件を広げて再度お試しください。`
          : lang === 'en'
          ? `No items matched "${cleanMessage}" within the specified constraints. Try relaxing your budget or category filter.`
          : `По запросу «${cleanMessage}» не найдено позиций в заданных рамках бюджета. Попробуйте расширить ценовой диапазон.`;
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
        const text =
          lang === 'ja'
            ? `384次元ベクトル空間で「${refItem.title}」に意味的に近いアイテム：`
            : lang === 'en'
            ? `Items semantically closest to "${refItem.title}" in 384-d vector space:`
            : `Позиции, семантически близкие к «${refItem.title}» в 384-мерном пространстве:`;
        const explanation =
          lang === 'ja'
            ? `「${refItem.title}」との384次元コサイン類似度でランキング`
            : lang === 'en'
            ? `Ranked by 384-d cosine similarity to "${refItem.title}"`
            : `Ранжировано по косинусному сходству 384-d векторов к «${refItem.title}»`;
        this.history.push({
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
          recommendedItems: items,
        });
        return { text, items, explanation };
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
    if (activeCategoryAliases) {
      filterNotes.push(
        lang === 'ja'
          ? `カテゴリ: ${activeCategoryAliases[0]}`
          : lang === 'en'
          ? `category: ${activeCategoryAliases[0]}`
          : `категория: ${activeCategoryAliases[0]}`
      );
    }
    if (intent.maxPrice !== undefined) {
      filterNotes.push(
        lang === 'ja'
          ? `上限 ${intent.maxPrice.toLocaleString()}`
          : lang === 'en'
          ? `under ${intent.maxPrice.toLocaleString()}`
          : `до ${intent.maxPrice.toLocaleString('ru-RU')} ₽`
      );
    }
    if (intent.minPrice !== undefined) {
      filterNotes.push(
        lang === 'ja'
          ? `下限 ${intent.minPrice.toLocaleString()}`
          : lang === 'en'
          ? `over ${intent.minPrice.toLocaleString()}`
          : `от ${intent.minPrice.toLocaleString('ru-RU')} ₽`
      );
    }

    const noteSuffix = filterNotes.length ? ` (${filterNotes.join(', ')})` : '';
    const text =
      lang === 'ja'
        ? `「${cleanMessage}」に対して関連性の高い ${items.length} 件のアイテムを抽出しました${noteSuffix}：`
        : lang === 'en'
        ? `Found ${items.length} relevant items for "${cleanMessage}"${noteSuffix}:`
        : `Найдено ${items.length} релевантных позиций по запросу «${cleanMessage}»${noteSuffix}:`;
    const explanation =
      lang === 'ja'
        ? `${candidates.length} 件の候補から384次元セマンティック検索を実行`
        : lang === 'en'
        ? `Semantic 384-d retrieval across ${candidates.length} candidates`
        : `Семантический 384-d поиск по ${candidates.length} кандидатам`;

    this.history.push({
      role: 'assistant',
      content: text,
      timestamp: Date.now(),
      recommendedItems: items,
    });

    return { text, items, explanation };
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
