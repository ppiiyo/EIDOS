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
    brandTitle: 'EIDOS Admin',
    brandSubtitle: 'Операторская панель поиска и каталога',
    demoBanner: 'Демо-контур · Только чтение · Для пилота на вашем каталоге — self-hosted EIDOS',
    demoCta: 'Запросить пилот / Self-Hosted',
    switchToDemo: 'Public Demo (Витрина)',
    switchToAdmin: 'EIDOS Admin',
    switchToStudio: 'Инженерная студия',
    tabs: {
      dashboard: 'Обзор (Пульс)',
      'live-search': 'Проверка поиска (Live)',
      'query-log': 'Журнал запросов',
      analytics: 'Аналитика и воронка',
      catalog: 'Каталог и синхронизация',
      dictionaries: 'Словари и синонимы',
      ranking: 'Настройки ранжирования',
      'api-keys': 'API-ключи доступа',
      system: 'Проверка системы',
      docs: 'Документация и гайды',
    },
    kpi: {
      itemsIndexed: 'Товаров в индексе',
      avgLatency: 'Средняя задержка (p50 / p95)',
      zeroRate: 'Доля пустых выдач',
      gateBlocks: 'Отсечено Category Gate',
      lastSnapshot: 'Последний снапшот',
      errors5xx: 'Ошибки 5xx поиска',
    },
  },
  en: {
    brandTitle: 'EIDOS Admin',
    brandSubtitle: 'Storefront Search & Catalog Operator Console',
    demoBanner: 'Demo Sandbox · Read-Only · For a store pilot on your own catalog — deploy self-hosted EIDOS',
    demoCta: 'Request Pilot / Self-Hosted',
    switchToDemo: 'Public Demo Stand',
    switchToAdmin: 'EIDOS Admin',
    switchToStudio: 'Engineering Studio',
    tabs: {
      dashboard: 'Dashboard',
      'live-search': 'Live Search & X-Ray',
      'query-log': 'Query Log',
      analytics: 'Analytics & Funnel',
      catalog: 'Catalog & Sync',
      dictionaries: 'Dictionaries',
      ranking: 'Ranking Defaults',
      'api-keys': 'API Keys',
      system: 'System Check',
      docs: 'Docs & Runbooks',
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
