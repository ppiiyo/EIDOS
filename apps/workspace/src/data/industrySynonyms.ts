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
    stopwords: ['оригинал', 'аналог', 'артикул', 'купить'],
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
    stopwords: ['дешево', 'недорого', 'акция', 'скидка'],
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
    descriptionRu: 'Дом и ремонт: дрель ↔ шуруповерт',
    descriptionEn: 'Home improvement and office gear slang',
    stopwords: ['купить', 'дешево'],
    synonyms: {
      дрель: ['шуруповерт', 'drill'],
      лампа: ['светильник', 'lamp'],
    },
    sampleQuery: 'дрель для дома',
  },
];

const DEFAULT_PACKS: IndustrySynonymPackId[] = ['auto_parts', 'electronics', 'fashion'];
const activePackIds = new Set<IndustrySynonymPackId>(DEFAULT_PACKS);
const customSynonyms: Array<{ source: string; targets: string[] }> = [];
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
  customSynonyms.length = 0;
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
  const source = sourcePhrase.trim().toLowerCase();
  if (!source) return;
  const targets = (Array.isArray(targetTerms) ? targetTerms : [targetTerms])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!targets.length) return;
  customSynonyms.push({ source, targets });
  notify();
}

export function getCustomSynonyms(): Array<{ source: string; targets: string[] }> {
  return customSynonyms.map((c) => ({ source: c.source, targets: [...c.targets] }));
}

export function listCustomSynonyms(): Array<{ source: string; targets: string[] }> {
  return getCustomSynonyms();
}

export interface SynonymExpansionResult {
  expandedQuery: string;
  matchedSynonyms: Array<{ source: string; targets: string[] }>;
}

export function expandQueryWithSynonyms(rawQuery: string): SynonymExpansionResult {
  const tokens = rawQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set(tokens);
  const matched: Array<{ source: string; targets: string[] }> = [];

  const packs = INDUSTRY_SYNONYM_PACKS.filter((p) => activePackIds.has(p.id));
  for (const t of tokens) {
    for (const pack of packs) {
      const syns = pack.synonyms[t];
      if (syns) {
        matched.push({ source: t, targets: syns });
        for (const s of syns) out.add(s);
      }
    }
    for (const custom of customSynonyms) {
      if (custom.source === t) {
        matched.push(custom);
        for (const s of custom.targets) out.add(s);
      }
    }
  }

  return {
    expandedQuery: [...out].join(' '),
    matchedSynonyms: matched,
  };
}
