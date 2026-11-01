import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  ShoppingBag,
  Sparkles,
  Sun,
  Moon,
  Copy,
  Check,
  Code2,
  ExternalLink,
  Zap,
  Tag,
} from 'lucide-react';
import { CatalogItem } from '../../../types';
import { HybridSearchHit } from '../../../utils/recommenderEngine';
import { UiLanguage } from '../../../i18n/uiTranslations';

interface WidgetLivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  onHybridSearch: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onSelectItem: (item: CatalogItem) => void;
  initialQuery?: string;
  uiLang?: UiLanguage;
}

export const WidgetLivePreviewModal: React.FC<WidgetLivePreviewModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onHybridSearch,
  onSelectItem,
  initialQuery = '',
  uiLang = 'ru',
}) => {
  const isRu = uiLang === 'ru';
  const [storeQuery, setStoreQuery] = useState(initialQuery);
  const [storeTheme, setStoreTheme] = useState<'light' | 'dark'>('light');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [hits, setHits] = useState<HybridSearchHit[]>([]);
  const [latencyMs, setLatencyMs] = useState<number>(1.2);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [showCodeBar, setShowCodeBar] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStoreQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const run = async () => {
      const q = storeQuery.trim();
      if (!q) {
        setHits(
          catalog.slice(0, 12).map((item, idx) => ({
            item,
            fusedScore: Number((0.96 - idx * 0.02).toFixed(3)),
            denseScore: 0.92,
            bm25Score: 0.88,
            source: 'hybrid',
            retrievalMode: 'hybrid-384d',
            whyRecommended: isRu ? 'Топ витрины магазина' : 'Storefront featured item',
          }))
        );
        setLatencyMs(0.4);
        return;
      }
      const t0 = performance.now();
      const res = await onHybridSearch(q, 0.7, 12);
      if (!active) return;
      setHits(res);
      setLatencyMs(Math.max(0.2, Math.round((performance.now() - t0) * 10) / 10));
    };
    const timer = setTimeout(() => {
      void run();
    }, 60);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, storeQuery, catalog, onHybridSearch, isRu]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of catalog) {
      if (item.category) set.add(item.category);
    }
    return ['ALL', ...Array.from(set).slice(0, 8)];
  }, [catalog]);

  const filteredHits = useMemo(() => {
    if (selectedCategory === 'ALL') return hits;
    return hits.filter((h) => h.item.category === selectedCategory);
  }, [hits, selectedCategory]);

  if (!isOpen) return null;

  const widgetEmbedCode = `<!-- EIDOS Instant Storefront Search Widget (1-script integration) -->
<script
  src="${typeof window !== 'undefined' ? window.location.origin : 'https://pilot.eidos.ai'}/widget.js"
  data-eidos-url="${typeof window !== 'undefined' ? window.location.origin : 'https://pilot.eidos.ai'}"
  data-eidos-key="eidos_search_readonly_public_demo"
  data-eidos-theme="${storeTheme}"
  data-eidos-placeholder="${isRu ? 'Умный поиск по каталогу (смысл, бренд, артикул)...' : 'Smart catalog search...'}"
></script>`;

  const handleCopySnippet = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(widgetEmbedCode).catch(() => {});
    }
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const isLight = storeTheme === 'light';

  return (
    <div
      data-testid="widget-live-preview-modal"
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md p-2 sm:p-5"
    >
      {/* Top Studio Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-t-2xl bg-zinc-900 border border-zinc-800 text-zinc-100">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold">
            <Sparkles size={13} />
            <span>Widget Live Preview</span>
          </span>
          <span className="text-xs text-zinc-400">
            {isRu
              ? `Живая витрина интернет-магазина с вашим каталогом (${catalog.length} SKU)`
              : `Live e-commerce storefront mockup with your active catalog (${catalog.length} SKUs)`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="widget-preview-theme-toggle"
            onClick={() => setStoreTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
          >
            {isLight ? <Moon size={13} /> : <Sun size={13} />}
            <span>{isLight ? (isRu ? 'Тёмная витрина' : 'Dark Store') : isRu ? 'Светлая витрина' : 'Light Store'}</span>
          </button>

          <button
            type="button"
            data-testid="widget-preview-toggle-code"
            onClick={() => setShowCodeBar((v) => !v)}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
          >
            <Code2 size={13} />
            <span>{isRu ? 'Код вставки <script>' : 'Embed <script>'}</span>
          </button>

          <button
            type="button"
            data-testid="widget-preview-copy-btn"
            onClick={handleCopySnippet}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            {copiedSnippet ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedSnippet ? (isRu ? 'Скопировано!' : 'Copied!') : isRu ? 'Скопировать код виджета' : 'Copy Widget Code'}</span>
          </button>

          <button
            type="button"
            data-testid="close-widget-preview-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {showCodeBar && (
        <div className="px-4 py-3 bg-zinc-950 border-x border-b border-zinc-800">
          <pre className="text-xs mono text-indigo-200 overflow-x-auto leading-relaxed">{widgetEmbedCode}</pre>
        </div>
      )}

      {/* Simulated Client E-Commerce Storefront */}
      <div
        className={`flex-1 overflow-y-auto rounded-b-2xl border-x border-b transition-colors ${
          isLight
            ? 'bg-slate-50 text-slate-900 border-slate-200'
            : 'bg-zinc-950 text-zinc-100 border-zinc-800'
        }`}
      >
        {/* Storefront Navigation Bar */}
        <header
          className={`sticky top-0 z-20 px-6 py-4 border-b backdrop-blur-md ${
            isLight ? 'bg-white/95 border-slate-200' : 'bg-zinc-900/95 border-zinc-800'
          }`}
        >
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                <ShoppingBag size={18} />
              </div>
              <div>
                <div className="font-bold text-base tracking-tight flex items-center gap-2">
                  <span>CLIENT STOREFRONT</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono">
                    EIDOS WIDGET v1.4 ACTIVE
                  </span>
                </div>
                <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  1С-Битрикс / Shopify / Custom витрина · 384-d Hybrid Search
                </div>
              </div>
            </div>

            {/* Interactive EIDOS Search Widget Input */}
            <div className="flex-1 max-w-xl relative">
              <Search
                size={17}
                className={`absolute left-3.5 top-3 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}
              />
              <input
                type="text"
                data-testid="widget-preview-search-input"
                value={storeQuery}
                onChange={(e) => setStoreQuery(e.target.value)}
                placeholder={
                  isRu
                    ? 'Введите запрос покупателя (опечатка, сленг, бюджет, бренд)...'
                    : 'Type customer query (typos, slang, use-case, brand)...'
                }
                className={`w-full pl-10 pr-28 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                  isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400'
                    : 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-400'
                }`}
              />
              <div className="absolute right-2.5 top-2 flex items-center gap-1.5">
                {storeQuery && (
                  <button
                    type="button"
                    onClick={() => setStoreQuery('')}
                    className="text-xs px-1.5 py-0.5 rounded hover:bg-black/10 text-slate-400"
                  >
                    ✕
                  </button>
                )}
                <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[11px] mono font-semibold flex items-center gap-1">
                  <Zap size={10} />
                  {latencyMs}ms
                </span>
              </div>
            </div>
          </div>

          {/* Quick Customer Query Pills & Category Filter */}
          <div className="max-w-6xl mx-auto mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                {isRu ? 'Проверка поиска:' : 'Try query:'}
              </span>
              {[
                'недорогие наушники для бега',
                'крсовки марафон',
                'ноутбук для кода',
                'утренний эспрессо',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setStoreQuery(q)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    storeQuery === q
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white'
                      : isLight
                      ? 'text-slate-600 hover:bg-slate-200/70'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {cat === 'ALL' ? (isRu ? 'Все категории' : 'All Categories') : cat}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Storefront Instant Results Grid */}
        <main className="max-w-6xl mx-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium">
              {storeQuery.trim() ? (
                <span>
                  {isRu ? 'Результаты живого виджета по запросу' : 'Live widget results for'}{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">«{storeQuery}»</strong> ({filteredHits.length})
                </span>
              ) : (
                <span>
                  {isRu ? 'Витрина каталога клиента' : 'Client Catalog Storefront'} ({filteredHits.length} SKU)
                </span>
              )}
            </div>
            <div className="text-xs mono text-emerald-600 dark:text-emerald-400">
              Hybrid RRF 384-d + BM25 · Zero-Config Widget
            </div>
          </div>

          {filteredHits.length === 0 ? (
            <div
              className={`p-10 rounded-2xl border text-center ${
                isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <p className="text-base font-semibold mb-1">
                {isRu ? 'По вашему запросу ничего не найдено' : 'No matching products found'}
              </p>
              <p className="text-xs text-slate-500 mb-4">
                {isRu
                  ? 'Виджет автоматически предлагает популярные категории и исправление опечаток.'
                  : 'The widget automatically suggests popular categories and typo recovery.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStoreQuery('');
                  setSelectedCategory('ALL');
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
              >
                {isRu ? 'Показать весь каталог' : 'Show all products'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredHits.map((hit, idx) => (
                <div
                  key={hit.item.id}
                  data-testid="widget-preview-product-card"
                  onClick={() => {
                    onSelectItem(hit.item);
                    onClose();
                  }}
                  className={`group cursor-pointer rounded-xl border p-4 flex flex-col justify-between transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-indigo-400'
                      : 'bg-zinc-900 border-zinc-800 hover:border-indigo-500/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
                          isLight ? 'bg-slate-100 text-slate-700' : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        <Tag size={10} />
                        {hit.item.category}
                      </span>
                      <span className="mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        #{idx + 1} · {(hit.fusedScore * 100).toFixed(0)}%
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm leading-snug mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {hit.item.title}
                    </h3>

                    <p
                      className={`text-xs line-clamp-2 mb-3 ${
                        isLight ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      {hit.item.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <span className="font-bold text-base mono tabular-nums">
                      {hit.item.price ? `${hit.item.price}` : '—'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      <span>{isRu ? 'В карточку' : 'Inspect'}</span>
                      <ExternalLink size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
