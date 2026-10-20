import React, { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  Boxes,
  Lightbulb,
} from 'lucide-react';
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem } from '../types';
import { trackEvent } from '../lib/analytics/tracker';
import {
  exportCatalogWithEmbeddings,
  parseCatalogWithEmbeddings,
} from '../utils/catalogExportImport';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';

interface CatalogViewProps {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  onAddItem: (item: CatalogItem) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem?: (item: CatalogItem) => void;
  onInspectIn3D?: (item: CatalogItem) => void;
  onImportVectorBundle?: (items: CatalogItem[], embeddings: Map<string, Float32Array>) => void;
  onOpenCsvModal?: () => void;
  uiLang?: UiLanguage;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  catalog,
  embeddings,
  onAddItem,
  onDeleteItem,
  onSelectItem,
  onInspectIn3D,
  onImportVectorBundle,
  onOpenCsvModal,
  uiLang = 'ru',
}) => {
  const t = UI_TRANSLATIONS[uiLang].catalog;

  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('Электроника');
  const [newPrice, setNewPrice] = useState('4 990 ₽');
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const categories = Array.from(new Set(catalog.map((c) => c.category))).sort();

  const filtered = catalog.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false;
    }
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
    const safeTitle = SecurityGuardrails.scanAndSanitize(newTitle.trim()).sanitizedInput;
    if (!safeTitle) return;

    const safeDesc =
      SecurityGuardrails.scanAndSanitize(newDesc.trim()).sanitizedInput || safeTitle;
    const safeCat =
      SecurityGuardrails.scanAndSanitize(newCat.trim()).sanitizedInput || 'General';
    const safePrice = SecurityGuardrails.scanAndSanitize(newPrice.trim()).sanitizedInput;

    const item: CatalogItem = {
      id: String(Date.now()),
      title: safeTitle,
      description: safeDesc,
      category: safeCat,
      price: safePrice,
      rating: 5.0,
      reviews: 1,
      badge: 'New',
      icon: '📦',
      tags: [safeCat.toLowerCase()],
    };

    onAddItem(item);
    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
  };

  const handleJsonBundleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = String(ev.target?.result || '');
        const parsed = parseCatalogWithEmbeddings(raw);
        onImportVectorBundle?.(parsed.items, parsed.embeddings);
      } catch {
        // invalid json ignored safely
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  return (
    <div className="page">
      {/* Header & Action Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-sub">
            {t.subtitle} ({catalog.length.toLocaleString()} SKU · {embeddings.size.toLocaleString()} × 384-d)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleJsonBundleUpload}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => exportCatalogWithEmbeddings(catalog, embeddings)}
            title="Export catalog with pre-computed 384-d vectors as JSON bundle"
          >
            <Download size={14} />
            <span>{t.exportJsonBtn}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => jsonInputRef.current?.click()}
            title="Import pre-computed JSON vector bundle with 0ms inference latency"
          >
            <Upload size={14} />
            <span>{t.importJsonBtn}</span>
          </button>

          {onOpenCsvModal && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onOpenCsvModal}
            >
              <FileSpreadsheet size={14} />
              <span>{t.csvBtn}</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal((v) => !v)}
          >
            <Plus size={14} />
            <span>{t.addSkuBtn}</span>
          </button>
        </div>
      </div>

      {/* Filter & Category Bar */}
      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 18,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 380 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-sec)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder={t.filterPlaceholder}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className="btn btn-sm"
            style={{
              background: categoryFilter === 'all' ? 'var(--accent)' : 'var(--bg-alt)',
              color: categoryFilter === 'all' ? '#FFFFFF' : 'var(--text-sec)',
              borderColor: 'var(--border)',
            }}
          >
            {t.allCategories} ({catalog.length})
          </button>
          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className="btn btn-sm"
              style={{
                background: categoryFilter === cat ? 'var(--accent)' : 'var(--bg-alt)',
                color: categoryFilter === cat ? '#FFFFFF' : 'var(--text-sec)',
                borderColor: 'var(--border)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Add SKU Inline Form */}
      {showAddModal && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>
            {t.addModalTitle}
          </h2>
          <form
            onSubmit={handleAdd}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}
          >
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Title
              </label>
              <input
                className="input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                placeholder="e.g. Mechanical Keyboard Keychron Q1"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Category
              </label>
              <input
                className="input"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="e.g. Электроника"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Price
              </label>
              <input
                className="input"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="e.g. 14 990 ₽"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Semantic Description
              </label>
              <input
                className="input"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Detailed attributes for 384-d vector indexing"
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="submit" className="btn btn-primary btn-sm">
                {t.saveVectorBtn}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddModal(false)}
              >
                {t.cancelBtn}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* High-Density Data Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table" data-testid="catalog-table">
          <thead>
            <tr>
              <th style={{ width: 72 }}>ID</th>
              <th>Item Title & Category</th>
              <th style={{ width: 120 }}>Price</th>
              <th>Semantic Description</th>
              <th style={{ width: 110 }}>Vector Norm</th>
              <th style={{ textAlign: 'right', width: 170 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 150).map((item) => {
              const vec = embeddings.get(String(item.id));
              return (
                <tr
                  key={item.id}
                  onClick={() => {
                    trackEvent({ type: 'item_click', itemId: item.id, category: item.category });
                    onSelectItem?.(item);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="mono" style={{ color: 'var(--text-sec)', fontSize: '0.75rem' }}>
                    #{item.id}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.15rem' }}>{item.icon || '📦'}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>
                          <span>{item.category}</span>
                          {item.rating && (
                            <>
                              <span> · </span>
                              <span className="mono">★ {item.rating.toFixed(1)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.8125rem' }}>
                    {item.price || '—'}
                  </td>
                  <td
                    style={{
                      color: 'var(--text-sec)',
                      fontSize: '0.8125rem',
                      maxWidth: 360,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.description}
                  </td>
                  <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                    {vec ? `${vec.length}d · L2=1.0` : 'Pending'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {onInspectIn3D && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectIn3D(item);
                          }}
                          title="Locate in 3D Vector Space"
                        >
                          <Boxes size={12} />
                        </button>
                      )}
                      {onSelectItem && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(item);
                          }}
                          title="Inspect MMR Recommendations"
                        >
                          <Lightbulb size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteItem(item.id);
                        }}
                        title="Delete SKU"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
