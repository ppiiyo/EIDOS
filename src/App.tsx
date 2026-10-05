import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Project,
  ActiveTab,
  Edge,
  Cluster,
  GraphMetrics,
  Insight,
  StatusKind,
  ToastItem,
  CatalogItem,
} from './types';
import { PRESET_DOMAINS } from './data/presets';
import { INITIAL_CATALOG } from './data/catalog';
import {
  generateSemanticEmbedding,
  buildSimilarityMatrix,
} from './utils/semanticEngine';
import {
  computeTextEmbedding,
} from './utils/recommenderEngine';
import {
  extractEdges,
  detectClusters,
  computeMetrics,
  generateInsights,
} from './utils/graphMath';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AnalysisView } from './components/AnalysisView';
import { GraphView } from './components/GraphView';
import { InsightsView } from './components/InsightsView';
import { ExportView } from './components/ExportView';
import { RecommenderView } from './components/RecommenderView';
import { VectorCanvas3D } from './components/VectorCanvas3D';
import { AdaptivePanel } from './components/AdaptivePanel';
import { PresentationLandingView } from './components/PresentationLandingView';
import { IntegrationHubView } from './components/IntegrationHubView';
import { MultiAgentStudioView } from './components/MultiAgentStudioView';
import { PromptInspectorModal } from './components/PromptInspectorModal';
import { useStorage } from './context/StorageContext';
import {
  NewProjectModal,
  RenameProjectModal,
  DeleteProjectModal,
  BatchPasteModal,
} from './components/Modals';
import { ToastContainer } from './components/ToastContainer';

const STORAGE_PROJECTS_KEY = 'eidos.projects.v4';
const STORAGE_CURRENT_KEY = 'eidos.currentId.v4';
const STORAGE_CATALOG_KEY = 'eidos.catalog.v4';
const STORAGE_TAB_KEY = 'eidos.activeTab.v4';

export default function App() {
  // 1. Catalog State (Production Recommender & Embeddings)
  const [catalog, setCatalog] = useState<CatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CATALOG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CATALOG;
  });

  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(() => catalog[0] || null);

  // Precomputed dense 384-dim embeddings map
  const catalogEmbeddings = useMemo(() => {
    const map = new Map<number, Float32Array>();
    for (const item of catalog) {
      const textToEmbed = `passage: ${item.title} ${item.description} ${item.category} ${item.tags?.join(' ') || ''}`;
      map.set(item.id, computeTextEmbedding(textToEmbed));
    }
    return map;
  }, [catalog]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(catalog));
    } catch {
      // ignore
    }
  }, [catalog]);

  // 2. Domain & Semantic Projects State (for Knowledge Graph)
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROJECTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    const defaultProject: Project = {
      id: 'proj-catalog',
      name: PRESET_DOMAINS.catalog.name,
      concepts: PRESET_DOMAINS.catalog.concepts.map((name, i) => ({
        id: `c-${i}`,
        name,
      })),
      updatedAt: Date.now(),
      simThreshold: 0.25,
    };
    return [defaultProject];
  });

  const [currentId, setCurrentId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_CURRENT_KEY);
    return saved || 'proj-catalog';
  });

  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === currentId) || projects[0];
  }, [projects, currentId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
      localStorage.setItem(STORAGE_CURRENT_KEY, currentId);
    } catch {
      // ignore
    }
  }, [projects, currentId]);

  // 3. Navigation State - Default to real working Showcase & Architecture
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TAB_KEY);
      if (
        saved &&
        [
          'landing',
          'recommender',
          'universe3d',
          'adaptive',
          'agent_studio',
          'graph',
          'integration',
          'overview',
        ].includes(saved)
      ) {
        return saved as ActiveTab;
      }
    } catch {
      // ignore
    }
    return 'landing';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TAB_KEY, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  const [threshold, setThreshold] = useState<number>(() => {
    return currentProject.simThreshold ?? 0.25;
  });

  const [status, setStatus] = useState<{ text: string; kind: StatusKind }>({
    text: 'Готово',
    kind: 'ready',
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 4. Computed Graph State
  const [embeddingsMap, setEmbeddingsMap] = useState<Map<string, Float32Array>>(new Map());
  const [similarityMatrix, setSimilarityMatrix] = useState<Float32Array[] | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [metrics, setMetrics] = useState<GraphMetrics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [highlightedConcept, setHighlightedConcept] = useState<string | null>(null);

  // 5. Modals State
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isRenameProjectOpen, setIsRenameProjectOpen] = useState(false);
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [isBatchPasteOpen, setIsBatchPasteOpen] = useState(false);
  const [isPromptInspectorOpen, setIsPromptInspectorOpen] = useState(false);

  // 6. Toasts State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, type: 'info' | 'success' | 'error' = 'info') => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Self-Hosted Storage & Cloud Sync
  const { user, syncData, loadCloudData } = useStorage();

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    loadCloudData().then((cloudData) => {
      if (!isMounted || !cloudData) return;
      if (cloudData.projects && cloudData.projects.length > 0) {
        setProjects(cloudData.projects);
        addToast('Облачные проекты синхронизированы', 'info');
      } else if (projects.length > 0) {
        syncData(projects, catalog);
      }
      if (cloudData.catalog && cloudData.catalog.length > 0) {
        setCatalog(cloudData.catalog);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Run Semantic Graph Pipeline
  const runAnalysis = useCallback(async () => {
    const concepts = currentProject.concepts;
    if (concepts.length < 2) return;

    setIsAnalyzing(true);
    setStatus({ text: 'Анализ графа…', kind: 'busy' });

    try {
      const names = concepts.map((c) => c.name);
      const newEmbeddings = new Map<string, Float32Array>();
      for (const name of names) {
        newEmbeddings.set(name, generateSemanticEmbedding(name));
      }
      setEmbeddingsMap(newEmbeddings);

      const matrix = buildSimilarityMatrix(names, newEmbeddings);
      setSimilarityMatrix(matrix);

      const extracted = extractEdges(names, matrix, threshold);
      const detectedClusters = detectClusters(names, extracted);
      const computedMetrics = computeMetrics(names, matrix, extracted);
      const generatedInsights = generateInsights(
        names,
        matrix,
        extracted,
        detectedClusters,
        computedMetrics
      );

      setEdges(extracted);
      setClusters(detectedClusters);
      setMetrics(computedMetrics);
      setInsights(generatedInsights);

      setStatus({
        text: `Готово · ${generatedInsights.length} инсайтов`,
        kind: 'ready',
      });
    } catch {
      setStatus({ text: 'Готово', kind: 'ready' });
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentProject, threshold]);

  // Pre-warm graph analysis on mount
  useEffect(() => {
    runAnalysis();
  }, []);

  const handleSelectPreset = (presetKey: string) => {
    const preset = PRESET_DOMAINS[presetKey];
    if (!preset) return;

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === currentProject.id) {
          return {
            ...p,
            name: preset.name,
            concepts: preset.concepts.map((name, i) => ({
              id: `c-${Date.now()}-${i}`,
              name,
            })),
          };
        }
        return p;
      })
    );

    addToast(`Загружен домен «${preset.name}»`, 'info');
    setTimeout(runAnalysis, 50);
  };

  const handleAddConcept = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (currentProject.concepts.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      addToast(`Концепт «${trimmed}» уже существует`, 'error');
      return;
    }
    const updated = [...currentProject.concepts, { id: `c-${Date.now()}`, name: trimmed }];
    setProjects((prev) =>
      prev.map((p) => (p.id === currentProject.id ? { ...p, concepts: updated } : p))
    );
    addToast(`Добавлен: ${trimmed}`, 'success');
  };

  const handleRemoveConcept = (index: number) => {
    const updated = currentProject.concepts.filter((_, i) => i !== index);
    setProjects((prev) =>
      prev.map((p) => (p.id === currentProject.id ? { ...p, concepts: updated } : p))
    );
  };

  const handleBatchImport = (newConcepts: string[], replace: boolean) => {
    const conceptObjects = newConcepts.map((name, i) => ({
      id: `c-${Date.now()}-${i}`,
      name,
    }));
    const finalConcepts = replace
      ? conceptObjects
      : [
          ...currentProject.concepts,
          ...conceptObjects.filter(
            (c) => !currentProject.concepts.some((orig) => orig.name.toLowerCase() === c.name.toLowerCase())
          ),
        ];
    setProjects((prev) =>
      prev.map((p) => (p.id === currentProject.id ? { ...p, concepts: finalConcepts } : p))
    );
    addToast(`Импортировано ${conceptObjects.length} концептов`, 'success');
  };

  const conceptNames = useMemo(() => {
    return currentProject.concepts.map((c) => c.name);
  }, [currentProject]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#07070c] text-[#e8e8f0]">
      {/* Top Application Header */}
      <Header
        projects={projects}
        currentProject={currentProject}
        status={status}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onSelectProject={setCurrentId}
        onNewProject={() => setIsNewProjectOpen(true)}
        onRenameProject={() => setIsRenameProjectOpen(true)}
        onDeleteProject={() => setIsDeleteProjectOpen(true)}
        onOpenPromptInspector={() => setIsPromptInspectorOpen(true)}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar only visible when explicitly exploring Graph Customizer */}
        {activeTab === 'graph' && (
          <Sidebar
            project={currentProject}
            threshold={threshold}
            isAnalyzing={isAnalyzing}
            onSelectPreset={handleSelectPreset}
            onAddConcept={handleAddConcept}
            onRemoveConcept={handleRemoveConcept}
            onOpenBatchPaste={() => setIsBatchPasteOpen(true)}
            onChangeThreshold={(val) => {
              setThreshold(val);
              setProjects((prev) =>
                prev.map((p) => (p.id === currentProject.id ? { ...p, simThreshold: val } : p))
              );
            }}
            onRunAnalysis={runAnalysis}
          />
        )}

        {/* Center Main Stage */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#07080f]">
          {/* Active View Container */}
          <div className="flex-1 overflow-hidden relative">
            {/* 1. CORE RECOMMENDER SHOWCASE & SEARCH */}
            {activeTab === 'recommender' && (
              <RecommenderView
                catalog={catalog}
                onUpdateCatalog={setCatalog}
                onShowToast={addToast}
              />
            )}

            {/* 2. STANDALONE FULL-SCREEN 3D VECTOR UNIVERSE */}
            {activeTab === 'universe3d' && (
              <div className="p-4 sm:p-6 h-full flex flex-col gap-4">
                <VectorCanvas3D
                  catalog={catalog}
                  embeddings={catalogEmbeddings}
                  selectedItemId={selectedCatalogItem?.id ?? null}
                  onSelectItem={(id) => {
                    const found = catalog.find((c) => c.id === id);
                    if (found) setSelectedCatalogItem(found);
                  }}
                  onSetSeed={(item) => {
                    setSelectedCatalogItem(item);
                    addToast(`Опорный товар выбран: ${item.title}`, 'success');
                  }}
                  height="100%"
                />
              </div>
            )}

            {/* 3. ADAPTIVE INTELLIGENCE LAYER CONSOLE */}
            {activeTab === 'adaptive' && (
              <div className="p-4 sm:p-6 h-full overflow-y-auto">
                <AdaptivePanel
                  catalog={catalog}
                  embeddings={catalogEmbeddings}
                  selectedItem={selectedCatalogItem}
                  onSelectItem={setSelectedCatalogItem}
                  onShowToast={addToast}
                />
              </div>
            )}

            {/* 4. MULTI-AGENT AUTONOMOUS AI STUDIO */}
            {activeTab === 'agent_studio' && (
              <MultiAgentStudioView
                catalog={catalog}
                onShowToast={addToast}
                onNavigateToRecommender={() => setActiveTab('recommender')}
                onOpenPromptInspector={() => setIsPromptInspectorOpen(true)}
              />
            )}

            {/* 5. KNOWLEDGE GRAPH & SEMANTIC FIELD */}
            {activeTab === 'graph' && (
              <GraphView
                names={conceptNames}
                edges={edges}
                clusters={clusters}
                metrics={metrics}
                threshold={threshold}
                highlightedConcept={highlightedConcept}
              />
            )}

            {/* 6. INTEGRATION HUB & SDK */}
            {activeTab === 'integration' && (
              <IntegrationHubView
                catalog={catalog}
                onShowToast={addToast}
              />
            )}

            {/* 7. ARCHITECTURE & ENTERPRISE OVERVIEW */}
            {(activeTab === 'overview' || activeTab === 'landing') && (
              <PresentationLandingView
                catalog={catalog}
                onSelectTab={setActiveTab}
                onShowToast={addToast}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreate={(name) => {
          const newProj: Project = {
            id: `proj-${Date.now()}`,
            name,
            concepts: [
              { id: `c-${Date.now()}-1`, name: 'Векторный поиск' },
              { id: `c-${Date.now()}-2`, name: 'Семантическая модель' },
            ],
            updatedAt: Date.now(),
            simThreshold: 0.25,
          };
          setProjects((prev) => [...prev, newProj]);
          setCurrentId(newProj.id);
          setIsNewProjectOpen(false);
          addToast(`Создан проект: ${name}`, 'success');
        }}
      />

      <RenameProjectModal
        isOpen={isRenameProjectOpen}
        currentName={currentProject.name}
        onClose={() => setIsRenameProjectOpen(false)}
        onRename={(newName) => {
          setProjects((prev) =>
            prev.map((p) => (p.id === currentProject.id ? { ...p, name: newName } : p))
          );
          setIsRenameProjectOpen(false);
          addToast(`Переименован в: ${newName}`, 'success');
        }}
      />

      <DeleteProjectModal
        isOpen={isDeleteProjectOpen}
        projectName={currentProject.name}
        onClose={() => setIsDeleteProjectOpen(false)}
        onConfirm={() => {
          if (projects.length <= 1) {
            addToast('Нельзя удалить единственный проект', 'error');
            return;
          }
          const next = projects.filter((p) => p.id !== currentProject.id);
          setProjects(next);
          setCurrentId(next[0].id);
          setIsDeleteProjectOpen(false);
          addToast('Проект удален', 'info');
        }}
      />

      <BatchPasteModal
        isOpen={isBatchPasteOpen}
        onClose={() => setIsBatchPasteOpen(false)}
        onImport={handleBatchImport}
      />

      {/* Prompt Inspector & Live Trace Modal */}
      <PromptInspectorModal
        isOpen={isPromptInspectorOpen}
        onClose={() => setIsPromptInspectorOpen(false)}
        onShowToast={addToast}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
