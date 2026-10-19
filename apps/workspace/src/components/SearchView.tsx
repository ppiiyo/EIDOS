import React, { useState } from 'react';
import { Search, Sparkles, AlertCircle } from 'lucide-react';
import { CatalogItem } from '../types';
import { trackEvent } from '../lib/analytics/tracker';

interface SearchViewProps {
  onSearch: (query: string) => Promise<CatalogItem[]>;
  onSelectItem?: (item: CatalogItem) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onSearch, onSelectItem }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const sampleQueries = [
    'космос и время',
    'киберпанк и симуляция',
    'программирование python',
    'кофемашина эспрессо',
  ];

  const handleSearch = async (targetQuery?: string) => {
    const q = (targetQuery ?? query).trim();
    if (!q) return;

    if (targetQuery) setQuery(targetQuery);
    setIsLoading(true);
    setHasSearched(true);
    trackEvent({ type: 'search', query: q });

    try {
      const res = await onSearch(q);
      setResults(res);
      res.forEach(item => {
        trackEvent({ type: 'item_view', itemId: item.id, category: item.category });
      });
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 840 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Semantic Search</h1>
        <p className="page-sub">
          Vector dot-product semantic matching over all MiniLM / E5 multilingual embeddings
        </p>
      </div>

      {/* Search Input Box */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          style={{ display: 'flex', gap: 10 }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-sec)' }} />
            <input
              data-testid="search-input"
              className="input"
              style={{ paddingLeft: 40, height: 42, fontSize: '0.9375rem' }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search concepts or products (e.g. 'интерстеллар нолан' or 'быстрый ноутбук')..."
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isLoading || !query.trim()} style={{ height: 42 }}>
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>Sample queries:</span>
          {sampleQueries.map((sq) => (
            <button
              key={sq}
              type="button"
              onClick={() => handleSearch(sq)}
              className="badge badge-neutral"
              style={{ cursor: 'pointer', border: 'none', background: '#F3F4F6' }}
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div>
        {hasSearched && results.length === 0 && !isLoading && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-sec)' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px', color: 'var(--text-mut)' }} />
            <p style={{ fontWeight: 500 }}>No semantic matches found</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-mut)', marginTop: 4 }}>
              Try broadening your query or selecting another catalog category.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', marginBottom: 2 }}>
              Found {results.length} semantic results:
            </div>
            {results.map((item) => (
              <div
                key={item.id}
                data-testid="search-result"
                className="card"
                onClick={() => {
                  trackEvent({ type: 'item_click', itemId: item.id, category: item.category });
                  onSelectItem?.(item);
                }}
                style={{
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  transition: 'border-color .15s',
                }}
              >
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ fontSize: '1.5rem', lineHeight: 1 }}>{item.icon || '📦'}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text)' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', marginTop: 3 }}>
                      {item.description}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="badge badge-neutral">{item.category}</span>
                      {item.badge && <span className="badge badge-accent">{item.badge}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text)' }}>
                  {item.price}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
