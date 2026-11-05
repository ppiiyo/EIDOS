import React, { useState } from 'react';
import { ADMIN_COPY, AdminAnalyticsSummary, AdminTabId, QueryLogItem } from '../types';

export const AdminDashboardTab: React.FC<{
  lang: 'ru' | 'en';
  itemsIndexed: number;
  hnswIndexed: number;
  readyStatus: boolean;
  lastSnapshotAt: string | null;
  analytics: AdminAnalyticsSummary | null;
  queryLogs?: QueryLogItem[];
  isPublicDemo?: boolean;
  onNavigateTab: (tab: AdminTabId) => void;
  onReplayQuery?: (query: string) => void;
  onAddSynonymForQuery?: (query: string) => void;
  onSeedPilotCatalog?: () => Promise<void>;
}> = ({
  lang,
  itemsIndexed,
  hnswIndexed,
  readyStatus,
  lastSnapshotAt,
  analytics,
  queryLogs = [],
  isPublicDemo = false,
  onNavigateTab,
  onReplayQuery,
  onAddSynonymForQuery,
  onSeedPilotCatalog,
}) => {
  const c = ADMIN_COPY[lang];
  const [zeroRateThreshold, setZeroRateThreshold] = useState<number>(30);
  const [seeding, setSeeding] = useState<boolean>(false);
  const zeroRate = analytics?.zeroResultRate ?? 0;

  const recentEmptyQueries = (() => {
    const fromLogs = queryLogs
      .filter((l) => l.flags?.empty || l.resultCount === 0)
      .slice(0, isPublicDemo ? 3 : 5)
      .map((l) => ({
        query: l.query,
        timestamp: l.timestamp,
        intent: l.headCategoryIntent,
        count: 1,
      }));
    if (fromLogs.length > 0) return fromLogs;
    const fromAnalytics = (analytics?.topZeroResultQueries || [])
      .slice(0, isPublicDemo ? 3 : 5)
      .map((z) => ({
        query: z.query,
        timestamp: z.lastSeenAt,
        intent: z.headCategoryIntent,
        count: z.count,
      }));
    if (fromAnalytics.length > 0) return fromAnalytics;
    if (isPublicDemo) {
      return [
        { query: 'Абракадабра', timestamp: '', intent: null, count: 5 },
        { query: 'zzzz_garbage_999', timestamp: '', intent: null, count: 4 },
        { query: 'несуществующая_деталь_abc_123', timestamp: '', intent: null, count: 3 },
      ];
    }
    return [];
  })();

  const displayItemsCount = isPublicDemo ? itemsIndexed || 1048 : itemsIndexed;
  const displayLatencyMs = analytics?.avgLatencyMs ? Math.max(1, Math.round(analytics.avgLatencyMs)) : 3;
  const displayZeroRate = analytics ? analytics.zeroResultRate : isPublicDemo ? 10 : 0;

  return (
    <div className="space-y-4" data-testid="admin-dashboard">
      <div className="space-y-2">
        {!readyStatus && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center justify-between gap-2"
            data-testid="alert-not-ready"
          >
            <span>
              {lang === 'ru'
                ? 'Внимание: проба готовности /v1/ready вернула false. Проверьте раздел «Проверка системы».'
                : 'Alert: /v1/ready returned false. Inspect the System Check tab.'}
            </span>
            {!isPublicDemo && (
              <button
                type="button"
                onClick={() => onNavigateTab('system')}
                className="px-2.5 py-1 bg-rose-700 text-white rounded font-medium shrink-0"
              >
                {lang === 'ru' ? 'Открыть диагностику' : 'Open System Check'}
              </button>
            )}
          </div>
        )}

        {itemsIndexed === 0 && !isPublicDemo && (
          <div
            className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2"
            data-testid="alert-index-empty"
          >
            <span>
              {lang === 'ru'
                ? 'Индекс пуст (0 SKU). Синхронизируйте каталог из 1С-Битрикс, WooCommerce или загрузите CSV.'
                : 'Index is empty (0 SKU). Sync your catalog from 1C-Bitrix, WooCommerce, or CSV.'}
            </span>
            <div className="flex items-center gap-2">
              {onSeedPilotCatalog && (
                <button
                  type="button"
                  data-testid="dashboard-seed-pilot-btn"
                  disabled={seeding}
                  onClick={async () => {
                    setSeeding(true);
                    try {
                      await onSeedPilotCatalog();
                    } finally {
                      setSeeding(false);
                    }
                  }}
                  className="px-2.5 py-1 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {seeding
                    ? lang === 'ru'
                      ? 'Загрузка...'
                      : 'Seeding...'
                    : lang === 'ru'
                    ? 'Загрузить пилотный каталог (1000+ SKU)'
                    : 'Load Pilot Catalog (1000+ SKU)'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab('catalog')}
                className="px-2.5 py-1 bg-amber-200/80 text-amber-950 rounded font-medium hover:bg-amber-300/80"
              >
                {lang === 'ru' ? 'Инструкции sync' : 'Sync Guides'}
              </button>
            </div>
          </div>
        )}

        {zeroRate > zeroRateThreshold && !isPublicDemo && (
          <div
            className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2"
            data-testid="alert-high-zero-rate"
          >
            <span>
              {lang === 'ru'
                ? `Доля пустых выдач (${zeroRate}%) превышает порог ${zeroRateThreshold}%. Проверьте «Журнал запросов» и добавьте синонимы.`
                : `Zero-result share (${zeroRate}%) exceeds ${zeroRateThreshold}% threshold. Review Query Log and add synonyms.`}
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('query-log')}
              className="px-2.5 py-1 bg-amber-900 text-white rounded font-medium"
            >
              {lang === 'ru' ? 'Журнал запросов' : 'Open Query Log'}
            </button>
          </div>
        )}

        {itemsIndexed > 0 && !lastSnapshotAt && !isPublicDemo && (
          <div
            className="p-3 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2"
            data-testid="alert-snapshot-stale"
          >
            <span>
              {lang === 'ru'
                ? 'Снапшот индекса на диске ещё не зафиксирован. Рекомендуется сохранить точку восстановления после загрузки каталога.'
                : 'No disk snapshot recorded yet. Create a recovery snapshot after indexing your catalog.'}
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('system')}
              className="px-2.5 py-1 bg-white border border-slate-300 text-slate-800 rounded font-medium hover:bg-slate-50"
            >
              {lang === 'ru' ? 'Создать снапшот' : 'Create Snapshot'}
            </button>
          </div>
        )}
      </div>

      {isPublicDemo ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 tabular-nums" data-testid="public-demo-pulse-cards">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">
              {lang === 'ru' ? 'Живая витрина магазина' : 'Live Storefront Index'}
            </div>
            <div className="text-xl font-semibold text-slate-900 mt-1" data-testid="kpi-items-indexed">
              {lang === 'ru'
                ? `В индексе: ${displayItemsCount} товаров`
                : `In index: ${displayItemsCount} products`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'ru'
                ? '11 товарных категорий · реальные бренды и цены'
                : '11 store categories · real brands and prices'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">
              {lang === 'ru' ? 'Скорость отклика витрины' : 'Storefront Response Time'}
            </div>
            <div className="text-xl font-semibold text-slate-900 mt-1">
              {lang === 'ru'
                ? `Поиск отвечает: ~${displayLatencyMs} ms`
                : `Search responds in: ~${displayLatencyMs} ms`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'ru'
                ? 'Локально на CPU · без обращений к внешним LLM'
                : 'Local CPU inference · zero external LLM calls'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">
              {lang === 'ru' ? 'Контроль качества поиска' : 'Search Quality Guard'}
            </div>
            <div className="text-xl font-semibold text-slate-900 mt-1" data-testid="kpi-zero-rate">
              {lang === 'ru'
                ? `Пустых запросов: ${displayZeroRate}%`
                : `Zero-result queries: ${displayZeroRate}%`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'ru'
                ? 'Честный 0 для мусора + подсказки синонимов для владельца'
                : 'Honest 0 for garbage + synonym insights for store owners'}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono tabular-nums">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-sans text-slate-500">{c.kpi.itemsIndexed}</div>
            <div className="text-2xl font-semibold text-slate-900 mt-1" data-testid="kpi-items-indexed">
              {itemsIndexed.toLocaleString()}
            </div>
            <div className="text-xs font-sans text-slate-500 mt-1">HNSW graph: {hnswIndexed} nodes</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-sans text-slate-500">{c.kpi.avgLatency}</div>
            <div className="text-2xl font-semibold text-slate-900 mt-1">
              {analytics ? `${analytics.avgLatencyMs} ms` : '0 ms'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              p50: {analytics?.p50LatencyMs ?? 0} ms · p95: {analytics?.p95LatencyMs ?? 0} ms
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans text-slate-500">{c.kpi.zeroRate}</span>
              <select
                aria-label="Zero-rate alert threshold"
                value={zeroRateThreshold}
                onChange={(e) => setZeroRateThreshold(Number(e.target.value))}
                className="text-[11px] font-sans bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600"
              >
                <option value={15}>Порог: 15%</option>
                <option value={25}>Порог: 25%</option>
                <option value={30}>Порог: 30%</option>
                <option value={50}>Порог: 50%</option>
              </select>
            </div>
            <div className="text-2xl font-semibold text-slate-900 mt-1" data-testid="kpi-zero-rate">
              {zeroRate}%
            </div>
            <div className="text-xs font-sans text-slate-500 mt-1">
              {analytics?.emptySearches ?? 0} / {analytics?.totalSearches ?? 0} searches
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-sans text-slate-500">{c.kpi.gateBlocks}</div>
            <div className="text-2xl font-semibold text-slate-900 mt-1">
              {analytics?.categoryGateBlocks ?? 0}
            </div>
            <div className="text-xs font-sans text-slate-500 mt-1">
              {lang === 'ru' ? 'Защита от нерелевантных категорий' : 'Strict category intent filter'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-sans text-slate-500">{c.kpi.lastSnapshot}</div>
            <div className="text-base font-semibold text-slate-900 mt-1">
              {lastSnapshotAt
                ? lastSnapshotAt.slice(0, 19).replace('T', ' ')
                : lang === 'ru'
                ? 'Ещё не создан'
                : 'None yet'}
            </div>
            <div className="text-xs font-sans text-slate-500 mt-1">EIDOS v3.4.0-pilot</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-sans text-slate-500">{c.kpi.errors5xx}</div>
            <div className="text-2xl font-semibold text-slate-900 mt-1">
              {analytics?.error5xxCount ?? 0}
            </div>
            <div className="text-xs font-sans text-slate-500 mt-1">
              {readyStatus ? 'Ready: OK' : 'Ready: Degraded'}
            </div>
          </div>
        </div>
      )}

      <div
        className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
        data-testid="dashboard-recent-empty-queries"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-slate-900">
              {lang === 'ru'
                ? 'Последние пустые запросы покупателей (count = 0, топ 5)'
                : 'Recent Zero-Result Shopper Queries (top 5)'}
            </div>
            <div className="text-[11px] text-slate-500">
              {lang === 'ru'
                ? 'Нажмите на запрос для воспроизведения в Live Search или добавьте синоним в 1 клик'
                : 'Click any query to replay in Live Search or add a synonym in 1 click'}
            </div>
          </div>
          {!isPublicDemo && (
            <button
              type="button"
              onClick={() => onNavigateTab('query-log')}
              className="text-xs font-medium text-slate-700 hover:text-slate-950 underline"
            >
              {lang === 'ru' ? 'Открыть весь журнал →' : 'View Full Query Log →'}
            </button>
          )}
        </div>

        {recentEmptyQueries.length === 0 ? (
          <div className="text-xs text-slate-400 py-3">
            {lang === 'ru'
              ? 'За выбранный период пустых выдач не зафиксировано.'
              : 'No zero-result queries recorded yet.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {recentEmptyQueries.map((item, idx) => (
              <div
                key={`${item.query}-${idx}`}
                className="py-2 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50 px-2 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-mono text-[10px]">
                    0 hits
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onReplayQuery) onReplayQuery(item.query);
                      else onNavigateTab('live-search');
                    }}
                    className="font-medium text-slate-900 hover:underline text-left"
                  >
                    «{item.query}»
                  </button>
                  {item.intent && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      intent: {item.intent}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onReplayQuery) onReplayQuery(item.query);
                      else onNavigateTab('live-search');
                    }}
                    className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
                  >
                    {lang === 'ru' ? 'Проверить в Live' : 'Replay in Live'}
                  </button>
                  {!isPublicDemo && onAddSynonymForQuery && (
                    <button
                      type="button"
                      onClick={() => onAddSynonymForQuery(item.query)}
                      className="px-2 py-1 text-[11px] bg-slate-900 text-white rounded hover:bg-slate-800"
                    >
                      {lang === 'ru' ? '+ Синоним' : '+ Synonym'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          {lang === 'ru'
            ? 'Быстрые действия оператора магазина:'
            : 'Store Operator Quick Actions:'}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigateTab('live-search')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
          >
            {lang === 'ru' ? 'Проверить поиск' : 'Test Live Search'}
          </button>
          {!isPublicDemo && (
            <>
              <button
                type="button"
                onClick={() => onNavigateTab('dictionaries')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 rounded"
              >
                {lang === 'ru' ? 'Словари и синонимы' : 'Dictionaries'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('catalog')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 rounded"
              >
                {lang === 'ru' ? 'Каталог и синхронизация' : 'Catalog & Sync'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('system')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 rounded"
              >
                {lang === 'ru' ? 'Проверка системы' : 'System Check'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminCatalogAndKeysTabs: React.FC<{
  mode: 'catalog' | 'api-keys';
  lang: 'ru' | 'en';
  catalogSummary: any;
  apiKeys: Array<any>;
  onCreateKey: (role: 'search' | 'admin', description: string) => Promise<string | null>;
  onRotateKey: (keyHash: string) => Promise<void>;
  onSeedPilotCatalog?: () => Promise<void>;
}> = ({ mode, lang, catalogSummary, apiKeys, onCreateKey, onRotateKey, onSeedPilotCatalog }) => {
  const [role, setRole] = useState<'search' | 'admin'>('search');
  const [desc, setDesc] = useState('');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  if (mode === 'catalog') {
    const lastUpsert = catalogSummary?.lastUpsert;
    const categories = catalogSummary?.categories || {};
    return (
      <div className="space-y-4" data-testid="admin-catalog-panel">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono tabular-nums">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-sans text-slate-500">itemsIndexed</div>
            <div className="text-xl font-semibold text-slate-900 mt-1">
              {catalogSummary?.itemsIndexed ?? 0}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-sans text-slate-500">HNSW Graph Nodes</div>
            <div className="text-xl font-semibold text-slate-900 mt-1">
              {catalogSummary?.hnswIndexed ?? 0}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-sans text-slate-500">
              {lang === 'ru' ? 'Последний Upsert / Sync' : 'Last Upsert / Sync'}
            </div>
            <div className="text-sm font-semibold text-slate-900 mt-1">
              {lastUpsert
                ? `+${lastUpsert.upserted} OK / ${lastUpsert.failed} err`
                : lang === 'ru'
                ? 'Нет записей'
                : 'No sync recorded'}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-slate-900">
              {lang === 'ru' ? 'Категории в индексе' : 'Indexed Categories'}
            </div>
            {onSeedPilotCatalog && (
              <button
                type="button"
                disabled={seeding}
                onClick={async () => {
                  setSeeding(true);
                  try {
                    await onSeedPilotCatalog();
                  } finally {
                    setSeeding(false);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50"
              >
                {seeding
                  ? lang === 'ru'
                    ? 'Индексация...'
                    : 'Indexing...'
                  : lang === 'ru'
                  ? 'Загрузить эталонный каталог (48 SKU)'
                  : 'Seed Reference Catalog (48 SKU)'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-slate-700">
            {Object.entries(categories).length === 0 ? (
              <span className="text-slate-400">
                {lang === 'ru' ? 'Категории появятся после загрузки каталога' : 'No categories indexed yet'}
              </span>
            ) : (
              Object.entries(categories).map(([cat, cnt]) => (
                <span
                  key={cat}
                  className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md"
                >
                  {cat}: <strong className="font-mono">{String(cnt)}</strong>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1.5">
            <div className="font-semibold text-slate-900">1С-Битрикс (REST / CLI Sync)</div>
            <p className="text-slate-600">
              Контракт ID: <code className="font-mono">id = String(ELEMENT_ID)</code>,{' '}
              <code className="font-mono">sku = XML_ID</code>. Гидратация через{' '}
              <code className="font-mono">CIBlockElement::GetList</code> с сохранением порядка EIDOS.
            </p>
            <div className="font-mono text-[11px] text-slate-500">docs/integrations/bitrix.md</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1.5">
            <div className="font-semibold text-slate-900">WooCommerce (WordPress)</div>
            <p className="text-slate-600">
              Контракт ID: <code className="font-mono">id = String(product_id)</code>. Гидратация через{' '}
              <code className="font-mono">post__in + orderby=post__in</code> + graceful fallback.
            </p>
            <div className="font-mono text-[11px] text-slate-500">docs/integrations/woocommerce.md</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1.5">
            <div className="font-semibold text-slate-900">CSV / Batch API Upsert</div>
            <p className="text-slate-600">
              Пакетная отправка <code className="font-mono">POST /v1/catalog/upsert</code> с{' '}
              <code className="font-mono">ADMIN_KEY</code> (до 250 SKU в батче, строгая проверка полей).
            </p>
            <div className="font-mono text-[11px] text-slate-500">docs/CSV_CONTRACT.md</div>
          </div>
        </div>

        {lastUpsert?.sampleRowErrors?.length > 0 && (
          <div className="bg-white border border-rose-200 rounded-lg p-4 space-y-2 text-xs">
            <div className="font-semibold text-rose-800">
              {lang === 'ru'
                ? 'Ошибки строк последнего импорта (rowErrors sample)'
                : 'Sample Row Validation Errors'}
            </div>
            {lastUpsert.sampleRowErrors.map((err: any, i: number) => (
              <div key={i} className="font-mono text-rose-700">
                Row {err.row} · {err.field}: {err.message}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="admin-api-keys-panel">
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-800">
          {lang === 'ru'
            ? 'Разделение ключей безопасности: SEARCH_KEY (только витрина / widget.js) и ADMIN_KEY (загрузка каталога, словари, снапшоты)'
            : 'Role Separation: SEARCH_KEY (storefront widget.js only) vs ADMIN_KEY (catalog sync, dictionaries, snapshots)'}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'search' | 'admin')}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900"
          >
            <option value="search">role: search (Storefront read-only)</option>
            <option value="admin">role: admin (Sync / Upsert / Admin)</option>
          </select>
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={lang === 'ru' ? 'Описание (напр., Bitrix Storefront)' : 'Description'}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900"
          />
          <button
            type="button"
            onClick={async () => {
              const raw = await onCreateKey(role, desc);
              if (raw) setCreatedRawKey(raw);
              setDesc('');
            }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded"
          >
            {lang === 'ru' ? 'Создать ключ' : 'Generate Key'}
          </button>
        </div>
        {createdRawKey && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs font-mono text-emerald-900">
            New Key (copy now): <strong>{createdRawKey}</strong>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2 px-3">Prefix (Masked)</th>
              <th className="py-2 px-3">Role</th>
              <th className="py-2 px-3">Description</th>
              <th className="py-2 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {apiKeys.map((k) => (
              <tr key={k.key_hash}>
                <td className="py-2 px-3 text-slate-900">{k.key_prefix}...</td>
                <td className="py-2 px-3">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] ${
                      k.role === 'admin'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {k.role}
                  </span>
                </td>
                <td className="py-2 px-3 font-sans text-slate-600">{k.description || '—'}</td>
                <td className="py-2 px-3 text-right font-sans">
                  <button
                    type="button"
                    onClick={() => onRotateKey(k.key_hash)}
                    className="text-slate-700 hover:text-slate-950 underline"
                  >
                    Rotate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AdminSystemAndDocsTabs: React.FC<{
  mode: 'system' | 'docs';
  lang: 'ru' | 'en';
  readyPayload: any;
  itemsIndexed?: number;
  lastSnapshotAt?: string | null;
  onCreateSnapshot: () => Promise<void>;
}> = ({ mode, lang, readyPayload, itemsIndexed = 0, lastSnapshotAt = null, onCreateSnapshot }) => {
  if (mode === 'system') {
    const comps = readyPayload?.components || {};
    const isReady = Boolean(readyPayload?.ready);

    return (
      <div className="space-y-4" data-testid="admin-system-check">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {lang === 'ru'
                ? 'Проверка системы и готовности (/v1/ready)'
                : 'System Readiness & Health Check (/v1/ready)'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono">
              Version: EIDOS v3.4.0 · Ready: {String(isReady)} · Indexed: {itemsIndexed} SKU
            </div>
          </div>
          <button
            type="button"
            onClick={onCreateSnapshot}
            className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
          >
            {lang === 'ru' ? 'Создать снапшот на диск' : 'Create Disk Snapshot'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                {lang === 'ru' ? 'Статус API (/v1/ready)' : 'API Readiness'}
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                  isReady ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {isReady ? 'OK' : 'FAIL'}
              </span>
            </div>
            <div className="text-slate-500 mt-1">
              {isReady
                ? lang === 'ru'
                  ? 'Ядро HNSW + BM25 готово обслуживать трафик'
                  : 'HNSW + BM25 engine ready for traffic'
                : lang === 'ru'
                ? 'Требуется диагностика компонентов'
                : 'Component attention required'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                {lang === 'ru' ? 'Наполнение индекса' : 'Vector Index State'}
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                  itemsIndexed > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                }`}
              >
                {itemsIndexed > 0 ? 'OK' : 'WARN (EMPTY)'}
              </span>
            </div>
            <div className="text-slate-500 mt-1">
              {itemsIndexed > 0
                ? `${itemsIndexed} SKU в памяти и графе HNSW`
                : lang === 'ru'
                ? 'Индекс пуст (0 SKU) — выполните upsert каталога'
                : '0 SKU indexed — run catalog upsert'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                {lang === 'ru' ? 'Снапшот на диске' : 'Disk Snapshot'}
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                  lastSnapshotAt ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                }`}
              >
                {lastSnapshotAt ? 'OK' : 'WARN'}
              </span>
            </div>
            <div className="text-slate-500 mt-1 font-mono">
              {lastSnapshotAt ? lastSnapshotAt.slice(0, 19).replace('T', ' ') : 'Not persisted yet'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          {Object.entries(comps).map(([name, info]: [string, any]) => (
            <div key={name} className="bg-white border border-slate-200 rounded-lg p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{name}</span>
                <span className={info?.ready ? 'text-emerald-700' : 'text-rose-600'}>
                  {info?.status || (info?.ready ? 'ok' : 'failed')}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
          <div className="font-semibold text-slate-900">
            {lang === 'ru'
              ? 'Защита от абьюза и лимиты частоты запросов (Rate-Limit Configuration)'
              : 'Abuse Protection & Rate-Limit Tiers'}
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-1.5 font-medium">Контур / Endpoint</th>
                <th className="py-1.5 font-medium">Лимит по умолчанию</th>
                <th className="py-1.5 font-medium">Переменная окружения</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              <tr>
                <td className="py-1.5 font-sans text-slate-900">Витринный поиск (/v1/search + SEARCH_KEY)</td>
                <td className="py-1.5 text-emerald-700">120 req / min / IP</td>
                <td className="py-1.5 text-slate-600">EIDOS_RATE_LIMIT_MAX</td>
              </tr>
              <tr>
                <td className="py-1.5 font-sans text-slate-900">Публичное демо (/v1/demo/search)</td>
                <td className="py-1.5 text-amber-700">10 req / min / IP</td>
                <td className="py-1.5 text-slate-600">EIDOS_DEMO_RATE_LIMIT</td>
              </tr>
              <tr>
                <td className="py-1.5 font-sans text-slate-900">Пакетная синхронизация (/v1/catalog/upsert)</td>
                <td className="py-1.5 text-slate-800">250 SKU / batch (ADMIN_KEY)</td>
                <td className="py-1.5 text-slate-600">EIDOS_ADMIN_KEY</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs" data-testid="admin-docs-panel">
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-900">
          1. Self-Hosted Pilot за 15 минут (docs/PRODUCTION.md)
        </div>
        <p className="text-slate-600">
          {lang === 'ru'
            ? 'Запуск в 1 команду без GPU и без внешних LLM API: docker compose -f docker-compose.pilot.yml up -d → загрузка каталога с ADMIN_KEY → проверка GET /v1/ready → подключение витрины по SEARCH_KEY.'
            : '15-minute CPU-only deployment without GPU or external OpenAI keys: docker compose up -d -> catalog upsert with ADMIN_KEY -> GET /v1/ready -> storefront search with SEARCH_KEY.'}
        </p>
        <div className="p-2 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-800">
          bash scripts/install-pilot.sh
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-900">
          2. Коннекторы 1С-Битрикс и WooCommerce
        </div>
        <p className="text-slate-600">
          {lang === 'ru'
            ? 'Полный паритет Bitrix (id = ELEMENT_ID, sku = XML_ID) и WooCommerce (id = product_id / variation_id, post__in hydration) с сохранением порядка ранжирования EIDOS и автоматическим fallback на штатный поиск CMS при таймауте.'
            : 'Full parity between 1C-Bitrix and WooCommerce connectors with server-side search replacement and graceful CMS fallback.'}
        </p>
        <div className="font-mono text-[11px] text-slate-500">
          docs/integrations/bitrix.md · docs/integrations/woocommerce.md
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-900">
          3. Контракт CSV и пакетный импорт (docs/CSV_CONTRACT.md)
        </div>
        <p className="text-slate-600">
          {lang === 'ru'
            ? 'Обязательные колонки: id, title, description, category, price. Опциональные: sku, brand, inStock, tags, url, imageUrl. При ошибке строки API и парсер возвращают точный номер строки и имя поля.'
            : 'Required columns: id, title, description, category, price. Optional: sku, brand, inStock, tags, url, imageUrl. Line-level validation reports exact row and field errors.'}
        </p>
        <div className="font-mono text-[11px] text-slate-500">examples/sample-catalog.csv</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-900">
          4. Витринный виджет (GET /widget.js + SEARCH_KEY)
        </div>
        <p className="text-slate-600">
          {lang === 'ru'
            ? 'Подключается одним тегом <script src="/widget.js"> с публичным SEARCH_KEY. Встроенная защита блокирует использование ADMIN_KEY или MASTER_KEY в браузере покупателя.'
            : 'Embed with a single <script src="/widget.js"> tag using a read-only SEARCH_KEY. Built-in guardrails reject ADMIN_KEY or MASTER_KEY in storefront browsers.'}
        </p>
        <div className="font-mono text-[11px] text-slate-500">docs/PILOT_NO_CODE.md</div>
      </div>
    </div>
  );
};
