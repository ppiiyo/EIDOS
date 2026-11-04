import React, { useState } from 'react';
import { ADMIN_COPY, AdminAnalyticsSummary, AdminTabId } from '../types';

export const AdminDashboardTab: React.FC<{
  lang: 'ru' | 'en';
  itemsIndexed: number;
  hnswIndexed: number;
  readyStatus: boolean;
  lastSnapshotAt: string | null;
  analytics: AdminAnalyticsSummary | null;
  onNavigateTab: (tab: AdminTabId) => void;
}> = ({
  lang,
  itemsIndexed,
  hnswIndexed,
  readyStatus,
  lastSnapshotAt,
  analytics,
  onNavigateTab,
}) => {
  const c = ADMIN_COPY[lang];
  const zeroRate = analytics?.zeroResultRate ?? 0;

  return (
    <div className="space-y-4" data-testid="admin-dashboard">
      <div className="space-y-2">
        {!readyStatus && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800" data-testid="alert-not-ready">
            {lang === 'ru'
              ? 'Внимание: проба готовности /v1/ready вернула false. Проверьте раздел «Проверка системы».'
              : 'Alert: /v1/ready returned false. Inspect the System Check tab.'}
          </div>
        )}
        {itemsIndexed === 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900" data-testid="alert-index-empty">
            {lang === 'ru'
              ? 'Индекс пуст (0 SKU). Синхронизируйте каталог из 1С-Битрикс, WooCommerce или загрузите CSV.'
              : 'Index is empty (0 SKU). Sync your catalog from 1C-Bitrix, WooCommerce, or CSV.'}
          </div>
        )}
        {zeroRate > 25 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900">
            {lang === 'ru'
              ? `Высокая доля пустых выдач (${zeroRate}%). Откройте «Журнал запросов» и добавьте синонимы.`
              : `Elevated zero-result share (${zeroRate}%). Review Query Log and add synonyms.`}
          </div>
        )}
      </div>

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
          <div className="text-xs font-sans text-slate-500">{c.kpi.zeroRate}</div>
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
            {lastSnapshotAt ? lastSnapshotAt.slice(0, 19).replace('T', ' ') : lang === 'ru' ? 'Ещё не создан' : 'None yet'}
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
          <button
            type="button"
            onClick={() => onNavigateTab('dictionaries')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 rounded"
          >
            {lang === 'ru' ? 'Словари и синонимы' : 'Dictionaries'}
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('system')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 rounded"
          >
            {lang === 'ru' ? 'Проверка системы' : 'System Check'}
          </button>
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
}> = ({ mode, lang, catalogSummary, apiKeys, onCreateKey, onRotateKey }) => {
  const [role, setRole] = useState<'search' | 'admin'>('search');
  const [desc, setDesc] = useState('');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);

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

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
          <div className="font-semibold text-slate-900">
            {lang === 'ru' ? 'Категории в индексе' : 'Indexed Categories'}
          </div>
          <div className="flex flex-wrap gap-3 text-slate-600">
            {Object.entries(categories).length === 0 ? (
              <span>—</span>
            ) : (
              Object.entries(categories).map(([cat, cnt]) => (
                <span key={cat}>
                  {cat}: <strong className="font-mono">{String(cnt)}</strong>
                </span>
              ))
            )}
          </div>
        </div>

        {lastUpsert?.sampleRowErrors?.length > 0 && (
          <div className="bg-white border border-rose-200 rounded-lg p-4 space-y-2 text-xs">
            <div className="font-semibold text-rose-800">
              {lang === 'ru' ? 'Ошибки строк последнего импорта (rowErrors sample)' : 'Sample Row Validation Errors'}
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
            ? 'Выпуск нового ключа (SEARCH_KEY только для поиска, ADMIN_KEY для синхронизации)'
            : 'Issue Scoped API Key (SEARCH_KEY for storefront, ADMIN_KEY for sync)'}
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
                <td className="py-2 px-3">{k.role}</td>
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
  onCreateSnapshot: () => Promise<void>;
}> = ({ mode, lang, readyPayload, onCreateSnapshot }) => {
  if (mode === 'system') {
    const comps = readyPayload?.components || {};
    return (
      <div className="space-y-4" data-testid="admin-system-check">
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {lang === 'ru' ? 'Проверка системы (/v1/ready)' : 'System Readiness Check (/v1/ready)'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono">
              Version: EIDOS v3.4.0 · Ready: {String(Boolean(readyPayload?.ready))}
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
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs" data-testid="admin-docs-panel">
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-900">1. Self-Hosted Pilot Runbook (docs/PRODUCTION.md)</div>
        <p className="text-slate-600">
          {lang === 'ru'
            ? 'Запуск в 1 команду: docker compose up -d → загрузка каталога с ADMIN_KEY → проверка GET /v1/ready → подключение витрины по SEARCH_KEY.'
            : '15-minute deployment: docker compose up -d -> catalog upsert with ADMIN_KEY -> GET /v1/ready -> storefront search with SEARCH_KEY.'}
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-900">2. 1C-Bitrix & WooCommerce Connectors</div>
        <p className="text-slate-600">
          {lang === 'ru'
            ? 'Bitrix (id = ELEMENT_ID, sku = XML_ID) и WooCommerce (id = product_id / variation_id, post__in hydration) с автоматическим fallback при недоступности API.'
            : 'Full parity between 1C-Bitrix and WooCommerce connectors with server-side search replacement and graceful CMS fallback.'}
        </p>
      </div>
    </div>
  );
};
