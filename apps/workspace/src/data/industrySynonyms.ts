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
    descriptionRu: 'Сленг автосервисов и СТО: акб ↔ аккумулятор, шрус ↔ граната',
    descriptionEn: 'Automotive slang & OEM terms: battery, CV joint, timing belt',
    stopwords: ['оригинал', 'аналог', 'артикул', 'купить', 'пожалуйста', 'в наличии'],
    synonyms: {
      акб: ['аккумулятор', 'батарея', 'питание', 'зарядка'],
      аккум: ['аккумулятор', 'батарея', 'питание'],
      грм: ['газораспределительный', 'ремень', 'механизм', 'двигатель'],
      шрус: ['граната', 'привод'],
      граната: ['шрус', 'привод'],
      двс: ['двигатель', 'мотор'],
      кпп: ['коробка передач', 'трансмиссия'],
      колодки: ['тормозные колодки', 'тормоза', 'диски'],
    },
    sampleQuery: 'акб и умные часы',
  },
  {
    id: 'electronics',
    icon: '💻',
    nameRu: 'Электроника и Гаджеты',
    nameEn: 'Consumer Electronics',
    nameJa: '家電・ガジェット',
    badge: 'Tech & Audio',
    descriptionRu: 'Разговорные сокращения: уши ↔ наушники, ноут ↔ ноутбук',
    descriptionEn: 'Tech shorthand: buds ↔ headphones, rig ↔ laptop',
    stopwords: ['дешево', 'недорого', 'акция', 'скидка', 'купить', 'пожалуйста'],
    synonyms: {
      уши: ['наушники', 'гарнитура', 'аудио', 'sony', 'anc'],
      затычки: ['наушники', 'tws', 'беспроводные наушники'],
      airpods: ['беспроводные наушники', 'наушники', 'bluetooth'],
      ноут: ['ноутбук', 'ультрабук', 'macbook', 'компьютер'],
      макбук: ['ноутбук', 'ультрабук', 'apple', 'macbook'],
      клава: ['клавиатура', 'механическая клавиатура'],
      моник: ['монитор', 'дисплей', 'экран'],
      смарт: ['смартфон', 'телефон', 'galaxy'],
      мышка: ['мышь', 'беспроводная мышь'],
    },
    sampleQuery: 'уши с шумоподавлением',
  },
  {
    id: 'fashion',
    icon: '👟',
    nameRu: 'Fashion и Спорттовары',
    nameEn: 'Fashion & Sport',
    nameJa: 'ファッション・スポーツ',
    badge: 'Fashion',
    descriptionRu: 'Спорт и обувь: кроссы ↔ кроссовки',
    descriptionEn: 'Sneakers, running gear, apparel slang',
    stopwords: ['размер', 'цвет', 'купить'],
    synonyms: {
      кроссы: ['кроссовки', 'sneakers', 'running'],
      sneakers: ['кроссовки', 'беговые'],
      кеды: ['кеды', 'keds'],
    },
    sampleQuery: 'кроссы для бега',
  },
  {
    id: 'diy',
    icon: '🛠️',
    nameRu: 'DIY, Дом и Офис',
    nameEn: 'DIY Home & Office',
    nameJa: 'DIY・家庭・オフィス',
    badge: 'DIY',
    descriptionRu: 'Дом и ремонт: дрель ↔ шуруповерт, шурик ↔ шуруповерт',
    descriptionEn: 'Home improvement and office gear slang',
    stopwords: ['купить', 'дешево'],
    synonyms: {
      дрель: ['шуруповерт', 'drill'],
      шурик: ['шуруповерт', 'дрель', 'drill'],
      болгарка: ['углошлифовальная', 'машина', 'ушм'],
      лампа: ['светильник', 'lamp'],
    },
    sampleQuery: 'шурик и болгарка',
  },
];

const DEFAULT_PACKS: IndustrySynonymPackId[] = ['auto_parts', 'electronics', 'fashion'];
const activePackIds = new Set<IndustrySynonymPackId>(DEFAULT_PACKS);
const customSynonymsMap = new Map<string, string[]>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeSynonyms(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetSynonymsToDefault(): void {
  activePackIds.clear();
  for (const id of DEFAULT_PACKS) activePackIds.add(id);
  customSynonymsMap.clear();
  notify();
}

export function getActiveSynonymPacks(): IndustrySynonymPackId[] {
  return [...activePackIds];
}

export function toggleSynonymPack(packId: IndustrySynonymPackId): boolean {
  if (activePackIds.has(packId)) activePackIds.delete(packId);
  else activePackIds.add(packId);
  notify();
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
  notify();
}

export function getCustomSynonyms(): Array<{ source: string; targets: string[] }> {
  return Array.from(customSynonymsMap.entries()).map(([source, targets]) => ({
    source,
    targets: [...targets],
  }));
}

export function listCustomSynonyms(): Array<{ source: string; targets: string[] }> {
  return getCustomSynonyms();
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
      for (const t of targets) extraTokens.add(t);
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
        for (const target of mapped) extraTokens.add(target);
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
