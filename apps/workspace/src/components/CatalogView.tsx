import React, { useState } from 'react';
import { Package, Search, Plus, Trash2, Tag } from 'lucide-react';
import { CatalogItem } from '../types';
import { trackEvent } from '../lib/analytics/tracker';

interface CatalogViewProps {
  catalog: CatalogItem[];
  onAddItem: (item: CatalogItem) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem?: (item: CatalogItem) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  catalog,
  onAddItem,
  onDeleteItem,
  onSelectItem,
}) => {
  const [filter, setFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('Товары');
  const [newPrice, setNewPrice] = useState('1 990 ₽');

  const filtered = catalog.filter((item) => {
    const q = filter.toLowerCase().trim();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const item: CatalogItem = {
      id: String(Date.now()),
      title: newTitle.trim(),
      description: newDesc.trim() || newTitle.trim(),
      category: newCat.trim() || 'General',
      price: newPrice.trim(),
      rating: 5.0,
      reviews: 1,
      badge: 'Новый',
      icon: '📦',
      tags: [newCat.toLowerCase()],
    };

    onAddItem(item);
    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Catalog Inventory</h1>
          <p className="page-sub">
            Managed semantic products and vector embeddings ({catalog.length} items)
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={15} /> Add Item
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-sec)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Filter catalog items..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Add New Item</h2>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>Title</label>
              <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required placeholder="e.g. Mechanical Keyboard" />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>Category</label>
              <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Electronics" />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>Price</label>
              <input className="input" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="e.g. 4 990 ₽" />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>Description</label>
              <input className="input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Semantic description for vector indexing" />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm">Save</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table" data-testid="catalog-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Item Title</th>
              <th>Category</th>
              <th>Price</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                onClick={() => {
                  trackEvent({ type: 'item_click', itemId: item.id, category: item.category });
                  onSelectItem?.(item);
                }}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-sec)', fontSize: '0.8125rem' }}>
                  #{item.id}
                </td>
                <td style={{ fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{item.icon || '📦'}</span>
                    <span>{item.title}</span>
                  </div>
                </td>
                <td>
                  <span className="badge badge-neutral">{item.category}</span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {item.price || '—'}
                </td>
                <td style={{ color: 'var(--text-sec)', fontSize: '0.8125rem', maxWidth: 380, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.description}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    title="Delete item"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
