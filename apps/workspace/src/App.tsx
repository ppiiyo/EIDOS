import React, { useState } from 'react';
import { Sidebar, ViewId } from './components/Sidebar';
import { StudioHeader } from './components/StudioHeader';
import { StudioViewRouter } from './components/StudioViewRouter';
import { StudioModals } from './components/StudioModals';
import { ToastContainer } from './components/ToastContainer';
import { useStudioWorkspace } from './hooks/useStudioWorkspace';
import { useCatalogImportHandlers } from './hooks/useCatalogImportHandlers';

export function App() {
  const [view, setView] = useState<ViewId>('search');
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

  const { handleImportVectorBundle, handleCsvImportConcepts, csvProject } =
    useCatalogImportHandlers({
      catalog,
      embeddings,
      setCatalog,
      setEmbeddings,
      setSelectedItem,
      setIsScaledCatalog,
      showToast,
    });

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

        <StudioViewRouter
          view={view}
          onNavigate={setView}
          catalog={catalog}
          embeddings={embeddings}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
          isScaledCatalog={isScaledCatalog}
          activeDomain={activeDomain}
          uiLang={uiLang}
          engineState={engineState}
          onSearch={handleSearch}
          onHybridSearch={handleHybridSearch}
          onRecommend={handleRecommend}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onScaleCatalog={handleScaleCatalog}
          onRestoreCatalog={handleRestoreCuratedCatalog}
          onSelectDomainPreset={handleSelectDomainPreset}
          onImportVectorBundle={handleImportVectorBundle}
          onOpenApiConsole={() => setIsApiModalOpen(true)}
          onOpenCsvModal={() => setIsCsvModalOpen(true)}
          onOpenDatabaseConnector={() => setIsDbConnectorOpen(true)}
          onShowToast={showToast}
        />
      </main>

      <StudioModals
        isApiModalOpen={isApiModalOpen}
        onCloseApiModal={() => setIsApiModalOpen(false)}
        isCsvModalOpen={isCsvModalOpen}
        onCloseCsvModal={() => setIsCsvModalOpen(false)}
        isDbConnectorOpen={isDbConnectorOpen}
        onCloseDbConnector={() => setIsDbConnectorOpen(false)}
        catalog={catalog}
        selectedItem={selectedItem}
        activeDomain={activeDomain}
        csvProject={csvProject}
        onHybridSearch={handleHybridSearch}
        onRecommend={handleRecommend}
        onImportCsvConcepts={handleCsvImportConcepts}
        onSelectDomainPreset={handleSelectDomainPreset}
        onImportCustomDatabase={handleImportCustomDatabase}
        onShowToast={showToast}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
