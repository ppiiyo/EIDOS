import { useMemo, useCallback } from 'react';
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem, Project } from '../types';
import { computeTextEmbedding } from '../utils/recommenderEngine';

export interface UseCatalogImportHandlersParams {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  setCatalog: (items: CatalogItem[]) => void;
  setEmbeddings: (embeddings: Map<string, Float32Array>) => void;
  setSelectedItem: (item: CatalogItem | null) => void;
  setIsScaledCatalog: (scaled: boolean) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export function useCatalogImportHandlers({
  catalog,
  embeddings,
  setCatalog,
  setEmbeddings,
  setSelectedItem,
  setIsScaledCatalog,
  showToast,
}: UseCatalogImportHandlersParams) {
  const handleImportVectorBundle = useCallback(
    (importedItems: CatalogItem[], importedEmbeddings: Map<string, Float32Array>) => {
      if (importedItems.length === 0) return;
      setEmbeddings(importedEmbeddings);
      setCatalog(importedItems);
      setSelectedItem(importedItems[0] || null);
      setIsScaledCatalog(importedItems.length >= 500);
      showToast(
        `Imported ${importedItems.length} items with 0ms pre-computed 384-d vectors`,
        'success'
      );
    },
    [setCatalog, setEmbeddings, setIsScaledCatalog, setSelectedItem, showToast]
  );

  const handleCsvImportConcepts = useCallback(
    (concepts: Array<{ name: string; category?: string; notes?: string }>, replace: boolean) => {
      const newItems: CatalogItem[] = concepts.map((c, idx) => {
        const safeTitle =
          SecurityGuardrails.scanAndSanitize(c.name).sanitizedInput || `Item ${idx + 1}`;
        const safeCat =
          SecurityGuardrails.scanAndSanitize(c.category || 'Imported CSV').sanitizedInput ||
          'Imported CSV';
        const safeDesc =
          SecurityGuardrails.scanAndSanitize(c.notes || c.name).sanitizedInput || safeTitle;
        return {
          id: `csv_${Date.now()}_${idx}`,
          title: safeTitle,
          description: safeDesc,
          category: safeCat,
          price: '—',
          rating: 4.8,
          reviews: 12,
          badge: 'CSV Import',
          icon: '📄',
          tags: [safeCat.toLowerCase()],
          custom: true,
        };
      });

      const nextCatalog = replace ? newItems : [...newItems, ...catalog];
      const nextEmbeddings = new Map(replace ? [] : embeddings);
      for (const item of newItems) {
        nextEmbeddings.set(
          String(item.id),
          computeTextEmbedding(
            `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`
          )
        );
      }
      setEmbeddings(nextEmbeddings);
      setCatalog(nextCatalog);
      if (nextCatalog.length > 0) setSelectedItem(nextCatalog[0]);
      showToast(`Imported ${newItems.length} records from CSV & vectorized to 384d`, 'success');
    },
    [catalog, embeddings, setCatalog, setEmbeddings, setSelectedItem, showToast]
  );

  const csvProject: Project = useMemo(
    () => ({
      id: 'eidos_catalog_proj',
      name: 'Eidos Production Catalog',
      updatedAt: Date.now(),
      concepts: catalog.map((item) => ({
        id: String(item.id),
        name: item.title,
        category: item.category,
        notes: item.description,
      })),
    }),
    [catalog]
  );

  return {
    handleImportVectorBundle,
    handleCsvImportConcepts,
    csvProject,
  };
}
