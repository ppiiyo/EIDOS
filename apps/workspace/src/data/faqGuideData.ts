export type FaqAudienceId = 'seo' | 'smm' | 'sales' | 'bitrix' | 'all';

export const AUDIENCE_FILTERS: Array<{ id: FaqAudienceId; label: string; labelRu: string }> = [
  { id: 'all', label: 'All', labelRu: 'Все' },
  { id: 'seo', label: 'SEO', labelRu: 'SEO' },
  { id: 'smm', label: 'SMM', labelRu: 'SMM' },
  { id: 'sales', label: 'Sales', labelRu: 'Продажи' },
  { id: 'bitrix', label: 'Bitrix', labelRu: 'Битрикс' },
];

export const FEATURE_GUIDE_ITEMS: Array<{ id: string; title: string; titleRu: string; body: string; bodyRu: string }> = [
  {
    id: 'search',
    title: 'Hybrid Search',
    titleRu: 'Гибридный поиск',
    body: 'Combines BM25 lexical matching with HNSW semantic vectors via RRF.',
    bodyRu: 'Сочетает лексический BM25 и семантический HNSW через RRF.',
  },
  {
    id: 'xray',
    title: 'X-Ray ranking',
    titleRu: 'X-Ray ранжирование',
    body: 'Per-hit explanation of lexical, semantic, and business boost factors.',
    bodyRu: 'Пояснение вклада лексики, семантики и бизнес-бустов по каждому хиту.',
  },
  {
    id: 'connectors',
    title: 'CMS connectors',
    titleRu: 'Коннекторы CMS',
    body: 'Bitrix and WooCommerce modules sync catalog and replace storefront search.',
    bodyRu: 'Модули Битрикс и WooCommerce синхронизируют каталог и подменяют поиск на витрине.',
  },
];
