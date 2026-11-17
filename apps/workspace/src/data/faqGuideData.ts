import type { ViewId } from '../components/Sidebar';

export type FaqAudienceId = 'seo' | 'smm' | 'sales' | 'bitrix' | 'all';

type LangText = { ru: string; en: string };

export const AUDIENCE_FILTERS: Array<{ id: FaqAudienceId; label: string; labelRu: string }> = [
  { id: 'all', label: 'All', labelRu: 'Все' },
  { id: 'seo', label: 'SEO', labelRu: 'SEO' },
  { id: 'smm', label: 'SMM', labelRu: 'SMM' },
  { id: 'sales', label: 'Sales', labelRu: 'Продажи' },
  { id: 'bitrix', label: 'Bitrix', labelRu: 'Битрикс' },
];

export interface FeatureGuideItem {
  id: ViewId;
  emoji: string;
  badge: LangText;
  title: LangText;
  whatIsIt: LangText;
  whyNeeded: LangText;
  howItWorks: LangText;
  realExample: LangText;
}

export const FEATURE_GUIDE_ITEMS: FeatureGuideItem[] = [
  {
    id: 'search',
    emoji: '🔍',
    badge: { ru: 'Поиск', en: 'Search' },
    title: { ru: 'Гибридный поиск', en: 'Hybrid Search' },
    whatIsIt: {
      ru: 'Сочетает BM25 и HNSW через RRF.',
      en: 'Combines BM25 and HNSW via RRF.',
    },
    whyNeeded: {
      ru: 'Точные артикулы + естественный язык в одной выдаче.',
      en: 'Exact SKUs and natural language in one ranking.',
    },
    howItWorks: {
      ru: 'Лексический и векторный каналы сливаются с настраиваемыми весами.',
      en: 'Lexical and vector channels fuse with tunable weights.',
    },
    realExample: {
      ru: 'Запрос «недорогие наушники для бега» находит релевантные SKU.',
      en: 'Query “budget running headphones” finds relevant SKUs.',
    },
  },
  {
    id: 'dashboard',
    emoji: '📊',
    badge: { ru: 'Студия', en: 'Studio' },
    title: { ru: 'X-Ray ранжирование', en: 'X-Ray ranking' },
    whatIsIt: {
      ru: 'Прозрачный разбор вклада факторов в score.',
      en: 'Transparent factor breakdown of each hit score.',
    },
    whyNeeded: {
      ru: 'Мерчандайзеры видят, почему товар наверху.',
      en: 'Merchandisers see why an item ranks high.',
    },
    howItWorks: {
      ru: 'В ответе API — lexical/semantic/business boost.',
      en: 'API returns lexical/semantic/business boost components.',
    },
    realExample: {
      ru: 'Буст маржинальных SKU без поломки релевантности.',
      en: 'Boost high-margin SKUs without breaking relevance.',
    },
  },
  {
    id: 'catalog',
    emoji: '🔌',
    badge: { ru: 'CMS', en: 'CMS' },
    title: { ru: 'Коннекторы Битрикс/Woo', en: 'Bitrix/Woo connectors' },
    whatIsIt: {
      ru: 'Синхронизация каталога и подмена поиска на витрине.',
      en: 'Catalog sync and storefront search replacement.',
    },
    whyNeeded: {
      ru: 'Пилот без переписывания витрины.',
      en: 'Pilot without rewriting the storefront.',
    },
    howItWorks: {
      ru: 'Модуль CMS → API EIDOS; fallback на CSearch при аварии.',
      en: 'CMS module → EIDOS API; falls back to native search on outage.',
    },
    realExample: {
      ru: 'Установка модуля, ключ API, cron-синк 10k SKU.',
      en: 'Install module, set API key, cron-sync 10k SKUs.',
    },
  },
];
