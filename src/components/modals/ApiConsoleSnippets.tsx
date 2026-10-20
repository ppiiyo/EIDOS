import React from 'react';
import { Copy, Check } from 'lucide-react';

interface ApiConsoleSnippetsProps {
  query: string;
  alpha: number;
  limit: number;
  selectedId: string;
  diversityLambda: number;
  copiedSnippet: string | null;
  onCopy: (code: string, key: string) => void;
}

export const ApiConsoleSnippets: React.FC<ApiConsoleSnippetsProps> = ({
  query,
  alpha,
  limit,
  selectedId,
  diversityLambda,
  copiedSnippet,
  onCopy,
}) => {
  const tsSdkSnippet = `import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  endpoint: 'http://localhost:3001',
  apiKey: process.env.EIDOS_API_KEY,
});

// 1. Hybrid Search (384-d Dense E5 + Sparse BM25 RRF)
const hits = await eidos.search({
  query: ${JSON.stringify(query)},
  alpha: ${alpha.toFixed(2)},
  limit: ${limit},
});

// 2. MMR Diversified Recommendations
const recs = await eidos.recommend({
  seedItemId: ${JSON.stringify(selectedId)},
  diversityLambda: ${diversityLambda.toFixed(2)},
  limit: ${limit},
});`;

  const curlSnippet = `curl -X POST http://localhost:3001/v1/search/hybrid \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eidos_live_98f2a..." \\
  -d '{
    "query": ${JSON.stringify(query)},
    "alpha": ${alpha.toFixed(2)},
    "limit": ${limit},
    "model": "Xenova/multilingual-e5-small"
  }'`;

  return (
    <div className="flex flex-col gap-4">
      {[
        { key: 'ts', title: 'TypeScript / Node.js (@eidos/sdk)', code: tsSdkSnippet },
        { key: 'curl', title: 'REST API (cURL)', code: curlSnippet },
      ].map((block) => (
        <div
          key={block.key}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)]">
            <span className="mono text-xs font-semibold text-[var(--text-sec)]">
              {block.title}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onCopy(block.code, block.key)}
            >
              {copiedSnippet === block.key ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedSnippet === block.key ? 'Copied' : 'Copy'}</span>
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
