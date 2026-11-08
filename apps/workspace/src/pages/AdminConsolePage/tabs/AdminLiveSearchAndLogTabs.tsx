import React, { useState, useEffect, useRef } from 'react';
import { LiveSearchHitDto, QueryLogItem, VitrinePhase } from '../types';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  KeyValue,
  ScoreBar,
  SearchField,
  Skeleton,
  Table,
  Tabs,
} from '../../../design-system/ui-kit';

export interface AdminLiveSearchTabProps {
  lang: 'ru' | 'en';
  apiKey: string;
  isPublicDemo?: boolean;
  isDemoReady?: boolean;
  searchReady?: boolean;
  vitrinePhase?: VitrinePhase;
  onPhaseChange?: (phase: VitrinePhase) => void;
  initialQuery?: string;
  defaultAlpha: number;
  defaultGate: 'hard' | 'soft' | 'off';
  onAddSynonymForQuery?: (query: string) => void;
  onSearchExecuted?: () => void;
  isIndexingDemo?: boolean;
  totalSkuCount?: number;
  onReloadDemoCatalog?: () => void;
  onConnectStore?: () => void;
}

export const AdminLiveSearchTab: React.FC<AdminLiveSearchTabProps> = ({
  lang,
  apiKey,
  isPublicDemo = false,
  searchReady = true,
  vitrinePhase = 'ready',
  onPhaseChange,
  initialQuery = 'недорогие наушники для бега',
  defaultAlpha,
  defaultGate,
  onAddSynonymForQuery,
  onSearchExecuted,
  isIndexingDemo = false,
  totalSkuCount = 0,
  onReloadDemoCatalog,
  onConnectStore,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<'hybrid' | 'dense' | 'sparse'>('hybrid');
  const [alpha, setAlpha] = useState<number>(defaultAlpha);
  const [gate, setGate] = useState<'hard' | 'soft' | 'off'>(defaultGate);
  const [phase, setPhase] = useState<VitrinePhase>(() =>
    isIndexingDemo && !(searchReady && totalSkuCount > 0) ? 'loading_catalog' : vitrinePhase
  );
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<{ message: string; code?: string } | null>(null);
  const [results, setResults] = useState<LiveSearchHitDto[]>([]);
  const [selectedHit, setSelectedHit] = useState<LiveSearchHitDto | null>(null);
  const [meta, setMeta] = useState<{
    latencyMs: number;
    normalizedQuery: string;
    originalQuery: string;
    rewritten: boolean;
    headCategoryIntent: string | null;
    appliedRules: string[];
    rewrites: Array<{ type: string; from: string; to: string }>;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasSearchResponseRef = useRef<boolean>(false);

  const [searchTrigger, setSearchTrigger] = useState(0);

  const updatePhase = (next: VitrinePhase) => {
    setPhase(next);
    onPhaseChange?.(next);
  };

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Sync catalog boot transitions without ever reverting to loading_catalog once ready/results exist
  useEffect(() => {
    if (hasSearchResponseRef.current) {
      if (phase === 'boot' || phase === 'loading_catalog') {
        updatePhase('results');
      }
      return;
    }
    if (isIndexingDemo && !(searchReady && totalSkuCount > 0)) {
      if (phase !== 'loading_catalog') {
        updatePhase('loading_catalog');
      }
    } else if (phase === 'boot' || phase === 'loading_catalog') {
      updatePhase('ready');
    }
  }, [isIndexingDemo, searchReady, totalSkuCount, phase]);

  useEffect(() => {
    // Wait for initial catalog load only if we haven't completed any search yet
    if (isIndexingDemo && !hasSearchResponseRef.current && !(searchReady && totalSkuCount > 0)) {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSelectedHit(null);
      setMeta(null);
      setApiError(null);
      updatePhase('ready');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setApiError(null);
      updatePhase('searching');

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
        if (cancelled || controller.signal.aborted) return;

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          setApiError({
            message:
              errBody?.message ||
              (res.status === 503
                ? lang === 'ru'
                  ? 'Индекс каталога пуст. Загрузите прайс или демо-каталог.'
                  : 'Catalog index is empty. Run sync or load demo catalog.'
                : lang === 'ru'
                ? 'Не удалось выполнить поисковый запрос.'
                : 'Search request failed.'),
            code: errBody?.code || `HTTP_${res.status}`,
          });
          // Stay in error/ready — NEVER revert to loading_catalog on search error (§2)
          updatePhase('error');
          return;
        }

        const data = await res.json();
        if (cancelled || controller.signal.aborted) return;

        const hits: LiveSearchHitDto[] = Array.isArray(data.results) ? data.results : [];
        hasSearchResponseRef.current = true;
        setResults(hits);
        setSelectedHit(hits[0] || null);
        setMeta({
          latencyMs: Number(data.latencyMs || 0),
          normalizedQuery: String(data.normalizedQuery || data.query || trimmed),
          originalQuery: String(data.originalQuery || trimmed),
          rewritten: Boolean(data.rewritten || data.rewriteApplied),
          headCategoryIntent: data.headCategoryIntent ?? null,
          appliedRules: Array.isArray(data.appliedDictionaryRules)
            ? data.appliedDictionaryRules
            : [],
          rewrites: Array.isArray(data.meta?.rewrites) ? data.meta.rewrites : [],
        });
        updatePhase('results');
        onSearchExecuted?.();
      } catch (err: any) {
        if (err?.name !== 'AbortError' && !cancelled) {
          setApiError({
            message:
              lang === 'ru'
                ? 'Ошибка сети при обращении к поиску.'
                : 'Network error while executing search.',
            code: 'NETWORK_ERROR',
          });
          updatePhase('error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, mode, alpha, gate, apiKey, isPublicDemo, isIndexingDemo, searchReady, totalSkuCount, searchTrigger]);

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

  // §3.1 Boot overlay rule:
  // Show ONLY if (phase === 'boot' || phase === 'loading_catalog')
  // AND hide immediately if:
  // - searchReady === true && itemsIndexed > 0
  // - phase === 'ready' | 'searching' | 'results'
  // - state already has a successful search response (meta !== null || results.length > 0)
  const hasSearchResponse = hasSearchResponseRef.current || meta !== null || results.length > 0;
  const showBootOverlay =
    (phase === 'boot' || phase === 'loading_catalog') &&
    !hasSearchResponse &&
    !(searchReady === true && totalSkuCount > 0);

  // §3.3 Controls disabled ONLY in boot | loading_catalog | searching
  const isSearching = phase === 'searching' || loading;
  const controlsDisabled = showBootOverlay || isSearching;

  return (
    <div
      className="space-y-4"
      data-testid="admin-live-search"
      data-vitrine-phase={phase}
    >
      {apiError && (
        <Banner
          tone={apiError.code === 'INDEX_EMPTY' ? 'warning' : 'danger'}
          code={apiError.code}
          testId="search-api-error-banner"
          action={
            onReloadDemoCatalog ? (
              <Button variant="secondary" size="sm" onClick={onReloadDemoCatalog}>
                {lang === 'ru' ? 'Загрузить демо-каталог' : 'Load Demo Catalog'}
              </Button>
            ) : undefined
          }
        >
          {apiError.message}
        </Banner>
      )}

      {!isPublicDemo && !searchReady && !apiError && (
        <Banner
          tone="warning"
          code="INDEX_EMPTY"
          testId="search-not-ready-banner"
        >
          {lang === 'ru'
            ? 'Индекс пуст (searchReady: false). Выполните синхронизацию каталога или загрузите пилотный прайс.'
            : 'Catalog index is empty (searchReady: false). Run catalog sync or seed pilot catalog.'}
        </Banner>
      )}

      {/* Search Controls Card — strict linear order per §3.2 */}
      <Card elevated className="p-5 space-y-4">
        {/* 1. Title & Subtitle on Storefront (§5: single non-duplicated subtitle, no duplicate 1048 badge) */}
        {isPublicDemo && (
          <div>
            <h1
              className="text-xl font-semibold text-slate-900 tracking-tight text-balance"
              data-testid="public-demo-story-title"
            >
              {lang === 'ru'
                ? 'Поиск, который понимает покупателя'
                : 'Search that understands the shopper'}
            </h1>
            <p
              className="text-xs text-slate-600 mt-1"
              data-testid="public-demo-story-subtitle"
            >
              {lang === 'ru'
                ? 'Каталог демо · без внешнего AI-ключа · видно, почему товар в топе'
                : 'Demo catalog · no external AI key · see why products rank on top'}
            </p>
          </div>
        )}

        {/* 2. SearchField + Submit Button (§3.3: disabled ONLY in boot | loading_catalog | searching) */}
        <SearchField
          value={query}
          onChange={setQuery}
          onSubmit={() => setSearchTrigger((n) => n + 1)}
          disabled={controlsDisabled}
          loading={isSearching}
          placeholder={
            lang === 'ru'
              ? 'Например: наушники для бега'
              : 'For example: running headphones'
          }
          submitLabel={lang === 'ru' ? 'Найти' : 'Search'}
          ariaLabel={lang === 'ru' ? 'Поисковый запрос покупателя' : 'Shopper search query'}
        />

        {/* 3. Example Chips (6 max in 1 row, wrap OK) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 mr-1">
            {isPublicDemo ? (lang === 'ru' ? 'Примеры:' : 'Examples:') : 'Golden:'}
          </span>
          {samplePresets.map((preset) => (
            <Chip
              key={preset.query}
              disabled={controlsDisabled}
              active={query === preset.query}
              data-testid={`admin-live-sample-${preset.query}`}
              onClick={() => setQuery(preset.query)}
            >
              {lang === 'ru' ? preset.labelRu : preset.labelEn}
            </Chip>
          ))}
          {isPublicDemo && onReloadDemoCatalog && (
            <button
              type="button"
              data-testid="reload-demo-catalog-btn"
              onClick={onReloadDemoCatalog}
              disabled={controlsDisabled}
              title={lang === 'ru' ? 'Перезагрузить витрину' : 'Reload demo'}
              className="ml-auto px-2 py-1 text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer disabled:opacity-50"
            >
              {lang === 'ru' ? '↻ Обновить демо' : '↻ Reload demo'}
            </button>
          )}
        </div>

        {/* 4. Quiet Meta Line (after response — lives outside boot-card per §3.4) */}
        {meta && (
          <div
            className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 tabular-nums"
            data-testid="admin-live-meta"
          >
            {isPublicDemo ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  {lang === 'ru'
                    ? `${results.length} товаров · ${Math.max(1, Math.round(meta.latencyMs))} мс · категория: ${topCategoryLabel}`
                    : `${results.length} items · ${Math.max(1, Math.round(meta.latencyMs))} ms · category: ${topCategoryLabel}`}
                </span>
                {meta.rewritten && (
                  <span
                    className="text-emerald-800 font-medium"
                    data-testid="admin-normalized-query"
                  >
                    {lang === 'ru'
                      ? `· исправлено → «${meta.normalizedQuery}»`
                      : `· corrected → "${meta.normalizedQuery}"`}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 font-mono text-slate-600">
                <span className="font-semibold text-slate-900">{results.length} hits</span>
                <span>·</span>
                <span>{meta.latencyMs.toFixed(1)} ms</span>
                {meta.headCategoryIntent && (
                  <>
                    <span>·</span>
                    <span>intent: {meta.headCategoryIntent}</span>
                  </>
                )}
                <span>·</span>
                <span
                  className={meta.rewritten ? 'text-emerald-800 font-semibold' : 'text-slate-600'}
                  data-testid="admin-normalized-query"
                >
                  normalized: «{meta.normalizedQuery}»
                </span>
                {meta.appliedRules.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-amber-800">rules: {meta.appliedRules.join(', ')}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 6. «Для специалиста» — 1 collapse at bottom of meta zone */}
        <details
          open={!isPublicDemo}
          className="pt-2 border-t border-slate-100 group"
          data-testid="specialist-levers-details"
        >
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800 select-none list-none flex items-center gap-1.5">
            <span className="text-[10px] transition-transform group-open:rotate-90">▶</span>
            <span>
              {lang === 'ru'
                ? 'Для специалиста (режим, α, Category Gate)'
                : 'For specialists (mode, alpha, Category Gate)'}
            </span>
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'ru' ? 'Режим' : 'Mode'}
              </label>
              <select
                aria-label={lang === 'ru' ? 'Режим поиска' : 'Search mode'}
                value={mode}
                onChange={(e) => setMode(e.target.value as 'hybrid' | 'dense' | 'sparse')}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-[6px] text-slate-900"
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
                aria-label="Alpha balance"
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
                aria-label="Category Gate"
                data-testid="admin-live-gate-select"
                value={gate}
                onChange={(e) => setGate(e.target.value as 'hard' | 'soft' | 'off')}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-[6px] text-slate-900"
              >
                <option value="hard">hard (strict)</option>
                <option value="soft">soft (demote)</option>
                <option value="off">off</option>
              </select>
            </div>
          </div>
        </details>
      </Card>

      {/* §3.1 Boot overlay: shown ONLY when showBootOverlay === true */}
      {showBootOverlay ? (
        <Card
          testId="admin-catalog-indexing-banner"
          className="p-10 text-center space-y-3"
        >
          <div className="text-sm font-semibold text-slate-900">
            {lang === 'ru' ? 'Загружаем витрину…' : 'Loading storefront…'}
          </div>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            {lang === 'ru'
              ? 'Подготавливаем демо-каталог и индекс быстрого поиска.'
              : 'Preparing the demo catalog and search index.'}
          </p>
          <div className="w-56 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-auto">
            <div className="h-full w-2/3 bg-slate-900 rounded-full animate-pulse" />
          </div>
        </Card>
      ) : (
        /* §3.2 Results block: Two-Column Results (Desktop 60–65% Left / 35–40% Right, Mobile 1 Column) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <Card className="lg:col-span-7 overflow-hidden">
            {isSearching ? (
              /* §3.2 searching -> Skeleton 5 rows */
              <Skeleton rows={5} />
            ) : !query.trim() && !hasSearchResponse ? (
              /* §3.2 ready, not searched yet -> Empty hint */
              <div
                data-testid="search-ready-hint"
                className="py-12 px-6 text-center text-xs text-slate-500"
              >
                {lang === 'ru'
                  ? 'Введите запрос или выберите пример'
                  : 'Enter a query or pick an example above'}
              </div>
            ) : results.length === 0 ? (
              /* §3.2 results, count=0 -> EmptyState zero-results (not boot!) */
              <EmptyState
                testId="admin-live-empty-state"
                title={
                  isPublicDemo
                    ? lang === 'ru'
                      ? 'Ничего не нашли — для бессмысленного запроса так и должно быть.'
                      : "No results — that's expected for a nonsense query."
                    : lang === 'ru'
                    ? 'По запросу ничего не найдено (count: 0)'
                    : 'Zero results returned (count: 0)'
                }
                description={
                  isPublicDemo
                    ? lang === 'ru'
                      ? 'Поиск не подсовывает случайные товары, если в каталоге нет подходящего ответа.'
                      : 'Search does not return random items when no relevant match exists in the catalog.'
                    : lang === 'ru'
                    ? 'Запрос отсечён порогом уверенности или фильтром категории. Если покупатели ищут так существующий товар — добавьте синоним.'
                    : 'Filtered by confidence floor or Category Gate. Add a synonym rule if shoppers use this phrase.'
                }
                action={
                  isPublicDemo ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid="empty-try-another-btn"
                      onClick={() => setQuery('наушники')}
                    >
                      {lang === 'ru' ? 'Попробовать другой пример' : 'Try another example'}
                    </Button>
                  ) : onAddSynonymForQuery && query.trim() ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onAddSynonymForQuery(query.trim())}
                    >
                      {lang === 'ru'
                        ? `+ Добавить синоним для «${query.trim()}»`
                        : `+ Add synonym for "${query.trim()}"`}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {/* Desktop Table (# · Товар · Категория · Цена · Match %) */}
                <div className="hidden sm:block">
                  <Table>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs text-slate-600">
                        <th className="py-2.5 px-3 font-medium w-10">#</th>
                        <th className="py-2.5 px-3 font-medium">
                          {lang === 'ru' ? 'Товар' : 'Product'}
                        </th>
                        <th className="py-2.5 px-3 font-medium">
                          {lang === 'ru' ? 'Категория' : 'Category'}
                        </th>
                        <th className="py-2.5 px-3 font-medium text-right">
                          {lang === 'ru' ? 'Цена' : 'Price'}
                        </th>
                        <th className="py-2.5 px-3 font-medium text-right">Match %</th>
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
                            className={`cursor-pointer transition-colors duration-150 ${
                              active ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono text-xs text-slate-500 tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-900">{hit.title}</div>
                              {!isPublicDemo && (
                                <div className="text-[11px] text-slate-500 font-mono">
                                  ID: {hit.id}
                                  {hit.sku ? ` · SKU: ${hit.sku}` : ''}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-slate-600">{hit.category}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs font-medium text-slate-900 tabular-nums whitespace-nowrap">
                              {typeof hit.price === 'number'
                                ? `${hit.price.toLocaleString()} ₽`
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <ScoreBar percent={hit.scorePercent} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>

                {/* Mobile Cards (title, category, price, match) */}
                <div
                  className="sm:hidden divide-y divide-slate-100"
                  data-testid="mobile-search-result-cards"
                >
                  {results.map((hit, idx) => {
                    const active = selectedHit?.id === hit.id;
                    return (
                      <button
                        key={hit.id}
                        type="button"
                        onClick={() => handleRecordClick(hit)}
                        className={`w-full text-left p-3.5 space-y-1.5 transition-colors cursor-pointer ${
                          active ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            <span className="font-mono text-xs text-slate-400 mr-1.5">
                              #{idx + 1}
                            </span>
                            {hit.title}
                          </span>
                          <ScoreBar percent={hit.scorePercent} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>{hit.category}</span>
                          <span className="font-mono font-medium text-slate-900 tabular-nums">
                            {typeof hit.price === 'number'
                              ? `${hit.price.toLocaleString()} ₽`
                              : '—'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {/* Right Panel: «Почему в топе» (§3.2: right column skeleton when searching) */}
          <Card
            testId="admin-xray-panel"
            className="lg:col-span-5 p-4 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">
                {lang === 'ru' ? 'Почему в топе' : 'Why it ranked on top'}
              </div>
              {isSearching ? (
                <div
                  data-testid="xray-loading-skeleton"
                  className="space-y-3 py-2 animate-pulse"
                  aria-busy="true"
                >
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-16 bg-slate-100 rounded-lg w-full" />
                </div>
              ) : !selectedHit ? (
                <div className="text-xs text-slate-500 py-8 text-center">
                  {lang === 'ru'
                    ? 'Выберите товар в списке слева, чтобы увидеть объяснение.'
                    : 'Select a product on the left to inspect its ranking explanation.'}
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {selectedHit.title}
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        {selectedHit.category}
                        {typeof selectedHit.price === 'number'
                          ? ` · ${selectedHit.price.toLocaleString()} ₽`
                          : ''}
                      </div>
                    </div>
                    <ScoreBar percent={selectedHit.scorePercent} />
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800">
                    <div
                      data-testid="admin-xray-human-explanation"
                      className="leading-relaxed text-slate-800"
                    >
                      {lang === 'ru'
                        ? selectedHit.humanExplanation?.ru ||
                          'Товар соответствует категории запроса и совпадает по смыслу и характеристикам.'
                        : selectedHit.humanExplanation?.en || 'Hybrid semantic + lexical match'}
                    </div>
                  </div>

                  {/* X-Ray Details — collapsed by default on Storefront */}
                  <details
                    open={!isPublicDemo}
                    className="pt-1 group"
                    data-testid="admin-xray-details"
                  >
                    <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800 select-none list-none flex items-center gap-1.5">
                      <span className="text-[10px] transition-transform group-open:rotate-90">
                        ▶
                      </span>
                      <span>
                        {lang === 'ru' ? 'Подробнее (формула)' : 'Details (formula)'}
                      </span>
                    </summary>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <KeyValue
                        label="Dense (384-d)"
                        value={Number(selectedHit.explanation?.denseComponent || 0).toFixed(4)}
                      />
                      <KeyValue
                        label="Sparse (BM25+)"
                        value={Number(selectedHit.explanation?.sparseBm25Component || 0).toFixed(4)}
                      />
                      <KeyValue
                        label="Hybrid RRF"
                        value={Number(selectedHit.explanation?.rrfScore || 0).toFixed(4)}
                      />
                      <KeyValue
                        label="Guardrail Boost"
                        value={Number(selectedHit.explanation?.businessBoost || 0).toFixed(4)}
                      />
                    </div>
                  </details>
                </div>
              )}
            </div>

            {isPublicDemo && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600">
                  {lang === 'ru' ? 'Проверить на своём каталоге?' : 'Test on your own catalog?'}
                </span>
                <button
                  type="button"
                  data-testid="public-demo-connect-store-cta"
                  onClick={onConnectStore}
                  className="text-slate-900 font-medium underline hover:text-slate-700 whitespace-nowrap cursor-pointer"
                >
                  {lang === 'ru' ? 'Подключить магазин →' : 'Connect Store →'}
                </button>
              </div>
            )}
          </Card>
        </div>
      )}
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
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            options={[
              { id: '24h', label: '24h' },
              { id: '7d', label: '7d' },
              { id: '30d', label: '30d' },
            ]}
            activeId={period}
            onChange={(p) => {
              const nextP = p as '24h' | '7d' | '30d';
              setPeriod(nextP);
              triggerFilter({ q, emptyOnly, gatedOnly, period: nextP });
            }}
          />

          <input
            type="search"
            aria-label={lang === 'ru' ? 'Фильтр по тексту запроса' : 'Filter by query text'}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              triggerFilter({ q: e.target.value, emptyOnly, gatedOnly, period });
            }}
            placeholder={lang === 'ru' ? 'Поиск по запросу...' : 'Filter query...'}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-[6px] text-slate-900"
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
            <span>{lang === 'ru' ? 'Только пустые (0)' : 'Zero results only'}</span>
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
            <span>{lang === 'ru' ? 'Category Gate' : 'Gated only'}</span>
          </label>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-mono tabular-nums">{logs.length}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRefresh({ q, emptyOnly, gatedOnly, period })}
          >
            {lang === 'ru' ? 'Обновить' : 'Refresh'}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState
            title={lang === 'ru' ? 'Журнал запросов пуст' : 'No queries logged yet'}
            description={
              lang === 'ru'
                ? 'Выполните поисковый запрос во вкладке «Живой поиск», чтобы увидеть запись в журнале.'
                : 'Run a search query in Live Search to populate the query log.'
            }
          />
        ) : (
          <>
            <Table className="text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-medium">{lang === 'ru' ? 'Время' : 'Time'}</th>
                  <th className="py-2.5 px-3 font-medium">{lang === 'ru' ? 'Запрос' : 'Query'}</th>
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
                    {lang === 'ru' ? 'Топ-1 товар' : 'Top-1 Hit'}
                  </th>
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
                      <span>{row.query}</span>
                      {(row.flags.empty || row.flags.rewritten || row.flags.gated) && (
                        <span className="ml-2 text-[11px] font-normal text-slate-500">
                          {[
                            row.flags.empty ? 'empty' : null,
                            row.flags.rewritten ? 'rewritten' : null,
                            row.flags.gated ? 'gated' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-600">{row.normalizedQuery}</td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={
                          row.flags.empty
                            ? 'text-rose-600 font-semibold'
                            : 'text-slate-900 font-semibold'
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
                        <span className="truncate block max-w-[220px]">
                          {row.top1.title} ({row.top1.scorePercent}%)
                        </span>
                      ) : (
                        '—'
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
                          className="text-slate-700 hover:text-slate-950 underline cursor-pointer"
                        >
                          {lang === 'ru' ? 'В Live' : 'Replay'}
                        </button>
                        {row.flags.empty && onAddSynonym && (
                          <button
                            type="button"
                            onClick={() => onAddSynonym(row.query)}
                            className="text-emerald-700 hover:text-emerald-900 underline font-medium cursor-pointer"
                          >
                            {lang === 'ru' ? '+ Синоним' : '+ Synonym'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <span>
                {lang === 'ru'
                  ? `Страница ${currentPage} из ${totalPages} (всего ${logs.length})`
                  : `Page ${currentPage} of ${totalPages} (${logs.length} total)`}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← {lang === 'ru' ? 'Назад' : 'Prev'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {lang === 'ru' ? 'Вперёд' : 'Next'} →
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
