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
    title: '\u5b87\u5b99\u3068\u30d6\u30e9\u30c3\u30af\u30db\u30fc\u30eb\u306e\u79d1\u5b66\u30c9\u30ad\u30e5\u30e1\u30f3\u30bf\u30ea\u30fc',
    description: '\u76f8\u5bfe\u6027\u7406\u8ad6\u3068\u6642\u7a7a\u306e\u6b6a\u307f\u3092\u89e3\u8aac\u3059\u308b\u79d1\u5b66\u756a\u7d44',
    category: '\u79d1\u5b66',
    price: 1200,
    tags: ['\u5b87\u5b99', '\u30d6\u30e9\u30c3\u30af\u30db\u30fc\u30eb', '\u79d1\u5b66', '\u76f8\u5bfe\u6027\u7406\u8ad6'],
  },
  {
    id: 'jp_2',
    title: '\u30d7\u30ed\u30b0\u30e9\u30df\u30f3\u30b0\u5165\u9580 TypeScript',
    description: '\u521d\u5fc3\u8005\u5411\u3051\u30b3\u30fc\u30c7\u30a3\u30f3\u30b0\u8b1b\u5ea7',
    category: '\u6559\u80b2',
    price: 980,
    tags: ['\u30d7\u30ed\u30b0\u30e9\u30df\u30f3\u30b0', 'TypeScript'],
  },
  {
    id: 'jp_3',
    title: '\u548c\u98df\u306e\u57fa\u672c \u51fa\u6c41\u3068\u5305\u4e01',
    description: '\u5bb6\u5ead\u3067\u3067\u304d\u308b\u65e5\u672c\u6599\u7406',
    category: '\u6599\u7406',
    price: 1500,
    tags: ['\u548c\u98df', '\u6599\u7406'],
  },
];

export const STREAMING_PLATFORM_CATALOG: CatalogItem[] = [
  {
    id: 'str_1',
    title: 'Space Documentary: Black Holes Explained',
    description: 'Relativity and spacetime curvature for general audiences',
    category: 'Science',
    price: 9.99,
    tags: ['space', 'black holes', 'relativity'],
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
  ...INITIAL_CATALOG.slice(0, 5),
  ...JAPANESE_VIDEO_HOSTING_CATALOG,
  ...STREAMING_PLATFORM_CATALOG,
  {
    id: 'zh_1',
    title: '\u65e0\u7ebf\u964d\u566a\u8033\u673a',
    description: '\u8fd0\u52a8\u84dd\u7259\u8033\u673a \u964d\u566a',
    category: '\u7535\u5b50\u4ea7\u54c1',
    price: 299,
    tags: ['\u8033\u673a', '\u84dd\u7259', '\u964d\u566a'],
  },
  {
    id: 'de_1',
    title: 'Rust Programmierung Praxisbuch',
    description: 'Systeme programmieren mit Rust',
    category: 'B\u00fccher',
    price: 39.9,
    tags: ['rust', 'programmierung'],
  },
];

const MARKETPLACE_ITEMS: CatalogItem[] = INITIAL_CATALOG.length
  ? INITIAL_CATALOG
  : [
      {
        id: '1',
        title: 'Sony WH-1000XM5',
        description: '\u0411\u0435\u0441\u043f\u0440\u043e\u0432\u043e\u0434\u043d\u044b\u0435 \u043d\u0430\u0443\u0448\u043d\u0438\u043a\u0438 \u0441 \u0448\u0443\u043c\u043e\u043f\u043e\u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435\u043c',
        category: '\u041d\u0430\u0443\u0448\u043d\u0438\u043a\u0438',
        price: 29990,
        tags: ['sony', 'anc', '\u043d\u0430\u0443\u0448\u043d\u0438\u043a\u0438'],
      },
      {
        id: '2',
        title: 'Nike Pegasus 40',
        description: '\u0411\u0435\u0433\u043e\u0432\u044b\u0435 \u043a\u0440\u043e\u0441\u0441\u043e\u0432\u043a\u0438',
        category: '\u041a\u0440\u043e\u0441\u0441\u043e\u0432\u043a\u0438',
        price: 12990,
        tags: ['nike', '\u0431\u0435\u0433'],
      },
      {
        id: '3',
        title: 'Samsung Galaxy S24',
        description: '\u0424\u043b\u0430\u0433\u043c\u0430\u043d\u0441\u043a\u0438\u0439 \u0441\u043c\u0430\u0440\u0442\u0444\u043e\u043d',
        category: '\u0421\u043c\u0430\u0440\u0442\u0444\u043e\u043d\u044b',
        price: 79990,
        tags: ['samsung', 'android'],
      },
    ];

const ELECTRONICS_ITEMS = MARKETPLACE_ITEMS.filter((i) =>
  /\u043d\u0430\u0443\u0448\u043d\u0438\u043a|\u0441\u043c\u0430\u0440\u0442\u0444\u043e\u043d|\u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d|phone|headphone|audio|monitor|\u043d\u043e\u0443\u0442/i.test(
    `${i.title} ${i.category} ${(i.tags || []).join(' ')}`
  )
);

const FASHION_ITEMS = MARKETPLACE_ITEMS.filter((i) =>
  /\u043a\u0440\u043e\u0441\u0441\u043e\u0432|\u043e\u0434\u0435\u0436\u0434|nike|adidas|fashion|sneakers/i.test(
    `${i.title} ${i.category} ${(i.tags || []).join(' ')}`
  )
);

const AUTO_ITEMS: CatalogItem[] = [
  {
    id: 'auto-1',
    title: '\u0422\u043e\u0440\u043c\u043e\u0437\u043d\u044b\u0435 \u043a\u043e\u043b\u043e\u0434\u043a\u0438 \u043a\u0435\u0440\u0430\u043c\u0438\u0447\u0435\u0441\u043a\u0438\u0435 Toyota Camry',
    description: '\u041f\u0435\u0440\u0435\u0434\u043d\u0438\u0435 \u043a\u043e\u043b\u043e\u0434\u043a\u0438 \u0434\u043b\u044f Camry XV70',
    category: '\u0422\u043e\u0440\u043c\u043e\u0437\u043d\u0430\u044f \u0441\u0438\u0441\u0442\u0435\u043c\u0430',
    price: 4500,
    tags: ['\u0442\u043e\u0440\u043c\u043e\u0437\u043d\u044b\u0435 \u043a\u043e\u043b\u043e\u0434\u043a\u0438', '\u043a\u0430\u043c\u0440\u0438', 'toyota', '\u043a\u043e\u043b\u043e\u0434\u043a\u0438'],
  },
  {
    id: 'auto-2',
    title: '\u0410\u043a\u043a\u0443\u043c\u0443\u043b\u044f\u0442\u043e\u0440 60Ah Varta',
    description: '\u0410\u041a\u0411 \u0434\u043b\u044f \u043b\u0435\u0433\u043a\u043e\u0432\u044b\u0445 \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u0435\u0439',
    category: '\u042d\u043b\u0435\u043a\u0442\u0440\u043e\u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435',
    price: 8900,
    tags: ['\u0430\u043a\u0431', '\u0430\u043a\u043a\u0443\u043c\u0443\u043b\u044f\u0442\u043e\u0440', 'varta'],
  },
];

export const PLATFORM_DOMAIN_PRESETS: PlatformDomainPreset[] = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    labelRu: '\u041c\u0430\u0440\u043a\u0435\u0442\u043f\u043b\u0435\u0439\u0441',
    name: 'Marketplace Retail',
    icon: '\ud83d\uded2',
    languageLabel: 'RU/EN/JA',
    description: 'Mixed retail catalog for cross-category hybrid search demos',
    descriptionRu: '\u0421\u043c\u0435\u0448\u0430\u043d\u043d\u044b\u0439 \u0440\u0438\u0442\u0435\u0439\u043b-\u043a\u0430\u0442\u0430\u043b\u043e\u0433 \u0434\u043b\u044f \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0433\u0438\u0431\u0440\u0438\u0434\u043d\u043e\u0433\u043e \u043f\u043e\u0438\u0441\u043a\u0430',
    items: MARKETPLACE_ITEMS,
    sampleQueries: qs([
      ['Budget headphones', '\u041d\u0435\u0434\u043e\u0440\u043e\u0433\u0438\u0435 \u043d\u0430\u0443\u0448\u043d\u0438\u043a\u0438', 'price intent', '\u043d\u0435\u0434\u043e\u0440\u043e\u0433\u0438\u0435 \u043d\u0430\u0443\u0448\u043d\u0438\u043a\u0438'],
      ['Running shoes', '\u041a\u0440\u043e\u0441\u0441\u043e\u0432\u043a\u0438 \u0434\u043b\u044f \u0431\u0435\u0433\u0430', 'sport', '\u043a\u0440\u043e\u0441\u0441\u043e\u0432\u043a\u0438 \u0434\u043b\u044f \u0431\u0435\u0433\u0430'],
      ['Samsung phone', '\u0421\u043c\u0430\u0440\u0442\u0444\u043e\u043d Samsung', 'brand', 'samsung \u0441\u043c\u0430\u0440\u0442\u0444\u043e\u043d'],
      ['Noise cancelling', '\u0428\u0443\u043c\u043e\u043f\u043e\u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435', 'feature', '\u043d\u0430\u0443\u0448\u043d\u0438\u043a\u0438 \u0441 \u0448\u0443\u043c\u043e\u043f\u043e\u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435\u043c'],
    ]),
  },
  {
    id: 'electronics',
    label: 'Electronics',
    labelRu: '\u042d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u0438\u043a\u0430',
    name: 'Consumer Electronics',
    icon: '\ud83d\udcbb',
    languageLabel: 'RU/EN',
    description: 'Phones, headphones and gadgets focused catalog',
    descriptionRu: '\u041a\u0430\u0442\u0430\u043b\u043e\u0433 \u0441\u043c\u0430\u0440\u0442\u0444\u043e\u043d\u043e\u0432, \u043d\u0430\u0443\u0448\u043d\u0438\u043a\u043e\u0432 \u0438 \u0433\u0430\u0434\u0436\u0435\u0442\u043e\u0432',
    items: ELECTRONICS_ITEMS.length ? ELECTRONICS_ITEMS : MARKETPLACE_ITEMS.slice(0, 3),
    sampleQueries: qs([
      ['Noise cancelling', '\u0428\u0443\u043c\u043e\u043f\u043e\u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435', 'feature', '\u043d\u0430\u0443\u0448\u043d\u0438\u043a\u0438 \u0441 \u0448\u0443\u043c\u043e\u043f\u043e\u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435\u043c'],
      ['Flagship phone', '\u0424\u043b\u0430\u0433\u043c\u0430\u043d', 'tier', '\u0444\u043b\u0430\u0433\u043c\u0430\u043d\u0441\u043a\u0438\u0439 \u0441\u043c\u0430\u0440\u0442\u0444\u043e\u043d'],
      ['Wireless buds', '\u0411\u0435\u0441\u043f\u0440\u043e\u0432\u043e\u0434\u043d\u044b\u0435', 'form', '\u0431\u0435\u0441\u043f\u0440\u043e\u0432\u043e\u0434\u043d\u044b\u0435 \u043d\u0430\u0443\u0448\u043d\u0438\u043a\u0438'],
      ['Budget ANC', '\u041d\u0435\u0434\u043e\u0440\u043e\u0433\u0438\u0435 ANC', 'price', '\u043d\u0435\u0434\u043e\u0440\u043e\u0433\u0438\u0435 \u043d\u0430\u0443\u0448\u043d\u0438\u043a\u0438 anc'],
    ]),
  },
  {
    id: 'fashion',
    label: 'Fashion',
    labelRu: '\u041e\u0434\u0435\u0436\u0434\u0430 \u0438 \u043e\u0431\u0443\u0432\u044c',
    name: 'Fashion & Sport',
    icon: '\ud83d\udc5f',
    languageLabel: 'RU/EN',
    description: 'Footwear and apparel assortment for sport queries',
    descriptionRu: '\u041e\u0431\u0443\u0432\u044c \u0438 \u043e\u0434\u0435\u0436\u0434\u0430 \u0434\u043b\u044f \u0441\u043f\u043e\u0440\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432',
    items: FASHION_ITEMS.length ? FASHION_ITEMS : MARKETPLACE_ITEMS.slice(0, 2),
    sampleQueries: qs([
      ['Nike runners', 'Nike \u0434\u043b\u044f \u0431\u0435\u0433\u0430', 'brand', 'nike \u0431\u0435\u0433\u043e\u0432\u044b\u0435'],
      ['Marathon shoes', '\u041c\u0430\u0440\u0430\u0444\u043e\u043d', 'use', '\u043a\u0440\u043e\u0441\u0441\u043e\u0432\u043a\u0438 \u0434\u043b\u044f \u043c\u0430\u0440\u0430\u0444\u043e\u043d\u0430'],
      ['Kids sneakers', '\u0414\u0435\u0442\u0441\u043a\u0438\u0435', 'audience', '\u0434\u0435\u0442\u0441\u043a\u0438\u0435 \u043a\u0440\u043e\u0441\u0441\u043e\u0432\u043a\u0438'],
      ['Winter trail', '\u0417\u0438\u043c\u043d\u0438\u0435', 'season', '\u0437\u0438\u043c\u043d\u0438\u0435 \u043a\u0440\u043e\u0441\u0441\u043e\u0432\u043a\u0438'],
    ]),
  },
  {
    id: 'auto',
    label: 'Auto',
    labelRu: '\u0410\u0432\u0442\u043e',
    name: 'Auto Parts',
    icon: '\ud83d\ude97',
    languageLabel: 'RU',
    description: 'OEM and aftermarket parts with service slang',
    descriptionRu: '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b \u0438 \u0430\u043d\u0430\u043b\u043e\u0433\u0438 \u0441 \u0441\u043b\u0435\u043d\u0433\u043e\u043c \u0430\u0432\u0442\u043e\u0441\u0435\u0440\u0432\u0438\u0441\u043e\u0432',
    items: AUTO_ITEMS,
    sampleQueries: qs([
      ['Camry brake pads', '\u041a\u043e\u043b\u043e\u0434\u043a\u0438 \u041a\u0430\u043c\u0440\u0438', 'sku-like', '\u0442\u043e\u0440\u043c\u043e\u0437\u043d\u044b\u0435 \u043a\u043e\u043b\u043e\u0434\u043a\u0438 \u043a\u0430\u043c\u0440\u0438'],
      ['Battery 60Ah', '\u0410\u041a\u0411 60', 'spec', '\u0430\u043a\u043a\u0443\u043c\u0443\u043b\u044f\u0442\u043e\u0440 60ah'],
      ['OEM pads', '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b', 'intent', '\u0442\u043e\u0440\u043c\u043e\u0437\u043d\u044b\u0435 \u043a\u043e\u043b\u043e\u0434\u043a\u0438 \u043e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'],
      ['Varta battery', 'Varta', 'brand', '\u0430\u043a\u0431 varta'],
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

/** Prefer exclusive category match; mixed catalogs stay marketplace. */
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

  const hasAuto = /\u0442\u043e\u0440\u043c\u043e\u0437|\u043a\u043e\u043b\u043e\u0434\u043a|camry|toyota|\u0430\u043a\u0431|\u0430\u043a\u043a\u0443\u043c\u0443\u043b\u044f\u0442\u043e\u0440|\u043c\u0430\u0441\u043b\u044f\u043d/.test(blob);
  const hasFashion = /\u043a\u0440\u043e\u0441\u0441\u043e\u0432|nike|adidas|\u043e\u0434\u0435\u0436\u0434|fashion|sneakers/.test(blob);
  const hasElectronics = /\u043d\u0430\u0443\u0448\u043d\u0438\u043a|smartphone|samsung|xiaomi|sony|\u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d|phone|\u043d\u043e\u0443\u0442/.test(blob);
  const distinct = [hasAuto, hasFashion, hasElectronics].filter(Boolean).length;

  let id: PlatformDomainId = 'marketplace';
  if (distinct === 1) {
    if (hasAuto) id = 'auto';
    else if (hasFashion) id = 'fashion';
    else if (hasElectronics) id = 'electronics';
  }
  return PLATFORM_DOMAIN_PRESETS.find((p) => p.id === id) ?? PLATFORM_DOMAIN_PRESETS[0] ?? null;
}
