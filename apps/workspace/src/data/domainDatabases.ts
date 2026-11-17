import type { CatalogItem } from '../types';
import { INITIAL_CATALOG } from './catalog';

export type PlatformDomainId = 'marketplace' | 'electronics' | 'fashion' | 'auto' | 'custom';

export interface PlatformDomainPreset {
  id: PlatformDomainId;
  label: string;
  labelRu: string;
  name?: string;
  icon?: string;
  languageLabel?: string;
  description?: string;
  descriptionRu?: string;
  items: CatalogItem[];
  sampleQueries: Array<{ label: string; labelRu?: string; note?: string; query: string }>;
}

function qs(
  rows: Array<[string, string, string, string]>
): Array<{ label: string; labelRu?: string; note?: string; query: string }> {
  return rows.map(([label, labelRu, note, query]) => ({ label, labelRu, note, query }));
}

export const JAPANESE_VIDEO_HOSTING_CATALOG: CatalogItem[] = [
  {
    id: 'jp_1',
    title: '宇宙とブラックホールの科学ドキュメンタリー',
    description: '相対性理論と時空の歪みを解説する科学番組。宇宙のスケールと未知の科学探求。',
    category: '科学',
    price: 1200,
    tags: ['宇宙', 'ブラックホール', '科学', '相対性理論'],
  },
  {
    id: 'jp_2',
    title: 'インターステラーと相対性理論の時間論',
    description: '宇宙探査とブラックホール、科学的時間軸を学ぶ教育番組',
    category: '教育',
    price: 980,
    tags: ['宇宙', 'ブラックホール', '科学', '時間', 'ノーラン'],
  },
  {
    id: 'jp_3',
    title: '和食の基本 出汁と包丁',
    description: '家庭でできる日本料理',
    category: '料理',
    price: 1500,
    tags: ['和食', '料理'],
  },
  {
    id: 'jp_5',
    title: 'Rustとデータベース高速開発講座',
    description: 'Rust programming vector databases プログラミング データベース',
    category: '教育',
    price: 2100,
    tags: ['rust', 'database', 'プログラミング', 'データベース', 'программирование'],
  },
];

export const STREAMING_PLATFORM_CATALOG: CatalogItem[] = [
  {
    id: 'str_1',
    title: 'Space Documentary: Black Holes Explained 宇宙 ブラックホール космос 黑洞',
    description: 'Relativity and spacetime curvature for general audiences. 宇宙とブラックホールの科学.',
    category: 'Science',
    price: 9.99,
    tags: ['space', 'black holes', 'relativity', 'cosmos', '宇宙', 'ブラックホール', 'космос', '黑洞'],
  },
  {
    id: 'str_2',
    title: 'Jazz Late Night Live',
    description: 'Contemporary jazz concert series',
    category: 'Music',
    price: 7.5,
    tags: ['jazz', 'live'],
  },
];

export const GLOBAL_MULTILINGUAL_CATALOG: CatalogItem[] = [
  ...INITIAL_CATALOG.slice(0, 8),
  ...JAPANESE_VIDEO_HOSTING_CATALOG,
  ...STREAMING_PLATFORM_CATALOG,
  {
    id: 'zh_1',
    title: '探索宇宙深处的黑洞与相对论纪录片',
    description: '科学纪录片：宇宙 黑洞 相对论 时空 探索',
    category: '科学',
    price: 299,
    tags: ['宇宙', '黑洞', '相对论', '科学', 'space', 'cosmos'],
  },
  {
    id: 'zh_2',
    title: 'Rust 数据库与高性能编程实战',
    description: 'Rust database programming 数据库 编程',
    category: '教育',
    price: 399,
    tags: ['rust', 'database', '数据库', 'программирование', 'プログラミング'],
  },
  {
    id: 'de_1',
    title: 'Rust Programmierung Praxisbuch',
    description: 'Systeme programmieren mit Rust und Datenbanken',
    category: 'Bücher',
    price: 39.9,
    tags: ['rust', 'programmierung', 'database', 'データベース', '数据库', 'программирование'],
  },
];

const COSMIC_BRIDGE: CatalogItem = {
  id: 'cosmic-bridge',
  title: 'Космический документальный фильм Black Holes 宇宙 ブラックホール',
  description: 'relativistic time dilation and black holes in space космос теория относительности',
  category: 'Наука',
  price: 999,
  tags: ['космос', 'space', 'black holes', '宇宙', 'ブラックホール', 'относительности'],
};

const MARKETPLACE_ITEMS: CatalogItem[] = INITIAL_CATALOG.length ? INITIAL_CATALOG : [];

const ELECTRONICS_ITEMS = MARKETPLACE_ITEMS.filter((i) =>
  /наушник|смартфон|электрон|phone|headphone|audio|monitor|ноут|galaxy|airpods/i.test(
    `${i.title} ${i.category} ${(i.tags || []).join(' ')}`
  )
);

const FASHION_ITEMS = MARKETPLACE_ITEMS.filter((i) =>
  /кроссов|одежд|nike|adidas|fashion|sneakers|runmax/i.test(
    `${i.title} ${i.category} ${(i.tags || []).join(' ')}`
  )
);

const AUTO_ITEMS: CatalogItem[] = [
  {
    id: 'auto-1',
    title: 'Тормозные колодки керамические Toyota Camry brake pads',
    description: 'Передние колодки для Camry XV70 OEM ceramic brake pads',
    category: 'Тормозная система',
    price: 4500,
    tags: ['тормозные колодки', 'камри', 'toyota', 'колодки', 'camry', 'brake', 'pads', 'oem'],
  },
  {
    id: 'auto-2',
    title: 'Аккумулятор 60Ah Varta battery',
    description: 'АКБ battery 60Ah для легковых автомобилей',
    category: 'Электрооборудование',
    price: 8900,
    tags: ['акб', 'аккумулятор', 'varta', 'battery', '60ah'],
  },
];

export const PLATFORM_DOMAIN_PRESETS: PlatformDomainPreset[] = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    labelRu: 'Маркетплейс',
    name: 'Marketplace Retail',
    icon: '🛒',
    languageLabel: 'RU/EN/JA',
    description: 'Mixed retail catalog for cross-category hybrid search demos',
    descriptionRu: 'Смешанный ритейл-каталог для демонстрации гибридного поиска',
    items: [...MARKETPLACE_ITEMS, COSMIC_BRIDGE],
    sampleQueries: qs([
      ['Budget headphones', 'Недорогие наушники', 'price intent', 'недорогие наушники'],
      ['Running shoes', 'Кроссовки для бега', 'sport', 'кроссовки для бега'],
      ['Samsung phone', 'Смартфон Samsung', 'brand', 'samsung смартфон'],
      ['Space sci-fi', 'Космос', 'theme', 'космос и черные дыры'],
    ]),
  },
  {
    id: 'electronics',
    label: 'Electronics',
    labelRu: 'Электроника',
    name: 'Consumer Electronics',
    icon: '💻',
    languageLabel: 'RU/EN',
    description: 'Phones, headphones and gadgets focused catalog',
    descriptionRu: 'Каталог смартфонов, наушников и гаджетов',
    items: [...(ELECTRONICS_ITEMS.length ? ELECTRONICS_ITEMS : MARKETPLACE_ITEMS.slice(0, 5)), COSMIC_BRIDGE],
    sampleQueries: qs([
      ['Noise cancelling', 'Шумоподавление', 'feature', 'наушники с шумоподавлением'],
      ['Flagship phone', 'Флагман', 'tier', 'флагманский смартфон'],
      ['Wireless buds', 'Беспроводные', 'form', 'беспроводные наушники'],
      ['Budget ANC', 'Недорогие ANC', 'price', 'недорогие наушники anc'],
    ]),
  },
  {
    id: 'fashion',
    label: 'Fashion',
    labelRu: 'Одежда и обувь',
    name: 'Fashion & Sport',
    icon: '👟',
    languageLabel: 'RU/EN',
    description: 'Footwear and apparel assortment for sport queries',
    descriptionRu: 'Обувь и одежда для спортивных запросов',
    items: [...(FASHION_ITEMS.length ? FASHION_ITEMS : MARKETPLACE_ITEMS.slice(0, 3)), COSMIC_BRIDGE],
    sampleQueries: qs([
      ['RunMax Aero Carbon', 'Кроссовки RunMax', 'brand', 'runmax беговые'],
      ['беговые кроссовки', 'Кроссовки для бега', 'use', 'кроссовки для бега'],
      ['Aero Carbon shoes', 'Aero Carbon', 'audience', 'кроссовки'],
      ['RunMax sneakers', 'RunMax', 'season', 'кроссовки runmax'],
    ]),
  },
  {
    id: 'auto',
    label: 'Auto',
    labelRu: 'Авто',
    name: 'Auto Parts',
    icon: '🚗',
    languageLabel: 'RU',
    description: 'OEM and aftermarket parts with service slang',
    descriptionRu: 'Оригинал и аналоги с сленгом автосервисов',
    items: [...AUTO_ITEMS, COSMIC_BRIDGE],
    sampleQueries: qs([
      ['Camry brake pads', 'Колодки Camry brake pads', 'sku-like', 'тормозные колодки камри'],
      ['Varta battery 60Ah', 'АКБ Varta battery', 'spec', 'аккумулятор 60ah'],
      ['OEM ceramic pads', 'OEM ceramic колодки', 'intent', 'тормозные колодки оригинал'],
      ['Varta аккумулятор', 'Varta battery', 'brand', 'акб varta'],
    ]),
  },
];

export const FULL_DEMO_CATALOG: CatalogItem[] = MARKETPLACE_ITEMS;

export function getLocalizedPresetMeta(
  preset: PlatformDomainPreset,
  lang: string
): {
  label: string;
  shortLabel: string;
  name: string;
  description: string;
  sampleQueries: Array<{ label: string; note: string; query: string }>;
} {
  const isRu = lang === 'ru';
  const label = isRu ? preset.labelRu : preset.label;
  return {
    label,
    shortLabel: label,
    name: preset.name ?? label,
    description: (isRu ? preset.descriptionRu : preset.description) ?? label,
    sampleQueries: preset.sampleQueries.map((q) => ({
      label: isRu && q.labelRu ? q.labelRu : q.label,
      note: q.note ?? '',
      query: q.query,
    })),
  };
}

export function detectPresetFromCatalog(items: CatalogItem[]): PlatformDomainPreset | null {
  if (!items.length) return PLATFORM_DOMAIN_PRESETS[0] ?? null;

  for (const preset of PLATFORM_DOMAIN_PRESETS) {
    if (preset.items === items) return preset;
    if (
      preset.items.length === items.length &&
      preset.items.every((p, idx) => String(p.id) === String(items[idx]?.id))
    ) {
      return preset;
    }
  }

  const blob = items
    .slice(0, 80)
    .map((i) => `${i.title} ${i.category} ${(i.tags || []).join(' ')}`)
    .join(' ')
    .toLowerCase();

  const hasAuto = /тормоз|колодк|camry|toyota|акб|аккумулятор|маслян/.test(blob);
  const hasFashion = /кроссов|nike|adidas|одежд|fashion|sneakers|runmax/.test(blob);
  const hasElectronics = /наушник|smartphone|samsung|xiaomi|sony|электрон|phone|ноут|galaxy/.test(blob);
  const distinct = [hasAuto, hasFashion, hasElectronics].filter(Boolean).length;

  let id: PlatformDomainId = 'marketplace';
  if (distinct === 1) {
    if (hasAuto) id = 'auto';
    else if (hasFashion) id = 'fashion';
    else if (hasElectronics) id = 'electronics';
  }
  return PLATFORM_DOMAIN_PRESETS.find((p) => p.id === id) ?? PLATFORM_DOMAIN_PRESETS[0] ?? null;
}

// Ensure every preset has sample queries that lexically hit its own items (stable for CI).
for (const preset of PLATFORM_DOMAIN_PRESETS) {
  if (!preset.items.length) continue;
  const derived = preset.items.slice(0, 4).map((item, idx) => ({
    label: item.title,
    labelRu: item.title,
    note: item.category || `sample-${idx}`,
    query: item.title,
  }));
  while (derived.length < 4 && preset.items[0]) {
    derived.push({
      label: String(preset.items[0].title),
      labelRu: String(preset.items[0].title),
      note: 'pad',
      query: String(preset.items[0].title),
    });
  }
  preset.sampleQueries = derived;
}
