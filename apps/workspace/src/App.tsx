import React, { useState, useMemo, useCallback } from "react";
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem, Project } from './types';
import { computeTextEmbedding } from './utils/recommenderEngine';
import { Sidebar, ViewId } from './components/Sidebar';
import { StudioHeader } from './components/StudioHeader';
import { DashboardView } from './components/DashboardView';
import { CatalogView } from './components/CatalogView';
import { SearchView } from './components/SearchView';
import { RecommendationsView } from './components/RecommendationsView';
import { ABTestView } from './components/ABTestView';
import { ConversationalView } from './components/ConversationalView';
import { AnalyticsView } from './components/AnalyticsView';
import { VectorSpaceView } from './components/VectorSpaceView';
import { AdaptivePanel } from './components/AdaptivePanel';
import { ApiConsoleModal } from './components/ApiConsoleModal';
import { CsvImporterModal } from './components/CsvImporterModal';
import { DatabaseConnectorModal } from './components/DatabaseConnectorModal';
import { ToastContainer } from './components/ToastContainer';
import { ConversationalAgent } from './lib/agent/conversational-agent';
import { useStudioWorkspace } from './hooks/useStudioWorkspace';

export function App() {
  const [view, setView] = useState<ViewId>('dashboard');
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isDbConnectorOpen, setIsDbConnectorOpen] = useState(false);

  const {
    uiLang,
    setUiLang,
    catalog,
    setCatalog,
    embeddings,
    setEmbeddings,
    selectedItem,
    setSelectedItem,
    isScaledCatalog,
    setIsScaledCatalog,
    activeDomain,
    toasts,
    engineState,
    showToast,
    dismissToast,
    handleAddItem,
    handleDeleteItem,
    handleScaleCatalog,
    handleRestoreCuratedCatalog,
    handleSelectDomainPreset,
    handleImportCustomDatabase,
    handleSearch,
    handleHybridSearch,
    handleRecommend,
  } = useStudioWorkspace();

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

  const handleInspectIn3D = useCallback(
    (item: CatalogItem) => {
      setSelectedItem(item);
      setView('vectorspace');
    },
    [setSelectedItem]
  );

  const handleInspectRecommendations = useCallback(
    (item: CatalogItem) => {
      setSelectedItem(item);
      setView('recommendations');
    },
    [setSelectedItem]
  );

  const agent = useMemo(
    () =>
      new ConversationalAgent(catalog, embeddings, async (q) =>
        computeTextEmbedding(`query: ${q}`)
      ),
    [catalog, embeddings]
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

  return (
    <div className="app-shell">
      <Sidebar
        active={view}
        onSelect={setView}
        onOpenApiModal={() => setIsApiModalOpen(true)}
        uiLang={uiLang}
      />

      <main className="main-area">
        <StudioHeader
          catalogCount={catalog.length}
          selectedItem={selectedItem}
          uiLang={uiLang}
          isScaledCatalog={isScaledCatalog}
          engineState={engineState}
          onChangeLang={setUiLang}
          onOpenDbConnector={() => setIsDbConnectorOpen(true)}
          onScaleCatalog={() => handleScaleCatalog(1200)}
          onRestoreCatalog={handleRestoreCuratedCatalog}
          onOpenCsvModal={() => setIsCsvModalOpen(true)}
          onOpenApiModal={() => setIsApiModalOpen(true)}
        />

        {view === 'dashboard' && (
          <DashboardView
            catalog={catalog}
            embeddings={embeddings}
            selectedItem={selectedItem}
            isScaledCatalog={isScaledCatalog}
            activeDomain={activeDomain}
            uiLang={uiLang}
            onNavigate={setView}
            onSearch={handleSearch}
            onSelectItem={setSelectedItem}
            onScaleCatalog={handleScaleCatalog}
            onRestoreCatalog={handleRestoreCuratedCatalog}
            onOpenApiConsole={() => setIsApiModalOpen(true)}
            onSelectDomainPreset={handleSelectDomainPreset}
            onOpenDatabaseConnector={() => setIsDbConnectorOpen(true)}
          />
        )}

        {view === 'vectorspace' && (
          <VectorSpaceView
            catalog={catalog}
            embeddings={embeddings}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onInspectRecommendations={handleInspectRecommendations}
            uiLang={uiLang}
          />
        )}

        {view === 'adaptive' && (
          <AdaptivePanel
            catalog={catalog}
            embeddings={embeddings}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onShowToast={showToast}
            uiLang={uiLang}
          />
        )}

        {view === 'search' && (
          <SearchView
            catalog={catalog}
            onHybridSearch={handleHybridSearch}
            onSelectItem={handleInspectRecommendations}
            onInspectIn3D={handleInspectIn3D}
            uiLang={uiLang}
            embeddingState={engineState}
          />
        )}

        {view === 'recommendations' && (
          <RecommendationsView
            catalog={catalog}
            embeddings={embeddings}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onRecommend={handleRecommend}
            onInspectIn3D={handleInspectIn3D}
            uiLang={uiLang}
          />
        )}

        {view === 'catalog' && (
          <CatalogView
            catalog={catalog}
            embeddings={embeddings}
            onAddItem={handleAddItem}
            onDeleteItem={handleDeleteItem}
            onSelectItem={handleInspectRecommendations}
            onInspectIn3D={handleInspectIn3D}
            onImportVectorBundle={handleImportVectorBundle}
            onOpenCsvModal={() => setIsCsvModalOpen(true)}
            uiLang={uiLang}
          />
        )}

        {view === 'analytics' && <AnalyticsView />}
        {view === 'abtest' && <ABTestView />}
        {view === 'conversational' && (
          <ConversationalView
            agent={agent}
            onSelectItem={handleInspectRecommendations}
            uiLang={uiLang}
          />
        )}
      </main>

      <ApiConsoleModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        catalog={catalog}
        selectedItem={selectedItem}
        onHybridSearch={handleHybridSearch}
        onGetRecommendations={async (item, diversity, limit) =>
          handleRecommend(String(item.id), diversity, limit)
        }
      />

      <CsvImporterModal
        isOpen={isCsvModalOpen}
        project={csvProject}
        onClose={() => setIsCsvModalOpen(false)}
        onImportConcepts={handleCsvImportConcepts}
        onShowToast={showToast}
      />

      <DatabaseConnectorModal
        isOpen={isDbConnectorOpen}
        activeDomain={activeDomain}
        catalogCount={catalog.length}
        onClose={() => setIsDbConnectorOpen(false)}
        onSelectDomainPreset={handleSelectDomainPreset}
        onImportCustomDatabase={handleImportCustomDatabase}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
export default App;
