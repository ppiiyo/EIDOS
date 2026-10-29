import React, { useState, useCallback, useMemo } from 'react';
import { CatalogItem } from '../../types';
import {
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
import { DemoMode } from './components/DemoMode';
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
  const [ownCatalog, setOwnCatalog] = useState<CatalogItem[]>([]);

  // Основной продукт (state === 'own') работает ТОЛЬКО с пользовательскими данными без демо-каталога
  const activeOwnCatalog = useMemo<CatalogItem[]>(() => {
    if (ownCatalog.length > 0) {
      return ownCatalog;
    }
    return catalog && catalog.length > 0 ? catalog : [];
  }, [ownCatalog, catalog]);

  const ownEmbeddings = useMemo(() => {
    const map = new Map<string, Float32Array>();
    for (const item of activeOwnCatalog) {
      map.set(
        String(item.id),
        computeTextEmbedding(
          `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`
        )
      );
    }
    return map;
  }, [activeOwnCatalog]);

  const handleOwnHybridSearch = useCallback(
    async (query: string, alpha: number, limit = 12): Promise<HybridSearchHit[]> => {
      if (ownCatalog.length > 0) {
        const queryVec = computeTextEmbedding(`query: ${query}`);
        return executeHybridCatalogSearch(
          query,
          queryVec,
          ownCatalog,
          ownEmbeddings,
          alpha,
          limit
        );
      }
      if (onHybridSearch) {
        return onHybridSearch(query, alpha, limit);
      }
      if (activeOwnCatalog.length === 0) {
        return [];
      }
      const queryVec = computeTextEmbedding(`query: ${query}`);
      return executeHybridCatalogSearch(
        query,
        queryVec,
        activeOwnCatalog,
        ownEmbeddings,
        alpha,
        limit
      );
    },
    [ownCatalog, ownEmbeddings, onHybridSearch, activeOwnCatalog]
  );

  const handleTryDemo = useCallback(() => {
    setDemoState('demo');
  }, [setDemoState]);

  const handleUploadSuccess = useCallback(
    (itemsCount: number, uploadedItems?: ParsedCatalogItem[]) => {
      if (uploadedItems && uploadedItems.length > 0) {
        setOwnCatalog(mapParsedToCatalogItems(uploadedItems));
      }
      setDemoState('own', itemsCount);
    },
    [setDemoState]
  );

  const handleReset = useCallback(() => {
    setOwnCatalog([]);
    void fetch(`${apiBaseUrl}/v1/demo/reset`, {
      method: 'POST',
    }).catch(() => {});
    resetToWelcome();
  }, [apiBaseUrl, resetToWelcome]);

  return (
    <div className="min-h-full bg-[#0f172a] text-[#f1f5f9]">
      {state === 'welcome' && (
        <WelcomeScreen
          onUpload={() => setIsUploadModalOpen(true)}
          onTryDemo={handleTryDemo}
        />
      )}

      {state === 'demo' && (
        <div>
          <DemoBanner
            state="demo"
            ownItemsCount={0}
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onReset={handleReset}
          />
          <DemoMode
            onSelectItem={onSelectItem}
            onInspectIn3D={onInspectIn3D}
            uiLang={uiLang}
            embeddingState={embeddingState}
            apiBaseUrl={apiBaseUrl}
          />
        </div>
      )}

      {state === 'own' && (
        <div>
          <DemoBanner
            state="own"
            ownItemsCount={ownItemsCount}
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onReset={handleReset}
          />
          <SearchView
            catalog={activeOwnCatalog}
            onHybridSearch={handleOwnHybridSearch}
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
