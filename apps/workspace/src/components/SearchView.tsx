import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Sliders,
  Columns,
  Globe,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem } from '../types';
import {
  HybridSearchHit,
  simulateKeywordSearch,
  detectTextLanguage,
} from '../utils/recommenderEngine';
import { trackEvent } from '../lib/analytics/tracker';
import { EmbeddingEngineState } from '../lib/embeddings';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';
import { SearchResultsColumns } from './search/SearchResultsColumns';

interface SearchViewProps {
  catalog: CatalogItem[];
  onHybridSearch: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onSelectItem: (item: CatalogItem) => void;
  onInspectIn3D: (item: CatalogItem) => void;
  uiLang?: UiLanguage;
  embeddingState?: EmbeddingEngineState;
}

export const SearchView: React.FC<SearchViewProps> = ({
  catalog,
  onHybridSearch,
  onSelectItem,
  onInspectIn3D,
  uiLang = 'ru',
  embeddingState,
}) => {
  const t = UI_TRANSLATIONS[uiLang].search;

  const dominantLang = useMemo(() => {
    const sample = catalog
      .slice(0, 4)
      .map((i) => `${i.title} ${i.description}`)
      .join(' ');
    return detectTextLanguage(sample);
  }, [catalog]);

  const sampleQueries = useMemo(() => {
    if (dominantLang === 'ja') {
      return [
        { label: '宇宙とブラックホールの科学と相対性理論', note: '日本語 4K科学ドキュメンタリー＆インターステラー考察を検索' },
        { label: 'サイバーパンクと人工知能のゲーム実況', note: 'サイバーパンク2077＆猫の冒険Stray実況を検索' },
        { label: 'RustとPythonによる高速データベース開発', note: 'Rust/WASMベクトルDB講座＆Python AI解説を検索' },
        { label: '京都の朝カフェと深夜の作業用BGM音楽', note: '京都エスプレッソVLOG＆東京Lo-Fi BGM配信を検索' },
      ];
    }
    if (dominantLang === 'en') {
      return [
        { label: 'relativistic time dilation and black holes in space', note: 'Finds Interstellar, Dune & Cosmos Documentary' },
        { label: 'neon cyberpunk artificial intelligence and simulated reality', note: 'Finds Edgerunners, The Matrix & Synthwave Stream' },
        { label: 'subconscious dreams and psychological mind thriller', note: 'Finds Inception & 1984' },
        { label: 'rust vector databases and deep coding focus', note: 'Finds Silicon & Rust Doc + Coding Synthwave Audio' },
      ];
    }
    return [
      { label: 'релятивистское время и космос', note: 'Vocabulary mismatch test (finds Interstellar & Dune)' },
      { label: 'симуляция реальности и нейросети', note: 'Conceptual match (finds Matrix & Cyberpunk)' },
      { label: '宇宙とブラックホールの科学 (JP Query)', note: 'Multilingual Japanese CJK vector + BM25 test' },
      { label: 'утренний эспрессо и уют в офисе', note: 'Cross-category lifestyle intent' },
    ];
  }, [dominantLang]);

  const [query, setQuery] = useState(sampleQueries[0].label);
  const [alpha, setAlpha] = useState<number>(0.7);
  const [compareMode, setCompareMode] = useState<boolean>(true);
  const [hybridHits, setHybridHits] = useState<HybridSearchHit[]>([]);
  const [keywordHits, setKeywordHits] = useState<Array<{ item: CatalogItem; matchedWords: string[] }>>([]);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [wasSanitized, setWasSanitized] = useState(false);

  const runSearch = async (targetQuery?: string, targetAlpha?: number) => {
    const raw = (targetQuery ?? query).trim();
    const a = targetAlpha ?? alpha;
    if (!raw) return;

    const scan = SecurityGuardrails.scanAndSanitize(raw);
    const q = scan.sanitizedInput || raw;
    setWasSanitized(!scan.isSafe);

    if (targetQuery !== undefined) setQuery(q);
    setIsLoading(true);
    trackEvent({ type: 'search', query: q });

    const t0 = performance.now();
    try {
      const hits = await onHybridSearch(q, a, 8);
      const kw = simulateKeywordSearch(q, catalog);
      setHybridHits(hits);
      setKeywordHits(kw);
      setLatencyMs(Math.round((performance.now() - t0) * 100) / 100);
      hits.slice(0, 4).forEach((h) => {
        trackEvent({ type: 'item_view', itemId: h.item.id, category: h.item.category });
      });
    } catch {
      setHybridHits([]);
      setKeywordHits([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const defaultQ = sampleQueries[0].label;
    setQuery(defaultQ);
    runSearch(defaultQ, alpha);
  }, [dominantLang, catalog[0]?.id]);

  useEffect(() => {
    runSearch(query, alpha);
  }, [alpha, catalog.length]);

  const modelStatusLabel =
    embeddingState?.status === 'ready'
      ? 'ONNX Neural Ready (384-d WASM)'
      : embeddingState?.status === 'loading-model'
      ? `ONNX Loading (${embeddingState.progress}%) · Hybrid Anchor + BM25 Active`
      : 'Local 384-d Anchor + BM25 Lexical Active';

  return (
    <div className="page">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-sub">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            data-testid="embedding-status-badge"
            className={`badge ${
              embeddingState?.status === 'ready' ? 'badge-success' : 'badge-warning'
            }`}
          >
            <Cpu size={12} />
            <span>{modelStatusLabel}</span>
          </span>
          <span className="badge badge-accent">
            <Globe size={12} />
            <span>
              {t.corpusScript} {dominantLang.toUpperCase()}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setCompareMode((v) => !v)}
            className={compareMode ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <Columns size={14} />
            <span>{compareMode ? t.sideBySideOn : t.sideBySideOff}</span>
          </button>
        </div>
      </div>

      <div className="card p-5 mb-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          className="flex gap-2.5 mb-4"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-[var(--text-sec)]" />
            <input
              data-testid="search-input"
              className="input pl-10 h-[42px] text-[0.9375rem]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.placeholder}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary h-[42px]"
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? t.searchingBtn : t.executeBtn}
          </button>
        </form>

        {wasSanitized && (
          <div className="badge badge-success mb-3">
            <ShieldCheck size={14} />
            <span>{t.securityFilteredBadge}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3.5 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--text-sec)]">
              {t.modePreset}
            </span>
            {[
              { label: 'Pure BM25 (α=0.0)', val: 0.0 },
              { label: 'Balanced Hybrid (α=0.5)', val: 0.5 },
              { label: 'Semantic Heavy (α=0.7)', val: 0.7 },
              { label: 'Pure 384-d Vector (α=1.0)', val: 1.0 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setAlpha(preset.val)}
                className={
                  Math.abs(alpha - preset.val) < 0.02
                    ? 'btn btn-primary btn-sm'
                    : 'btn btn-secondary btn-sm'
                }
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 min-w-[260px]">
            <Sliders size={14} className="text-[var(--text-sec)]" />
            <span className="text-xs text-[var(--text-sec)]">{t.alphaWeight}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="mono text-xs font-bold text-[var(--accent)]">
              {alpha.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-sec)]">{t.testQueries}</span>
          {sampleQueries.map((sq) => (
            <button
              key={sq.label}
              type="button"
              onClick={() => runSearch(sq.label)}
              className="btn btn-secondary btn-sm"
              title={sq.note}
            >
              {sq.label}
            </button>
          ))}
        </div>
      </div>

      <SearchResultsColumns
        compareMode={compareMode}
        hybridHits={hybridHits}
        keywordHits={keywordHits}
        latencyMs={latencyMs}
        alpha={alpha}
        t={t}
        onSelectItem={onSelectItem}
        onInspectIn3D={onInspectIn3D}
      />
    </div>
  );
};
