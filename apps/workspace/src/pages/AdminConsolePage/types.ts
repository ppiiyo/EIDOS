export type VitrinePhase =
  | 'boot'            // first mount, readiness not yet confirmed
  | 'loading_catalog' // searchReady=false -> POST /v1/demo/load + poll /v1/ready
  | 'ready'           // searchReady=true, itemsIndexed>0
  | 'searching'       // search request in-flight
  | 'results'         // search response received (count>=0)
  | 'error';          // network/5xx error during boot or search

export type AdminTabId =
  | 'dashboard'
  | 'live-search'
  | 'query-log'
  | 'analytics'
  | 'catalog'
  | 'dictionaries'
  | 'ranking'
  | 'api-keys'
  | 'system'
  | 'docs';

export interface QueryLogItem {
  id: string;
  timestamp: string;
  tenantId: string;
  indexName: string;
  query: string;
  normalizedQuery: string;
  resultCount: number;
  latencyMs: number;
  cacheHit: boolean;
  headCategoryIntent: string | null;
  simpleCategoryGate: 'hard' | 'soft' | 'off';
  alpha: number;
  top1: {
    id: string;
    title: string;
    category: string;
    scorePercent: number;
    score: number;
  } | null;
  flags: {
    empty: boolean;
    gated: boolean;
    rewritten: boolean;
    fallback_not_applicable: boolean;
  };
  appliedDictionaryRules?: string[];
}

export interface AdminAnalyticsSummary {
  period: '24h' | '7d' | '30d';
  totalSearches: number;
  emptySearches: number;
  zeroResultRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  categoryGateBlocks: number;
  rewrittenSearches: number;
  error5xxCount: number;
  searchesByDay: Array<{
    date: string;
    searches: number;
    emptySearches: number;
    zeroResultShare: number;
    p95LatencyMs: number;
  }>;
  topQueries: Array<{
    query: string;
    count: number;
    emptyCount: number;
    avgLatencyMs: number;
    top1Category: string | null;
  }>;
  topZeroResultQueries: Array<{
    query: string;
    count: number;
    lastSeenAt: string;
    headCategoryIntent: string | null;
  }>;
  honestFunnel: {
    searches: number;
    clicks: number;
    addToCart: number;
    purchases: number;
    ctrPercent: number;
    hasStorefrontOrderEvents: boolean;
  };
}

export interface TenantDictionariesDto {
  version: number;
  updatedAt: string;
  synonyms: Array<{ id: string; phrase: string; replacement: string; enabled: boolean }>;
  rewrites: Array<{ id: string; from: string; to: string; enabled: boolean }>;
  stopwords: string[];
}

export interface TenantRankingDefaultsDto {
  simpleCategoryGate: 'hard' | 'soft' | 'off';
  defaultAlpha: number;
  minScore: number;
  minSimilarity: number;
  updatedAt: string;
}

export interface LiveSearchHitDto {
  id: string;
  sku?: string;
  url?: string;
  imageUrl?: string;
  title: string;
  description?: string;
  category: string;
  price?: number;
  tags?: string[];
  score: number;
  scorePercent: number;
  humanExplanation?: { ru: string; en: string };
  explanation?: {
    denseComponent: number;
    sparseBm25Component: number;
    rrfScore: number;
    mmrPenalty: number;
    businessBoost: number;
  };
}

export const ADMIN_COPY = {
  ru: {
    brandTitle: 'EIDOS Кабинет',
    brandSubtitle: 'Управление поиском, индексацией и словарями магазина',
    demoBanner: 'Демо-каталог · read-only · ваш магазин = self-hosted пилот',
    demoCta: 'Подключить магазин',
    switchToDemo: 'Витрина (/public-demo)',
    switchToAdmin: 'Кабинет (/admin)',
    switchToStudio: 'Студия (/)',
    tabs: {
      dashboard: 'Обзор',
      'live-search': 'Живой поиск · Проверка поиска',
      'query-log': 'Журнал запросов',
      analytics: 'Аналитика',
      catalog: 'Каталог',
      dictionaries: 'Словари и синонимы',
      ranking: 'Настройки ранжирования',
      'api-keys': 'Ключи',
      system: 'Проверка системы',
      docs: 'Документация',
    },
    kpi: {
      itemsIndexed: 'Товаров в индексе',
      avgLatency: 'Задержка (p50 / p95)',
      zeroRate: 'Доля пустых выдач',
      gateBlocks: 'Отсечено Category Gate',
      lastSnapshot: 'Последний снапшот',
      errors5xx: 'Ошибки 5xx поиска',
    },
  },
  en: {
    brandTitle: 'EIDOS Cabinet',
    brandSubtitle: 'Storefront Search, Index & Dictionary Management',
    demoBanner: 'Demo catalog · read-only · your store = self-hosted pilot',
    demoCta: 'Connect Store',
    switchToDemo: 'Storefront (/public-demo)',
    switchToAdmin: 'Cabinet (/admin)',
    switchToStudio: 'Studio (/)',
    tabs: {
      dashboard: 'Overview',
      'live-search': 'Live Search',
      'query-log': 'Query Log',
      analytics: 'Analytics',
      catalog: 'Catalog',
      dictionaries: 'Dictionaries',
      ranking: 'Ranking',
      'api-keys': 'Keys',
      system: 'System',
      docs: 'Documentation',
    },
    kpi: {
      itemsIndexed: 'Items Indexed',
      avgLatency: 'Search Latency (p50 / p95)',
      zeroRate: 'Zero-Result Share',
      gateBlocks: 'Category Gate Blocks',
      lastSnapshot: 'Latest Snapshot',
      errors5xx: '5xx Search Errors',
    },
  },
};
