# React Integration Example (`@eidos/sdk`)

Integrate EIDOS hybrid semantic search and real-time recommendations into a React 19 application with debounced queries and Redis cache-hit indicators.

```tsx
import React, { useState, useEffect } from 'react';
import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  baseUrl: import.meta.env.VITE_EIDOS_API_URL || 'http://localhost:3000',
  apiKey: import.meta.env.VITE_EIDOS_API_KEY || 'test-key',
});

export function SemanticProductSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [cacheHit, setCacheHit] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${eidos.getBaseUrl()}/v1/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-key',
          },
          body: JSON.stringify({
            query,
            mode: 'hybrid',
            limit: 8,
          }),
        });
        const data = await res.json();
        setResults(data.results || []);
        setLatencyMs(data.latencyMs);
        setCacheHit(Boolean(data.cacheHit));
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products semantically (e.g., wireless studio headphones)..."
          className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white"
        />
        {latencyMs !== null && (
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-950 text-emerald-300">
            {latencyMs}ms {cacheHit ? '⚡ REDIS HIT' : 'MISS'}
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-zinc-400">Searching HNSW + BM25 index...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((item) => (
          <div key={item.id} className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/60">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-white">{item.title}</h3>
              <span className="text-xs text-zinc-400">{item.category}</span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">{item.description}</p>
            <div className="mt-3 flex justify-between items-center text-xs font-mono">
              <span className="text-emerald-400">${item.price ?? 'N/A'}</span>
              <span className="text-zinc-500">score: {item.score?.toFixed(4)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```
