export type IndustrySynonymPackId = 'auto_parts' | 'electronics' | 'fashion' | 'diy';

export interface IndustrySynonymPack {
  id: IndustrySynonymPackId;
  icon: string;
  nameRu: string;
  nameEn: string;
  nameJa: string;
  badge: string;
  descriptionRu: string;
  descriptionEn: string;
  stopwords: string[];
  synonyms: Record<string, string[]>;
  sampleQuery: string;
}

export const INDUSTRY_SYNONYM_PACKS: IndustrySynonymPack[] = [
  {
    id: 'auto_parts',
    icon: '🚗',
    nameRu: 'Автотека и Запчасти',
    nameEn: 'Auto Parts & OEM',
    nameJa: '自動車部品・OEM',
    badge: 'Auto / OEM',
    descriptionRu: 'Сленг автосервисов и СТО: акб ↔ аккумулятор, шрус ↔ граната, грм ↔ газораспределительный механизм',
    descriptionEn: 'Automotive slang & OEM terms: battery, CV joint, timing belt, gearbox, brake pads',
    stopwords: ['оригинал', 'аналог', 'артикул', 'купить', 'пожалуйста', 'в наличии'],
    synonyms: {
      акб: ['аккумулятор', 'батарея', 'питание', 'зарядка'],
      аккум: ['аккумулятор', 'батарея', 'питание'],
      грм: ['газораспределительный', 'ремень', 'механизм', 'двигатель'],
      шрус: ['граната', 'шарнир равных угловых скоростей', 'привод'],
      граната: ['шрус', 'привод', 'шарнир'],
      двс: ['двигатель', 'мотор'],
      кпп: ['коробка передач', 'трансмиссия', 'акпп', 'мкпп'],
      колодки: ['тормозные колодки', 'тормоза', 'диски'],
      генератор: ['зарядка', 'электропитание'],
    },
    sampleQuery: 'акб и умные часы с солнечной зарядкой',
  },
  {
    id: 'electronics',
    icon: '💻',
    nameRu: 'Электроника и Гаджеты',
    nameEn: 'Consumer Electronics',
    nameJa: '家電・ガジェット',
    badge: 'Tech & Audio',
    descriptionRu: 'Разговорные сокращения: уши ↔ наушники, ноут ↔ ноутбук, клава ↔ клавиатура, моник ↔ монитор',
    descriptionEn: 'Tech shorthand: cans/buds ↔ headphones, rig/ultrabook ↔ laptop, mech ↔ keyboard',
    stopwords: ['дешево', 'недорого', 'акция', 'скидка', 'оригинал', 'купить', 'пожалуйста'],
    synonyms: {
      уши: ['наушники', 'гарнитура', 'аудио', 'sony', 'anc'],
      затычки: ['наушники', 'tws', 'беспроводные наушники', 'аудио'],
      airpods: ['беспроводные наушники', 'наушники', 'sony', 'anc', 'bluetooth'],
      ноут: ['ноутбук', 'ультрабук', 'macbook', 'компьютер'],
      макбук: ['ноутбук', 'ультрабук', 'apple', 'macbook'],
      клава: ['клавиатура', 'механическая клавиатура', 'keychron', 'периферия'],
      моник: ['монитор', 'дисплей', 'экран', 'oled'],
      смарт: ['смартфон', 'телефон', 'galaxy', 'камера'],
      мышка: ['мышь', 'беспроводная мышь', 'logitech', 'периферия'],
      superlight: ['мышь', 'клавиатура', 'гейминг', 'периферия'],
      rtx: ['игровой', 'монитор', 'ноутбук', 'cyberpunk', 'видеокарта'],
    },
    sampleQuery: 'беспроводные уши с шумоподавлением и ноут для работы',
  },
  {
    id: 'fashion',
    icon: '👟',
    nameRu: 'Fashion и Спорттовары',
    nameEn: 'Fashion & Apparel',
    nameJa: 'ファッション・スポーツ',
    badge: 'Apparel & Sport',
    descriptionRu: 'Одежда и обувь: худи ↔ толстовка, кроссы/сникеры ↔ кроссовки, лонгслив ↔ кофта',
    descriptionEn: 'Streetwear & activewear synonyms: kicks/sneakers ↔ running shoes, hoodie ↔ sweatshirt',
    stopwords: ['размер', 'цвет', 'коллекция', 'сезон', 'модный', 'купить', 'пожалуйста'],
    synonyms: {
      худи: ['толстовка', 'кофта с капюшоном', 'свитшот', 'спорт'],
      свитшот: ['толстовка', 'худи', 'джемпер'],
      кроссы: ['кроссовки', 'беговые кроссовки', 'обувь', 'бег', 'марафон'],
      сникеры: ['кроссовки', 'кеды', 'обувь', 'бег'],
      кеды: ['кроссовки', 'обувь', 'спорт'],
      пуховик: ['зимняя куртка', 'парка', 'верхняя одежда'],
      треники: ['спортивные брюки', 'джоггеры', 'фитнес'],
    },
    sampleQuery: 'легкие кроссы для марафона и бега',
  },
  {
    id: 'diy',
    icon: '🛠️',
    nameRu: 'DIY, Дом и Офис',
    nameEn: 'DIY, Home & Office',
    nameJa: 'DIY・ホーム＆オフィス',
    badge: 'DIY & Home',
    descriptionRu: 'Профессиональный сленг: болгарка ↔ углошлифовальная ушм, шурик ↔ шуруповерт, рожок ↔ кофемашина',
    descriptionEn: 'Home, barista & workshop terms: angle grinder, cordless drill, ergonomic chair, espresso maker',
    stopwords: ['доставка', 'сборка', 'гарантия', 'оптом', 'купить', 'пожалуйста'],
    synonyms: {
      болгарка: ['ушм', 'углошлифовальная', 'угловая шлифовальная машина', 'инструмент'],
      шурик: ['шуруповерт', 'дрель', 'аккумуляторный инструмент'],
      перф: ['перфоратор', 'бурение', 'ремонт'],
      рожок: ['кофемашина', 'рожковая кофемашина', 'эспрессо', 'бариста', 'кофе'],
      капучинатор: ['кофемашина', 'капучино', 'латте', 'кофе'],
      табурет: ['кресло', 'стул', 'офисное кресло', 'мебель'],
      кресло: ['эргономичное кресло', 'офис', 'мебель', 'работа'],
    },
    sampleQuery: 'рожок для утреннего эспрессо и удобное кресло в офис',
  },
];

const DEFAULT_PACKS: IndustrySynonymPackId[] = ['auto_parts', 'electronics', 'fashion'];
const activePackIds = new Set<IndustrySynonymPackId>(DEFAULT_PACKS);

const customSynonymsMap = new Map<string, string[]>([
  ['airpods pro max ultra', ['наушники', 'беспроводные наушники', 'sony', 'anc']],
]);

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) {
    fn();
  }
}

export function subscribeSynonyms(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetSynonymsToDefault(): void {
  activePackIds.clear();
  for (const p of DEFAULT_PACKS) {
    activePackIds.add(p);
  }
  customSynonymsMap.clear();
  customSynonymsMap.set('airpods pro max ultra', ['наушники', 'беспроводные наушники', 'sony', 'anc']);
  notifyListeners();
}

export function getActiveSynonymPacks(): IndustrySynonymPackId[] {
  return Array.from(activePackIds);
}

export function toggleSynonymPack(packId: IndustrySynonymPackId): boolean {
  if (activePackIds.has(packId)) {
    activePackIds.delete(packId);
  } else {
    activePackIds.add(packId);
  }
  notifyListeners();
  return activePackIds.has(packId);
}

export function addCustomSynonym(sourcePhrase: string, targetTerms: string | string[]): void {
  const cleanSource = sourcePhrase.trim().toLowerCase();
  if (!cleanSource) return;
  const targets = (Array.isArray(targetTerms) ? targetTerms : targetTerms.split(/[,;]+/))
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (targets.length === 0) return;
  customSynonymsMap.set(cleanSource, targets);
  notifyListeners();
}

export function getCustomSynonyms(): Array<{ source: string; targets: string[] }> {
  return Array.from(customSynonymsMap.entries()).map(([source, targets]) => ({
    source,
    targets,
  }));
}

export interface SynonymExpansionResult {
  originalQuery: string;
  expandedQuery: string;
  matchedSynonyms: Array<{ from: string; to: string[]; packId: string }>;
  removedStopwords: string[];
}

export function expandQueryWithSynonyms(rawQuery: string): SynonymExpansionResult {
  const trimmed = (rawQuery || '').trim();
  if (!trimmed) {
    return {
      originalQuery: rawQuery,
      expandedQuery: '',
      matchedSynonyms: [],
      removedStopwords: [],
    };
  }

  const lower = trimmed.toLowerCase();
  const matchedSynonyms: Array<{ from: string; to: string[]; packId: string }> = [];
  const extraTokens = new Set<string>();
  const removedStopwords: string[] = [];

  for (const [source, targets] of customSynonymsMap.entries()) {
    if (lower.includes(source)) {
      matchedSynonyms.push({ from: source, to: targets, packId: 'custom' });
      for (const t of targets) {
        extraTokens.add(t);
      }
    }
  }

  const tokens = lower.split(/[\s,_\-—"«»'().:;!?]+/).filter(Boolean);
  for (const pack of INDUSTRY_SYNONYM_PACKS) {
    if (!activePackIds.has(pack.id)) continue;

    for (const sw of pack.stopwords) {
      if (tokens.includes(sw) && !removedStopwords.includes(sw)) {
        removedStopwords.push(sw);
      }
    }

    for (const tok of tokens) {
      const mapped = pack.synonyms[tok];
      if (mapped && mapped.length > 0) {
        matchedSynonyms.push({ from: tok, to: mapped, packId: pack.id });
        for (const target of mapped) {
          extraTokens.add(target);
        }
      }
    }
  }

  const expansionTail = Array.from(extraTokens)
    .filter((t) => !lower.includes(t))
    .join(' ');

  const expandedQuery = expansionTail ? `${trimmed} ${expansionTail}` : trimmed;

  return {
    originalQuery: rawQuery,
    expandedQuery,
    matchedSynonyms,
    removedStopwords,
  };
}
