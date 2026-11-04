import React, { Suspense, useMemo } from 'react';
import {
  CatalogItem,
  CatalogRecommendation,
  MerchandisingRules,
} from '../types';
import { ViewId } from './Sidebar';
import { DashboardView } from './DashboardView';
import { SearchView } from './SearchView';
import { RecommendationsView } from './RecommendationsView';
import { RankingPlayground } from './RankingPlayground';
import { CatalogView } from './CatalogView';
import { AnalyticsView } from './AnalyticsView';
import { DemoPage } from '../pages/DemoPage/DemoPage';
import { HybridSearchHit, computeTextEmbedding } from '../utils/recommenderEngine';
import { PlatformDomainId, PlatformDomainPreset } from '../data/domainDatabases';
import { UiLanguage } from '../i18n/uiTranslations';
import { EmbeddingEngineState } from '../lib/embeddings';
import { ConversationalAgent } from '../lib/agent/conversational-agent';

const VectorSpaceView = React.lazy(() =>
  import('./VectorSpaceView').then((m) => ({ default: m.VectorSpaceView }))
);
const ClusterTopologyView = React.lazy(() =>
  import('./ClusterTopologyView').then((m) => ({ default: m.ClusterTopologyView }))
);
const FaqGuideView = React.lazy(() =>
  import('./FaqGuideView').then((m) => ({ default: m.FaqGuideView }))
);
const OnboardingWizard = React.lazy(() =>
  import('../pages/OnboardingPage/OnboardingWizard').then((m) => ({ default: m.OnboardingWizard }))
);
const SEODashboard = React.lazy(() =>
  import('../pages/SEODashboard/SEODashboard').then((m) => ({ default: m.SEODashboard }))
);
const AdaptivePanel = React.lazy(() =>
  import('./AdaptivePanel').then((m) => ({ default: m.AdaptivePanel }))
);
const IndexManagerView = React.lazy(() =>
  import('./IndexManagerView').then((m) => ({ default: m.IndexManagerView }))
);
const ABTestView = React.lazy(() =>
  import('./ABTestView').then((m) => ({ default: m.ABTestView }))
);
const ConversationalView = React.lazy(() =>
  import('./ConversationalView').then((m) => ({ default: m.ConversationalView }))
);
const SettingsView = React.lazy(() =>
  import('./SettingsView').then((m) => ({ default: m.SettingsView }))
);
const EidosAdminConsole = React.lazy(() =>
  import('../pages/AdminConsolePage/EidosAdminConsole').then((m) => ({
    default: m.EidosAdminConsole,
  }))
);

export interface StudioViewRouterProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  selectedItem: CatalogItem | null;
  onSelectItem: (item: CatalogItem) => void;
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
  onClearCatalog: () => void;
  onSelectDomainPreset: (preset: PlatformDomainPreset) => void;
  onImportCustomDatabase: (items: CatalogItem[], label?: string) => void;
  onImportVectorBundle: (items: CatalogItem[], embeddings: Map<string, Float32Array>) => void;
  onOpenApiConsole: () => void;
  onOpenCsvModal: () => void;
  onOpenDatabaseConnector: () => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const LazyTabFallback: React.FC = () => (
  <div className="page flex items-center justify-center py-16 text-xs mono text-[var(--text-sec)]">
    Loading Studio module...
  </div>
);

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
  const agent = useMemo(
    () => new ConversationalAgent(catalog, embeddings, async (text) => computeTextEmbedding(text)),
    [catalog, embeddings]
  );

  const handleInspectIn3D = (item: CatalogItem) => {
    onSelectItem(item);
    onNavigate('vectorspace');
  };

  return (
    <Suspense fallback={<LazyTabFallback />}>
      {(view === 'admin' || view === 'public-demo') && (
        <EidosAdminConsole
          mode={view === 'public-demo' ? 'public-demo' : 'admin'}
          uiLang={uiLang === 'en' ? 'en' : 'ru'}
          onSwitchMode={(m) => onNavigate(m === 'public-demo' ? 'public-demo' : 'admin')}
        />
      )}

      {view === 'dashboard' && (
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
      )}

      {view === 'onboarding' && (
        <OnboardingWizard
          catalog={catalog}
          onImportCustomDatabase={onImportCustomDatabase}
          onHybridSearch={onHybridSearch}
          onNavigate={onNavigate}
          onShowToast={onShowToast}
        />
      )}

      {view === 'demo' && (
        <DemoPage
          catalog={catalog}
          onHybridSearch={onHybridSearch}
          onSelectItem={onSelectItem}
          onInspectIn3D={handleInspectIn3D}
          onImportCustomDatabase={onImportCustomDatabase}
          onClearCatalog={onClearCatalog}
          onNavigate={onNavigate}
          forceMode="demo"
          uiLang={uiLang}
          embeddingState={engineState}
        />
      )}

      {view === 'search' && (
        <DemoPage
          catalog={catalog}
          onHybridSearch={onHybridSearch}
          onSelectItem={onSelectItem}
          onInspectIn3D={handleInspectIn3D}
          onImportCustomDatabase={onImportCustomDatabase}
          onClearCatalog={onClearCatalog}
          onNavigate={onNavigate}
          forceMode="normal"
          uiLang={uiLang}
          embeddingState={engineState}
        />
      )}

      {view === 'seo' && <SEODashboard />}

      {view === 'vectorspace' && (
        <VectorSpaceView
          catalog={catalog}
          embeddings={embeddings}
          selectedItem={selectedItem}
          onSelectItem={onSelectItem}
          onInspectRecommendations={(item) => {
            onSelectItem(item);
            onNavigate('recommendations');
          }}
          uiLang={uiLang}
        />
      )}

      {view === 'adaptive' && (
        <AdaptivePanel
          catalog={catalog}
          embeddings={embeddings}
          selectedItem={selectedItem}
          onSelectItem={onSelectItem}
          onShowToast={onShowToast}
          uiLang={uiLang}
        />
      )}

      {view === 'ranking' && <RankingPlayground catalog={catalog} uiLang={uiLang} />}

      {view === 'recommendations' && (
        <RecommendationsView
          catalog={catalog}
          embeddings={embeddings}
          selectedItem={selectedItem}
          onSelectItem={onSelectItem}
          onRecommend={onRecommend}
          onInspectIn3D={handleInspectIn3D}
          uiLang={uiLang}
        />
      )}

      {view === 'catalog' && (
        <CatalogView
          catalog={catalog}
          embeddings={embeddings}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onSelectItem={onSelectItem}
          onInspectIn3D={handleInspectIn3D}
          onImportVectorBundle={onImportVectorBundle}
          onOpenCsvModal={onOpenCsvModal}
          uiLang={uiLang}
        />
      )}

      {view === 'indexes' && <IndexManagerView />}

      {view === 'cluster' && <ClusterTopologyView onShowToast={onShowToast} uiLang={uiLang} />}

      {view === 'analytics' && <AnalyticsView uiLang={uiLang} />}

      {view === 'abtest' && <ABTestView uiLang={uiLang} />}

      {view === 'conversational' && (
        <ConversationalView agent={agent} onSelectItem={onSelectItem} uiLang={uiLang} />
      )}

      {view === 'settings' && <SettingsView onShowToast={onShowToast} uiLang={uiLang} />}

      {view === 'faq' && (
        <FaqGuideView
          uiLang={uiLang}
          onNavigate={onNavigate}
          onOpenDatabaseConnector={onOpenDatabaseConnector}
        />
      )}
    </Suspense>
  );
};
