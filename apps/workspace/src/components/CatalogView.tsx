import React, { useState, useRef } from "react";
import {
  Search,
  Plus,
  Download,
  Upload,
  FileSpreadsheet,
} from 'lucide-react';
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem } from '../types';
import {
  exportCatalogWithEmbeddings,
  parseCatalogWithEmbeddings,
} from '../utils/catalogExportImport';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';
import { CatalogTable } from './catalog/CatalogTable';

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
      <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-sub">
            {t.subtitle} ({catalog.length.toLocaleString()} SKU · {embeddings.size.toLocaleString()} × 384-d)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            className="hidden"
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

      <div className="card p-3.5 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-[380px]">
          <Search
            size={14}
            className="absolute left-3 top-2.5 text-[var(--text-sec)]"
          />
          <input
            className="input pl-8"
            placeholder={t.filterPlaceholder}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={categoryFilter === 'all' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            {t.allCategories} ({catalog.length})
          </button>
          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={categoryFilter === cat ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {showAddModal && (
        <div className="card p-5 mb-5">
          <h2 className="text-base font-semibold mb-3">{t.addModalTitle}</h2>
          <form
            onSubmit={handleAdd}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <div>
              <label className="text-xs font-medium block mb-1">Title</label>
              <input
                className="input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                placeholder="e.g. Mechanical Keyboard Keychron Q1"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Category</label>
              <input
                className="input"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="e.g. Электроника"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Price</label>
              <input
                className="input"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="e.g. 14 990 ₽"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Semantic Description</label>
              <input
                className="input"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Detailed attributes for 384-d vector indexing"
              />
            </div>
            <div className="col-span-full flex gap-2 mt-1.5">
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

      <CatalogTable
        items={filtered}
        embeddings={embeddings}
        onSelectItem={onSelectItem}
        onInspectIn3D={onInspectIn3D}
        onDeleteItem={onDeleteItem}
      />
    </div>
  );
};
