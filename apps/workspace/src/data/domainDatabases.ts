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

export const PLATFORM_DOMAIN_PRESETS: PlatformDomainPreset[] = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    labelRu: 'Маркетплейс',
    name: 'Marketplace',
    icon: '🛒',
    languageLabel: 'RU/EN',
    description: 'Mixed retail catalog',
    descriptionRu: 'Смешанный ритейл-каталог',
    items: INITIAL_CATALOG,
    sampleQueries: [
      { label: 'Budget headphones', labelRu: 'Недорогие наушники', note: 'price intent', query: 'недорогие наушники' },
      { label: 'Running shoes', labelRu: 'Кроссовки для бега', note: 'sport', query: 'кроссовки для бега' },
      { label: 'Samsung phone', labelRu: 'Смартфон Samsung', note: 'brand', query: 'samsung смартфон' },
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    labelRu: 'Электроника',
    name: 'Electronics',
    icon: '💻',
    languageLabel: 'RU/EN',
    items: INITIAL_CATALOG.filter((i) =>
      ['Наушники', 'Смартфоны', 'Бытовая техника'].includes(i.category)
    ),
    sampleQueries: [
      { label: 'Noise cancelling', labelRu: 'Шумоподавление', note: 'feature', query: 'наушники с шумоподавлением' },
      { label: 'Flagship phone', labelRu: 'Флагман', note: 'tier', query: 'флагманский смартфон' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion',
    labelRu: 'Одежда и обувь',
    name: 'Fashion',
    icon: '👟',
    languageLabel: 'RU/EN',
    items: INITIAL_CATALOG.filter((i) => i.category === 'Кроссовки'),
    sampleQueries: [
      { label: 'Nike runners', labelRu: 'Nike для бега', note: 'brand', query: 'nike беговые' },
    ],
  },
  {
    id: 'auto',
    label: 'Auto',
    labelRu: 'Авто',
    name: 'Auto',
    icon: '🚗',
    languageLabel: 'RU',
    items: [
      {
        id: 'auto-1',
        title: 'Тормозные колодки керамические Toyota Camry',
        description: 'Передние колодки для Camry XV70',
        category: 'Тормозная система',
        price: 4500,
        tags: ['тормозные колодки', 'камри', 'toyota'],
      },
    ],
    sampleQueries: [
      { label: 'Camry brake pads', labelRu: 'Колодки Камри', note: 'sku-like', query: 'тормозные колодки камри' },
    ],
  },
];

export const FULL_DEMO_CATALOG: CatalogItem[] = INITIAL_CATALOG;

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
    description: (isRu ? preset.descriptionRu : preset.description) ?? '',
    sampleQueries: preset.sampleQueries.map((q) => ({
      label: isRu && q.labelRu ? q.labelRu : q.label,
      note: q.note ?? '',
      query: q.query,
    })),
  };
}

/** Returns matching preset (callers pass it to getLocalizedPresetMeta). */
export function detectPresetFromCatalog(items: CatalogItem[]): PlatformDomainPreset | null {
  if (!items.length) return PLATFORM_DOMAIN_PRESETS[0] ?? null;
  const blob = items
    .slice(0, 40)
    .map((i) => `${i.title} ${i.category}`)
    .join(' ')
    .toLowerCase();
  const id: PlatformDomainId = /тормоз|колодк|camry|toyota|маслян/.test(blob)
    ? 'auto'
    : /наушник|smartphone|samsung|xiaomi|sony|электрон/.test(blob)
      ? 'electronics'
      : /кроссов|nike|adidas|одежд|fashion/.test(blob)
        ? 'fashion'
        : 'marketplace';
  return PLATFORM_DOMAIN_PRESETS.find((p) => p.id === id) ?? PLATFORM_DOMAIN_PRESETS[0] ?? null;
}
