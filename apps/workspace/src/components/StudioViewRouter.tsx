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
import { RankingPlayground } from './RankingPlayground';
import { RecommendationsView } from './RecommendationsView';
import { ABTestView } from './ABTestView';
import { ConversationalView } from './ConversationalView';
import { AnalyticsView } from './AnalyticsView';
import { VectorSpaceView } from './VectorSpaceView';
import { AdaptivePanel } from './AdaptivePanel';
import { IndexManagerView } from './IndexManagerView';
import { ClusterTopologyView } from './ClusterTopologyView';
import { SettingsView } from './SettingsView';
import { FaqGuideView } from './FaqGuideView';
import { SEODashboard } from '../pages/SEODashboard/SEODashboard';
import { DemoPage } from '../pages/DemoPage/DemoPage';

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
  onClearCatalog?: () => void;
  onSelectDomainPreset: (preset: PlatformDomainPreset) => void;
  onImportCustomDatabase?: (items: CatalogItem[], label?: string) => void;
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
  onClearCatalog,
  onSelectDomainPreset,
  onImportCustomDatabase,
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

  const renderActiveView = () => {
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
      case 'demo':
        return (
          <DemoPage
            catalog={catalog}
            forceMode="demo"
            onHybridSearch={onHybridSearch}
            onSelectItem={handleInspectRecommendations}
            onInspectIn3D={handleInspectIn3D}
            onImportCustomDatabase={onImportCustomDatabase}
            onClearCatalog={onClearCatalog}
            onNavigate={onNavigate}
            uiLang={uiLang}
            embeddingState={engineState}
          />
        );
      case 'search':
        return (
          <DemoPage
            catalog={catalog}
            forceMode="normal"
            onHybridSearch={onHybridSearch}
            onSelectItem={handleInspectRecommendations}
            onInspectIn3D={handleInspectIn3D}
            onImportCustomDatabase={onImportCustomDatabase}
            onClearCatalog={onClearCatalog}
            onNavigate={onNavigate}
            uiLang={uiLang}
            embeddingState={engineState}
          />
        );
      case 'ranking':
        return <RankingPlayground catalog={catalog} uiLang={uiLang} />;
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
      case 'indexes':
        return <IndexManagerView onShowToast={onShowToast} uiLang={uiLang} />;
      case 'cluster':
        return <ClusterTopologyView onShowToast={onShowToast} uiLang={uiLang} />;
      case 'seo':
        return <SEODashboard uiLang={uiLang} />;
      case 'analytics':
        return <AnalyticsView uiLang={uiLang} />;
      case 'abtest':
        return <ABTestView uiLang={uiLang} />;
      case 'conversational':
        return (
          <ConversationalView
            agent={agent}
            onSelectItem={handleInspectRecommendations}
            uiLang={uiLang}
          />
        );
      case 'settings':
        return <SettingsView onShowToast={onShowToast} uiLang={uiLang} />;
      case 'faq':
        return (
          <FaqGuideView
            uiLang={uiLang}
            onNavigate={onNavigate}
            onOpenDatabaseConnector={onOpenDatabaseConnector}
          />
        );
      default:
        return <SEODashboard uiLang={uiLang} />;
    }
  };

  return (
    <div className="relative w-full" data-testid="studio-view-router">
      {engineState.status === 'loading-model' && (
        <div
          data-testid="studio-router-loading-indicator"
          role="status"
          aria-live="polite"
          className="px-6 py-1.5 bg-[var(--accent)]/10 border-b border-[var(--accent)]/30 flex items-center justify-between text-xs text-[var(--text)]"
        >
          <span className="flex items-center gap-2 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span>
              {uiLang === 'ru'
                ? `Инициализация нейросетевого движка ONNX (${engineState.progress}%) — локальный 384-d + BM25 поиск уже активен`
                : `Initializing ONNX neural engine (${engineState.progress}%) — local 384-d + BM25 search is active`}
            </span>
          </span>
          <span className="mono text-[11px] font-bold text-[var(--accent)]">
            {engineState.progress}%
          </span>
        </div>
      )}
      {renderActiveView()}
    </div>
  );
};
