import React from 'react';
import { Copy, Check } from 'lucide-react';

interface ApiConsoleSnippetsProps {
  query: string;
  alpha: number;
  limit: number;
  selectedId: string;
  diversityLambda: number;
  strategy: 'adaptive' | 'simple' | 'user';
  filterCategory: string;
  copiedSnippet: string | null;
  onCopy: (text: string, key: string) => void;
}

export const ApiConsoleSnippets: React.FC<ApiConsoleSnippetsProps> = ({
  query,
  alpha,
  limit,
  selectedId,
  diversityLambda,
  strategy,
  filterCategory,
  copiedSnippet,
  onCopy,
}) => {
  const tsSnippet = `import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.EIDOS_API_KEY ?? '<YOUR_EIDOS_API_KEY>',
});

// 1. Hybrid 384-d Vector + BM25 Search
const searchHits = await eidos.search({
  query: ${JSON.stringify(query)},
  alpha: ${alpha},
  limit: ${limit},
});

// 2. Unified Adaptive Recommendations
const recs = await eidos.recommend({
  itemId: ${JSON.stringify(selectedId)},
  strategy: ${JSON.stringify(strategy)},
  diversityFactor: ${diversityLambda},
  limit: ${limit},${filterCategory ? `\n  filters: { category: ${JSON.stringify(filterCategory)} },` : ''}
});`;

  const curlSnippet = `curl -X POST http://localhost:3001/v1/search \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_EIDOS_API_KEY>" \\
  -d '${JSON.stringify({ query, mode: 'hybrid', alpha, limit })}'`;

  const pySnippet = `from eidos_sdk import EidosClient, AsyncEidosClient

client = EidosClient(base_url="http://localhost:3001", api_key='<YOUR_EIDOS_API_KEY>')
hits = client.search(query=${JSON.stringify(query)}, alpha=${alpha}, limit=${limit})
print(f"Found {len(hits['results'])} items in {hits['tookMs']}ms")`;

  const blocks = [
    { key: 'ts', title: 'TypeScript / Node.js (@eidos/sdk)', code: tsSnippet },
    { key: 'curl', title: 'cURL REST Request (/v1/search)', code: curlSnippet },
    { key: 'py', title: 'Python SDK (eidos-sdk)', code: pySnippet },
  ];

  return (
    <div data-testid="sdk-code-generator" className="space-y-4">
      {blocks.map((b) => (
        <div key={b.key} className="rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--text)]">{b.title}</span>
            <button type="button" onClick={() => onCopy(b.code, b.key)} className="btn btn-secondary btn-sm">
              {copiedSnippet === b.key ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedSnippet === b.key ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3.5 text-xs mono overflow-x-auto text-[var(--text)] m-0">{b.code}</pre>
        </div>
      ))}
    </div>
  );
};
