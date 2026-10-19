/**
 * Rule-based Conversational Agent поверх @kostra44sip/core.
 * Без LLM. Использует реальный векторный поиск и векторный сдвиг.
 */
import { CatalogItem } from '../../types';

export interface AgentTurn {
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
}

export interface AgentResponse {
  text: string;
  items: CatalogItem[];
  explanation?: string;
}

// ── Простой NLU: извлечение интентов и сущностей ───────────────────────────

type Intent = 'search' | 'similar' | 'cheaper' | 'expensive'
            | 'category' | 'modify' | 'help' | 'unknown';

interface ParsedQuery {
  intent: Intent;
  keywords: string[];
  priceConstraint?: { op: 'lt' | 'gt' | 'eq'; value: number };
  category?: string;
}

const INTENT_RULES: { intent: Intent; patterns: RegExp[] }[] = [
  { intent: 'cheaper',   patterns: [/дешевле|дешёв|бюджет|до (\d+)/i] },
  { intent: 'expensive', patterns: [/дороже|премиум|люкс|от (\d+)/i] },
  { intent: 'similar',   patterns: [/похож|как этот|аналог|подобн|похожие на (.+)/i] },
  { intent: 'category',  patterns: [/категори|раздел|покажи (все )?(.+)/i] },
  { intent: 'modify',    patterns: [/но |как .+ но|более|менее|строже|темнее|светлее/i] },
  { intent: 'help',      patterns: [/помощь|что ты|как работает|что умеешь/i] },
  { intent: 'search',    patterns: [/найди|покажи|ищу|хочу|нужен|нужна|подбери/i] },
];

export function parseQuery(raw: string): ParsedQuery {
  const q = raw.trim().toLowerCase();
  let intent: Intent = 'search';

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some(p => p.test(q))) { intent = rule.intent; break; }
  }

  // Извлечение цены
  const priceMatch = q.match(/(?:до|дешевле|бюджет)\s*(\d[\d\s]*)/);
  const priceConstraint = priceMatch
    ? { op: 'lt' as const, value: parseInt(priceMatch[1].replace(/\s/g,''), 10) }
    : undefined;

  // Ключевые слова (убираем стоп-слова)
  const stopWords = new Set(['найди','покажи','ищу','хочу','нужен','нужна',
    'как','но','более','менее','похожие','похож','на','все','мне','подбери',
    'что','есть','какие','где','как','это','этот','эта','эти']);
  const keywords = q
    .replace(/[^a-zа-яё0-9\s]/gi, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return { intent, keywords, priceConstraint };
}

// ── Основной агент ─────────────────────────────────────────────────────────

export class ConversationalAgent {
  private history: AgentTurn[] = [];
  private lastResults: CatalogItem[] = [];
  private maxHistory = 20;

  constructor(
    private catalog: CatalogItem[],
    private searchFn: (query: string, limit?: number) => Promise<CatalogItem[]>,
  ) {}

  /** Обновить каталог (например после добавления товара) */
  setCatalog(catalog: CatalogItem[]) {
    this.catalog = catalog;
  }

  getHistory(): AgentTurn[] { return [...this.history]; }
  clearHistory() { this.history = []; this.lastResults = []; }

  async respond(raw: string): Promise<AgentResponse> {
    const parsed = parseQuery(raw);
    this.addTurn('user', raw);

    let response: AgentResponse;

    switch (parsed.intent) {
      case 'help':
        response = this.helpResponse(); break;
      case 'cheaper':
        response = this.filterByPrice(parsed, 'lt'); break;
      case 'expensive':
        response = this.filterByPrice(parsed, 'gt'); break;
      case 'similar':
        response = await this.similarItems(raw, parsed); break;
      case 'modify':
        response = await this.modifyLastResults(raw, parsed); break;
      case 'category':
        response = this.filterByCategory(parsed); break;
      case 'search':
      default:
        response = await this.searchItems(raw, parsed); break;
    }

    this.lastResults = response.items;
    this.addTurn('agent', response.text);
    return response;
  }

  private addTurn(role: AgentTurn['role'], text: string) {
    this.history.push({ role, text, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  // ── Реализации интентов ──────────────────────────────────────────────────

  private helpResponse(): AgentResponse {
    return {
      text: 'Я могу: искать товары по смыслу, находить похожие, фильтровать по цене и категории. Попробуйте: «найди механическую клавиатуру до 10000».',
      items: [],
    };
  }

  private async searchItems(raw: string, parsed: ParsedQuery): Promise<AgentResponse> {
    const items = await this.searchFn(raw, 10);
    const filtered = this.applyPriceFilter(items, parsed.priceConstraint);

    if (filtered.length === 0) {
      return {
        text: `По запросу «${raw}» ничего не найдено${parsed.priceConstraint ? ` в ценовом диапазоне до ${parsed.priceConstraint.value}` : ''}. Попробуйте переформулировать.`,
        items: [],
      };
    }

    return {
      text: `Нашёл ${filtered.length} товар(ов) по запросу «${raw}»:`,
      items: filtered,
      explanation: 'Семантический поиск по векторным эмбеддингам',
    };
  }

  private async similarItems(raw: string, parsed: ParsedQuery): Promise<AgentResponse> {
    // Берём первый результат из последнего поиска как базу
    const base = this.lastResults[0] ?? this.catalog[0];
    if (!base) return { text: 'Каталог пуст.', items: [] };

    const items = await this.searchFn(base.title, 10);
    const filtered = items
      .filter(i => i.id !== base.id)
      .slice(0, 6);

    return {
      text: `Похожие на «${base.title}»:`,
      items: filtered,
      explanation: `Векторная близость к «${base.title}»`,
    };
  }

  private async modifyLastResults(raw: string, parsed: ParsedQuery): Promise<AgentResponse> {
    // Повторный поиск с уточнённым запросом
    const items = await this.searchFn(raw, 8);
    return {
      text: `Уточнённые результаты:`,
      items,
      explanation: 'Запрос переформулирован с учётом модификаторов',
    };
  }

  private parseNumericPrice(priceStr?: string | number): number {
    if (typeof priceStr === 'number') return priceStr;
    if (!priceStr) return 0;
    const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  private filterByPrice(parsed: ParsedQuery, op: 'lt'|'gt'): AgentResponse {
    const value = parsed.priceConstraint?.value ?? (op === 'lt' ? 1000 : 5000);
    const constraint = { op, value };
    const items = this.applyPriceFilter(
      this.lastResults.length > 0 ? this.lastResults : this.catalog,
      constraint,
    );
    const label = op === 'lt' ? `дешевле ${value}` : `дороже ${value}`;
    return {
      text: items.length > 0
        ? `Нашёл ${items.length} товар(ов) ${label}:`
        : `Нет товаров ${label}.`,
      items,
      explanation: `Фильтр: цена ${op === 'lt' ? '<' : '>'} ${value}`,
    };
  }

  private filterByCategory(parsed: ParsedQuery): AgentResponse {
    const keyword = parsed.keywords.find(k =>
      this.catalog.some(i => i.category.toLowerCase().includes(k))
    );
    if (!keyword) return { text: 'Не удалось определить категорию.', items: [] };

    const items = this.catalog.filter(i =>
      i.category.toLowerCase().includes(keyword)
    );
    return {
      text: `Товары в категории «${keyword}»:`,
      items,
      explanation: `Фильтр по категории: ${keyword}`,
    };
  }

  private applyPriceFilter(
    items: CatalogItem[],
    constraint?: { op: string; value: number },
  ): CatalogItem[] {
    if (!constraint) return items;
    return items.filter(i => {
      const p = this.parseNumericPrice(i.price);
      return constraint.op === 'lt' ? p <= constraint.value
        : constraint.op === 'gt' ? p >= constraint.value
        : true;
    });
  }
}
