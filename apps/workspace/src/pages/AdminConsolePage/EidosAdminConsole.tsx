import React, { useState, useEffect, useCallback } from 'react';
import {
  ADMIN_COPY,
  AdminAnalyticsSummary,
  AdminTabId,
  QueryLogItem,
  TenantDictionariesDto,
  TenantRankingDefaultsDto,
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
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return sessionStorage.getItem('eidos_admin_key') || 'eidos_dev_key';
    } catch {
      return 'eidos_dev_key';
    }
  });
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const [liveQuerySeed, setLiveQuerySeed] = useState<string>('недорогие наушники для бега');
  const [synonymPrefill, setSynonymPrefill] = useState<string>('');
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [isIndexingDemo, setIsIndexingDemo] = useState<boolean>(false);

  const [readyPayload, setReadyPayload] = useState<any>({ ready: true, components: {} });
  const [catalogSummary, setCatalogSummary] = useState<any>({
    itemsIndexed: 0,
    hnswIndexed: 0,
    categories: {},
  });
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

  const switchSurface = (target: 'admin' | 'public-demo') => {
    setSurfaceMode(target);
    if (target === 'public-demo' && !PUBLIC_DEMO_TABS.includes(activeTab)) {
      setActiveTab('live-search');
    }
    onSwitchMode?.(target);
  };

  const fetchAdminData = useCallback(async () => {
    try {
      const [rRes, publicStatsRes] = await Promise.all([
        fetch('/v1/ready'),
        fetch('/v1/catalog/stats'),
      ]);
      if (rRes.ok) {
        setReadyPayload(await rRes.json());
      }
      let fallbackStats: any = null;
      if (publicStatsRes.ok) {
        fallbackStats = await publicStatsRes.json();
      }

      if (isPublicDemo) {
        let st = fallbackStats;
        if (!st || (st.itemsIndexed ?? 0) < 1000) {
          setIsIndexingDemo(true);
          try {
            await fetch('/v1/demo/load', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scale: '1000' }),
            });
            const stRes = await fetch('/v1/catalog/stats');
            if (stRes.ok) st = await stRes.json();
          } finally {
            setIsIndexingDemo(false);
          }
        }
        setCatalogSummary({
          itemsIndexed: st?.itemsIndexed ?? 1048,
          hnswIndexed: st?.hnswIndexed ?? 1048,
          categories: st?.categories || {},
        });

        // Non-auth public analytics and queries for demo stand
        const [demoAnalyticsRes, demoQueriesRes] = await Promise.all([
          fetch(`/v1/demo/analytics?period=${period}`),
          fetch('/v1/demo/queries?limit=100'),
        ]);
        if (demoAnalyticsRes.ok) {
          setAnalytics(await demoAnalyticsRes.json());
        }
        if (demoQueriesRes.ok) {
          const qData = await demoQueriesRes.json();
          setQueryLogs(Array.isArray(qData.items) ? qData.items : []);
        }
        return;
      }

      const headers = { 'x-api-key': apiKey };
      const [catRes, sumRes, logRes, dictRes, rankRes, keysRes, statsRes] = await Promise.all([
        fetch('/v1/admin/catalog/summary', { headers }),
        fetch(`/v1/admin/analytics/summary?period=${period}`, { headers }),
        fetch(`/v1/admin/queries?limit=100&period=${period}`, { headers }),
        fetch('/v1/admin/dictionaries', { headers }),
        fetch('/v1/admin/ranking-defaults', { headers }),
        fetch('/v1/admin/keys', { headers }),
        fetch('/v1/admin/stats', { headers }),
      ]);

      if (catRes.status === 401 || catRes.status === 403) {
        setAuthWarning(
          lang === 'ru'
            ? 'Указанный ADMIN_KEY не прошёл проверку для /v1/admin/*. Укажите действительный административный ключ в верхнем поле.'
            : 'ADMIN_KEY rejected (401/403) for /v1/admin/*. Enter a valid Admin Key in the top bar.'
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
    } catch {
      // Non-blocking background refresh
    }
  }, [apiKey, isPublicDemo, period, lang]);

  useEffect(() => {
    void fetchAdminData();
  }, [fetchAdminData]);

  const handleReloadDemoCatalog = async () => {
    setIsIndexingDemo(true);
    try {
      await fetch('/v1/demo/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scale: '1000' }),
      });
      await fetchAdminData();
    } catch {
      // Ignore network errors
    } finally {
      setIsIndexingDemo(false);
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

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 flex flex-col"
      data-testid="eidos-admin-console"
    >
      {isPublicDemo && (
        <div
          className="bg-slate-900 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
          data-testid="public-demo-banner"
        >
          <span>{c.demoBanner}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('docs')}
              className="underline font-medium text-emerald-300 hover:text-white"
            >
              {c.demoCta}
            </button>
            <button
              type="button"
              onClick={() => switchSurface('admin')}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
            >
              {lang === 'ru' ? 'Перейти в EIDOS Admin →' : 'Open EIDOS Admin →'}
            </button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-slate-900 tracking-tight">
                {isPublicDemo ? 'EIDOS Public Demo' : c.brandTitle}
              </span>
              <span className="px-1.5 py-0.5 text-[11px] font-mono bg-slate-100 border border-slate-200 rounded text-slate-700">
                v3.4.0
              </span>
            </div>
            <div className="text-xs text-slate-500">{c.brandSubtitle}</div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800">
              SKU: {catalogSummary?.itemsIndexed ?? 0}
            </span>
            <span
              className={`px-2 py-0.5 rounded font-semibold ${
                readyPayload?.ready
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              Ready: {readyPayload?.ready ? 'OK' : 'WARN'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isPublicDemo && (
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                try {
                  sessionStorage.setItem('eidos_admin_key', e.target.value);
                } catch {
                  // Ignore sessionStorage errors
                }
              }}
              aria-label="Admin API Key"
              placeholder="ADMIN_KEY"
              className="w-36 px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-300 rounded text-slate-800"
            />
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              data-testid="switch-surface-admin"
              onClick={() => switchSurface('admin')}
              className={`px-2.5 py-1 text-xs font-medium rounded ${
                !isPublicDemo ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {c.switchToAdmin}
            </button>
            <button
              type="button"
              data-testid="switch-surface-demo"
              onClick={() => switchSurface('public-demo')}
              className={`px-2.5 py-1 text-xs font-medium rounded ${
                isPublicDemo ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {c.switchToDemo}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
            className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
          >
            {lang.toUpperCase()}
          </button>

          {onReturnToStudio && (
            <button
              type="button"
              data-testid="admin-return-to-studio"
              onClick={onReturnToStudio}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 underline"
            >
              {c.switchToStudio}
            </button>
          )}
        </div>
      </header>

      {authWarning && !isPublicDemo && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 text-xs text-amber-900">
          {authWarning}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-60 bg-white border-r border-slate-200 p-3 space-y-1 shrink-0">
          {(isPublicDemo ? PUBLIC_DEMO_TABS : TAB_ORDER).map((tabId) => (
            <button
              key={tabId}
              type="button"
              data-testid={`admin-tab-${tabId}`}
              onClick={() => setActiveTab(tabId)}
              className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === tabId
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {c.tabs[tabId]}
            </button>
          ))}
        </aside>

        <main className="flex-1 p-5 max-w-6xl">
          {activeTab === 'live-search' && (
            <AdminLiveSearchTab
              lang={lang}
              apiKey={isPublicDemo ? '' : apiKey}
              isPublicDemo={isPublicDemo}
              initialQuery={liveQuerySeed}
              defaultAlpha={rankingDefaults.defaultAlpha}
              defaultGate={rankingDefaults.simpleCategoryGate}
              isIndexingDemo={isIndexingDemo}
              totalSkuCount={catalogSummary?.itemsIndexed ?? 0}
              onReloadDemoCatalog={handleReloadDemoCatalog}
              onAddSynonymForQuery={(q) => {
                if (isPublicDemo) return;
                setSynonymPrefill(q);
                setActiveTab('dictionaries');
              }}
              onSearchExecuted={() => {
                if (!isPublicDemo) void fetchAdminData();
              }}
            />
          )}

          {activeTab === 'dashboard' && (
            <AdminDashboardTab
              lang={lang}
              itemsIndexed={catalogSummary?.itemsIndexed ?? 0}
              hnswIndexed={catalogSummary?.hnswIndexed ?? 0}
              readyStatus={Boolean(readyPayload?.ready)}
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
              itemsIndexed={catalogSummary?.itemsIndexed ?? 0}
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
        </main>
      </div>
    </div>
  );
};
