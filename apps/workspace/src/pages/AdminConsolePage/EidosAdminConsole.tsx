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
  const [activeTab, setActiveTab] = useState<AdminTabId>('dashboard');
  const [apiKey, setApiKey] = useState<string>('eidos_dev_key');
  const [liveQuerySeed, setLiveQuerySeed] = useState<string>('недорогие наушники для бега');
  const [synonymPrefill, setSynonymPrefill] = useState<string>('');
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');

  const [readyPayload, setReadyPayload] = useState<any>({ ready: true, components: {} });
  const [catalogSummary, setCatalogSummary] = useState<any>({ itemsIndexed: 0, hnswIndexed: 0, categories: {} });
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

  const fetchAdminData = useCallback(async () => {
    try {
      const rRes = await fetch('/v1/ready');
      if (rRes.ok) {
        setReadyPayload(await rRes.json());
      }
      if (isPublicDemo) {
        await fetch('/v1/demo/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scale: '48' }),
        });
        const stRes = await fetch('/v1/catalog/stats');
        if (stRes.ok) {
          const st = await stRes.json();
          setCatalogSummary({
            itemsIndexed: st.itemsIndexed ?? 48,
            hnswIndexed: st.hnswIndexed ?? 48,
            categories: st.categories || {},
          });
        }
        return;
      }

      const headers = { 'x-api-key': apiKey };
      const [catRes, sumRes, logRes, dictRes, rankRes, keysRes, statsRes] = await Promise.all([
        fetch('/v1/admin/catalog/summary', { headers }),
        fetch(`/v1/admin/analytics/summary?period=${period}`, { headers }),
        fetch('/v1/admin/queries?limit=50', { headers }),
        fetch('/v1/admin/dictionaries', { headers }),
        fetch('/v1/admin/ranking-defaults', { headers }),
        fetch('/v1/admin/keys', { headers }),
        fetch('/v1/admin/stats', { headers }),
      ]);

      if (catRes.ok) setCatalogSummary(await catRes.json());
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
  }, [apiKey, isPublicDemo, period]);

  useEffect(() => {
    void fetchAdminData();
  }, [fetchAdminData]);

  const handleRefreshLogs = async (filters: { q: string; emptyOnly: boolean }) => {
    try {
      const qs = new URLSearchParams({
        q: filters.q,
        emptyOnly: String(filters.emptyOnly),
        limit: '50',
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col" data-testid="eidos-admin-console">
      {isPublicDemo && (
        <div
          className="bg-slate-900 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
          data-testid="public-demo-banner"
        >
          <span>{c.demoBanner}</span>
          <button
            type="button"
            onClick={() => setSurfaceMode('admin')}
            className="underline font-medium text-emerald-300 hover:text-white"
          >
            {c.demoCta}
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-base font-semibold text-slate-900 tracking-tight">
              {isPublicDemo ? 'EIDOS Public Demo' : c.brandTitle}
            </div>
            <div className="text-xs text-slate-500">{c.brandSubtitle}</div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>SKU: {catalogSummary?.itemsIndexed ?? 0}</span>
            <span>·</span>
            <span>Ready: {readyPayload?.ready ? 'OK' : 'WARN'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isPublicDemo && (
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              aria-label="Admin API Key"
              placeholder="ADMIN_KEY"
              className="w-36 px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-300 rounded text-slate-800"
            />
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              data-testid="switch-surface-admin"
              onClick={() => setSurfaceMode('admin')}
              className={`px-2.5 py-1 text-xs font-medium rounded ${
                !isPublicDemo ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {c.switchToAdmin}
            </button>
            <button
              type="button"
              data-testid="switch-surface-demo"
              onClick={() => {
                setSurfaceMode('public-demo');
                setActiveTab('live-search');
              }}
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
              onClick={onReturnToStudio}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 underline"
            >
              {c.switchToStudio}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        {!isPublicDemo && (
          <aside className="w-full md:w-60 bg-white border-r border-slate-200 p-3 space-y-1 shrink-0">
            {TAB_ORDER.map((tabId) => (
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
        )}

        <main className="flex-1 p-5 max-w-6xl">
          {(isPublicDemo || activeTab === 'live-search') && (
            <AdminLiveSearchTab
              lang={lang}
              apiKey={isPublicDemo ? '' : apiKey}
              isPublicDemo={isPublicDemo}
              initialQuery={liveQuerySeed}
              defaultAlpha={rankingDefaults.defaultAlpha}
              defaultGate={rankingDefaults.simpleCategoryGate}
              onAddSynonymForQuery={(q) => {
                setSynonymPrefill(q);
                setActiveTab('dictionaries');
              }}
              onSearchExecuted={() => {
                if (!isPublicDemo) void fetchAdminData();
              }}
            />
          )}

          {!isPublicDemo && activeTab === 'dashboard' && (
            <AdminDashboardTab
              lang={lang}
              itemsIndexed={catalogSummary?.itemsIndexed ?? 0}
              hnswIndexed={catalogSummary?.hnswIndexed ?? 0}
              readyStatus={Boolean(readyPayload?.ready)}
              lastSnapshotAt={lastSnapshotAt}
              analytics={analytics}
              onNavigateTab={setActiveTab}
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

          {!isPublicDemo && (activeTab === 'system' || activeTab === 'docs') && (
            <AdminSystemAndDocsTabs
              mode={activeTab}
              lang={lang}
              readyPayload={readyPayload}
              onCreateSnapshot={async () => {
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
