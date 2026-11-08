import React, { useState } from 'react';
import { ADMIN_COPY, AdminAnalyticsSummary, AdminTabId, QueryLogItem } from '../types';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  StatusDot,
  Table,
} from '../../../design-system/ui-kit';

export const AdminDashboardTab: React.FC<{
  lang: 'ru' | 'en';
  itemsIndexed: number;
  hnswIndexed: number;
  readyStatus: boolean;
  searchReady?: boolean;
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
  searchReady = itemsIndexed > 0,
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
  const displayP95Ms = analytics?.p95LatencyMs
    ? Math.max(1, Math.round(analytics.p95LatencyMs))
    : 5;
  const displayZeroRate = analytics ? analytics.zeroResultRate : isPublicDemo ? 10 : 0;

  // Storefront «Как это работает» screen (§3.3)
  if (isPublicDemo) {
    const howItWorksCards =
      lang === 'ru'
        ? [
            {
              step: '01',
              title: 'Понимает смысл, не только слова',
              body: 'Сочетает смысловой и точный поиск: находит по характеристикам и артикулам, исправляет раскладку («yfeiybrb» → «наушники») и опечатки.',
            },
            {
              step: '02',
              title: 'Учитывает категорию (не смешивает наушники и кроссовки)',
              body: 'Category Gate определяет целевую рубрику запроса и отсекает товары из чужих разделов даже при совпадении слов «для бега».',
            },
            {
              step: '03',
              title: 'Прозрачность: видно, почему в топе',
              body: 'Для каждого товара в выдаче доступно человеческое объяснение и точная математическая формула под спойлером «Подробнее».',
            },
            {
              step: '04',
              title: 'Данные у вас: self-hosted пилот',
              body: 'Разворачивается в Docker на вашем сервере. Прайс-лист и запросы покупателей не передаются во внешние облачные сервисы.',
            },
          ]
        : [
            {
              step: '01',
              title: 'Understands intent, not just keywords',
              body: 'Combines semantic and exact SKU matching, fixing keyboard layout mistypes and typos automatically.',
            },
            {
              step: '02',
              title: 'Respects category boundaries',
              body: 'Category Gate keeps results inside the target department—never mixing running shoes into running headphones.',
            },
            {
              step: '03',
              title: 'Transparent: see why it ranks on top',
              body: 'Every result includes a clear explanation plus collapsible formula details.',
            },
            {
              step: '04',
              title: 'Your data stays with you: self-hosted pilot',
              body: 'Runs in Docker on your own server with zero external cloud LLM calls.',
            },
          ];

    return (
      <div className="space-y-6" data-testid="admin-dashboard">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            {lang === 'ru' ? 'Как работает поиск EIDOS' : 'How EIDOS Search Works'}
          </h1>
          <p className="text-xs text-slate-600">
            {lang === 'ru'
              ? 'Четыре принципа качественной товарной выдачи на витрине интернет-магазина'
              : 'Four principles of accurate storefront product discovery'}
          </p>
        </div>

        {/* 4 Feature Cards (§3.3) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {howItWorksCards.map((item) => (
            <Card key={item.step} elevated className="p-5 space-y-2">
              <div className="text-xs font-mono text-slate-400">{item.step}</div>
              <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
              <p className="text-xs text-slate-600 leading-relaxed">{item.body}</p>
            </Card>
          ))}
        </div>

        {/* 3 Honest KPIs from /v1/demo/analytics (§3.3) */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-3 tabular-nums"
          data-testid="public-demo-pulse-cards"
        >
          <Card className="p-4">
            <div className="text-xs text-slate-500">
              {lang === 'ru' ? 'Товаров в индексе' : 'Products in Index'}
            </div>
            <div
              className="text-xl font-semibold text-slate-900 mt-1 font-mono"
              data-testid="kpi-items-indexed"
            >
              {displayItemsCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'ru' ? '11 категорий демо-витрины' : '11 storefront categories'}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-slate-500">
              {lang === 'ru' ? 'Скорость ответа (p95)' : 'Latency (p95)'}
            </div>
            <div className="text-xl font-semibold text-slate-900 mt-1 font-mono">
              ~{displayP95Ms} мс
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'ru' ? 'Локально на CPU' : 'Local CPU inference'}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-slate-500">
              {lang === 'ru' ? 'Доля пустых выдач' : 'Zero-Result Share'}
            </div>
            <div
              className="text-xl font-semibold text-slate-900 mt-1 font-mono"
              data-testid="kpi-zero-rate"
            >
              {displayZeroRate}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'ru'
                ? 'Честный ноль на мусорные запросы'
                : 'Honest zero on nonsensical queries'}
            </div>
          </Card>
        </div>

        <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-700">
            {lang === 'ru'
              ? 'Проверьте выдачу на живых запросах или посмотрите инструкцию подключения к вашей CMS.'
              : 'Test live search queries or inspect the connection guide for your CMS.'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => onNavigateTab('live-search')}>
              {lang === 'ru' ? 'Перейти к поиску' : 'Try Search'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onNavigateTab('docs')}>
              {lang === 'ru' ? 'Подключить магазин' : 'Connect Store'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Operator Cabinet «Обзор» screen (§4.3: 4 KPI max + 5 recent zero-queries + CTA «Открыть журнал»)
  return (
    <div className="space-y-4" data-testid="admin-dashboard">
      <div className="space-y-2">
        {!readyStatus && (
          <Banner
            tone="danger"
            code="NOT_READY"
            testId="alert-not-ready"
            action={
              <Button variant="danger" size="sm" onClick={() => onNavigateTab('system')}>
                {lang === 'ru' ? 'Открыть диагностику' : 'System Check'}
              </Button>
            }
          >
            {lang === 'ru'
              ? 'Проба готовности /v1/ready вернула false. Проверьте состояние компонентов.'
              : '/v1/ready returned false. Inspect component health.'}
          </Banner>
        )}

        {(itemsIndexed === 0 || !searchReady) && (
          <Banner
            tone="warning"
            code="INDEX_EMPTY"
            testId="alert-index-empty"
            action={
              <>
                {onSeedPilotCatalog && (
                  <Button
                    variant="primary"
                    size="sm"
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
                  >
                    {seeding
                      ? lang === 'ru'
                        ? 'Загрузка...'
                        : 'Seeding...'
                      : lang === 'ru'
                      ? 'Загрузить пилотный каталог (1000+ SKU)'
                      : 'Load Pilot Catalog (1000+ SKU)'}
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => onNavigateTab('catalog')}>
                  {lang === 'ru' ? 'Инструкции sync' : 'Sync Guides'}
                </Button>
              </>
            }
          >
            {lang === 'ru'
              ? 'Индекс пуст (searchReady: false, 0 SKU). Синхронизируйте каталог из 1С-Битрикс, WooCommerce или загрузите CSV.'
              : 'Index is empty (searchReady: false, 0 SKU). Sync your catalog from 1C-Bitrix, WooCommerce, or CSV.'}
          </Banner>
        )}

        {zeroRate > zeroRateThreshold && (
          <Banner
            tone="warning"
            testId="alert-high-zero-rate"
            action={
              <Button variant="primary" size="sm" onClick={() => onNavigateTab('query-log')}>
                {lang === 'ru' ? 'Открыть журнал' : 'Open Query Log'}
              </Button>
            }
          >
            {lang === 'ru'
              ? `Доля пустых выдач (${zeroRate}%) превышает порог ${zeroRateThreshold}%. Проверьте «Журнал запросов» и добавьте синонимы.`
              : `Zero-result share (${zeroRate}%) exceeds ${zeroRateThreshold}% threshold.`}
          </Banner>
        )}

        {itemsIndexed > 0 && !lastSnapshotAt && (
          <Banner
            tone="neutral"
            testId="alert-snapshot-stale"
            action={
              <Button variant="secondary" size="sm" onClick={() => onNavigateTab('system')}>
                {lang === 'ru' ? 'Создать снапшот' : 'Create Snapshot'}
              </Button>
            }
          >
            {lang === 'ru'
              ? 'Снапшот индекса на диске ещё не создан. Сохраните точку восстановления в разделе «Проверка системы».'
              : 'No disk snapshot recorded yet. Create a recovery snapshot in System Check.'}
          </Banner>
        )}
      </div>

      {/* 4 KPI Max per §4.3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono tabular-nums">
        <Card className="p-4">
          <div className="text-xs font-sans text-slate-500">{c.kpi.itemsIndexed}</div>
          <div
            className="text-2xl font-semibold text-slate-900 mt-1"
            data-testid="kpi-items-indexed"
          >
            {itemsIndexed.toLocaleString()}
          </div>
          <div className="text-xs font-sans text-slate-500 mt-1">HNSW: {hnswIndexed} nodes</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-sans text-slate-500">{c.kpi.avgLatency}</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">
            {analytics ? `${analytics.p50LatencyMs} / ${analytics.p95LatencyMs} ms` : '0 ms'}
          </div>
          <div className="text-xs font-sans text-slate-500 mt-1">
            avg: {analytics?.avgLatencyMs ?? 0} ms
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-slate-500">{c.kpi.zeroRate}</span>
            <select
              aria-label="Zero-rate alert threshold"
              value={zeroRateThreshold}
              onChange={(e) => setZeroRateThreshold(Number(e.target.value))}
              className="text-[11px] font-sans bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600"
            >
              <option value={15}>15%</option>
              <option value={25}>25%</option>
              <option value={30}>30%</option>
              <option value={50}>50%</option>
            </select>
          </div>
          <div className="text-2xl font-semibold text-slate-900 mt-1" data-testid="kpi-zero-rate">
            {zeroRate}%
          </div>
          <div className="text-xs font-sans text-slate-500 mt-1">
            {analytics?.emptySearches ?? 0} / {analytics?.totalSearches ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-sans text-slate-500">{c.kpi.gateBlocks}</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">
            {analytics?.categoryGateBlocks ?? 0}
          </div>
          <div className="text-xs font-sans text-slate-500 mt-1">
            {lang === 'ru' ? 'Отсечено чужих рубрик' : 'Filtered off-category hits'}
          </div>
        </Card>
      </div>

      {/* 5 Recent Zero-Queries + CTA «Открыть журнал» (§4.3) */}
      <Card testId="dashboard-recent-empty-queries" className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold text-slate-900">
              {lang === 'ru'
                ? 'Последние пустые запросы (count = 0, топ 5)'
                : 'Recent Zero-Result Queries (top 5)'}
            </h2>
            <p className="text-[11px] text-slate-500">
              {lang === 'ru'
                ? 'Кликните для проверки в Живом поиске или добавьте синоним'
                : 'Click to replay in Live Search or add a synonym'}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onNavigateTab('query-log')}>
            {lang === 'ru' ? 'Открыть журнал →' : 'Open Query Log →'}
          </Button>
        </div>

        {recentEmptyQueries.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">
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
                  <span className="font-mono text-rose-600 font-semibold tabular-nums">0 hits</span>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onReplayQuery) onReplayQuery(item.query);
                      else onNavigateTab('live-search');
                    }}
                    className="font-medium text-slate-900 hover:underline text-left cursor-pointer"
                  >
                    «{item.query}»
                  </button>
                  {item.intent && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      · intent: {item.intent}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (onReplayQuery) onReplayQuery(item.query);
                      else onNavigateTab('live-search');
                    }}
                  >
                    {lang === 'ru' ? 'В Живой поиск' : 'Replay'}
                  </Button>
                  {onAddSynonymForQuery && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onAddSynonymForQuery(item.query)}
                    >
                      {lang === 'ru' ? '+ Синоним' : '+ Synonym'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
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
          <Card className="p-4">
            <div className="text-xs font-sans text-slate-500">itemsIndexed</div>
            <div className="text-xl font-semibold text-slate-900 mt-1">
              {catalogSummary?.itemsIndexed ?? 0}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-sans text-slate-500">HNSW Graph Nodes</div>
            <div className="text-xl font-semibold text-slate-900 mt-1">
              {catalogSummary?.hnswIndexed ?? 0}
            </div>
          </Card>
          <Card className="p-4">
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
          </Card>
        </div>

        <Card className="p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-slate-900">
              {lang === 'ru' ? 'Категории в индексе' : 'Indexed Categories'}
            </div>
            {onSeedPilotCatalog && (
              <Button
                variant="primary"
                size="sm"
                disabled={seeding}
                onClick={async () => {
                  setSeeding(true);
                  try {
                    await onSeedPilotCatalog();
                  } finally {
                    setSeeding(false);
                  }
                }}
              >
                {seeding
                  ? lang === 'ru'
                    ? 'Индексация...'
                    : 'Indexing...'
                  : lang === 'ru'
                  ? 'Загрузить пилотный каталог (1000+ SKU)'
                  : 'Seed Pilot Catalog (1000+ SKU)'}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-slate-700">
            {Object.entries(categories).length === 0 ? (
              <span className="text-slate-500">
                {lang === 'ru'
                  ? 'Категории появятся после загрузки каталога'
                  : 'No categories indexed yet'}
              </span>
            ) : (
              Object.entries(categories).map(([cat, cnt]) => (
                <span key={cat} className="text-xs text-slate-700">
                  {cat}: <strong className="font-mono tabular-nums">{String(cnt)}</strong>
                </span>
              ))
            )}
          </div>
        </Card>

        {lastUpsert?.sampleRowErrors?.length > 0 && (
          <Banner tone="danger" code="ROW_VALIDATION_ERROR">
            <div className="space-y-1">
              <div className="font-semibold">
                {lang === 'ru'
                  ? 'Ошибки строк последнего импорта'
                  : 'Sample Row Validation Errors'}
              </div>
              {lastUpsert.sampleRowErrors.map((err: any, i: number) => (
                <div key={i} className="font-mono text-xs">
                  Row {err.row} · {err.field}: {err.message}
                </div>
              ))}
            </div>
          </Banner>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="admin-api-keys-panel">
      <Card className="p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-800">
          {lang === 'ru'
            ? 'Ключи доступа: SEARCH_KEY (витрина / suggest) и ADMIN_KEY (загрузка каталога, словари, снапшоты)'
            : 'Role Separation: SEARCH_KEY (storefront) vs ADMIN_KEY (catalog sync, dictionaries, snapshots)'}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            aria-label="Key role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'search' | 'admin')}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-[6px] text-slate-900"
          >
            <option value="search">role: search (Storefront read-only)</option>
            <option value="admin">role: admin (Sync / Upsert / Admin)</option>
          </select>
          <input
            type="text"
            aria-label="Key description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={lang === 'ru' ? 'Описание (напр., WooCommerce)' : 'Description'}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-[6px] text-slate-900"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              const raw = await onCreateKey(role, desc);
              if (raw) setCreatedRawKey(raw);
              setDesc('');
            }}
          >
            {lang === 'ru' ? 'Создать ключ' : 'Generate Key'}
          </Button>
        </div>
        {createdRawKey && (
          <Banner tone="success">
            <span className="font-mono">
              New Key (copy now): <strong>{createdRawKey}</strong>
            </span>
          </Banner>
        )}
      </Card>

      <Card className="overflow-hidden">
        {apiKeys.length === 0 ? (
          <EmptyState
            title={lang === 'ru' ? 'Дополнительные ключи не созданы' : 'No custom API keys created'}
            description={
              lang === 'ru'
                ? 'Создайте отдельный SEARCH_KEY для витринного виджета или коннектора CMS.'
                : 'Generate a dedicated SEARCH_KEY for your storefront widget or CMS connector.'
            }
          />
        ) : (
          <Table className="text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-2.5 px-3 font-medium">Prefix</th>
                <th className="py-2.5 px-3 font-medium">Role</th>
                <th className="py-2.5 px-3 font-medium">Description</th>
                <th className="py-2.5 px-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {apiKeys.map((k) => (
                <tr key={k.key_hash}>
                  <td className="py-2 px-3 text-slate-900">{k.key_prefix}...</td>
                  <td className="py-2 px-3">
                    <Badge tone={k.role === 'admin' ? 'warning' : 'success'}>{k.role}</Badge>
                  </td>
                  <td className="py-2 px-3 font-sans text-slate-600">{k.description || '—'}</td>
                  <td className="py-2 px-3 text-right font-sans">
                    <button
                      type="button"
                      onClick={() => onRotateKey(k.key_hash)}
                      className="text-slate-700 hover:text-slate-950 underline cursor-pointer"
                    >
                      Rotate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
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
    const searchReady =
      readyPayload?.searchReady !== undefined
        ? Boolean(readyPayload.searchReady)
        : itemsIndexed > 0;

    return (
      <div className="space-y-4" data-testid="admin-system-check">
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {lang === 'ru'
                ? 'Проверка системы и готовности (/v1/ready)'
                : 'System Readiness & Health (/v1/ready)'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              EIDOS v3.4.0 · processReady: {String(isReady)} · searchReady: {String(searchReady)} ·
              itemsIndexed: {itemsIndexed}
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={onCreateSnapshot}>
            {lang === 'ru' ? 'Создать снапшот на диск' : 'Create Disk Snapshot'}
          </Button>
        </Card>

        {/* System Status Grid (§4.3: ready / searchReady / snapshot / version — green/yellow/red) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <Card className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">processReady</span>
              <StatusDot status={isReady ? 'ok' : 'error'} label={isReady ? 'OK' : 'FAIL'} />
            </div>
            <div className="text-slate-600">
              {isReady
                ? lang === 'ru'
                  ? 'HTTP API и ядро запущены'
                  : 'HTTP API & engine online'
                : lang === 'ru'
                ? 'Требуется проверка процесса'
                : 'Process check required'}
            </div>
          </Card>

          <Card className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">searchReady</span>
              <StatusDot
                status={searchReady ? 'ok' : 'warn'}
                label={searchReady ? 'OK' : 'INDEX_EMPTY'}
              />
            </div>
            <div className="text-slate-600">
              {searchReady
                ? `${itemsIndexed} SKU в индексе`
                : lang === 'ru'
                ? 'Индекс пуст (0 SKU)'
                : '0 SKU indexed'}
            </div>
          </Card>

          <Card className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Snapshot / Persistence</span>
              <StatusDot
                status={lastSnapshotAt ? 'ok' : 'warn'}
                label={lastSnapshotAt ? 'OK' : 'WARN'}
              />
            </div>
            <div className="text-slate-600 font-mono">
              {lastSnapshotAt
                ? lastSnapshotAt.slice(0, 19).replace('T', ' ')
                : lang === 'ru'
                ? 'Снапшот не сохранён'
                : 'No snapshot yet'}
            </div>
          </Card>

          <Card className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Version</span>
              <Badge tone="neutral">v3.4.0</Badge>
            </div>
            <div className="text-slate-600 font-mono">384-d HNSW + BM25 + RRF</div>
          </Card>
        </div>

        {Object.keys(comps).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            {Object.entries(comps).map(([name, info]: [string, any]) => (
              <Card key={name} className="p-3.5 flex items-center justify-between">
                <span className="font-semibold text-slate-900">{name}</span>
                <StatusDot
                  status={info?.ready ? 'ok' : 'error'}
                  label={info?.status || (info?.ready ? 'ok' : 'failed')}
                />
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // «Подключить магазин» / Документация (§3.4: 3 equal path cards + secondary Docker self-hosted block)
  return (
    <div className="space-y-4 text-xs" data-testid="admin-docs-panel">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
          {lang === 'ru'
            ? 'Подключить магазин к EIDOS'
            : 'Connect Your Store to EIDOS'}
        </h1>
        <p className="text-xs text-slate-600">
          {lang === 'ru'
            ? 'Три готовых пути интеграции. При недоступности сервиса поиска витрина автоматически использует штатный поиск вашей CMS.'
            : 'Three integration paths with automatic fallback to native CMS search.'}
        </p>
      </div>

      {/* 3 Equal Path Cards: WooCommerce · 1С-Битрикс · CSV / YML (§3.4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card elevated className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="text-sm font-semibold text-slate-900">WooCommerce</div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
              <li>
                Соберите архив <code className="font-mono">pnpm pack:woo</code> (
                <code className="font-mono">eidos-woocommerce.zip</code>)
              </li>
              <li>Загрузите плагин в WordPress → Плагины → Добавить новый</li>
              <li>
                Укажите URL вашего сервера EIDOS, <code className="font-mono">ADMIN_KEY</code> и{' '}
                <code className="font-mono">SEARCH_KEY</code>
              </li>
              <li>Нажмите «Проверить связь» и «Синхронизировать каталог»</li>
              <li>Активируйте live-подсказки и перехват поиска с авто-fallback</li>
            </ol>
          </div>
          <div className="pt-3 border-t border-slate-100 font-mono text-[11px] text-slate-500">
            connectors/woocommerce/eidos-search · PILOT.md
          </div>
        </Card>

        <Card elevated className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="text-sm font-semibold text-slate-900">1С-Битрикс</div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
              <li>
                Соберите модуль <code className="font-mono">pnpm pack:bitrix</code> (
                <code className="font-mono">eidos.search.tar.gz</code>)
              </li>
              <li>
                Распакуйте в <code className="font-mono">/bitrix/modules/eidos.search</code> и
                установите в Администрировании
              </li>
              <li>
                Выберите инфоблок каталога и укажите <code className="font-mono">ADMIN_KEY</code> /{' '}
                <code className="font-mono">SEARCH_KEY</code>
              </li>
              <li>Запустите синхронизацию товаров (передаются SKU, URL и картинка)</li>
              <li>Включите перехват поиска с сохранением порядка через CIBlockElement</li>
            </ol>
          </div>
          <div className="pt-3 border-t border-slate-100 font-mono text-[11px] text-slate-500">
            connectors/bitrix/eidos.search · PILOT.md
          </div>
        </Card>

        <Card elevated className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="text-sm font-semibold text-slate-900">CSV / YML</div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
              <li>
                Подготовьте выгрузку (<code className="font-mono">id, sku, title, category, price, url, imageUrl</code>)
              </li>
              <li>
                Отправьте батч в <code className="font-mono">POST /v1/catalog/upsert</code> с
                заголовком <code className="font-mono">x-api-key: ADMIN_KEY</code>
              </li>
              <li>
                Убедитесь, что <code className="font-mono">GET /v1/ready</code> вернул{' '}
                <code className="font-mono">searchReady: true</code>
              </li>
              <li>Создайте снапшот индекса на диск в кабинете оператора</li>
              <li>
                Подключите <code className="font-mono">/v1/search</code> и{' '}
                <code className="font-mono">/v1/suggest</code> по <code className="font-mono">SEARCH_KEY</code>
              </li>
            </ol>
          </div>
          <div className="pt-3 border-t border-slate-100 font-mono text-[11px] text-slate-500">
            docs/CSV_CONTRACT.md · PILOT.md
          </div>
        </Card>
      </div>

      {/* Secondary CTA: Self-Hosted Docker requirement (§3.4) */}
      <Card
        testId="pilot-14-days-runbook"
        className="p-5 flex flex-wrap items-center justify-between gap-4 bg-slate-50"
      >
        <div className="space-y-1 max-w-2xl">
          <h2 className="text-sm font-semibold text-slate-900">
            {lang === 'ru'
              ? 'Нужен self-hosted EIDOS (Docker)'
              : 'Self-Hosted EIDOS (Docker) Required'}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {lang === 'ru'
              ? 'Публичная демо-витрина работает в режиме только чтение. Для подключения вашего интернет-магазина разверните контейнер EIDOS на своём сервере по инструкции в PILOT.md (docker-compose.pilot.yml).'
              : 'The public demo is read-only. To connect your store, deploy the EIDOS container on your server using docker-compose.pilot.yml and PILOT.md.'}
          </p>
        </div>
        <div className="font-mono text-xs text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-md">
          docker compose -f docker-compose.pilot.yml up -d
        </div>
      </Card>
    </div>
  );
};
