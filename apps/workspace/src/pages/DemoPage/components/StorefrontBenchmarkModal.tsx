import { getActiveApiKey } from '../../../lib/apiClient';
import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2,
  BookOpen,
  Plus,
} from 'lucide-react';
import { CatalogItem } from '../../../types';
import { HybridSearchHit, simulateKeywordSearch } from '../../../utils/recommenderEngine';
import {
  INDUSTRY_SYNONYM_PACKS,
  IndustrySynonymPackId,
  getActiveSynonymPacks,
  toggleSynonymPack,
  getCustomSynonyms,
  addCustomSynonym,
  subscribeSynonyms,
} from '../../../data/industrySynonyms';
import { UiLanguage } from '../../../i18n/uiTranslations';

interface StorefrontBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  onHybridSearch: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onRunQueryInStudio: (query: string) => void;
  uiLang?: UiLanguage;
}

interface BenchmarkRow {
  query: string;
  tag: string;
  legacyCount: number;
  legacyTitles: string[];
  eidosCount: number;
  eidosTopTitles: Array<{ title: string; score: number; price?: string | number }>;
  latencyMs: number;
}

const DEFAULT_BENCHMARK_SCENARIOS = [
  { query: 'недорогие наушники для бега', tag: 'Смысловой + Бюджет (Intent)' },
  { query: 'крсовки для марафона', tag: 'Опечатка покупателя (Subword 384-d)' },
  { query: 'акб и колодки', tag: 'Отраслевой сленг (Синонимы)' },
  { query: 'ghjuhfvvbhjdfybt rust', tag: 'Неверная раскладка клавиатуры' },
  { query: 'утренний эспрессо дома', tag: 'Сценарий использования (LSA/Dense)' },
];

export const StorefrontBenchmarkModal: React.FC<StorefrontBenchmarkModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onHybridSearch,
  onRunQueryInStudio,
  uiLang = 'ru',
}) => {
  const isRu = uiLang === 'ru';
  const [clientSearchUrl, setClientSearchUrl] = useState('');
  const [comparisonSource, setComparisonSource] = useState<'simulated_sql_like' | 'external_url'>('simulated_sql_like');
  const [externalUrlWarning, setExternalUrlWarning] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [activePacks, setActivePacks] = useState<IndustrySynonymPackId[]>(getActiveSynonymPacks());
  const [customSyns, setCustomSyns] = useState(getCustomSynonyms());
  const [newSynSource, setNewSynSource] = useState('');
  const [newSynTarget, setNewSynTarget] = useState('');

  useEffect(() => {
    return subscribeSynonyms(() => {
      setActivePacks(getActiveSynonymPacks());
      setCustomSyns(getCustomSynonyms());
    });
  }, []);

  const runBenchmarkSuite = async () => {
    if (catalog.length === 0) return;
    setIsRunning(true);
    setExternalUrlWarning(null);

    const trimmedUrl = clientSearchUrl.trim();
    const isRealExternalUrl =
      trimmedUrl.length > 0 &&
      /^https?:\/\//i.test(trimmedUrl) &&
      !trimmedUrl.includes('your-bitrix-shop.ru') &&
      !trimmedUrl.includes('your-store.ru');

    let serverExternalMap: Map<string, { titles: string[]; status: string }> | null = null;

    if (isRealExternalUrl && typeof window !== 'undefined' && typeof window.fetch === 'function') {
      try {
        const res = await window.fetch('/v1/benchmark/compare-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': getActiveApiKey({ allowPublicDemoKey: true }),
          },
          body: JSON.stringify({
            searchUrlTemplate: trimmedUrl,
            queries: DEFAULT_BENCHMARK_SCENARIOS.map((s) => s.query),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.comparisons)) {
            serverExternalMap = new Map();
            let anyFetched = false;
            for (const c of data.comparisons) {
              if (c.externalStatus === 'fetched') anyFetched = true;
              serverExternalMap.set(String(c.query), {
                titles: Array.isArray(c.externalTop3) ? c.externalTop3 : [],
                status: String(c.externalStatus || 'simulated_sql_like'),
              });
            }
            setComparisonSource(anyFetched ? 'external_url' : 'simulated_sql_like');
            if (!anyFetched) {
              setExternalUrlWarning(
                isRu
                  ? 'Внешний URL не вернул парсируемую HTML-выдачу (или недоступен) — показана честная симуляция SQL LIKE по текущему каталогу.'
                  : 'External URL did not return parseable HTML results — showing exact SQL LIKE simulation over the active catalog.'
              );
            }
          }
        } else {
          setComparisonSource('simulated_sql_like');
          setExternalUrlWarning(
            isRu
              ? `Проверка внешнего URL требует ключ администратора (HTTP ${res.status}) — показана локальная симуляция SQL LIKE.`
              : `External URL comparison requires admin key (HTTP ${res.status}) — showing local SQL LIKE simulation.`
          );
        }
      } catch {
        setComparisonSource('simulated_sql_like');
      }
    } else {
      setComparisonSource('simulated_sql_like');
    }

    const computed: BenchmarkRow[] = [];
    for (const sc of DEFAULT_BENCHMARK_SCENARIOS) {
      const t0 = performance.now();
      const kw = simulateKeywordSearch(sc.query, catalog);
      const eidos = await onHybridSearch(sc.query, 0.7, 3);
      const elapsed = Math.max(0.3, Math.round((performance.now() - t0) * 10) / 10);
      const extEntry = serverExternalMap?.get(sc.query);
      const legacyTitles =
        extEntry && extEntry.status === 'fetched'
          ? extEntry.titles.slice(0, 2)
          : kw.slice(0, 2).map((k) => k.item.title);
      const legacyCount =
        extEntry && extEntry.status === 'fetched' ? extEntry.titles.length : kw.length;

      computed.push({
        query: sc.query,
        tag: sc.tag,
        legacyCount,
        legacyTitles,
        eidosCount: eidos.length,
        eidosTopTitles: eidos.slice(0, 2).map((h) => ({
          title: h.item.title,
          score: Math.round(h.fusedScore * 100),
          price: h.item.price,
        })),
        latencyMs: elapsed,
      });
    }
    setRows(computed);
    setIsRunning(false);
  };

  useEffect(() => {
    if (isOpen && catalog.length > 0) {
      void runBenchmarkSuite();
    }
  }, [isOpen, catalog.length, activePacks.length, customSyns.length]);

  if (!isOpen) return null;

  const handleTogglePack = (packId: IndustrySynonymPackId) => {
    toggleSynonymPack(packId);
  };

  const handleAddSynonym = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSynSource.trim() || !newSynTarget.trim()) return;
    addCustomSynonym(newSynSource.trim(), newSynTarget.trim());
    setNewSynSource('');
    setNewSynTarget('');
  };

  const legacyZeroCount = rows.filter((r) => r.legacyCount === 0).length;
  const legacySolvedCount = rows.length - legacyZeroCount;
  const eidosSolvedCount = rows.filter((r) => r.eidosCount > 0).length;
  const avgLatencyMs =
    rows.length > 0
      ? Math.round((rows.reduce((sum, r) => sum + r.latencyMs, 0) / rows.length) * 10) / 10
      : 0;
  const recallLiftPct =
    rows.length > 0
      ? Math.max(0, Math.round(((eidosSolvedCount - legacySolvedCount) / rows.length) * 100))
      : 0;

  return (
    <div
      data-testid="storefront-benchmark-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-5xl w-full p-6 shadow-2xl text-zinc-100 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Scale size={13} />
                <span>Executive ROI Benchmark</span>
              </span>
              <h2 className="text-lg font-bold text-white">
                {isRu
                  ? 'Сравнение «Было на вашем сайте (SQL/Bitrix) vs Стало в EIDOS» + Отраслевые синонимы'
                  : 'Side-by-Side Storefront Benchmark & Industry Synonym Dictionaries'}
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              {isRu
                ? 'Наглядная демонстрация для ЛПР: как 384-d векторы и отраслевые словари синонимов спасают потерянную выручку на сложных запросах.'
                : 'Demonstrate how 384-d hybrid vectors and domain synonym dictionaries eliminate zero-result searches.'}
            </p>
          </div>
          <button
            type="button"
            data-testid="close-benchmark-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section 1: Industry Synonym & Stopword Packs (Автотека, Электроника, Fashion, DIY) */}
        <div className="mb-6 p-4 rounded-xl bg-zinc-950/90 border border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                {isRu
                  ? 'Отраслевые словари синонимов и стоп-слов (1-клик подключение):'
                  : 'Industry Synonym & Stopword Packs (1-Click Activation):'}
              </span>
            </div>
            <span className="text-[11px] mono text-emerald-400">
              {isRu ? `Активно словарей: ${activePacks.length}` : `Active packs: ${activePacks.length}`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
            {INDUSTRY_SYNONYM_PACKS.map((pack) => {
              const active = activePacks.includes(pack.id);
              return (
                <button
                  key={pack.id}
                  type="button"
                  data-testid={`synonym-pack-btn-${pack.id}`}
                  onClick={() => handleTogglePack(pack.id)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    active
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-white">
                      {pack.icon} {isRu ? pack.nameRu : pack.nameEn}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {active ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2">{pack.descriptionRu}</p>
                </button>
              );
            })}
          </div>

          {/* Quick Custom Synonym Adder */}
          <form onSubmit={handleAddSynonym} className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-zinc-800/80">
            <span className="text-xs text-zinc-400">
              {isRu ? 'Добавить свой синоним:' : 'Add custom synonym:'}
            </span>
            <input
              type="text"
              data-testid="custom-synonym-source-input"
              value={newSynSource}
              onChange={(e) => setNewSynSource(e.target.value)}
              placeholder={isRu ? 'Сленг / запрос (напр. макбук)' : 'Source term'}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white"
            />
            <span className="text-zinc-500 text-xs">→</span>
            <input
              type="text"
              data-testid="custom-synonym-target-input"
              value={newSynTarget}
              onChange={(e) => setNewSynTarget(e.target.value)}
              placeholder={isRu ? 'Нормализованный термин (ноутбук apple)' : 'Target expansion'}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white flex-1 min-w-[180px]"
            />
            <button
              type="submit"
              data-testid="add-custom-synonym-btn"
              className="btn btn-primary btn-sm flex items-center gap-1"
            >
              <Plus size={12} />
              <span>{isRu ? 'Связать' : 'Bind'}</span>
            </button>
            {customSyns.length > 0 && (
              <span className="text-[11px] text-emerald-400 mono">
                +{customSyns.length} польз. правил
              </span>
            )}
          </form>
        </div>

        {/* Section 2: Target Storefront URL Input & Benchmark Trigger */}
        <div className="flex flex-wrap items-center gap-2.5 mb-2">
          <div className="relative flex-1 min-w-[260px]">
            <Globe size={15} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              data-testid="benchmark-url-input"
              value={clientSearchUrl}
              onChange={(e) => setClientSearchUrl(e.target.value)}
              placeholder="https://your-store.ru/search?q={query} (опционально — без URL используется локальная SQL LIKE симуляция)"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white mono"
            />
          </div>
          <button
            type="button"
            data-testid="run-benchmark-suite-btn"
            onClick={() => void runBenchmarkSuite()}
            disabled={isRunning}
            className="btn btn-primary flex items-center gap-1.5"
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{isRu ? 'Запустить стресс-тест (5 запросов)' : 'Run 5-Query Stress Benchmark'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-[11px]">
          <span
            data-testid="benchmark-comparison-source"
            className={`px-2 py-0.5 rounded font-mono ${
              comparisonSource === 'external_url'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
            }`}
          >
            {comparisonSource === 'external_url'
              ? isRu
                ? 'Источник базовой линии: Live-запрос к внешнему URL (/v1/benchmark/compare-url)'
                : 'Baseline source: Live external URL check (/v1/benchmark/compare-url)'
              : isRu
                ? 'Источник базовой линии: Локальная симуляция SQL LIKE по демо-каталогу'
                : 'Baseline source: Local SQL LIKE simulation over demo catalog'}
          </span>
          {externalUrlWarning && (
            <span data-testid="benchmark-url-warning" className="text-amber-400">
              {externalUrlWarning}
            </span>
          )}
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="text-xs text-red-300 mb-0.5">
              {isRu ? 'Обычный SQL LIKE / Bitrix поиск' : 'Legacy SQL / Keyword Search'}
            </div>
            <div className="text-lg font-bold text-red-400 mono tabular-nums">
              {legacyZeroCount} из {rows.length} запросов = 0 товаров
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-xs text-emerald-300 mb-0.5">
              {isRu ? 'Гибридный поиск EIDOS (384-d + Синонимы)' : 'EIDOS Hybrid 384-d + Synonyms'}
            </div>
            <div className="text-lg font-bold text-emerald-400 mono tabular-nums">
              {eidosSolvedCount} из {rows.length} успешных выдач
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <div className="text-xs text-indigo-300 mb-0.5">
              {isRu ? 'Прирост полноты выдачи и задержка' : 'Measured Recall Lift & Latency'}
            </div>
            <div data-testid="benchmark-measured-kpi" className="text-lg font-bold text-indigo-300 mono tabular-nums">
              +{recallLiftPct}% полнота · {avgLatencyMs > 0 ? `${avgLatencyMs} мс` : '—'}
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.query}
              data-testid="benchmark-comparison-row"
              className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
            >
              <div className="lg:col-span-3">
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 mb-1">
                  {row.tag}
                </span>
                <div className="font-semibold text-sm text-white">«{row.query}»</div>
                <button
                  type="button"
                  onClick={() => {
                    onRunQueryInStudio(row.query);
                    onClose();
                  }}
                  className="text-[11px] text-indigo-400 hover:underline mt-1"
                >
                  {isRu ? 'Открыть в X-Ray инспекторе →' : 'Inspect in Studio →'}
                </button>
              </div>

              {/* Legacy SQL Column */}
              <div className="lg:col-span-4 p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800/80">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-400">{isRu ? 'Было (SQL / точное слово):' : 'Before (SQL Exact):'}</span>
                  {row.legacyCount === 0 ? (
                    <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                      <AlertTriangle size={12} /> 0 найдено
                    </span>
                  ) : (
                    <span className="text-zinc-300 mono">{row.legacyCount} шт.</span>
                  )}
                </div>
                {row.legacyTitles.length === 0 ? (
                  <div className="text-xs text-red-300/80 italic">
                    {isRu ? 'Потерянный покупатель (пустая страница)' : 'Zero results — lost customer'}
                  </div>
                ) : (
                  <ul className="text-xs text-zinc-300 space-y-0.5 truncate">
                    {row.legacyTitles.map((t, i) => (
                      <li key={i} className="truncate">
                        • {t}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* EIDOS Hybrid Column */}
              <div className="lg:col-span-5 p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-emerald-300 font-semibold flex items-center gap-1">
                    <Sparkles size={12} />
                    {isRu ? 'Стало в EIDOS (384-d + BM25):' : 'After in EIDOS (384-d + BM25):'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 mono font-semibold">
                    <CheckCircle2 size={12} /> {row.eidosCount} найдено · {row.latencyMs}ms
                  </span>
                </div>
                <ul className="text-xs text-zinc-100 space-y-1">
                  {row.eidosTopTitles.map((hit, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        #{i + 1} {hit.title}
                      </span>
                      <span className="mono text-[11px] text-emerald-400 shrink-0">{hit.score}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
