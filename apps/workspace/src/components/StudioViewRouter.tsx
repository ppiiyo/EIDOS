import React, { useMemo, useCallback } from 'react';
import { CatalogItem, CatalogRecommendation, MerchandisingRules } from '../types';
import { computeTextEmbedding, HybridSearchHit } from '../utils/recommenderEngine';
import { PlatformDomainId, PlatformDomainPreset } from '../data/domainDatabases';
import { UiLanguage } from '../i18n/uiTranslations';
import { EmbeddingEngineState } from '../lib/embeddings';
import { ConversationalAgent } from '../lib/agent/conversational-agent';
import { ViewId } from './Sidebar';
import { DashboardView } from './DashboardView';
import { CatalogView } from './CatalogView';
import { SearchView } from './SearchView';
import { RecommendationsView } from './RecommendationsView';
import { ABTestView } from './ABTestView';
import { ConversationalView } from './ConversationalView';
import { AnalyticsView } from './AnalyticsView';
import { VectorSpaceView } from './VectorSpaceView';
import { AdaptivePanel } from './AdaptivePanel';
import { SEODashboard } from '../pages/SEODashboard/SEODashboard';

export interface StudioViewRouterProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  selectedItem: CatalogItem | null;
  onSelectItem: (item: CatalogItem | null) => void;
  isScaledCatalog: boolean;
  activeDomain: PlatformDomainId;
  uiLang: UiLanguage;
  engineState: EmbeddingEngineState;
  onSearch: (query: string) => Promise<CatalogItem[]>;
  onHybridSearch: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onRecommend: (
    itemId: string,
    diversityLambda?: number,
    limit?: number,
    rules?: MerchandisingRules
  ) => CatalogRecommendation[];
  onAddItem: (item: CatalogItem) => void;
  onDeleteItem: (id: string) => void;
  onScaleCatalog: (targetCount?: number) => void;
  onRestoreCatalog: () => void;
  onSelectDomainPreset: (preset: PlatformDomainPreset) => void;
  onImportVectorBundle: (items: CatalogItem[], embeddings: Map<string, Float32Array>) => void;
  onOpenApiConsole: () => void;
  onOpenCsvModal: () => void;
  onOpenDatabaseConnector: () => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const StudioViewRouter: React.FC<StudioViewRouterProps> = ({
  view,
  onNavigate,
  catalog,
  embeddings,
  selectedItem,
  onSelectItem,
  isScaledCatalog,
  activeDomain,
  uiLang,
  engineState,
  onSearch,
  onHybridSearch,
  onRecommend,
  onAddItem,
  onDeleteItem,
  onScaleCatalog,
  onRestoreCatalog,
  onSelectDomainPreset,
  onImportVectorBundle,
  onOpenApiConsole,
  onOpenCsvModal,
  onOpenDatabaseConnector,
  onShowToast,
}) => {
  const handleInspectIn3D = useCallback(
    (item: CatalogItem) => {
      onSelectItem(item);
      onNavigate('vectorspace');
    },
    [onSelectItem, onNavigate]
  );

  const handleInspectRecommendations = useCallback(
    (item: CatalogItem) => {
      onSelectItem(item);
      onNavigate('recommendations');
    },
    [onSelectItem, onNavigate]
  );

  const agent = useMemo(
    () =>
      new ConversationalAgent(catalog, embeddings, async (q) =>
        computeTextEmbedding(`query: ${q}`)
      ),
    [catalog, embeddings]
  );

  switch (view) {
    case 'dashboard':
      return (
        <DashboardView
          catalog={catalog}
          embeddings={embeddings}
          selectedItem={selectedItem}
          isScaledCatalog={isScaledCatalog}
          activeDomain={activeDomain}
          uiLang={uiLang}
          onNavigate={onNavigate}
          onSearch={onSearch}
          onSelectItem={onSelectItem}
          onScaleCatalog={onScaleCatalog}
          onRestoreCatalog={onRestoreCatalog}
          onOpenApiConsole={onOpenApiConsole}
          onSelectDomainPreset={onSelectDomainPreset}
          onOpenDatabaseConnector={onOpenDatabaseConnector}
        />
      );
    case 'vectorspace':
      return (
        <VectorSpaceView
          catalog={catalog}
          embeddings={embeddings}
          selectedItem={selectedItem}
          onSelectItem={onSelectItem}
          onInspectRecommendations={handleInspectRecommendations}
          uiLang={uiLang}
        />
      );
    case 'adaptive':
      return (
        <AdaptivePanel
          catalog={catalog}
          embeddings={embeddings}
          selectedItem={selectedItem}
          onSelectItem={onSelectItem}
          onShowToast={onShowToast}
          uiLang={uiLang}
        />
      );
    case 'search':
      return (
        <SearchView
          catalog={catalog}
          onHybridSearch={onHybridSearch}
          onSelectItem={handleInspectRecommendations}
          onInspectIn3D={handleInspectIn3D}
          uiLang={uiLang}
          embeddingState={engineState}
        />
      );
    case 'recommendations':
      return (
        <RecommendationsView
          catalog={catalog}
          embeddings={embeddings}
          selectedItem={selectedItem}
          onSelectItem={onSelectItem}
          onRecommend={onRecommend}
          onInspectIn3D={handleInspectIn3D}
          uiLang={uiLang}
        />
      );
    case 'catalog':
      return (
        <CatalogView
          catalog={catalog}
          embeddings={embeddings}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onSelectItem={handleInspectRecommendations}
          onInspectIn3D={handleInspectIn3D}
          onImportVectorBundle={onImportVectorBundle}
          onOpenCsvModal={onOpenCsvModal}
          uiLang={uiLang}
        />
      );
    case 'seo':
      return <SEODashboard />;
    case 'analytics':
      return <AnalyticsView />;
    case 'abtest':
      return <ABTestView />;
    case 'conversational':
      return (
        <ConversationalView
          agent={agent}
          onSelectItem={handleInspectRecommendations}
          uiLang={uiLang}
        />
      );
    default:
      return <SEODashboard />;
  }
};
