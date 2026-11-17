import type { CatalogItem } from '../types';
import { INITIAL_CATALOG } from './catalog';

export type PlatformDomainId = 'marketplace' | 'electronics' | 'fashion' | 'auto' | 'custom';

export interface PlatformDomainPreset {
  id: PlatformDomainId;
  label: string;
  labelRu: string;
  description?: string;
  descriptionRu?: string;
  items: CatalogItem[];
  sampleQueries: Array<{ label: string; labelRu?: string; query: string }>;
}

export const PLATFORM_DOMAIN_PRESETS: PlatformDomainPreset[] = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    labelRu: 'Маркетплейс',
    description: 'Mixed retail catalog',
    descriptionRu: 'Смешанный ритейл-каталог',
    items: INITIAL_CATALOG,
    sampleQueries: [
      { label: 'Budget headphones', labelRu: 'Недорогие наушники', query: 'недорогие наушники' },
      { label: 'Running shoes', labelRu: 'Кроссовки для бега', query: 'кроссовки для бега' },
      { label: 'Samsung phone', labelRu: 'Смартфон Samsung', query: 'samsung смартфон' },
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    labelRu: 'Электроника',
    items: INITIAL_CATALOG.filter((i) =>
      ['Наушники', 'Смартфоны', 'Бытовая техника'].includes(i.category)
    ),
    sampleQueries: [
      { label: 'Noise cancelling', labelRu: 'Шумоподавление', query: 'наушники с шумоподавлением' },
      { label: 'Flagship phone', labelRu: 'Флагман', query: 'флагманский смартфон' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion',
    labelRu: 'Одежда и обувь',
    items: INITIAL_CATALOG.filter((i) => i.category === 'Кроссовки'),
    sampleQueries: [
      { label: 'Nike runners', labelRu: 'Nike для бега', query: 'nike беговые' },
    ],
  },
  {
    id: 'auto',
    label: 'Auto',
    labelRu: 'Авто',
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
      { label: 'Camry brake pads', labelRu: 'Колодки Камри', query: 'тормозные колодки камри' },
    ],
  },
];

/** Full demo catalog alias used by DemoMode. */
export const FULL_DEMO_CATALOG: CatalogItem[] = INITIAL_CATALOG;

export function getLocalizedPresetMeta(
  preset: PlatformDomainPreset,
  lang: string
): {
  label: string;
  description: string;
  sampleQueries: Array<{ label: string; query: string }>;
} {
  const isRu = lang === 'ru';
  return {
    label: isRu ? preset.labelRu : preset.label,
    description: (isRu ? preset.descriptionRu : preset.description) ?? '',
    sampleQueries: preset.sampleQueries.map((q) => ({
      label: isRu && q.labelRu ? q.labelRu : q.label,
      query: q.query,
    })),
  };
}

/** Heuristic domain detection from catalog titles/categories. */
export function detectPresetFromCatalog(items: CatalogItem[]): PlatformDomainId {
  if (!items.length) return 'marketplace';
  const blob = items
    .slice(0, 40)
    .map((i) => `${i.title} ${i.category}`)
    .join(' ')
    .toLowerCase();
  if (/тормоз|колодк|camry|toyota|маслян/.test(blob)) return 'auto';
  if (/наушник|smartphone|samsung|xiaomi|sony|электрон/.test(blob)) return 'electronics';
  if (/кроссов|nike|adidas|одежд|fashion/.test(blob)) return 'fashion';
  return 'marketplace';
}
