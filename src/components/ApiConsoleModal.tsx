import React, { useState, useEffect } from 'react';
import { X, Play, Terminal, Code2, Copy, Check } from 'lucide-react';
import { CatalogItem, CatalogRecommendation } from '../types';
import { HybridSearchHit } from '../utils/recommenderEngine';
import { ApiConsoleSnippets } from './modals/ApiConsoleSnippets';

interface ApiConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  selectedItem: CatalogItem | null;
  onHybridSearch: (query: string, alpha: number, limit: number) => Promise<HybridSearchHit[]>;
  onGetRecommendations: (
    item: CatalogItem,
    diversity: number,
    limit: number
  ) => Promise<CatalogRecommendation[]>;
}

export const ApiConsoleModal: React.FC<ApiConsoleModalProps> = ({
  isOpen,
  onClose,
  catalog,
  selectedItem,
  onHybridSearch,
  onGetRecommendations,
}) => {
  const [activeTab, setActiveTab] = useState<'playground' | 'sdk'>('playground');
  const [endpoint, setEndpoint] = useState<'search' | 'recommend'>('search');
  const [query, setQuery] = useState('космос и черные дыры');
  const [alpha, setAlpha] = useState(0.65);
  const [diversityLambda, setDiversityLambda] = useState(0.35);
  const [limit, setLimit] = useState(5);
  const [seedId, setSeedId] = useState<string>(String(selectedItem?.id || catalog[0]?.id || '1'));
  const [responseJson, setResponseJson] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (selectedItem) setSeedId(String(selectedItem.id));
  }, [selectedItem]);

  useEffect(() => {
    if (isOpen) {
      void executeRequest();
    }
  }, [isOpen, endpoint]);

  if (!isOpen) return null;

  const executeRequest = async () => {
    const t0 = performance.now();
    if (endpoint === 'search') {
      const hits = await onHybridSearch(query, alpha, limit);
      const elapsed = Math.round((performance.now() - t0) * 100) / 100;
      setLatencyMs(elapsed);
      setResponseJson(
        JSON.stringify(
          {
            status: 200,
            endpoint: 'POST /v1/search/hybrid',
            latencyMs: elapsed,
            params: { query, alpha, limit, dimension: 384 },
            hits: hits.map((h, idx) => ({
              rank: idx + 1,
              id: h.item.id,
              title: h.item.title,
              category: h.item.category,
              fusedScore: Number(h.fusedScore.toFixed(4)),
              denseCosine: Number(h.denseScore.toFixed(4)),
              sparseBm25: Number(h.bm25Score.toFixed(4)),
              retrievalMode: h.retrievalMode || 'hybrid-384d',
            })),
          },
          null,
          2
        )
      );
    } else {
      const seed = catalog.find((c) => String(c.id) === seedId) || catalog[0];
      if (!seed) return;
      const recs = await onGetRecommendations(seed, diversityLambda, limit);
      const elapsed = Math.round((performance.now() - t0) * 100) / 100;
      setLatencyMs(elapsed);
      setResponseJson(
        JSON.stringify(
          {
            status: 200,
            endpoint: 'POST /v1/recommendations/mmr',
            latencyMs: elapsed,
            seedItem: { id: seed.id, title: seed.title, category: seed.category },
            params: { diversityLambda, limit },
            recommendations: recs.map((r, idx) => ({
              rank: idx + 1,
              id: r.item.id,
              title: r.item.title,
              category: r.item.category,
              cosineSimilarity: Number(r.sim.toFixed(4)),
              mmrScore: r.mmrScore,
              noveltyBonus: r.noveltyBonus,
            })),
          },
          null,
          2
        )
      );
    }
  };

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <Terminal size={17} className="text-[var(--accent)]" />
            <span className="font-bold text-base text-[var(--text)]">
              Eidos REST API & TypeScript SDK Console
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('playground')}
              className={
                activeTab === 'playground' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'
              }
            >
              <Play size={12} />
              <span>Live Playground</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sdk')}
              className={
                activeTab === 'sdk' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'
              }
            >
              <Code2 size={12} />
              <span>SDK Integration</span>
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'sdk' ? (
            <ApiConsoleSnippets
              query={query}
              alpha={alpha}
              limit={limit}
              selectedId={seedId}
              diversityLambda={diversityLambda}
              copiedSnippet={copiedKey}
              onCopy={handleCopy}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-sec)] block mb-1">
                    Endpoint
                  </label>
                  <select
                    className="input"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value as 'search' | 'recommend')}
                  >
                    <option value="search">POST /v1/search/hybrid</option>
                    <option value="recommend">POST /v1/recommendations/mmr</option>
                  </select>
                </div>

                {endpoint === 'search' ? (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-sec)] block mb-1">
                        Query
                      </label>
                      <input
                        className="input"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-sec)] block mb-1">
                        Dense / BM25 Alpha ({alpha.toFixed(2)})
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={alpha}
                        onChange={(e) => setAlpha(parseFloat(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-sec)] block mb-1">
                        Seed Item
                      </label>
                      <select
                        className="input"
                        value={seedId}
                        onChange={(e) => setSeedId(e.target.value)}
                      >
                        {catalog.slice(0, 40).map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            #{item.id} · {item.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-sec)] block mb-1">
                        MMR Diversity λ ({diversityLambda.toFixed(2)})
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={0.85}
                        step={0.05}
                        value={diversityLambda}
                        onChange={(e) => setDiversityLambda(parseFloat(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-semibold text-[var(--text-sec)] block mb-1">
                    Top-K Limit ({limit})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="input"
                    value={limit}
                    onChange={(e) => setLimit(Math.max(1, Math.min(20, Number(e.target.value))))}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void executeRequest()}
                  className="btn btn-primary w-full justify-center"
                >
                  <Play size={14} />
                  <span>Execute Request</span>
                </button>
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)]">
                  <span className="mono text-xs text-[var(--success)] font-semibold">
                    200 OK · {latencyMs} ms
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy(responseJson, 'json')}
                  >
                    {copiedKey === 'json' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedKey === 'json' ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-3.5 text-xs mono overflow-auto max-h-[420px] text-[var(--text)] m-0">
                  {responseJson}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ApiConsoleModal;
