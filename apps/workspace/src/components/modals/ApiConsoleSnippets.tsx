import React from 'react';
import { Copy, Check } from 'lucide-react';

interface ApiConsoleSnippetsProps {
  query: string;
  alpha: number;
  limit: number;
  selectedId: string;
  diversityLambda: number;
  strategy?: 'adaptive' | 'simple' | 'user';
  filterCategory?: string;
  copiedSnippet: string | null;
  onCopy: (code: string, key: string) => void;
}

export const ApiConsoleSnippets: React.FC<ApiConsoleSnippetsProps> = ({
  query,
  alpha,
  limit,
  selectedId,
  diversityLambda,
  strategy = 'adaptive',
  filterCategory = '',
  copiedSnippet,
  onCopy,
}) => {
  const filtersBlock = filterCategory
    ? `,\n  filters: { category: ${JSON.stringify(filterCategory)} }`
    : '';

  const tsSdkSnippet = `import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY ?? 'eidos_dev_key',
});

// 1. Hybrid Search (384-d Dense HNSW + Sparse BM25 RRF + Cross-Encoder Rerank)
const hits = await eidos.search({
  query: ${JSON.stringify(query)},
  alpha: ${alpha.toFixed(2)},
  limit: ${limit},
});

// 2. Unified Recommendations (strategy: '${strategy}', MMR λ=${diversityLambda.toFixed(2)})
const recs = await eidos.recommend({
  itemId: ${JSON.stringify(selectedId)},
  strategy: ${JSON.stringify(strategy)},
  diversityFactor: ${diversityLambda.toFixed(2)},
  limit: ${limit}${filtersBlock}
});`;

  const pythonSdkSnippet = `from eidos_sdk import EidosClient, AsyncEidosClient

# Synchronous Client (packages/python-sdk)
with EidosClient(
    base_url="http://localhost:3000",
    api_key="eidos_dev_key"
) as client:
    # 1. Hybrid Multilingual & Cross-Encoder Search
    hits = client.search(
        query=${JSON.stringify(query)},
        mode="hybrid",
        alpha=${alpha.toFixed(2)},
        limit=${limit}
    )

    # 2. Adaptive / MMR Recommendations (${strategy} strategy)
    recs = client.recommend(
        item_id=${JSON.stringify(selectedId)},
        strategy=${JSON.stringify(strategy)},
        diversity_factor=${diversityLambda.toFixed(2)},
        limit=${limit}${filterCategory ? `,\n        filters={"category": ${JSON.stringify(filterCategory)}}` : ''}
    )

    # 3. Inspect Distributed Cluster Topology (150 vnodes, R=2)
    cluster = client.get_cluster_status()
    print(f"Healthy shards: {cluster.healthy_shards}/{cluster.shard_count}")`;

  const curlSnippet = `# 1. Hybrid Search (POST /v1/search)
curl -i -X POST http://localhost:3000/v1/search \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: eidos_dev_key" \\
  -d '{
    "query": ${JSON.stringify(query)},
    "mode": "hybrid",
    "alpha": ${alpha.toFixed(2)},
    "limit": ${limit}
  }'

# 2. Unified Recommendation Endpoint (POST /v1/recommend)
curl -i -X POST http://localhost:3000/v1/recommend \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: eidos_dev_key" \\
  -d '{
    "item_id": ${JSON.stringify(selectedId)},
    "strategy": ${JSON.stringify(strategy)},
    "diversity_factor": ${diversityLambda.toFixed(2)},
    "limit": ${limit}${filterCategory ? `,\n    "filters": { "category": ${JSON.stringify(filterCategory)} }` : ''}
  }'`;

  return (
    <div className="flex flex-col gap-4" data-testid="sdk-code-generator">
      {[
        { key: 'ts', title: 'TypeScript / Node.js (@eidos/sdk v3.2)', code: tsSdkSnippet },
        { key: 'py', title: 'Python 3.9+ Official SDK (eidos_sdk v3.2)', code: pythonSdkSnippet },
        { key: 'curl', title: 'REST API (cURL — /v1/search & /v1/recommend)', code: curlSnippet },
      ].map((block) => (
        <div
          key={block.key}
          data-testid={`sdk-snippet-${block.key}`}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)]">
            <span className="mono text-xs font-semibold text-[var(--text-sec)]">
              {block.title}
            </span>
            <button
              type="button"
              data-testid={`copy-sdk-${block.key}`}
              className="btn btn-secondary btn-sm"
              onClick={() => onCopy(block.code, block.key)}
            >
              {copiedSnippet === block.key ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedSnippet === block.key ? 'Copied' : 'Copy Snippet'}</span>
            </button>
          </div>
          <pre className="p-3.5 text-xs mono overflow-x-auto text-[var(--text)] m-0 leading-relaxed">
            {block.code}
          </pre>
        </div>
      ))}
    </div>
  );
};
