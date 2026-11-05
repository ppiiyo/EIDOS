import React, { useState, useEffect, useRef } from 'react';
import { LiveSearchHitDto, QueryLogItem } from '../types';

export interface AdminLiveSearchTabProps {
  lang: 'ru' | 'en';
  apiKey: string;
  isPublicDemo?: boolean;
  initialQuery?: string;
  defaultAlpha: number;
  defaultGate: 'hard' | 'soft' | 'off';
  onAddSynonymForQuery?: (query: string) => void;
  onSearchExecuted?: () => void;
  isIndexingDemo?: boolean;
  totalSkuCount?: number;
  onReloadDemoCatalog?: () => void;
}

export const AdminLiveSearchTab: React.FC<AdminLiveSearchTabProps> = ({
  lang,
  apiKey,
  isPublicDemo = false,
  initialQuery = 'недорогие наушники для бега',
  defaultAlpha,
  defaultGate,
  onAddSynonymForQuery,
  onSearchExecuted,
  isIndexingDemo = false,
  totalSkuCount = 0,
  onReloadDemoCatalog,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<'hybrid' | 'dense' | 'sparse'>('hybrid');
  const [alpha, setAlpha] = useState<number>(defaultAlpha);
  const [gate, setGate] = useState<'hard' | 'soft' | 'off'>(defaultGate);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LiveSearchHitDto[]>([]);
  const [selectedHit, setSelectedHit] = useState<LiveSearchHitDto | null>(null);
  const [meta, setMeta] = useState<{
    latencyMs: number;
    normalizedQuery: string;
    originalQuery: string;
    rewritten: boolean;
    headCategoryIntent: string | null;
    appliedRules: string[];
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [searchTrigger, setSearchTrigger] = useState(0);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (isIndexingDemo) {
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSelectedHit(null);
      setMeta(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const endpoint = isPublicDemo ? '/v1/demo/search' : '/v1/search';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (!isPublicDemo && apiKey) {
          headers['x-api-key'] = apiKey;
        }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            query: trimmed,
            mode,
            alpha,
            simpleCategoryGate: gate,
            limit: 12,
          }),
        });
        if (!res.ok) {
          setResults([]);
          setSelectedHit(null);
          return;
        }
        const data = await res.json();
        const hits: LiveSearchHitDto[] = Array.isArray(data.results) ? data.results : [];
        setResults(hits);
        setSelectedHit(hits[0] || null);
        setMeta({
          latencyMs: Number(data.latencyMs || 0),
          normalizedQuery: String(data.normalizedQuery || data.query || trimmed),
          originalQuery: String(data.originalQuery || trimmed),
          rewritten: Boolean(data.rewritten),
          headCategoryIntent: data.headCategoryIntent ?? null,
          appliedRules: Array.isArray(data.appliedDictionaryRules)
            ? data.appliedDictionaryRules
            : [],
        });
        onSearchExecuted?.();
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query, mode, alpha, gate, apiKey, isPublicDemo, isIndexingDemo, searchTrigger]);

  const handleRecordClick = async (hit: LiveSearchHitDto) => {
    setSelectedHit(hit);
    try {
      await fetch('/v1/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || 'eidos_demo_key',
        },
        body: JSON.stringify({
          type: 'click',
          query: query.trim(),
          productId: String(hit.id),
        }),
      });
    } catch {
      // Non-blocking event telemetry
    }
  };

  const samplePresets = [
    {
      query: 'недорогие наушники для бега',
      labelRu: isPublicDemo ? 'Наушники для бега' : 'недорогие наушники для бега',
      labelEn: isPublicDemo ? 'Running headphones' : 'недорогие наушники для бега',
    },
    {
      query: 'детский смартфон до 15000',
      labelRu: isPublicDemo ? 'Детский смартфон' : 'детский смартфон до 15000',
      labelEn: isPublicDemo ? 'Kids smartphone' : 'детский смартфон до 15000',
    },
    { query: '5W-40', labelRu: '5W-40', labelEn: '5W-40' },
    { query: 'yfeiybrb', labelRu: 'yfeiybrb', labelEn: 'yfeiybrb' },
    { query: 'Абракадабра', labelRu: 'Абракадабра', labelEn: 'Абракадабра' },
    { query: 'zzzz_garbage_999', labelRu: 'zzzz_garbage_999', labelEn: 'zzzz_garbage_999' },
  ];

  const topCategoryLabel =
    results[0]?.category || meta?.headCategoryIntent || (lang === 'ru' ? 'Все категории' : 'All');

  return (
    <div className="space-y-4" data-testid="admin-live-search">
      {isIndexingDemo && (
        <div
          className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 flex items-center justify-between gap-2 shadow-sm"
          data-testid="admin-catalog-indexing-banner"
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping inline-block" />
            <span>
              {lang === 'ru'
                ? 'Загружаем витрину… Индексируем каталог 1000+ товаров для моментального поиска.'
                : 'Loading storefront… Indexing 1000+ products for instant search.'}
            </span>
          </div>
          <span className="text-indigo-700 font-mono text-[11px]">1048 товаров</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5 shadow-xs">
        {isPublicDemo && (
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h1
                className="text-lg font-semibold text-slate-900 tracking-tight"
                data-testid="public-demo-story-title"
              >
                {lang === 'ru'
                  ? 'Поиск, который понимает покупателя'
                  : 'Search that understands the shopper'}
              </h1>
              <p
                className="text-xs text-slate-500 mt-0.5"
                data-testid="public-demo-story-subtitle"
              >
                {lang === 'ru'
                  ? '1000+ товаров · без OpenAI · explainable'
                  : '1000+ products · zero OpenAI · explainable'}
              </p>
            </div>
            <div className="text-xs text-slate-600 font-medium">
              {lang === 'ru'
                ? `Каталог демо: ${totalSkuCount || 1048} товаров`
                : `Demo catalog: ${totalSkuCount || 1048} products`}
            </div>
          </div>
        )}

        <div>
          {!isPublicDemo && (
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'ru'
                ? 'Поисковый запрос (debounce 220ms)'
                : 'Search Query (220ms debounce)'}
            </label>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              data-testid="admin-live-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                lang === 'ru'
                  ? 'Введите запрос покупателя...'
                  : 'Enter a shopper search query...'
              }
              className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
            />
            <button
              type="button"
              data-testid="admin-live-search-submit"
              onClick={() => setSearchTrigger((n) => n + 1)}
              className="px-4 py-2.5 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors shrink-0"
            >
              {lang === 'ru' ? 'Найти' : 'Search'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-slate-500">
              {isPublicDemo
                ? lang === 'ru'
                  ? 'Попробовать:'
                  : 'Try:'
                : 'Golden Queries:'}
            </span>
            {samplePresets.map((preset) => (
              <button
                key={preset.query}
                type="button"
                data-testid={`admin-live-sample-${preset.query}`}
                onClick={() => setQuery(preset.query)}
                className={`px-2.5 py-1 rounded-md transition-colors font-medium border ${
                  query === preset.query
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80 hover:text-slate-900'
                }`}
              >
                {lang === 'ru' ? preset.labelRu : preset.labelEn}
              </button>
            ))}
            {isPublicDemo && onReloadDemoCatalog && (
              <button
                type="button"
                data-testid="reload-demo-catalog-btn"
                onClick={onReloadDemoCatalog}
                disabled={isIndexingDemo}
                className="ml-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-md font-medium transition-colors disabled:opacity-50"
              >
                {lang === 'ru' ? '↻ Обновить витрину (1048 товаров)' : '↻ Reload 1048 items'}
              </button>
            )}
          </div>
        </div>

        {meta && (
          <div
            className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
            data-testid="admin-live-meta"
          >
            {isPublicDemo ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">
                  {lang === 'ru'
                    ? `Найдено: ${results.length} товаров · ${Math.max(1, Math.round(meta.latencyMs))} ms${
                        results.length > 0 ? ` · категория: ${topCategoryLabel}` : ''
                      }`
                    : `Found: ${results.length} items · ${Math.max(1, Math.round(meta.latencyMs))} ms${
                        results.length > 0 ? ` · category: ${topCategoryLabel}` : ''
                      }`}
                </span>
                {meta.rewritten && (
                  <span
                    className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium"
                    data-testid="admin-normalized-query"
                  >
                    {lang === 'ru'
                      ? `исправлена раскладка / синоним → «${meta.normalizedQuery}»`
                      : `auto-corrected → "${meta.normalizedQuery}"`}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums text-slate-600">
                <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-semibold">
                  {results.length} hits
                </span>
                <span>{meta.latencyMs.toFixed(1)} ms</span>
                {meta.headCategoryIntent && (
                  <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                    intent: {meta.headCategoryIntent}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded border ${
                    meta.rewritten
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                  data-testid="admin-normalized-query"
                >
                  normalized: «{meta.normalizedQuery}»
                </span>
                {meta.appliedRules.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-800">
                    rules: {meta.appliedRules.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <details
          open={!isPublicDemo}
          className="pt-2 border-t border-slate-100 group"
          data-testid="specialist-levers-details"
        >
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800 select-none list-none flex items-center gap-1.5">
            <span className="text-[10px] transition-transform group-open:rotate-90">▶</span>
            <span>
              {lang === 'ru'
                ? 'Для специалиста (режим поиска, баланс α, Category Gate)'
                : 'For specialists (search mode, alpha balance, Category Gate)'}
            </span>
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-slate-50/70 p-3 rounded-md border border-slate-200/70">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'ru' ? 'Режим' : 'Mode'}
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'hybrid' | 'dense' | 'sparse')}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="hybrid">Hybrid (HNSW + BM25)</option>
                <option value="dense">Semantic (Dense 384-d)</option>
                <option value="sparse">Lexical (BM25+)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'ru'
                  ? `Баланс α (Семантика: ${Math.round(alpha * 100)}%)`
                  : `Alpha (${Math.round(alpha * 100)}% Semantic)`}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value))}
                className="w-full accent-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category Gate</label>
              <select
                data-testid="admin-live-gate-select"
                value={gate}
                onChange={(e) => setGate(e.target.value as 'hard' | 'soft' | 'off')}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="hard">hard (strict)</option>
                <option value="soft">soft (demote)</option>
                <option value="off">off</option>
              </select>
            </div>
          </div>
        </details>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          {isIndexingDemo || loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {isIndexingDemo
                ? lang === 'ru'
                  ? 'Загружаем витрину…'
                  : 'Loading storefront…'
                : lang === 'ru'
                ? 'Ищем подходящие товары…'
                : 'Searching products…'}
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center space-y-2.5" data-testid="admin-live-empty-state">
              <div className="text-sm font-semibold text-slate-900">
                {isPublicDemo
                  ? lang === 'ru'
                    ? 'Ничего не найдено — так и должно быть для бессмысленного запроса'
                    : 'Nothing found — as expected for a nonsensical query'
                  : lang === 'ru'
                  ? 'По запросу ничего не найдено (count: 0)'
                  : 'Zero results returned (count: 0)'}
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isPublicDemo
                  ? lang === 'ru'
                    ? 'Поиск EIDOS не засоряет витрину случайными товарами, если в каталоге нет подходящего ответа.'
                    : 'EIDOS never pollutes the storefront with random items when no relevant product exists.'
                  : lang === 'ru'
                  ? 'Запрос отсечён порогом минимальной уверенности или строгим фильтром категории (Category Gate). Если это сленг или синоним покупателя — добавьте правило в словарь.'
                  : 'Filtered by minimum confidence threshold or strict Category Gate. Add a synonym rule if shoppers use this phrase for an existing product.'}
              </p>
              {!isPublicDemo && onAddSynonymForQuery && query.trim() && (
                <button
                  type="button"
                  onClick={() => onAddSynonymForQuery(query.trim())}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
                >
                  {lang === 'ru'
                    ? `+ Добавить синоним для «${query.trim()}»`
                    : `+ Add synonym for "${query.trim()}"`}
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <th className="py-2.5 px-3 font-medium">#</th>
                  <th className="py-2.5 px-3 font-medium">{lang === 'ru' ? 'Товар' : 'Product'}</th>
                  <th className="py-2.5 px-3 font-medium">
                    {lang === 'ru' ? 'Категория' : 'Category'}
                  </th>
                  <th className="py-2.5 px-3 font-medium text-right">
                    {lang === 'ru' ? 'Цена' : 'Price'}
                  </th>
                  <th className="py-2.5 px-3 font-medium text-right">Match %</th>
                  {!isPublicDemo && (
                    <th className="py-2.5 px-3 font-medium text-right">Score</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((hit, idx) => {
                  const active = selectedHit?.id === hit.id;
                  return (
                    <tr
                      key={hit.id}
                      data-testid="admin-live-result-row"
                      onClick={() => handleRecordClick(hit)}
                      className={`cursor-pointer transition-colors ${
                        active ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{hit.title}</div>
                        {!isPublicDemo && (
                          <div className="text-xs text-slate-500 font-mono">ID: {hit.id}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{hit.category}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs font-medium text-slate-900 tabular-nums whitespace-nowrap">
                        {typeof hit.price === 'number' ? `${hit.price.toLocaleString()} ₽` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                        {hit.scorePercent}%
                      </td>
                      {!isPublicDemo && (
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-500 tabular-nums">
                          {Number(hit.score || 0).toFixed(4)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div
          className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4"
          data-testid="admin-xray-panel"
        >
          <div className="text-xs font-semibold text-slate-500 mb-2">
            {isPublicDemo
              ? lang === 'ru'
                ? 'Почему в топе'
                : 'Why it ranked on top'
              : lang === 'ru'
              ? 'Рентген ранжирования (X-Ray Inspector)'
              : 'Explainable Ranking X-Ray'}
          </div>
          {!selectedHit ? (
            <div className="text-xs text-slate-400 py-8 text-center">
              {lang === 'ru'
                ? 'Выберите товар в списке слева, чтобы увидеть объяснение выбора.'
                : 'Select a product on the left to see why it matched.'}
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-sm font-semibold text-slate-900">{selectedHit.title}</div>
                <div className="text-slate-500 mt-0.5">
                  {selectedHit.category}
                  {typeof selectedHit.price === 'number'
                    ? ` · ${selectedHit.price.toLocaleString()} ₽`
                    : ''}{' '}
                  · Совпадение {selectedHit.scorePercent}%
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-md text-slate-800">
                <div className="font-medium text-slate-900 mb-1">
                  {lang === 'ru' ? 'Почему этот товар в выдаче:' : 'Why this item ranked here:'}
                </div>
                <div data-testid="admin-xray-human-explanation" className="leading-relaxed">
                  {lang === 'ru'
                    ? selectedHit.humanExplanation?.ru ||
                      'Товар соответствует категории запроса и совпадает по смыслу и характеристикам.'
                    : selectedHit.humanExplanation?.en || 'Hybrid semantic + lexical match'}
                </div>
              </div>

              <details
                open={!isPublicDemo}
                className="pt-1 group"
                data-testid="admin-xray-details"
              >
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800 select-none list-none flex items-center gap-1.5">
                  <span className="text-[10px] transition-transform group-open:rotate-90">▶</span>
                  <span>
                    {lang === 'ru'
                      ? 'Подробнее (формула X-Ray: Dense / BM25 / RRF)'
                      : 'Details (X-Ray math: Dense / BM25 / RRF)'}
                  </span>
                </summary>
                <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono tabular-nums">
                  <div className="p-2.5 border border-slate-200 rounded bg-slate-50/50">
                    <div className="text-slate-500">Dense (384-d Cosine)</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {Number(selectedHit.explanation?.denseComponent || 0).toFixed(4)}
                    </div>
                  </div>
                  <div className="p-2.5 border border-slate-200 rounded bg-slate-50/50">
                    <div className="text-slate-500">Sparse (BM25+)</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {Number(selectedHit.explanation?.sparseBm25Component || 0).toFixed(4)}
                    </div>
                  </div>
                  <div className="p-2.5 border border-slate-200 rounded bg-slate-50/50">
                    <div className="text-slate-500">Hybrid RRF</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {Number(selectedHit.explanation?.rrfScore || 0).toFixed(4)}
                    </div>
                  </div>
                  <div className="p-2.5 border border-slate-200 rounded bg-slate-50/50">
                    <div className="text-slate-500">Guardrail Boost</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {Number(selectedHit.explanation?.businessBoost || 0).toFixed(4)}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminQueryLogTab: React.FC<{
  lang: 'ru' | 'en';
  logs: QueryLogItem[];
  onRefresh: (filters: {
    q: string;
    emptyOnly: boolean;
    gatedOnly?: boolean;
    period?: '24h' | '7d' | '30d';
  }) => void;
  onReplay: (query: string) => void;
  onAddSynonym?: (query: string) => void;
}> = ({ lang, logs, onRefresh, onReplay, onAddSynonym }) => {
  const [q, setQ] = useState('');
  const [emptyOnly, setEmptyOnly] = useState(false);
  const [gatedOnly, setGatedOnly] = useState(false);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const triggerFilter = (next: {
    q: string;
    emptyOnly: boolean;
    gatedOnly: boolean;
    period: '24h' | '7d' | '30d';
  }) => {
    setPage(1);
    onRefresh(next);
  };

  return (
    <div className="space-y-4" data-testid="admin-query-log">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(['24h', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPeriod(p);
                  triggerFilter({ q, emptyOnly, gatedOnly, period: p });
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded ${
                  period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              triggerFilter({ q: e.target.value, emptyOnly, gatedOnly, period });
            }}
            placeholder={lang === 'ru' ? 'Поиск по тексту запроса...' : 'Filter by query text...'}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900"
          />

          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              data-testid="query-log-empty-only"
              checked={emptyOnly}
              onChange={(e) => {
                setEmptyOnly(e.target.checked);
                triggerFilter({ q, emptyOnly: e.target.checked, gatedOnly, period });
              }}
            />
            <span>{lang === 'ru' ? 'Только пустые (0)' : 'Empty results only (0)'}</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={gatedOnly}
              onChange={(e) => {
                setGatedOnly(e.target.checked);
                triggerFilter({ q, emptyOnly, gatedOnly: e.target.checked, period });
              }}
            />
            <span>{lang === 'ru' ? 'Отсечено Category Gate' : 'Gated only'}</span>
          </label>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-mono">{logs.length} records</span>
          <button
            type="button"
            onClick={() => onRefresh({ q, emptyOnly, gatedOnly, period })}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
          >
            {lang === 'ru' ? 'Обновить журнал' : 'Refresh Log'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            {lang === 'ru'
              ? 'Записей в журнале запросов пока нет. Выполните поиск во вкладке «Проверка поиска».'
              : 'No query logs recorded yet.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2.5 px-3 font-medium">{lang === 'ru' ? 'Время' : 'Time'}</th>
                    <th className="py-2.5 px-3 font-medium">
                      {lang === 'ru' ? 'Запрос' : 'Query'}
                    </th>
                    <th className="py-2.5 px-3 font-medium">
                      {lang === 'ru' ? 'Нормализованный' : 'Normalized'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      {lang === 'ru' ? 'Найдено' : 'Hits'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      {lang === 'ru' ? 'Задержка' : 'Latency'}
                    </th>
                    <th className="py-2.5 px-3 font-medium">
                      {lang === 'ru' ? 'Топ-1 товар / Категория' : 'Top-1 Hit / Category'}
                    </th>
                    <th className="py-2.5 px-3 font-medium">Gate / Intent</th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      {lang === 'ru' ? 'Действие' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {pagedLogs.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => onReplay(row.query)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                        {row.timestamp.slice(11, 19)}
                      </td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-900">
                        <div>{row.query}</div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {row.flags.empty && (
                            <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px]">
                              empty
                            </span>
                          )}
                          {row.flags.rewritten && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px]">
                              synonym
                            </span>
                          )}
                          {row.flags.gated && (
                            <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px]">
                              gated
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600">
                        {row.flags.rewritten ? (
                          <span className="text-emerald-700 font-medium">
                            {row.normalizedQuery}
                          </span>
                        ) : (
                          row.normalizedQuery
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={
                            row.flags.empty
                              ? 'text-rose-600 font-semibold'
                              : 'text-slate-800 font-semibold'
                          }
                        >
                          {row.resultCount}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {row.latencyMs.toFixed(1)} ms
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600">
                        {row.top1 ? (
                          <div>
                            <div className="text-slate-900 font-medium truncate max-w-[200px]">
                              {row.top1.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {row.top1.category} · {row.top1.scorePercent}%
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        <div>gate: {row.simpleCategoryGate}</div>
                        {row.headCategoryIntent && (
                          <div className="text-[11px] text-slate-500">
                            intent: {row.headCategoryIntent}
                          </div>
                        )}
                      </td>
                      <td
                        className="py-2 px-3 text-right font-sans whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onReplay(row.query)}
                            className="text-slate-700 hover:text-slate-950 underline"
                          >
                            {lang === 'ru' ? 'В Live' : 'Replay'}
                          </button>
                          {row.flags.empty && onAddSynonym && (
                            <button
                              type="button"
                              onClick={() => onAddSynonym(row.query)}
                              className="text-emerald-700 hover:text-emerald-900 underline font-medium"
                            >
                              {lang === 'ru' ? '+ Синоним' : '+ Synonym'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <span>
                {lang === 'ru'
                  ? `Страница ${currentPage} из ${totalPages} (всего ${logs.length})`
                  : `Page ${currentPage} of ${totalPages} (${logs.length} total)`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded disabled:opacity-40"
                >
                  ← {lang === 'ru' ? 'Назад' : 'Prev'}
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded disabled:opacity-40"
                >
                  {lang === 'ru' ? 'Вперёд' : 'Next'} →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
