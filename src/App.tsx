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
import { PresentationLandingView } from './components/PresentationLandingView';
import { IntegrationHubView } from './components/IntegrationHubView';
import {
  NewProjectModal,
  RenameProjectModal,
  DeleteProjectModal,
  BatchPasteModal,
} from './components/Modals';
import { ToastContainer } from './components/ToastContainer';

const STORAGE_PROJECTS_KEY = 'eidos.projects.v3';
const STORAGE_CURRENT_KEY = 'eidos.currentId.v3';
const STORAGE_CATALOG_KEY = 'eidos.catalog.v1';

export default function App() {
  // 1. Projects State (for Ideation)
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
    // Default initial project
    const defaultProject: Project = {
      id: 'proj-philosophy',
      name: 'Философия',
      concepts: PRESET_DOMAINS.philosophy.concepts.map((name, i) => ({
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
    return saved || 'proj-philosophy';
  });

  // Current Active Project
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === currentId) || projects[0];
  }, [projects, currentId]);

  // Catalog State (for EIDOS Recommender)
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(catalog));
    } catch {
      // ignore
    }
  }, [catalog]);

  // Save projects to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
      localStorage.setItem(STORAGE_CURRENT_KEY, currentId);
    } catch {
      // ignore
    }
  }, [projects, currentId]);

  // 2. Navigation & UI state - start in Landing Presentation mode
  const [activeTab, setActiveTab] = useState<ActiveTab>('landing');
  const [threshold, setThreshold] = useState<number>(() => {
    return currentProject.simThreshold ?? 0.25;
  });

  const [status, setStatus] = useState<{ text: string; kind: StatusKind }>({
    text: 'Готово',
    kind: 'ready',
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 3. Computed Graph State
  const [embeddingsMap, setEmbeddingsMap] = useState<Map<string, Float32Array>>(
    new Map()
  );
  const [similarityMatrix, setSimilarityMatrix] = useState<Float32Array[] | null>(
    null
  );
  const [edges, setEdges] = useState<Edge[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [metrics, setMetrics] = useState<GraphMetrics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [highlightedConcept, setHighlightedConcept] = useState<string | null>(
    null
  );

  // 4. Modals state
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isRenameProjectOpen, setIsRenameProjectOpen] = useState(false);
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [isBatchPasteOpen, setIsBatchPasteOpen] = useState(false);

  // 5. Toasts state
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

  // Run Semantic Pipeline
  const runAnalysis = useCallback(async () => {
    const concepts = currentProject.concepts;
    if (concepts.length < 2) {
      addToast('Добавьте как минимум 2 концепта для анализа', 'error');
      return;
    }

    setIsAnalyzing(true);
    setStatus({ text: 'Анализ поля…', kind: 'busy' });

    try {
      const names = concepts.map((c) => c.name);

      // 1. Calculate semantic embeddings
      const newEmbeddings = new Map<string, Float32Array>();
      for (const name of names) {
        const vec = generateSemanticEmbedding(name);
        newEmbeddings.set(name, vec);
      }
      setEmbeddingsMap(newEmbeddings);

      // 2. Similarity matrix
      const matrix = buildSimilarityMatrix(names, newEmbeddings);
      setSimilarityMatrix(matrix);

      // 3. Extract edges, detect clusters, compute metrics
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
      addToast(
        `Анализ завершён: ${extracted.length} связей, ${detectedClusters.length} кластеров`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ text: 'Ошибка анализа', kind: 'error' });
      addToast(`Ошибка: ${msg}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentProject, threshold, addToast]);

  // Run initial analysis automatically once on mount
  useEffect(() => {
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When threshold changes, dynamically recompute without recalculating embeddings
  const handleThresholdChange = (newThreshold: number) => {
    setThreshold(newThreshold);
    if (!similarityMatrix) return;

    const names = currentProject.concepts.map((c) => c.name);
    const extracted = extractEdges(names, similarityMatrix, newThreshold);
    const detectedClusters = detectClusters(names, extracted);
    const computedMetrics = computeMetrics(names, similarityMatrix, extracted);
    const generatedInsights = generateInsights(
      names,
      similarityMatrix,
      extracted,
      detectedClusters,
      computedMetrics
    );

    setEdges(extracted);
    setClusters(detectedClusters);
    setMetrics(computedMetrics);
    setInsights(generatedInsights);
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to trigger analysis
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        runAnalysis();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runAnalysis]);

  // Project management handlers
  const handleCreateProject = (name: string) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      concepts: [],
      updatedAt: Date.now(),
      simThreshold: 0.25,
    };
    setProjects((prev) => [...prev, newProj]);
    setCurrentId(newProj.id);
    setEdges([]);
    setClusters([]);
    setMetrics(null);
    setInsights([]);
    setSimilarityMatrix(null);
    addToast(`Проект «${name}» создан`, 'success');
  };

  const handleRenameProject = (newName: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === currentProject.id ? { ...p, name: newName } : p))
    );
    addToast('Проект переименован', 'success');
  };

  const handleDeleteProject = () => {
    if (projects.length <= 1) {
      addToast('Нельзя удалить единственный проект', 'error');
      return;
    }
    const filtered = projects.filter((p) => p.id !== currentProject.id);
    setProjects(filtered);
    setCurrentId(filtered[0].id);
    addToast('Проект удалён', 'info');
  };

  // Concept management handlers
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
    // Auto-run analysis for the new preset
    setTimeout(() => {
      const names = preset.concepts;
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
    }, 50);
  };

  const handleAddConcept = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const exists = currentProject.concepts.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      addToast(`Концепт «${trimmed}» уже существует`, 'error');
      return;
    }

    const updated = [
      ...currentProject.concepts,
      { id: `c-${Date.now()}`, name: trimmed },
    ];

    setProjects((prev) =>
      prev.map((p) => (p.id === currentProject.id ? { ...p, concepts: updated } : p))
    );
    addToast(`Добавлен концепт: ${trimmed}`, 'success');
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
            (c) =>
              !currentProject.concepts.some(
                (orig) => orig.name.toLowerCase() === c.name.toLowerCase()
              )
          ),
        ];

    setProjects((prev) =>
      prev.map((p) =>
        p.id === currentProject.id ? { ...p, concepts: finalConcepts } : p
      )
    );
    addToast(`Импортировано ${conceptObjects.length} концептов`, 'success');
  };

  const handleHighlightConceptOnGraph = (conceptName: string) => {
    setHighlightedConcept(conceptName);
    setActiveTab('graph');
  };

  const conceptNames = useMemo(() => {
    return currentProject.concepts.map((c) => c.name);
  }, [currentProject]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#07070c] text-[#e8e8f0]">
      {/* Top Header */}
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
      />

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (Ideation mode) */}
        {activeTab !== 'recommender' && activeTab !== 'landing' && activeTab !== 'integration' && (
          <Sidebar
            project={currentProject}
            threshold={threshold}
            isAnalyzing={isAnalyzing}
            onSelectPreset={handleSelectPreset}
            onAddConcept={handleAddConcept}
            onRemoveConcept={handleRemoveConcept}
            onOpenBatchPaste={() => setIsBatchPasteOpen(true)}
            onChangeThreshold={handleThresholdChange}
            onRunAnalysis={runAnalysis}
          />
        )}

        {/* Center Main Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0b0b13]/50">
          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 px-5 pt-2 border-b border-[#1e1e35] bg-[#0b0b13]/80 select-none overflow-x-auto">
            {[
              { key: 'landing', label: '🌟 Презентация & Лендинг' },
              { key: 'integration', label: '⚡ Интеграция & SDK' },
              { key: 'recommender', label: '🎯 Витрина Recommender' },
              { key: 'analyze', label: 'Анализ' },
              { key: 'graph', label: 'Граф' },
              { key: 'insights', label: 'Инсайты' },
              { key: 'export', label: 'Экспорт' },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as ActiveTab);
                    if (tab.key !== 'graph') setHighlightedConcept(null);
                  }}
                  className={`px-4 sm:px-5 py-2.5 rounded-t-lg mono text-xs uppercase tracking-wider transition-all relative cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-[#00e5ff] font-semibold bg-[#111120]/60'
                      : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#00e5ff] shadow-[0_0_10px_#00e5ff]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active View Container */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'landing' && (
              <PresentationLandingView
                catalog={catalog}
                onSelectTab={setActiveTab}
                onShowToast={addToast}
              />
            )}

            {activeTab === 'integration' && (
              <IntegrationHubView
                catalog={catalog}
                onShowToast={addToast}
              />
            )}

            {activeTab === 'recommender' && (
              <RecommenderView
                catalog={catalog}
                onUpdateCatalog={setCatalog}
                onShowToast={addToast}
              />
            )}

            {activeTab === 'analyze' && (
              <AnalysisView
                metrics={metrics}
                edges={edges}
                clusters={clusters}
                conceptCount={currentProject.concepts.length}
                insightCount={insights.length}
                onNavigateToGraph={() => setActiveTab('graph')}
              />
            )}

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

            {activeTab === 'insights' && (
              <InsightsView
                insights={insights}
                onHighlightConcept={handleHighlightConceptOnGraph}
              />
            )}

            {activeTab === 'export' && (
              <ExportView
                project={currentProject}
                matrix={similarityMatrix}
                edges={edges}
                clusters={clusters}
                metrics={metrics}
                insights={insights}
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
        onCreate={handleCreateProject}
      />

      <RenameProjectModal
        isOpen={isRenameProjectOpen}
        currentName={currentProject.name}
        onClose={() => setIsRenameProjectOpen(false)}
        onRename={handleRenameProject}
      />

      <DeleteProjectModal
        isOpen={isDeleteProjectOpen}
        projectName={currentProject.name}
        onClose={() => setIsDeleteProjectOpen(false)}
        onConfirm={handleDeleteProject}
      />

      <BatchPasteModal
        isOpen={isBatchPasteOpen}
        onClose={() => setIsBatchPasteOpen(false)}
        onImport={handleBatchImport}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
