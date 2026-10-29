import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { CatalogItem } from '../../../types';
import {
  DEFAULT_CATALOG,
  HybridSearchHit,
  computeTextEmbedding,
  executeHybridCatalogSearch,
} from '../../../utils/recommenderEngine';
import { EmbeddingEngineState } from '../../../lib/embeddings';
import { UiLanguage } from '../../../i18n/uiTranslations';
import { SearchView } from '../../../components/SearchView';

export interface DemoModeProps {
  onSelectItem?: (item: CatalogItem) => void;
  onInspectIn3D?: (item: CatalogItem) => void;
  uiLang?: UiLanguage;
  embeddingState?: EmbeddingEngineState;
  apiBaseUrl?: string;
}

export const DemoMode: React.FC<DemoModeProps> = ({
  onSelectItem = () => {},
  onInspectIn3D = () => {},
  uiLang = 'ru',
  embeddingState,
  apiBaseUrl = '',
}) => {
  const [isLoadingDemo, setIsLoadingDemo] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function initDemoOnServer() {
      setIsLoadingDemo(true);
      setLoadError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/v1/demo/load`, {
          method: 'POST',
        });
        if (!res.ok && active) {
          setLoadError(`Не удалось загрузить демо-данные на сервере (HTTP ${res.status})`);
        }
      } catch {
        // Fallback to local 18-SKU demo catalog if offline
      } finally {
        if (active) {
          setIsLoadingDemo(false);
        }
      }
    }

    void initDemoOnServer();

    return () => {
      active = false;
      void fetch(`${apiBaseUrl}/v1/demo/reset`, {
        method: 'POST',
      }).catch(() => {});
    };
  }, [apiBaseUrl]);

  const demoEmbeddings = useMemo(() => {
    const map = new Map<string, Float32Array>();
    for (const item of DEFAULT_CATALOG) {
      map.set(
        String(item.id),
        computeTextEmbedding(
          `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`
        )
      );
    }
    return map;
  }, []);

  const handleDemoHybridSearch = useCallback(
    async (query: string, alpha: number, limit = 12): Promise<HybridSearchHit[]> => {
      const queryVec = computeTextEmbedding(`query: ${query}`);
      return executeHybridCatalogSearch(
        query,
        queryVec,
        DEFAULT_CATALOG,
        demoEmbeddings,
        alpha,
        limit
      );
    },
    [demoEmbeddings]
  );

  if (isLoadingDemo) {
    return (
      <div
        data-testid="demo-mode-loading"
        className="rounded-xl bg-[#1e293b] border border-slate-700 p-8 text-center text-sm text-[#f1f5f9]"
      >
        Загрузка изолированной демо-базы (18 SKU)...
      </div>
    );
  }

  return (
    <div data-testid="isolated-demo-mode">
      {loadError && (
        <div className="mb-3 rounded-lg bg-amber-950/50 border border-amber-700/60 px-4 py-2 text-xs text-amber-200">
          {loadError}
        </div>
      )}
      <SearchView
        catalog={DEFAULT_CATALOG}
        onHybridSearch={handleDemoHybridSearch}
        onSelectItem={onSelectItem}
        onInspectIn3D={onInspectIn3D}
        uiLang={uiLang}
        embeddingState={embeddingState}
      />
    </div>
  );
};
