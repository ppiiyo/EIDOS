import React, { useState } from 'react';
import { Sidebar, ViewId } from './components/Sidebar';
import { StudioHeader } from './components/StudioHeader';
import { StudioViewRouter } from './components/StudioViewRouter';
import { StudioModals } from './components/StudioModals';
import { ToastContainer } from './components/ToastContainer';
import { useStudioWorkspace } from './hooks/useStudioWorkspace';
import { useCatalogImportHandlers } from './hooks/useCatalogImportHandlers';

import { EidosAdminConsole } from './pages/AdminConsolePage/EidosAdminConsole';

export function App() {
  const [view, setView] = useState<ViewId>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location?.pathname || '';
      const search = window.location?.search || '';
      if (path.startsWith('/public-demo') || search.includes('mode=public-demo')) {
        return 'public-demo';
      }
      if (path.startsWith('/admin') || search.includes('mode=admin')) {
        return 'admin';
      }
      if (path.startsWith('/onboarding') || search.includes('onboarding=1')) {
        return 'onboarding';
      }
    }
    return 'search';
  });
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isDbConnectorOpen, setIsDbConnectorOpen] = useState(false);

  const navigateView = (nextView: ViewId) => {
    setView(nextView);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      const targetPath =
        nextView === 'admin'
          ? '/admin'
          : nextView === 'public-demo'
          ? '/public-demo'
          : nextView === 'onboarding'
          ? '/onboarding'
          : '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
    }
  };

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const path = window.location?.pathname || '';
      if (path.startsWith('/public-demo')) setView('public-demo');
      else if (path.startsWith('/admin')) setView('admin');
      else if (path.startsWith('/onboarding')) setView('onboarding');
      else setView('search');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
    handleClearCatalog,
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

  if (view === 'admin' || view === 'public-demo') {
    return (
      <EidosAdminConsole
        key={view}
        mode={view === 'public-demo' ? 'public-demo' : 'admin'}
        uiLang={uiLang === 'en' ? 'en' : 'ru'}
        onSwitchMode={(m) => navigateView(m === 'admin' ? 'admin' : 'public-demo')}
        onReturnToStudio={() => navigateView('search')}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        active={view}
        onSelect={navigateView}
        onOpenApiModal={() => setIsApiModalOpen(true)}
        uiLang={uiLang}
      />

      <main className="main-area">
        <StudioHeader
          catalogCount={view === 'demo' ? 48 : catalog.length}
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
          onOpenAdminConsole={() => navigateView('admin')}
          onOpenPublicDemo={() => navigateView('public-demo')}
        />

        <StudioViewRouter
          view={view}
          onNavigate={navigateView}
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
          onClearCatalog={handleClearCatalog}
          onSelectDomainPreset={handleSelectDomainPreset}
          onImportCustomDatabase={handleImportCustomDatabase}
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
        uiLang={uiLang}
        csvProject={csvProject}
        onHybridSearch={handleHybridSearch}
        onRecommend={handleRecommend}
        onImportCsvConcepts={handleCsvImportConcepts}
        onSelectDomainPreset={(preset) => {
          handleSelectDomainPreset(preset);
          if (view === 'demo') setView('search');
        }}
        onImportCustomDatabase={(items, label) => {
          handleImportCustomDatabase(items, label);
          if (view === 'demo') setView('search');
        }}
        onShowToast={showToast}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
