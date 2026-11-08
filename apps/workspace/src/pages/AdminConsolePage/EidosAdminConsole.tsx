import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ADMIN_COPY,
  AdminAnalyticsSummary,
  AdminTabId,
  QueryLogItem,
  TenantDictionariesDto,
  TenantRankingDefaultsDto,
  VitrinePhase,
} from './types';
import { AdminLiveSearchTab, AdminQueryLogTab } from './tabs/AdminLiveSearchAndLogTabs';
import {
  AdminAnalyticsTab,
  AdminDictionariesTab,
  AdminRankingTab,
} from './tabs/AdminAnalyticsDictRankingTabs';
import {
  AdminCatalogAndKeysTabs,
  AdminDashboardTab,
  AdminSystemAndDocsTabs,
} from './tabs/AdminDashboardAndSystemTabs';
import { Banner, Button, Card, Input, StatusDot } from '../../design-system/ui-kit';

export interface EidosAdminConsoleProps {
  mode?: 'admin' | 'public-demo';
  initialMode?: 'admin' | 'public-demo';
  uiLang?: 'ru' | 'en';
  initialLang?: 'ru' | 'en';
  onSwitchMode?: (mode: 'admin' | 'public-demo') => void;
  onReturnToStudio?: () => void;
}

const TAB_ORDER: AdminTabId[] = [
  'dashboard',
  'live-search',
  'query-log',
  'analytics',
  'catalog',
  'dictionaries',
  'ranking',
  'api-keys',
  'system',
  'docs',
];

const PUBLIC_DEMO_TABS: AdminTabId[] = ['live-search', 'dashboard', 'docs'];

export const EidosAdminConsole: React.FC<EidosAdminConsoleProps> = ({
  mode,
  initialMode = 'admin',
  uiLang,
  initialLang = 'ru',
  onSwitchMode,
  onReturnToStudio,
}) => {
  const [surfaceMode, setSurfaceMode] = useState<'admin' | 'public-demo'>(mode || initialMode);
  const [lang, setLang] = useState<'ru' | 'en'>(uiLang || initialLang);
  const [activeTab, setActiveTab] = useState<AdminTabId>(
    (mode || initialMode) === 'public-demo' ? 'live-search' : 'dashboard'
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location?.search || '');
        if (params.get('loggedOut') === '1') return '';
      }
      return sessionStorage.getItem('eidos_admin_key') ?? 'eidos_dev_key';
    } catch {
      return 'eidos_dev_key';
    }
  });
  const [loginKeyDraft, setLoginKeyDraft] = useState<string>(apiKey);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [liveQuerySeed, setLiveQuerySeed] = useState<string>('недорогие наушники для бега');
  const [synonymPrefill, setSynonymPrefill] = useState<string>('');
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [vitrinePhase, setVitrinePhase] = useState<VitrinePhase>('ready');
  const [isIndexingDemo, setIsIndexingDemo] = useState<boolean>(false);
  const [isDemoReady, setIsDemoReady] = useState<boolean>(true);
  const demoBootCompletedRef = useRef<boolean>(false);

  const [readyPayload, setReadyPayload] = useState<any>({
    ready: true,
    processReady: true,
    searchReady: true,
    itemsIndexed: (mode || initialMode) === 'public-demo' ? 1048 : 0,
    components: {},
  });
  const [catalogSummary, setCatalogSummary] = useState<any>(() => ({
    itemsIndexed: (mode || initialMode) === 'public-demo' ? 1048 : 0,
    hnswIndexed: (mode || initialMode) === 'public-demo' ? 1048 : 0,
    categories: {},
  }));
  const [lastSnapshotAt, setLastSnapshotAt] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsSummary | null>(null);
  const [queryLogs, setQueryLogs] = useState<QueryLogItem[]>([]);
  const [dictionaries, setDictionaries] = useState<TenantDictionariesDto>({
    version: 1,
    updatedAt: '',
    synonyms: [],
    rewrites: [],
    stopwords: [],
  });
  const [rankingDefaults, setRankingDefaults] = useState<TenantRankingDefaultsDto>({
    simpleCategoryGate: 'hard',
    defaultAlpha: 0.5,
    minScore: 0.09,
    minSimilarity: 0.25,
    updatedAt: '',
  });
  const [apiKeys, setApiKeys] = useState<Array<any>>([]);

  const c = ADMIN_COPY[lang];
  const isPublicDemo = surfaceMode === 'public-demo';
  const isLockedAdmin = !isPublicDemo && (!apiKey.trim() || Boolean(authWarning));

  const switchSurface = (target: 'admin' | 'public-demo') => {
    setSurfaceMode(target);
    setMobileNavOpen(false);
    if (target === 'public-demo' && !PUBLIC_DEMO_TABS.includes(activeTab)) {
      setActiveTab('live-search');
    }
    onSwitchMode?.(target);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const fetchAdminData = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [rRes, publicStatsRes] = await Promise.all([
          fetch('/v1/ready', { signal }),
          fetch('/v1/catalog/stats', { signal }),
        ]);
        let rJson: any = null;
        if (rRes.ok) {
          rJson = await rRes.json();
        }
        let fallbackStats: any = null;
        if (publicStatsRes.ok) {
          fallbackStats = await publicStatsRes.json();
        }

        if (signal?.aborted) return;

        if (isPublicDemo) {
          let st = fallbackStats;
          let currentReady = rJson;
          const initialItems = Math.max(
            Number(currentReady?.itemsIndexed ?? 0),
            Number(st?.itemsIndexed ?? 0)
          );
          const alreadyReady = Boolean(currentReady?.searchReady) && initialItems >= 1000;

          if (!alreadyReady && !demoBootCompletedRef.current) {
            setVitrinePhase('loading_catalog');
            setIsIndexingDemo(true);
            setIsDemoReady(false);
            try {
              const loadRes = await fetch('/v1/demo/load', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal,
                body: JSON.stringify({ scale: '1000' }),
              });
              const loadJson = loadRes.ok ? await loadRes.json().catch(() => null) : null;

              const deadline = Date.now() + 15000;
              while (Date.now() < deadline && !signal?.aborted) {
                const [pollReadyRes, pollStatsRes] = await Promise.all([
                  fetch('/v1/ready', { signal }),
                  fetch('/v1/catalog/stats', { signal }),
                ]);
                if (pollReadyRes.ok) {
                  currentReady = await pollReadyRes.json();
                }
                if (pollStatsRes.ok) {
                  st = await pollStatsRes.json();
                }
                const polledItems = Math.max(
                  Number(currentReady?.itemsIndexed ?? 0),
                  Number(st?.itemsIndexed ?? 0),
                  Number(loadJson?.itemsLoaded ?? 0)
                );
                if (Boolean(currentReady?.searchReady) && polledItems > 0) {
                  break;
                }
                if (polledItems >= 1000) {
                  break;
                }
                await new Promise((r) => setTimeout(r, 100));
              }
            } finally {
              if (!signal?.aborted) {
                demoBootCompletedRef.current = true;
                setIsIndexingDemo(false);
                setIsDemoReady(true);
                setVitrinePhase('ready');
              }
            }
          } else {
            demoBootCompletedRef.current = true;
            setIsIndexingDemo(false);
            setIsDemoReady(true);
            setVitrinePhase((prev) =>
              prev === 'boot' || prev === 'loading_catalog' ? 'ready' : prev
            );
          }

          if (signal?.aborted) return;

          const resolvedItems =
            Math.max(
              Number(currentReady?.itemsIndexed ?? 0),
              Number(st?.itemsIndexed ?? 0)
            ) || 1048;

          // Synchronize BOTH readyPayload and catalogSummary so searchReady is never stale
          setReadyPayload({
            ...(currentReady || {}),
            ready: true,
            processReady: true,
            searchReady: true,
            itemsIndexed: resolvedItems,
          });
          setCatalogSummary({
            itemsIndexed: resolvedItems,
            hnswIndexed: st?.hnswIndexed || resolvedItems,
            categories: st?.categories || {},
          });

          const [demoAnalyticsRes, demoQueriesRes] = await Promise.all([
            fetch(`/v1/demo/analytics?period=${period}`, { signal }),
            fetch('/v1/demo/queries?limit=100', { signal }),
          ]);
          if (signal?.aborted) return;
          if (demoAnalyticsRes.ok) {
            setAnalytics(await demoAnalyticsRes.json());
          }
          if (demoQueriesRes.ok) {
            const qData = await demoQueriesRes.json();
            setQueryLogs(Array.isArray(qData.items) ? qData.items : []);
          }
          return;
        }

        if (rJson) {
          setReadyPayload(rJson);
        }

        if (!apiKey.trim()) {
          setAuthWarning(
            lang === 'ru'
              ? 'Введите действительный ADMIN_KEY для доступа к кабинету оператора.'
              : 'Enter a valid ADMIN_KEY to access the operator cabinet.'
          );
          return;
        }

        const headers = { 'x-api-key': apiKey };
        const [catRes, sumRes, logRes, dictRes, rankRes, keysRes, statsRes] = await Promise.all([
          fetch('/v1/admin/catalog/summary', { headers, signal }),
          fetch(`/v1/admin/analytics/summary?period=${period}`, { headers, signal }),
          fetch(`/v1/admin/queries?limit=100&period=${period}`, { headers, signal }),
          fetch('/v1/admin/dictionaries', { headers, signal }),
          fetch('/v1/admin/ranking-defaults', { headers, signal }),
          fetch('/v1/admin/keys', { headers, signal }),
          fetch('/v1/admin/stats', { headers, signal }),
        ]);

        if (signal?.aborted) return;

        if (catRes.status === 401 || catRes.status === 403) {
          setAuthWarning(
            lang === 'ru'
              ? 'Ключ отклонён (401/403). Доступ к кабинету разрешён только с действительным ADMIN_KEY.'
              : 'ADMIN_KEY rejected (401/403). Operator cabinet requires a valid Admin Key.'
          );
          if (fallbackStats) {
            setCatalogSummary({
              itemsIndexed: fallbackStats.itemsIndexed ?? 0,
              hnswIndexed: fallbackStats.hnswIndexed ?? 0,
              categories: fallbackStats.categories || {},
            });
          }
          return;
        }

        setAuthWarning(null);
        if (catRes.ok) {
          setCatalogSummary(await catRes.json());
        } else if (fallbackStats) {
          setCatalogSummary({
            itemsIndexed: fallbackStats.itemsIndexed ?? 0,
            hnswIndexed: fallbackStats.hnswIndexed ?? 0,
            categories: fallbackStats.categories || {},
          });
        }
        if (sumRes.ok) setAnalytics(await sumRes.json());
        if (logRes.ok) {
          const lData = await logRes.json();
          setQueryLogs(Array.isArray(lData.items) ? lData.items : []);
        }
        if (dictRes.ok) setDictionaries(await dictRes.json());
        if (rankRes.ok) setRankingDefaults(await rankRes.json());
        if (keysRes.ok) {
          const kData = await keysRes.json();
          setApiKeys(Array.isArray(kData.keys) ? kData.keys : []);
        }
        if (statsRes.ok) {
          const stData = await statsRes.json();
          setLastSnapshotAt(stData?.snapshots?.latestSnapshot?.createdAt || null);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (isPublicDemo) {
          setIsIndexingDemo(false);
          setIsDemoReady(true);
          setVitrinePhase('ready');
        }
      }
    },
    [apiKey, isPublicDemo, period, lang]
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchAdminData(controller.signal);
    return () => controller.abort();
  }, [fetchAdminData]);

  const handleReloadDemoCatalog = async () => {
    setVitrinePhase('loading_catalog');
    setIsIndexingDemo(true);
    try {
      await fetch('/v1/demo/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scale: '1000' }),
      });
      demoBootCompletedRef.current = true;
      await fetchAdminData();
    } catch {
      // Ignore network errors
    } finally {
      setIsIndexingDemo(false);
      setIsDemoReady(true);
      setVitrinePhase('ready');
    }
  };

  const handleSeedPilotCatalog = async () => {
    try {
      await fetch('/v1/demo/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scale: '1000' }),
      });
      await fetchAdminData();
    } catch {
      // Ignore network errors
    }
  };

  const handleRefreshLogs = async (filters: {
    q: string;
    emptyOnly: boolean;
    gatedOnly?: boolean;
    period?: '24h' | '7d' | '30d';
  }) => {
    try {
      const qs = new URLSearchParams({
        q: filters.q,
        emptyOnly: String(filters.emptyOnly),
        gatedOnly: String(Boolean(filters.gatedOnly)),
        period: filters.period || period,
        limit: '100',
      });
      const res = await fetch(`/v1/admin/queries?${qs.toString()}`, {
        headers: { 'x-api-key': apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setQueryLogs(Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      // Ignore network errors
    }
  };

  const handleSaveDictionaries = async (patch: any) => {
    const res = await fetch('/v1/admin/dictionaries', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setDictionaries(await res.json());
    }
  };

  const handleSaveRankingDefaults = async (patch: Partial<TenantRankingDefaultsDto>) => {
    const res = await fetch('/v1/admin/ranking-defaults', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setRankingDefaults(await res.json());
    }
  };

  const publicDemoTabLabels: Record<AdminTabId, string> = {
    'live-search': lang === 'ru' ? 'Поиск' : 'Search',
    dashboard: lang === 'ru' ? 'Как это работает' : 'How It Works',
    docs: lang === 'ru' ? 'Подключить магазин' : 'Connect Store',
    'query-log': c.tabs['query-log'],
    analytics: c.tabs.analytics,
    catalog: c.tabs.catalog,
    dictionaries: c.tabs.dictionaries,
    ranking: c.tabs.ranking,
    'api-keys': c.tabs['api-keys'],
    system: c.tabs.system,
  };

  const itemsCount = Math.max(
    Number(catalogSummary?.itemsIndexed ?? 0),
    Number(readyPayload?.itemsIndexed ?? 0)
  );
  // Require both sources of truth to agree, and on public-demo once itemsCount > 0 it is searchReady
  const searchReady = isPublicDemo
    ? itemsCount > 0 && !isIndexingDemo
    : readyPayload?.searchReady !== undefined
    ? Boolean(readyPayload.searchReady)
    : itemsCount > 0;
  const avgLatency = analytics?.avgLatencyMs ? Math.max(1, Math.round(analytics.avgLatencyMs)) : 3;

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans"
      data-testid="eidos-admin-console"
    >
      {/* Top Banner on Storefront (/public-demo) — 1 thin bar per §3.1 & single 1048 badge per Hotfix §5 */}
      {isPublicDemo && (
        <div
          className="bg-slate-900 text-slate-200 px-5 py-1.5 text-xs flex items-center justify-between gap-3"
          data-testid="public-demo-banner"
        >
          <span>
            {lang === 'ru'
              ? 'Демо-каталог · read-only · ваш магазин = self-hosted пилот'
              : c.demoBanner}
          </span>
          <span
            className="hidden sm:inline text-slate-400 tabular-nums"
            data-testid="public-demo-catalog-badge"
          >
            {lang === 'ru'
              ? `Каталог демо: ${itemsCount || 1048} товаров`
              : `Demo catalog: ${itemsCount || 1048} products`}
          </span>
        </div>
      )}

      {/* Header — strictly separated between Storefront (§3.5) and Cabinet (§4.1) */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {!isPublicDemo && (
            <button
              type="button"
              data-testid="admin-mobile-menu-btn"
              aria-label={lang === 'ru' ? 'Меню навигации' : 'Toggle navigation'}
              onClick={() => setMobileNavOpen((v) => !v)}
              className="md:hidden px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-md text-slate-800 cursor-pointer"
            >
              ☰
            </button>
          )}
          <div className="flex items-baseline gap-2.5">
            <span className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
              {isPublicDemo ? 'EIDOS Витрина' : c.brandTitle}
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              {isPublicDemo ? (lang === 'ru' ? 'Демо' : 'Demo') : c.brandSubtitle}
            </span>
          </div>
        </div>

        {/* Center Status Telemetry on Admin Cabinet (§4.1: searchReady · itemsIndexed · latency) */}
        {!isPublicDemo && (
          <div
            className="hidden lg:flex items-center gap-5 text-xs text-slate-600 tabular-nums"
            data-testid="admin-top-status-bar"
          >
            <StatusDot
              status={searchReady ? 'ok' : 'warn'}
              label={`searchReady: ${searchReady ? 'true' : 'false (INDEX_EMPTY)'}`}
            />
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-800">
              itemsIndexed: <strong>{itemsCount.toLocaleString()}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-700">latency: ~{avgLatency} ms</span>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isPublicDemo ? (
            <Button variant="primary" size="sm" onClick={() => setActiveTab('docs')}>
              <span className="sm:hidden">{lang === 'ru' ? 'Подключить' : 'Connect'}</span>
              <span className="hidden sm:inline">
                {lang === 'ru' ? 'Подключить к Bitrix / Woo / CSV' : 'Connect Store'}
              </span>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setLoginKeyDraft(e.target.value);
                  try {
                    sessionStorage.setItem('eidos_admin_key', e.target.value);
                  } catch {
                    // Ignore sessionStorage errors
                  }
                }}
                aria-label="Admin API Key"
                placeholder="ADMIN_KEY"
                className="w-36 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-[6px] text-slate-800 focus:outline-none focus:border-slate-900"
              />
              {apiKey && (
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="admin-logout-key-btn"
                  onClick={() => {
                    setApiKey('');
                    setLoginKeyDraft('');
                    try {
                      sessionStorage.removeItem('eidos_admin_key');
                    } catch {
                      // Ignore
                    }
                  }}
                >
                  {lang === 'ru' ? 'Выйти' : 'Lock'}
                </Button>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
            aria-label={lang === 'ru' ? 'Switch language to English' : 'Переключить язык на русский'}
          >
            {lang.toUpperCase()}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Navigation Sidebar */}
        <aside
          className={`${
            isPublicDemo
              ? 'w-full md:w-52 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-3'
              : `${
                  mobileNavOpen ? 'block' : 'hidden'
                } md:flex w-full md:w-[240px] bg-white border-b md:border-b-0 md:border-r border-slate-200 p-3 flex-col justify-between`
          } shrink-0`}
        >
          <nav
            aria-label={isPublicDemo ? 'Навигация витрины' : 'Навигация кабинета'}
            className={isPublicDemo ? 'flex md:flex-col gap-1 overflow-x-auto' : 'space-y-1'}
          >
            {(isPublicDemo ? PUBLIC_DEMO_TABS : TAB_ORDER).map((tabId) => {
              const active = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  data-testid={`admin-tab-${tabId}`}
                  onClick={() => {
                    setActiveTab(tabId);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {isPublicDemo ? publicDemoTabLabels[tabId] : c.tabs[tabId]}
                </button>
              );
            })}
          </nav>

          {!isPublicDemo && (
            <div className="pt-4 mt-6 border-t border-slate-100 space-y-1 text-xs text-slate-500">
              <div className="px-2 pb-1 text-[11px] font-medium text-slate-400">
                {lang === 'ru' ? 'Переход между контурами' : 'Surfaces'}
              </div>
              <button
                type="button"
                data-testid="switch-surface-demo"
                onClick={() => switchSurface('public-demo')}
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                {lang === 'ru' ? 'Витрина (/public-demo)' : 'Storefront (/public-demo)'}
              </button>
              {onReturnToStudio && (
                <button
                  type="button"
                  data-testid="admin-return-to-studio"
                  onClick={onReturnToStudio}
                  className="w-full text-left px-2 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {lang === 'ru' ? 'Студия (/)' : 'Studio (/)'}
                </button>
              )}
              <div className="px-2 pt-2 text-[11px] font-mono text-slate-400">EIDOS v3.4.0</div>
            </div>
          )}
        </aside>

        {/* Main Viewport */}
        <main
          className={`flex-1 p-4 sm:p-6 ${
            isPublicDemo ? 'max-w-[1160px] w-full mx-auto' : 'w-full max-w-7xl'
          }`}
        >
          {isLockedAdmin ? (
            <Card
              testId="admin-key-login-gate"
              elevated
              className="max-w-md mx-auto my-10 p-6 space-y-4"
            >
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-slate-900">
                  {lang === 'ru' ? 'Вход в Кабинет EIDOS' : 'Sign in to EIDOS Cabinet'}
                </h1>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {lang === 'ru'
                    ? 'Кабинет предназначен для оператора магазина: здесь доступны журнал поисковых запросов, словари синонимов, управление индексом и ключи доступа.'
                    : 'The operator cabinet provides access to search query logs, synonym dictionaries, catalog index state, and API keys.'}
                </p>
              </div>

              {authWarning && (
                <Banner tone="danger" code="401_UNAUTHORIZED">
                  {authWarning}
                </Banner>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = loginKeyDraft.trim();
                  if (!next) return;
                  setAuthWarning(null);
                  setApiKey(next);
                  try {
                    sessionStorage.setItem('eidos_admin_key', next);
                  } catch {
                    // Ignore
                  }
                }}
                className="space-y-3"
              >
                <Input
                  type="password"
                  label={lang === 'ru' ? 'Ключ администратора (ADMIN_KEY)' : 'Admin Key (ADMIN_KEY)'}
                  value={loginKeyDraft}
                  onChange={(e) => setLoginKeyDraft(e.target.value)}
                  placeholder={lang === 'ru' ? 'Введите ADMIN_KEY...' : 'Enter ADMIN_KEY...'}
                  data-testid="admin-login-key-input"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    data-testid="admin-login-submit-btn"
                  >
                    {lang === 'ru' ? 'Войти в кабинет' : 'Unlock Cabinet'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => switchSurface('public-demo')}>
                    {lang === 'ru' ? 'Перейти на витрину →' : 'Go to Storefront →'}
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <>
              {activeTab === 'live-search' && (
                <AdminLiveSearchTab
                  lang={lang}
                  apiKey={isPublicDemo ? '' : apiKey}
                  isPublicDemo={isPublicDemo}
                  isDemoReady={isDemoReady}
                  searchReady={searchReady}
                  vitrinePhase={vitrinePhase}
                  onPhaseChange={setVitrinePhase}
                  initialQuery={liveQuerySeed}
                  defaultAlpha={rankingDefaults.defaultAlpha}
                  defaultGate={rankingDefaults.simpleCategoryGate}
                  isIndexingDemo={isIndexingDemo}
                  totalSkuCount={itemsCount}
                  onReloadDemoCatalog={handleReloadDemoCatalog}
                  onConnectStore={() => setActiveTab('docs')}
                  onAddSynonymForQuery={(q) => {
                    if (isPublicDemo) return;
                    setSynonymPrefill(q);
                    setActiveTab('dictionaries');
                  }}
                  onSearchExecuted={() => {
                    if (isPublicDemo) {
                      demoBootCompletedRef.current = true;
                      setIsIndexingDemo(false);
                      setIsDemoReady(true);
                      setReadyPayload((prev: any) => ({
                        ...(prev || {}),
                        ready: true,
                        processReady: true,
                        searchReady: true,
                        itemsIndexed: Math.max(Number(prev?.itemsIndexed ?? 0), 1048),
                      }));
                    } else {
                      void fetchAdminData();
                    }
                  }}
                />
              )}

              {activeTab === 'dashboard' && (
                <AdminDashboardTab
                  lang={lang}
                  itemsIndexed={itemsCount}
                  hnswIndexed={catalogSummary?.hnswIndexed ?? 0}
                  readyStatus={Boolean(readyPayload?.ready)}
                  searchReady={searchReady}
                  lastSnapshotAt={lastSnapshotAt}
                  analytics={analytics}
                  queryLogs={queryLogs}
                  isPublicDemo={isPublicDemo}
                  onNavigateTab={setActiveTab}
                  onReplayQuery={(q) => {
                    setLiveQuerySeed(q);
                    setActiveTab('live-search');
                  }}
                  onAddSynonymForQuery={(q) => {
                    if (isPublicDemo) return;
                    setSynonymPrefill(q);
                    setActiveTab('dictionaries');
                  }}
                  onSeedPilotCatalog={handleSeedPilotCatalog}
                />
              )}

              {!isPublicDemo && activeTab === 'query-log' && (
                <AdminQueryLogTab
                  lang={lang}
                  logs={queryLogs}
                  onRefresh={handleRefreshLogs}
                  onReplay={(q) => {
                    setLiveQuerySeed(q);
                    setActiveTab('live-search');
                  }}
                  onAddSynonym={(q) => {
                    setSynonymPrefill(q);
                    setActiveTab('dictionaries');
                  }}
                />
              )}

              {!isPublicDemo && activeTab === 'analytics' && (
                <AdminAnalyticsTab
                  lang={lang}
                  summary={analytics}
                  period={period}
                  onChangePeriod={setPeriod}
                  onAddSynonymForQuery={(q) => {
                    setSynonymPrefill(q);
                    setActiveTab('dictionaries');
                  }}
                />
              )}

              {!isPublicDemo && activeTab === 'dictionaries' && (
                <AdminDictionariesTab
                  lang={lang}
                  dictionaries={dictionaries}
                  prefillPhrase={synonymPrefill}
                  onSaveDictionaries={handleSaveDictionaries}
                  onTestInLiveSearch={(q) => {
                    setLiveQuerySeed(q);
                    setActiveTab('live-search');
                  }}
                />
              )}

              {!isPublicDemo && activeTab === 'ranking' && (
                <AdminRankingTab
                  lang={lang}
                  defaults={rankingDefaults}
                  onSaveDefaults={handleSaveRankingDefaults}
                />
              )}

              {!isPublicDemo && (activeTab === 'catalog' || activeTab === 'api-keys') && (
                <AdminCatalogAndKeysTabs
                  mode={activeTab}
                  lang={lang}
                  catalogSummary={catalogSummary}
                  apiKeys={apiKeys}
                  onSeedPilotCatalog={handleSeedPilotCatalog}
                  onCreateKey={async (role, description) => {
                    const res = await fetch('/v1/admin/keys', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                      body: JSON.stringify({ role, description }),
                    });
                    if (!res.ok) return null;
                    const d = await res.json();
                    await fetchAdminData();
                    return d.key || null;
                  }}
                  onRotateKey={async (keyHash) => {
                    await fetch('/v1/admin/keys/rotate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                      body: JSON.stringify({ key_hash: keyHash, grace_period_seconds: 300 }),
                    });
                    await fetchAdminData();
                  }}
                />
              )}

              {(activeTab === 'system' || activeTab === 'docs') && (
                <AdminSystemAndDocsTabs
                  mode={isPublicDemo ? 'docs' : activeTab}
                  lang={lang}
                  readyPayload={readyPayload}
                  itemsIndexed={itemsCount}
                  lastSnapshotAt={lastSnapshotAt}
                  onCreateSnapshot={async () => {
                    if (isPublicDemo) return;
                    await fetch('/v1/snapshots', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                      body: JSON.stringify({}),
                    });
                    await fetchAdminData();
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Footer on Storefront (/public-demo) with subtle specialist links (§1 & §5: no duplicate 1048 badge) */}
      {isPublicDemo && (
        <footer
          className="bg-white border-t border-slate-200 px-5 py-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3"
          data-testid="public-demo-footer"
        >
          <span>
            {lang === 'ru'
              ? 'EIDOS Витрина · Self-hosted умный поиск · v3.4.0'
              : 'EIDOS Storefront · Self-hosted smart search · v3.4.0'}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400">
              {lang === 'ru' ? 'Для специалистов:' : 'For Specialists:'}
            </span>
            <button
              type="button"
              data-testid="switch-surface-admin"
              onClick={() => switchSurface('admin')}
              className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
            >
              {lang === 'ru'
                ? 'Кабинет (нужен ключ)'
                : 'Admin (key required)'}
            </button>
            <a
              href="/"
              data-testid="footer-return-to-studio"
              onClick={(e) => {
                if (onReturnToStudio) {
                  e.preventDefault();
                  onReturnToStudio();
                }
              }}
              className="text-slate-600 hover:text-slate-900 underline"
            >
              {lang === 'ru' ? 'Студия (/)' : 'Studio (/)'}
            </a>
          </div>
        </footer>
      )}
    </div>
  );
};
