import React, { useState, useEffect } from 'react';
import {
  Code2,
  Copy,
  Check,
  Play,
  Terminal,
  X,
  Server,
} from 'lucide-react';
import { CatalogItem, CatalogRecommendation, HybridSearchHit } from '../types';

interface ApiConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  selectedItem?: CatalogItem | null;
  onHybridSearch?: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onGetRecommendations?: (item: CatalogItem, diversity: number, limit?: number) => Promise<CatalogRecommendation[]>;
}

export const ApiConsoleModal: React.FC<ApiConsoleModalProps> = ({
  isOpen,
  onClose,
  catalog,
  selectedItem,
  onHybridSearch,
  onGetRecommendations,
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<'recommend' | 'search'>('recommend');
  const [selectedItemId, setSelectedItemId] = useState<string>(
    String(selectedItem?.id || catalog[0]?.id || '1')
  );
  const [searchQuery, setSearchQuery] = useState('релятивистское время и космос');
  const [alpha, setAlpha] = useState(0.7);
  const [diversity, setDiversity] = useState(0.35);
  const [limit, setLimit] = useState(4);
  const [langTab, setLangTab] = useState<'curl' | 'js' | 'python'>('curl');
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [latency, setLatency] = useState<number>(1.2);

  useEffect(() => {
    if (selectedItem) {
      setSelectedItemId(String(selectedItem.id));
    }
  }, [selectedItem]);

  if (!isOpen) return null;

  const currentItem =
    catalog.find((c) => String(c.id) === String(selectedItemId)) || catalog[0];

  const handleSendRequest = async () => {
    setIsLoading(true);
    const t0 = performance.now();

    try {
      if (selectedEndpoint === 'recommend' && currentItem && onGetRecommendations) {
        const recs = await onGetRecommendations(currentItem, diversity, limit);
        const duration = +(performance.now() - t0).toFixed(2);
        setLatency(duration);

        const payload = {
          status: 'ok',
          code: 200,
          engine: 'EIDOS Hybrid Core (HNSW Phase 2 + MMR)',
          execution_time_ms: duration,
          vector_dimensions: 384,
          seed_anchor: {
            id: currentItem.id,
            title: currentItem.title,
            category: currentItem.category,
          },
          mmr_lambda: diversity,
          recommendations: recs.map((r, idx) => ({
            rank: idx + 1,
            id: r.item.id,
            title: r.item.title,
            category: r.item.category,
            price: r.item.price,
            cosine_similarity: +r.sim.toFixed(4),
            explanation: r.whyRecommended,
          })),
        };
        setResponseOutput(JSON.stringify(payload, null, 2));
      } else if (selectedEndpoint === 'search' && onHybridSearch) {
        const hits = await onHybridSearch(searchQuery, alpha, limit);
        const duration = +(performance.now() - t0).toFixed(2);
        setLatency(duration);

        const payload = {
          status: 'ok',
          code: 200,
          engine: 'EIDOS Hybrid Retrieval (Dense HNSW + Sparse BM25)',
          execution_time_ms: duration,
          vector_dimensions: 384,
          query: searchQuery,
          alpha_weight: alpha,
          hits: hits.map((h, idx) => ({
            rank: idx + 1,
            id: h.item.id,
            title: h.item.title,
            category: h.item.category,
            fused_score: +h.fusedScore.toFixed(4),
            dense_cosine: +h.denseScore.toFixed(4),
            bm25_lexical: +h.bm25Score.toFixed(4),
            retrieval_source: h.source,
            explanation: h.whyRecommended,
          })),
        };
        setResponseOutput(JSON.stringify(payload, null, 2));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getCodeSnippet = () => {
    const itemTitle = currentItem?.title || 'Item';
    if (selectedEndpoint === 'recommend') {
      if (langTab === 'curl') {
        return `curl -X POST https://api.eidos.dev/v1/recommend \\
  -H "Authorization: Bearer eidos_live_sk_384d" \\
  -H "Content-Type: application/json" \\
  -d '{
    "item_id": "${currentItem?.id}",
    "item_title": "${itemTitle}",
    "mmr_diversity": ${diversity},
    "limit": ${limit}
  }'`;
      }
      if (langTab === 'js') {
        return `const response = await fetch("https://api.eidos.dev/v1/recommend", {
  method: "POST",
  headers: {
    "Authorization": "Bearer eidos_live_sk_384d",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    item_id: "${currentItem?.id}",
    mmr_diversity: ${diversity},
    limit: ${limit}
  })
});
const { recommendations } = await response.json();`;
      }
      return `import requests

response = requests.post(
    "https://api.eidos.dev/v1/recommend",
    headers={"Authorization": "Bearer eidos_live_sk_384d"},
    json={
        "item_id": "${currentItem?.id}",
        "mmr_diversity": ${diversity},
        "limit": ${limit}
    }
)
print(response.json())`;
    } else {
      if (langTab === 'curl') {
        return `curl -X POST https://api.eidos.dev/v1/search/hybrid \\
  -H "Authorization: Bearer eidos_live_sk_384d" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "${searchQuery}",
    "alpha": ${alpha},
    "limit": ${limit}
  }'`;
      }
      if (langTab === 'js') {
        return `const response = await fetch("https://api.eidos.dev/v1/search/hybrid", {
  method: "POST",
  headers: {
    "Authorization": "Bearer eidos_live_sk_384d",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query: "${searchQuery}",
    alpha: ${alpha},
    limit: ${limit}
  })
});
const { hits } = await response.json();`;
      }
      return `import requests

response = requests.post(
    "https://api.eidos.dev/v1/search/hybrid",
    headers={"Authorization": "Bearer eidos_live_sk_384d"},
    json={
        "query": "${searchQuery}",
        "alpha": ${alpha},
        "limit": ${limit}
    }
)
print(response.json())`;
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 880,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            paddingBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code2 size={20} color="var(--accent)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                Live REST API Console (In-Browser 384-d Execution)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>
                Executes real queries against the active {catalog.length.toLocaleString()}-item HNSW + BM25 index
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
          >
            <X size={15} />
          </button>
        </div>

        {/* Endpoint Selector Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: 10,
            background: 'var(--bg-alt)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setSelectedEndpoint('recommend')}
              className="btn btn-sm mono"
              style={{
                background: selectedEndpoint === 'recommend' ? 'var(--accent)' : 'transparent',
                color: selectedEndpoint === 'recommend' ? '#FFFFFF' : 'var(--text-sec)',
              }}
            >
              POST /v1/recommend
            </button>
            <button
              type="button"
              onClick={() => setSelectedEndpoint('search')}
              className="btn btn-sm mono"
              style={{
                background: selectedEndpoint === 'search' ? 'var(--accent)' : 'transparent',
                color: selectedEndpoint === 'search' ? '#FFFFFF' : 'var(--text-sec)',
              }}
            >
              POST /v1/search/hybrid
            </button>
          </div>

          <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--success)' }}>
            <Server size={13} />
            <span>200 OK · {latency} ms</span>
          </div>
        </div>

        {/* Interactive Request Builder + Snippet */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <div
            style={{
              padding: 16,
              background: 'var(--bg-alt)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sec)' }}>
              Request Payload Parameters
            </div>

            {selectedEndpoint === 'recommend' ? (
              <>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>
                    Target Seed Item:
                  </label>
                  <select
                    className="input"
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                  >
                    {catalog.slice(0, 150).map((i) => (
                      <option key={i.id} value={String(i.id)}>
                        {i.title} ({i.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>
                    MMR Diversity (λ = {diversity.toFixed(2)}):
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.05}
                    value={diversity}
                    onChange={(e) => setDiversity(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>
                    Natural Language Query:
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>
                    Hybrid Balance (α = {alpha.toFixed(2)}):
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={alpha}
                    onChange={(e) => setAlpha(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>
                Top-K Limit ({limit}):
              </label>
              <input
                type="range"
                min={1}
                max={8}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>

            <button
              type="button"
              onClick={handleSendRequest}
              disabled={isLoading}
              className="btn btn-primary"
              style={{ marginTop: 4 }}
            >
              <Play size={13} />
              <span>{isLoading ? 'Executing...' : 'Send Live Request'}</span>
            </button>
          </div>

          {/* Code Snippet */}
          <div
            style={{
              padding: 16,
              background: 'var(--bg-alt)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['curl', 'js', 'python'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setLangTab(tab)}
                    className="btn btn-sm mono"
                    style={{
                      background: langTab === tab ? 'var(--accent)' : 'transparent',
                      color: langTab === tab ? '#FFFFFF' : 'var(--text-sec)',
                    }}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
              <button type="button" onClick={copyCode} className="btn btn-secondary btn-sm">
                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <pre
              className="mono"
              style={{
                padding: 12,
                background: '#0B0F19',
                color: '#E2E8F0',
                borderRadius: 6,
                fontSize: '0.75rem',
                overflowX: 'auto',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              <code>{getCodeSnippet()}</code>
            </pre>
          </div>
        </div>

        {/* Response Output */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={13} color="var(--accent)" />
              <span>JSON Response Payload</span>
            </span>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
              HTTP/2 200 OK
            </span>
          </div>
          <pre
            className="mono"
            style={{
              padding: 14,
              background: '#0B0F19',
              color: '#10B981',
              borderRadius: 8,
              fontSize: '0.75rem',
              overflowX: 'auto',
              maxHeight: 240,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            <code>
              {responseOutput ||
                `{\n  "status": "ready",\n  "endpoint": "/v1/${selectedEndpoint}",\n  "note": "Click 'Send Live Request' to execute against the live 384-d catalog"\n}`}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};
