import React, { useState, useCallback, useMemo } from 'react';
import { CatalogItem } from '../../types';
import {
  DEFAULT_CATALOG,
  HybridSearchHit,
  computeTextEmbedding,
  executeHybridCatalogSearch,
} from '../../utils/recommenderEngine';
import { EmbeddingEngineState } from '../../lib/embeddings';
import { UiLanguage } from '../../i18n/uiTranslations';
import { SearchView } from '../../components/SearchView';
import { useDemoState } from './hooks/useDemoState';
import { WelcomeScreen } from './components/WelcomeScreen';
import { DemoBanner } from './components/DemoBanner';
import { UploadModal } from './components/UploadModal';
import { ParsedCatalogItem } from './lib/csv-parser';

export interface DemoPageProps {
  catalog?: CatalogItem[];
  onHybridSearch?: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onSelectItem?: (item: CatalogItem) => void;
  onInspectIn3D?: (item: CatalogItem) => void;
  uiLang?: UiLanguage;
  embeddingState?: EmbeddingEngineState;
  apiKey?: string;
  apiBaseUrl?: string;
}

function mapParsedToCatalogItems(parsedItems: ParsedCatalogItem[]): CatalogItem[] {
  return parsedItems.map((item, idx) => ({
    id: item.id || `custom-${idx + 1}`,
    title: item.title,
    category: item.category || 'Пользовательский каталог',
    description: item.description || `${item.title} (${item.category || 'товар'})`,
    price: item.price !== undefined ? `${item.price} ₽` : '—',
    rating: 4.8,
    reviews: 100,
    tags: item.tags && item.tags.length > 0 ? item.tags : [item.category || 'custom'],
    emoji: '📦',
  }));
}

export const DemoPage: React.FC<DemoPageProps> = ({
  catalog,
  onHybridSearch,
  onSelectItem = () => {},
  onInspectIn3D = () => {},
  uiLang = 'ru',
  embeddingState,
  apiKey = 'eidos_dev_key',
  apiBaseUrl = '',
}) => {
  const { state, ownItemsCount, setDemoState, resetToWelcome } = useDemoState();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [customCatalog, setCustomCatalog] = useState<CatalogItem[] | null>(null);

  const activeCatalog = useMemo<CatalogItem[]>(() => {
    if (state === 'own' && customCatalog && customCatalog.length > 0) {
      return customCatalog;
    }
    if (state === 'demo') {
      return DEFAULT_CATALOG;
    }
    return catalog && catalog.length > 0 ? catalog : DEFAULT_CATALOG;
  }, [state, customCatalog, catalog]);

  const activeEmbeddings = useMemo(() => {
    const map = new Map<string, Float32Array>();
    for (const item of activeCatalog) {
      map.set(
        String(item.id),
        computeTextEmbedding(
          `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`
        )
      );
    }
    return map;
  }, [activeCatalog]);

  const handleEffectiveHybridSearch = useCallback(
    async (query: string, alpha: number, limit = 12): Promise<HybridSearchHit[]> => {
      if (state === 'own' && customCatalog && customCatalog.length > 0) {
        const queryVec = computeTextEmbedding(`query: ${query}`);
        return executeHybridCatalogSearch(
          query,
          queryVec,
          customCatalog,
          activeEmbeddings,
          alpha,
          limit
        );
      }
      if (onHybridSearch && state !== 'demo') {
        return onHybridSearch(query, alpha, limit);
      }
      const queryVec = computeTextEmbedding(`query: ${query}`);
      return executeHybridCatalogSearch(
        query,
        queryVec,
        activeCatalog,
        activeEmbeddings,
        alpha,
        limit
      );
    },
    [state, customCatalog, onHybridSearch, activeCatalog, activeEmbeddings]
  );

  const handleSelectDemo = useCallback(() => {
    setDemoState('demo');
  }, [setDemoState]);

  const handleUploadSuccess = useCallback(
    (itemsCount: number, uploadedItems?: ParsedCatalogItem[]) => {
      if (uploadedItems && uploadedItems.length > 0) {
        setCustomCatalog(mapParsedToCatalogItems(uploadedItems));
      }
      setDemoState('own', itemsCount);
    },
    [setDemoState]
  );

  const handleReset = useCallback(() => {
    setCustomCatalog(null);
    resetToWelcome();
  }, [resetToWelcome]);

  return (
    <div className="min-h-full bg-[#0f172a] text-[#f1f5f9]">
      {state === 'welcome' ? (
        <WelcomeScreen
          onSelectDemo={handleSelectDemo}
          onOpenUpload={() => setIsUploadModalOpen(true)}
        />
      ) : (
        <div>
          <DemoBanner
            state={state}
            ownItemsCount={ownItemsCount}
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onReset={handleReset}
          />
          <SearchView
            catalog={activeCatalog}
            onHybridSearch={handleEffectiveHybridSearch}
            onSelectItem={onSelectItem}
            onInspectIn3D={onInspectIn3D}
            uiLang={uiLang}
            embeddingState={embeddingState}
          />
        </div>
      )}

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
        apiKey={apiKey}
        apiBaseUrl={apiBaseUrl}
      />
    </div>
  );
};

export default DemoPage;
