import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Sliders,
  Columns,
  Boxes,
  Lightbulb,
  AlertCircle,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem } from '../types';
import {
  HybridSearchHit,
  simulateKeywordSearch,
  detectTextLanguage,
} from '../utils/recommenderEngine';
import { trackEvent } from '../lib/analytics/tracker';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';

interface SearchViewProps {
  catalog: CatalogItem[];
  onHybridSearch: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onSelectItem: (item: CatalogItem) => void;
  onInspectIn3D: (item: CatalogItem) => void;
  uiLang?: UiLanguage;
}

export const SearchView: React.FC<SearchViewProps> = ({
  catalog,
  onHybridSearch,
  onSelectItem,
  onInspectIn3D,
  uiLang = 'ru',
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

    // SecurityGuardrails XSS & Prompt Injection protection
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

  // Update query when catalog domain language changes
  useEffect(() => {
    const defaultQ = sampleQueries[0].label;
    setQuery(defaultQ);
    runSearch(defaultQ, alpha);
  }, [dominantLang, catalog[0]?.id]);

  useEffect(() => {
    runSearch(query, alpha);
  }, [alpha, catalog.length]);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-sub">{t.subtitle}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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

      {/* Search Bar & Hybrid Alpha Controls */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          style={{ display: 'flex', gap: 10, marginBottom: 16 }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-sec)' }} />
            <input
              data-testid="search-input"
              className="input"
              style={{ paddingLeft: 40, height: 42, fontSize: '0.9375rem' }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.placeholder}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isLoading || !query.trim()} style={{ height: 42 }}>
            {isLoading ? t.searchingBtn : t.executeBtn}
          </button>
        </form>

        {wasSanitized && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'var(--success-bg)',
              color: 'var(--success)',
              fontSize: '0.75rem',
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            <ShieldCheck size={14} />
            <span>{t.securityFilteredBadge}</span>
          </div>
        )}

        {/* Hybrid Mode & Alpha Slider */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sec)' }}>
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
                className="btn btn-sm"
                style={{
                  background: Math.abs(alpha - preset.val) < 0.02 ? 'var(--accent)' : 'var(--bg-alt)',
                  color: Math.abs(alpha - preset.val) < 0.02 ? '#FFFFFF' : 'var(--text-sec)',
                  borderColor: 'var(--border)',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 260 }}>
            <Sliders size={14} style={{ color: 'var(--text-sec)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{t.alphaWeight}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span className="mono" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent)' }}>
              {alpha.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Sample Queries */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{t.testQueries}</span>
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

      {/* Results Area: Side-by-Side or Single Column */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compareMode ? 'repeat(auto-fit, minmax(380px, 1fr))' : '1fr',
          gap: 20,
        }}
      >
        {/* Column 1: Eidos Hybrid Search */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>
              {t.hybridHitsTitle} ({hybridHits.length} hits)
            </div>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
              {latencyMs} ms · α={alpha.toFixed(2)}
            </span>
          </div>

          {hybridHits.length === 0 ? (
            <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-sec)' }}>
              No matches found for this threshold.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hybridHits.map((hit, idx) => (
                <div
                  key={hit.item.id}
                  data-testid="search-result"
                  className="card"
                  onClick={() => onSelectItem(hit.item)}
                  style={{ padding: 16, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-mut)', fontWeight: 700, marginTop: 2 }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{hit.item.icon || '📦'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text)' }}>
                          {hit.item.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 2 }}>
                          <span>{hit.item.category}</span>
                          <span> · </span>
                          <span className="mono">{hit.item.price || '—'}</span>
                          <span> · </span>
                          <span className="mono" style={{ color: 'var(--accent)' }}>
                            {hit.source.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--success)' }}>
                        {(hit.fusedScore * 100).toFixed(1)}%
                      </div>
                      <div className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-sec)' }}>
                        D:{(hit.denseScore * 100).toFixed(0)}% · B:{(hit.bm25Score * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', margin: '8px 0' }}>
                    {hit.item.description}
                  </p>

                  {/* Score Decomposition Bar */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                      padding: '8px 10px',
                      background: 'var(--bg-alt)',
                      borderRadius: 6,
                      fontSize: '0.6875rem',
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-sec)' }}>Dense 384-d Cosine</span>
                        <span className="mono" style={{ fontWeight: 600 }}>{(hit.denseScore * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, hit.denseScore * 100)}%`, height: '100%', background: 'var(--accent)' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-sec)' }}>BM25 Lexical Match (CJK + Unicode)</span>
                        <span className="mono" style={{ fontWeight: 600 }}>{(hit.bm25Score * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, hit.bm25Score * 100)}%`, height: '100%', background: 'var(--success)' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-mut)' }}>{hit.whyRecommended}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectIn3D(hit.item);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Boxes size={12} />
                        <span>3D Node</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectItem(hit.item);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Lightbulb size={12} />
                        <span>MMR Recs</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Legacy Exact Keyword Search (for Comparison) */}
        {compareMode && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-sec)' }}>
                {t.legacyHitsTitle} ({keywordHits.length} hits)
              </div>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600 }}>
                {t.legacySubtitle}
              </span>
            </div>

            {keywordHits.length === 0 ? (
              <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-sec)' }}>
                <AlertCircle size={22} style={{ margin: '0 auto 8px', color: 'var(--warning)' }} />
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {t.legacyZeroTitle}
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', marginTop: 6 }}>
                  {t.legacyZeroDesc}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {keywordHits.slice(0, 8).map(({ item, matchedWords }, idx) => (
                  <div key={item.id} className="card" style={{ padding: 16, opacity: 0.9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text)' }}>
                          #{idx + 1} · {item.icon} {item.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 2 }}>
                          {item.category} · {item.price || '—'}
                        </div>
                      </div>
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600 }}>
                        {matchedWords.length} word match
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', marginTop: 8 }}>
                      {item.description}
                    </p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-mut)', marginTop: 6 }}>
                      Matched tokens: <span className="mono">{matchedWords.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
