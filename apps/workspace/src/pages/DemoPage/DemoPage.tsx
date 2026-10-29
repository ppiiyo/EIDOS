import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { CatalogItem } from '../../types';
import {
  HybridSearchHit,
  computeTextEmbedding,
  executeHybridCatalogSearch,
} from '../../utils/recommenderEngine';
import { EmbeddingEngineState } from '../../lib/embeddings';
import { UiLanguage } from '../../i18n/uiTranslations';
import { SearchView } from '../../components/SearchView';
import { ViewId } from '../../components/Sidebar';
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
  onImportCustomDatabase?: (items: CatalogItem[], label?: string) => void;
  onClearCatalog?: () => void;
  onNavigate?: (view: ViewId) => void;
  forceMode?: 'demo' | 'normal';
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
    icon: '📦',
    emoji: '📦',
  }));
}

export const DemoPage: React.FC<DemoPageProps> = ({
  catalog,
  onHybridSearch,
  onSelectItem = () => {},
  onInspectIn3D = () => {},
  onImportCustomDatabase,
  onClearCatalog,
  onNavigate,
  forceMode,
  uiLang = 'ru',
  embeddingState,
  apiKey = 'eidos_dev_key',
  apiBaseUrl = '',
}) => {
  const { state, ownItemsCount, setDemoState, resetToWelcome } = useDemoState();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [ownCatalog, setOwnCatalog] = useState<CatalogItem[]>([]);

  // На обычной странице (forceMode === 'normal') никогда не показываем демо-каталог:
  // либо пользователь уже загрузил свою базу ('own'), либо видит чистый экран загрузки ('welcome')
  const effectiveState = useMemo(() => {
    if (forceMode === 'demo') {
      return 'demo';
    }
    if (forceMode === 'normal') {
      const hasUserItems = ownCatalog.length > 0 || (catalog && catalog.length > 0);
      return hasUserItems ? 'own' : 'welcome';
    }
    return state;
  }, [forceMode, ownCatalog.length, catalog, state]);

  useEffect(() => {
    if (forceMode === 'normal' && ownCatalog.length === 0 && (!catalog || catalog.length === 0)) {
      // При переходе на обычную страницу без пользовательской базы очищаем демо-индекс на сервере
      void fetch(`${apiBaseUrl}/v1/demo/reset`, {
        method: 'POST',
      }).catch(() => {});
    }
  }, [forceMode, ownCatalog.length, catalog, apiBaseUrl]);

  // Основной продукт (effectiveState === 'own') работает ТОЛЬКО с пользовательскими данными без демо-каталога
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
      if (activeOwnCatalog.length > 0) {
        const queryVec = computeTextEmbedding(`query: ${query}`);
        return executeHybridCatalogSearch(
          query,
          queryVec,
          activeOwnCatalog,
          ownEmbeddings,
          alpha,
          limit
        );
      }
      if (onHybridSearch) {
        return onHybridSearch(query, alpha, limit);
      }
      return [];
    },
    [activeOwnCatalog, ownEmbeddings, onHybridSearch]
  );

  const handleTryDemo = useCallback(() => {
    setDemoState('demo');
    if (onNavigate) {
      onNavigate('demo');
    }
  }, [setDemoState, onNavigate]);

  const handleUploadSuccess = useCallback(
    (itemsCount: number, uploadedItems?: ParsedCatalogItem[]) => {
      if (uploadedItems && uploadedItems.length > 0) {
        const mapped = mapParsedToCatalogItems(uploadedItems);
        setOwnCatalog(mapped);
        onImportCustomDatabase?.(mapped, 'Пользовательский каталог');
      }
      setDemoState('own', itemsCount);
      if (forceMode === 'demo' && onNavigate) {
        onNavigate('search');
      }
    },
    [setDemoState, onImportCustomDatabase, forceMode, onNavigate]
  );

  const handleReset = useCallback(() => {
    setOwnCatalog([]);
    onClearCatalog?.();
    void fetch(`${apiBaseUrl}/v1/demo/reset`, {
      method: 'POST',
    }).catch(() => {});
    resetToWelcome();
    if (forceMode === 'demo' && onNavigate) {
      onNavigate('search');
    }
  }, [apiBaseUrl, resetToWelcome, onClearCatalog, forceMode, onNavigate]);

  return (
    <div className="min-h-full bg-[#0f172a] text-[#f1f5f9]">
      {effectiveState === 'welcome' && (
        <WelcomeScreen
          onUpload={() => setIsUploadModalOpen(true)}
          onTryDemo={handleTryDemo}
        />
      )}

      {effectiveState === 'demo' && (
        <div>
          <DemoBanner
            state="demo"
            ownItemsCount={0}
            demoItemsCount={48}
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

      {effectiveState === 'own' && (
        <div>
          <DemoBanner
            state="own"
            ownItemsCount={activeOwnCatalog.length || ownItemsCount}
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
