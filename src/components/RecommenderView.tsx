import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Play,
  Code2,
  TrendingUp,
  Sliders,
  Layers,
  Network,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Building2,
  Cpu,
  Zap,
  Users,
  Globe,
  FileSpreadsheet,
  Eye,
  Brain,
} from 'lucide-react';
import {
  CatalogItem,
  CatalogRecommendation,
  StatusKind,
  WhiteLabelBrand,
  CustomerPersona,
} from '../types';
import {
  CATALOG_CATEGORIES,
  SAMPLE_QUERIES,
  WHITE_LABEL_BRANDS,
} from '../data/catalog';
import { CUSTOMER_PERSONAS } from '../data/personas';
import {
  computeCatalogEmbeddingsWithModel,
  buildCatalogSimilarityMatrix,
  getRecommendationsForItem,
  searchCatalogWithModel,
  simulateKeywordSearch,
  extractTopCatalogEdges,
  ModelChoice,
  EmbedderPipeline,
} from '../utils/recommenderEngine';
import { decomposeSimilarityFeatures } from '../utils/featureAttribution';
import { ProductCard } from './ProductCard';
import { PitchModal } from './PitchModal';
import { ApiConsoleModal } from './ApiConsoleModal';
import { RoiCalculatorModal } from './RoiCalculatorModal';
import { FeedImporterModal } from './FeedImporterModal';
import { ABTestReportModal } from './ABTestReportModal';
import { VisualExplanationLayer } from './VisualExplanationLayer';

declare global {
  interface Window {
    Transformers?: {
      pipeline: (task: string, model: string) => Promise<EmbedderPipeline>;
    };
  }
}

interface RecommenderViewProps {
  catalog: CatalogItem[];
  onUpdateCatalog: (newCatalog: CatalogItem[]) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const RecommenderView: React.FC<RecommenderViewProps> = ({
  catalog,
  onUpdateCatalog,
  onShowToast,
}) => {
  // Brand selection (White-Label showcase)
  const [currentBrand, setCurrentBrand] = useState<WhiteLabelBrand>(WHITE_LABEL_BRANDS[0]);

  // Customer Persona state (Real-time personalization)
  const [selectedPersona, setSelectedPersona] = useState<CustomerPersona>(CUSTOMER_PERSONAS[0]);

  // Main UI Mode: 'showcase' (Product view) | 'comparison' (A/B Test) | 'engine' (Under the hood)
  const [activeMode, setActiveMode] = useState<'showcase' | 'comparison' | 'engine'>('showcase');

  // Modals state
  const [isPitchOpen, setIsPitchOpen] = useState(false);
  const [isApiOpen, setIsApiOpen] = useState(false);
  const [isRoiOpen, setIsRoiOpen] = useState(false);
  const [isFeedImporterOpen, setIsFeedImporterOpen] = useState(false);
  const [isABReportOpen, setIsABReportOpen] = useState(false);

  // Model & State
  const [modelChoice, setModelChoice] = useState<ModelChoice>('e5-small');
  const [embedderInstance, setEmbedderInstance] = useState<EmbedderPipeline | null>(null);
  const [embeddings, setEmbeddings] = useState<Map<number, Float32Array>>(new Map());
  const [similarityMatrix, setSimilarityMatrix] = useState<Float32Array[] | null>(null);

  // Search & Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<CatalogItem>(() => catalog[0] || null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [minSimThreshold, setMinSimThreshold] = useState<number>(0.15);

  const [status, setStatus] = useState<{ text: string; kind: StatusKind }>({
    text: 'Загрузка рекомендательного ядра E5...',
    kind: 'loading',
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CatalogRecommendation[] | null>(null);

  // Visual Explanation layer state
  const [hoveredRecId, setHoveredRecId] = useState<number | null>(null);
  const [visualExplanationMode, setVisualExplanationMode] = useState<'hover' | 'always'>('hover');

  // Graph Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filtered catalog by category
  const filteredCatalog = useMemo(() => {
    if (selectedCategory === 'Все') return catalog;
    return catalog.filter((item) => item.category === selectedCategory);
  }, [catalog, selectedCategory]);

  // Semantic Recommendations for selected item (item-to-item) with real-time Persona Personalization
  const recommendations = useMemo(() => {
    if (!similarityMatrix || !selectedItem) return [];
    const baseRecs = getRecommendationsForItem(
      selectedItem.id,
      catalog,
      similarityMatrix,
      8,
      minSimThreshold
    );

    // If a customer persona is active, re-rank recommendations with persona affinity
    if (selectedPersona.id !== 'neutral') {
      return baseRecs
        .map((rec) => {
          let affinity = 0;
          if (selectedPersona.preferredCategories.includes(rec.item.category)) {
            affinity += 0.15;
          }
          if (rec.item.tags) {
            const matches = rec.item.tags.filter((t) =>
              selectedPersona.affinityTags.some((at) => at.toLowerCase() === t.toLowerCase())
            );
            affinity += matches.length * 0.09;
          }
          const blendedSim = Math.min(0.99, Number((rec.sim * 0.7 + affinity * 0.3).toFixed(2)));
          let why = rec.whyRecommended;
          if (affinity > 0) {
            why = `Персонализировано для «${selectedPersona.name}» (${selectedPersona.role})`;
          }
          return {
            ...rec,
            sim: blendedSim,
            whyRecommended: why,
          };
        })
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 5);
    }

    return baseRecs.slice(0, 5);
  }, [similarityMatrix, selectedItem, catalog, minSimThreshold, selectedPersona]);

  // Active hovered recommendation item
  const hoveredRecommendation = useMemo(() => {
    if (!hoveredRecId) return null;
    return recommendations.find((r) => r.item.id === hoveredRecId) || null;
  }, [hoveredRecId, recommendations]);

  // Feature attribution for the currently hovered recommendation
  const hoveredExplanation = useMemo(() => {
    if (!selectedItem || !hoveredRecommendation) return null;
    return decomposeSimilarityFeatures(
      selectedItem,
      hoveredRecommendation.item,
      hoveredRecommendation.sim,
      selectedPersona
    );
  }, [selectedItem, hoveredRecommendation, selectedPersona]);

  // Top pairwise edges for Engine tab
  const topEdges = useMemo(() => {
    if (!similarityMatrix) return [];
    return extractTopCatalogEdges(catalog, similarityMatrix, 12, minSimThreshold);
  }, [similarityMatrix, catalog, minSimThreshold]);

  // Keyword search comparison simulation
  const keywordResults = useMemo(() => {
    if (!submittedQuery) return [];
    return simulateKeywordSearch(submittedQuery, catalog);
  }, [submittedQuery, catalog]);

  // Load Model & compute embeddings
  const initEngine = async (choice: ModelChoice) => {
    setStatus({ text: 'Инициализация E5 Multilingual...', kind: 'loading' });
    let pipeline: EmbedderPipeline | null = null;

    if (choice !== 'built-in' && typeof window !== 'undefined' && window.Transformers) {
      try {
        const modelId =
          choice === 'e5-small' ? 'Xenova/multilingual-e5-small' : 'Xenova/all-MiniLM-L6-v2';
        pipeline = await window.Transformers.pipeline('feature-extraction', modelId);
        setEmbedderInstance(() => pipeline);
      } catch (err) {
        console.warn('Transformers.js network load fallback:', err);
      }
    }

    try {
      const vecs = await computeCatalogEmbeddingsWithModel(catalog, pipeline, choice);
      setEmbeddings(vecs);
      const matrix = buildCatalogSimilarityMatrix(catalog, vecs);
      setSimilarityMatrix(matrix);
      setStatus({ text: 'Рекомендательный движок готов · 0ms отклик', kind: 'ready' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ text: 'Ошибка: ' + msg, kind: 'error' });
    }
  };

  useEffect(() => {
    initEngine(modelChoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Search Submission
  const handlePerformSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) {
      setSearchResults(null);
      setSubmittedQuery('');
      return;
    }

    setIsSearching(true);
    setSubmittedQuery(q);
    setStatus({ text: 'Семантический поиск по смыслу...', kind: 'loading' });

    try {
      const results = await searchCatalogWithModel(
        q,
        catalog,
        embeddings,
        embedderInstance,
        modelChoice,
        8
      );
      setSearchResults(results);
      if (results.length > 0) {
        setSelectedItem(results[0].item);
      }
      setStatus({ text: `Найдено ${results.length} рекомендаций`, kind: 'ready' });
      onShowToast(`Найдено ${results.length} товаров по смыслу «${q}»`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ text: 'Ошибка поиска: ' + msg, kind: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search and return to catalog
  const handleResetSearch = () => {
    setSearchResults(null);
    setSearchQuery('');
    setSubmittedQuery('');
  };

  // Import items from YML/JSON feed
  const handleImportFeedItems = (newItems: CatalogItem[]) => {
    const existingIds = new Set(catalog.map((c) => c.id));
    const toAdd = newItems.filter((item) => !existingIds.has(item.id));
    if (toAdd.length === 0) {
      onShowToast('Все товары из фида уже присутствуют в каталоге', 'info');
      return;
    }
    const merged = [...catalog, ...toAdd];
    onUpdateCatalog(merged);
    onShowToast(`Импортировано ${toAdd.length} товаров. Пересчитываем векторное поле...`, 'success');
    initEngine(modelChoice);
  };

  // Render Engine Canvas Graph
  useEffect(() => {
    if (activeMode !== 'engine' || !canvasRef.current || !similarityMatrix) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const n = catalog.length;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.38;

    const positions = catalog.map((_, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });

    // Edges
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sim = similarityMatrix[i][j];
        if (sim >= minSimThreshold) {
          const isConnected =
            selectedItem &&
            (catalog[i].id === selectedItem.id || catalog[j].id === selectedItem.id);

          ctx.beginPath();
          ctx.moveTo(positions[i].x, positions[i].y);
          ctx.lineTo(positions[j].x, positions[j].y);

          if (isConnected) {
            ctx.strokeStyle = `rgba(0, 240, 255, ${Math.min(1, sim * 1.5)})`;
            ctx.lineWidth = Math.max(1.8, sim * 4.5);
          } else {
            ctx.strokeStyle = `rgba(180, 120, 255, ${sim * 0.3})`;
            ctx.lineWidth = Math.max(0.7, sim * 2);
          }
          ctx.stroke();
        }
      }
    }

    // Nodes
    catalog.forEach((item, i) => {
      const pos = positions[i];
      const isSelected = selectedItem && selectedItem.id === item.id;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#00f0ff' : '#a855f7';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0b0b13';
      ctx.stroke();

      ctx.font = isSelected
        ? 'bold 11px "JetBrains Mono", monospace'
        : '9px "Inter", sans-serif';
      ctx.fillStyle = isSelected ? '#00f0ff' : '#8a8aa3';
      ctx.fillText(item.title.slice(0, 14), pos.x + 9, pos.y + 3);
    });
  }, [activeMode, catalog, similarityMatrix, selectedItem, minSimThreshold]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#07070c] text-[#e8e8f0] p-4 sm:p-6 selection:bg-[#00f0ff]/20">
      <div className="max-w-[1360px] w-full mx-auto flex flex-col gap-6">
        {/* TOP BRAND & PRESENTATION ACTION BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-[#0e0e18] border border-[#1e1e35] rounded-2xl shadow-xl">
          {/* Brand Presentation Identity */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00f0ff] to-[#b478ff] flex items-center justify-center text-xl shadow-[0_0_20px_rgba(0,240,255,0.3)]">
              {currentBrand.logo}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wide text-[#e8e8f0] mono">
                  {currentBrand.name}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] mono bg-[#3ee89a]/15 text-[#3ee89a] border border-[#3ee89a]/30 font-semibold">
                  Powered by EIDOS Core
                </span>
              </div>
              <div className="text-xs text-[#8a8aa3]">{currentBrand.tagline}</div>
            </div>
          </div>

          {/* 3 Presentation Action Buttons from User Prompt */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setIsPitchOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#b478ff] text-black font-bold text-xs mono shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:opacity-95 transition-all cursor-pointer"
            >
              <Play size={13} fill="black" />
              <span>🎬 2-мин Питч инвестору</span>
            </button>

            <button
              onClick={() => setIsApiOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#141424] hover:bg-[#1a1a30] border border-[#1e1e35] hover:border-[#00f0ff] text-[#e8e8f0] font-semibold text-xs mono transition-all cursor-pointer"
            >
              <Code2 size={13} className="text-[#00f0ff]" />
              <span>⚡ REST API Console</span>
            </button>

            <button
              onClick={() => setIsRoiOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#141424] hover:bg-[#1a1a30] border border-[#1e1e35] hover:border-[#3ee89a] text-[#e8e8f0] font-semibold text-xs mono transition-all cursor-pointer"
            >
              <TrendingUp size={13} className="text-[#3ee89a]" />
              <span>📈 Калькулятор ROI</span>
            </button>

            {/* White-Label Brand Switcher dropdown */}
            <div className="flex items-center gap-1 bg-[#141424] p-1 rounded-xl border border-[#1e1e35]">
              <span className="text-[10px] text-[#8a8aa3] px-2 mono flex items-center gap-1">
                <Building2 size={11} /> Бренд:
              </span>
              {WHITE_LABEL_BRANDS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setCurrentBrand(b);
                    onShowToast(`Переключено на витрину: ${b.name}`, 'info');
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] mono transition-all cursor-pointer ${
                    currentBrand.id === b.id
                      ? 'bg-[#1e1e35] text-[#00f0ff] font-bold'
                      : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
                  }`}
                  title={b.niche}
                >
                  {b.logo} {b.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MODE SWITCHER TABS: Showcase (Product) | A/B Comparison | Engine (Under the hood) */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[#1e1e35] pb-3">
          <div className="flex items-center gap-1 bg-[#0e0e18] p-1 rounded-xl border border-[#1e1e35]">
            <button
              onClick={() => setActiveMode('showcase')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs mono font-bold transition-all cursor-pointer ${
                activeMode === 'showcase'
                  ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                  : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
              }`}
            >
              <span>🛍️ Витрина сервиса</span>
            </button>

            <button
              onClick={() => setActiveMode('comparison')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs mono font-bold transition-all cursor-pointer ${
                activeMode === 'comparison'
                  ? 'bg-[#b478ff]/15 text-[#b478ff] border border-[#b478ff]/30 shadow-[0_0_12px_rgba(180,120,255,0.2)]'
                  : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
              }`}
            >
              <span>⚖️ Сравнение (Обычный поиск vs EIDOS AI)</span>
            </button>

            <button
              onClick={() => setActiveMode('engine')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs mono font-bold transition-all cursor-pointer ${
                activeMode === 'engine'
                  ? 'bg-[#3ee89a]/15 text-[#3ee89a] border border-[#3ee89a]/30 shadow-[0_0_12px_rgba(62,232,154,0.2)]'
                  : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
              }`}
            >
              <span>⚡ Под капотом (ML & Векторы)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs mono text-[#8a8aa3]">
            <span
              className={`w-2 h-2 rounded-full ${
                status.kind === 'loading'
                  ? 'bg-[#fbbf24] animate-pulse shadow-[0_0_8px_#fbbf24]'
                  : 'bg-[#3ee89a] shadow-[0_0_8px_#3ee89a]'
              }`}
            />
            <span className="text-[#e8e8f0] font-medium">{status.text}</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODE 1: SHOWCASE (Product View with Cards & "Why Recommended") */}
        {/* ============================================================ */}
        {activeMode === 'showcase' && (
          <div className="flex flex-col gap-6">
            {/* Search Bar matching user's requirement: "Находит смысл, а не просто слова" */}
            <div className="p-5 bg-[#0e0e18] border border-[#1e1e35] rounded-2xl shadow-xl flex flex-col gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePerformSearch(searchQuery);
                }}
                className="flex gap-2.5"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Например: хочу что-то про космос и время / киберпанк / кофе для бодрости..."
                    className="w-full pl-11 pr-4 py-3.5 bg-[#141424] border border-[#1e1e35] rounded-xl text-sm text-[#e8e8f0] focus:outline-none focus:border-[#00f0ff] focus:shadow-[0_0_20px_rgba(0,240,255,0.15)] transition-all placeholder-[#64748b]"
                  />
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a8aa3]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#b478ff] text-black font-bold text-xs mono hover:opacity-90 shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  <span>Найти по смыслу</span>
                </button>
              </form>

              {/* Sample Queries Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-[#8a8aa3]">
                <span className="shrink-0 mono text-[11px]">Попробуйте запросы:</span>
                {SAMPLE_QUERIES.map((sq) => (
                  <button
                    key={sq}
                    onClick={() => {
                      setSearchQuery(sq);
                      handlePerformSearch(sq);
                    }}
                    className="px-3 py-1 rounded-full bg-[#141424] border border-[#1e1e35] hover:border-[#00f0ff] text-[#e8e8f0] text-[11px] whitespace-nowrap transition-colors cursor-pointer"
                  >
                    «{sq}»
                  </button>
                ))}
              </div>
            </div>

            {/* Real-Time Customer Persona Switcher */}
            <div className="p-4 bg-[#0e0e18] border border-[#1e1e35] rounded-2xl shadow-xl flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#b478ff]" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#e8e8f0]">
                    Симуляция профиля покупателя (Real-Time Persona Affinity)
                  </span>
                </div>
                {selectedPersona.id !== 'neutral' && (
                  <span className="text-[11px] font-mono text-[#3ee89a] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3ee89a]" />
                    Векторный профиль активен: +15% скор к аффинным категориям
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {CUSTOMER_PERSONAS.map((persona) => {
                  const isActive = selectedPersona.id === persona.id;
                  return (
                    <button
                      key={persona.id}
                      onClick={() => {
                        setSelectedPersona(persona);
                        onShowToast(`Профиль покупателя: ${persona.name} (${persona.role})`, 'info');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2 shrink-0 transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-[#1a1a2e] border-[#00f0ff] text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                          : 'bg-[#141424] border-[#1e1e35] text-[#8a8aa3] hover:text-[#e8e8f0] hover:border-[#2a2a40]'
                      }`}
                    >
                      <span className="text-base">{persona.avatar}</span>
                      <div className="text-left">
                        <div className="font-bold leading-tight">{persona.name}</div>
                        <div className="text-[10px] text-[#8a8aa3] leading-tight">{persona.role}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedPersona.id !== 'neutral' && (
                <div className="text-xs text-[#8a8aa3] flex flex-wrap items-center gap-2 pt-1 border-t border-[#1e1e35]/60">
                  <span className="text-[11px] text-[#e8e8f0]">{selectedPersona.tagline}</span>
                  <span className="text-[#1e1e35]">•</span>
                  <span className="text-[11px] font-mono text-[#b478ff]">
                    Аффинность: {selectedPersona.preferredCategories.join(', ') || 'Все'}
                  </span>
                </div>
              )}
            </div>

            {/* Split View: Left = Catalog / Results Grid | Right = Spotlight Recommendations with "Why We Recommend" */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (Catalog / Results) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm uppercase tracking-wider mono text-[#e8e8f0]">
                      {searchResults !== null
                        ? `Результаты по смыслу «${submittedQuery}» (${searchResults.length})`
                        : `Каталог товаров и произведений (${filteredCatalog.length})`}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsFeedImporterOpen(true)}
                      className="px-3 py-1 rounded-lg bg-[#141424] hover:bg-[#1e1e35] border border-[#00f0ff]/30 text-[#00f0ff] font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Импортировать каталог по ссылке на YML/JSON фид"
                    >
                      <Globe size={12} />
                      <span>Импорт YML/URL</span>
                    </button>
                    {searchResults !== null && (
                      <button
                        onClick={handleResetSearch}
                        className="text-xs mono text-[#00f0ff] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw size={11} /> Весь каталог
                      </button>
                    )}
                  </div>
                </div>

                {/* Categories filter pills */}
                {searchResults === null && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {CATALOG_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs mono transition-all cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-bold'
                            : 'bg-[#0e0e18] text-[#8a8aa3] border border-[#1e1e35] hover:text-[#e8e8f0]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[720px] overflow-y-auto pr-1">
                  {searchResults !== null
                    ? searchResults.map((rec) => (
                        <ProductCard
                          key={rec.item.id}
                          item={rec.item}
                          isSelected={selectedItem?.id === rec.item.id}
                          onSelect={setSelectedItem}
                          onAddToCart={(i) => onShowToast(`Добавлено в корзину: ${i.title}`, 'success')}
                        />
                      ))
                    : filteredCatalog.map((item) => (
                        <ProductCard
                          key={item.id}
                          item={item}
                          isSelected={selectedItem?.id === item.id}
                          onSelect={setSelectedItem}
                          onAddToCart={(i) => onShowToast(`Добавлено в корзину: ${i.title}`, 'success')}
                        />
                      ))}
                </div>
              </div>

              {/* Right Column: Spotlight Recommendations & "Why We Recommend" */}
              <div className="lg:col-span-5 flex flex-col gap-4 sticky top-4">
                <div className="p-5 bg-[#0e0e18] border border-[#1e1e35] rounded-2xl shadow-xl flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-[#1e1e35] pb-3">
                    <div>
                      <div className="font-extrabold text-sm text-[#e8e8f0] flex items-center gap-2">
                        <Sparkles size={16} className="text-[#00f0ff]" />
                        <span>Вам может понравиться</span>
                      </div>
                      <div className="text-[11px] text-[#8a8aa3] mt-0.5">
                        Умные рекомендации на основе выбранного объекта
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setVisualExplanationMode((prev) => (prev === 'hover' ? 'always' : 'hover'))}
                        title="Переключить режим слоя объяснений: при наведении или всегда развернут"
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] mono font-bold border transition-all cursor-pointer ${
                          visualExplanationMode === 'always'
                            ? 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/50 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                            : 'bg-[#141424] text-[#8a8aa3] border-[#1e1e35] hover:text-[#e8e8f0] hover:border-[#2e2e46]'
                        }`}
                      >
                        <Eye size={11} />
                        <span>Слой объяснений: {visualExplanationMode === 'always' ? 'Всегда' : 'При наведении'}</span>
                      </button>
                      <span className="px-2 py-0.5 rounded-full text-[10px] mono bg-[#b478ff]/15 text-[#b478ff] border border-[#b478ff]/30 font-bold">
                        Semantic AI
                      </span>
                    </div>
                  </div>

                  {/* Active target showcase banner */}
                  {selectedItem && (
                    <div className="p-3.5 rounded-xl bg-[#141424] border border-[#00f0ff]/30 flex flex-col gap-1.5 transition-all">
                      <div className="flex items-center justify-between text-xs">
                        <span className="mono text-[10px] uppercase text-[#00f0ff] font-bold tracking-wider">
                          Вы просматриваете:
                        </span>
                        <span className="mono text-[10px] text-[#8a8aa3]">{selectedItem.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{selectedItem.icon || '📦'}</span>
                        <span className="font-bold text-sm text-[#e8e8f0]">{selectedItem.title}</span>
                      </div>
                      <div className="text-xs text-[#8a8aa3] leading-relaxed">{selectedItem.description}</div>

                      {/* Dynamic Two-Way Visual Bridge when hovering over a recommendation */}
                      {hoveredExplanation && (
                        <div className="mt-2 pt-2.5 border-t border-[#00f0ff]/25 flex flex-col gap-1.5 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-[#00f0ff] font-bold flex items-center gap-1">
                              <Brain size={12} className="animate-pulse" />
                              <span>Связанные признаки с «{hoveredExplanation.recommendedTitle}»:</span>
                            </span>
                            <span className="text-[#3ee89a] font-bold bg-[#3ee89a]/10 px-1.5 py-0.5 rounded border border-[#3ee89a]/20">
                              {(hoveredExplanation.similarityScore * 100).toFixed(0)}% сходство
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {hoveredExplanation.features.map((feat) => (
                              <span
                                key={feat.id}
                                className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border flex items-center gap-1"
                                style={{
                                  backgroundColor: `${feat.color}15`,
                                  borderColor: `${feat.color}40`,
                                  color: feat.color,
                                }}
                              >
                                <span>{feat.label.split(' ')[0]}</span>
                                <span className="font-bold">+{feat.absoluteContribution}</span>
                              </span>
                            ))}
                            {hoveredExplanation.matchedKeywords.length > 0 && (
                              <span className="text-[10px] text-[#8a8aa3] font-mono">
                                Ключевые термины: {hoveredExplanation.matchedKeywords.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendations with "Why we recommend" and Visual Explanation Layer on hover */}
                  <div className="flex flex-col gap-3 max-h-[580px] overflow-y-auto pr-1">
                    {recommendations.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[#8a8aa3]">
                        Загрузка семантических связей...
                      </div>
                    ) : (
                      recommendations.map((rec) => {
                        const percent = (rec.sim * 100).toFixed(0);
                        const isHovered = hoveredRecId === rec.item.id;
                        const showExplanation = isHovered || visualExplanationMode === 'always';
                        const explanation = selectedItem
                          ? decomposeSimilarityFeatures(selectedItem, rec.item, rec.sim, selectedPersona)
                          : null;

                        return (
                          <div
                            key={rec.item.id}
                            onClick={() => setSelectedItem(rec.item)}
                            onMouseEnter={() => setHoveredRecId(rec.item.id)}
                            onMouseLeave={() => setHoveredRecId(null)}
                            className={`group p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-2.5 relative overflow-hidden ${
                              isHovered
                                ? 'bg-[#14182b] border-[#00f0ff] shadow-[0_0_24px_rgba(0,240,255,0.22)] ring-1 ring-[#00f0ff]/50'
                                : 'bg-[#111120] hover:bg-[#141829] border-[#1e1e35] hover:border-[#00f0ff]/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className="text-2xl">{rec.item.icon || '📦'}</span>
                                <div>
                                  <div className="font-bold text-xs text-[#e8e8f0] group-hover:text-[#00f0ff] transition-colors line-clamp-1">
                                    {rec.item.title}
                                  </div>
                                  <div className="text-[11px] text-[#8a8aa3]">
                                    {rec.item.category} · {rec.item.price || '1 990 ₽'}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isHovered && (
                                  <span className="text-[9px] mono font-bold text-[#00f0ff] bg-[#00f0ff]/15 px-1.5 py-0.5 rounded border border-[#00f0ff]/30 flex items-center gap-1 animate-pulse">
                                    <Brain size={10} />
                                    <span>Слой признаков</span>
                                  </span>
                                )}
                                <span className="text-xs mono font-bold text-[#3ee89a] bg-[#3ee89a]/10 px-2 py-0.5 rounded border border-[#3ee89a]/20">
                                  {percent}% совпадение
                                </span>
                              </div>
                            </div>

                            {/* PROGRESS BAR */}
                            <div className="w-full bg-[#0a0a12] h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-[#00f0ff] via-[#b478ff] to-[#3ee89a] h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, rec.sim * 100)}%` }}
                              />
                            </div>

                            {/* "WHY WE RECOMMEND THIS" */}
                            {rec.whyRecommended && (
                              <div className="p-2 rounded-lg bg-[#0e0e18] border border-[#1e1e35] text-[11px] text-[#8a8aa3] leading-relaxed flex items-start gap-1.5">
                                <Info size={13} className="text-[#00f0ff] shrink-0 mt-0.5" />
                                <div>
                                  <strong className="text-[#e8e8f0] font-medium">Почему рекомендуем: </strong>
                                  <span>{rec.whyRecommended}</span>
                                </div>
                              </div>
                            )}

                            {/* VISUAL EXPLANATION LAYER (Activated on hover or always if toggled) */}
                            {showExplanation && explanation ? (
                              <VisualExplanationLayer
                                explanation={explanation}
                                targetIcon={selectedItem?.icon}
                                recommendedIcon={rec.item.icon}
                              />
                            ) : (
                              /* Hover Affordance CTA when collapsed */
                              <div className="flex items-center justify-between text-[10px] font-mono text-[#8a8aa3] pt-1 border-t border-[#1e1e35]/60">
                                <span className="flex items-center gap-1.5 group-hover:text-[#00f0ff] transition-colors">
                                  <Eye size={11} className="text-[#00f0ff]" />
                                  <span>Наведите для визуализации признаков сходства</span>
                                </span>
                                <span className="text-[#3ee89a] font-semibold">
                                  {explanation?.topLatentConcept.split(',')[0] || 'Векторное сходство'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODE 2: COMPARISON (Traditional Keyword Search vs EIDOS AI)   */}
        {/* ============================================================ */}
        {activeMode === 'comparison' && (
          <div className="p-6 bg-[#0e0e18] border border-[#1e1e35] rounded-2xl shadow-xl flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-[#e8e8f0] mono">
                  Интерактивное сравнение: Обычный поиск VS Движок EIDOS
                </h3>
                <p className="text-sm text-[#8a8aa3] mt-1">
                  Попробуйте один и тот же запрос в двух парадигмах: слепой поиск по буквам против понимания смысла.
                </p>
              </div>
              <button
                onClick={() => setIsABReportOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1f1f33] hover:bg-[#2a2a46] text-[#3ee89a] font-mono text-xs font-bold border border-[#3ee89a]/30 transition-all cursor-pointer shrink-0 shadow-[0_0_12px_rgba(62,232,154,0.15)]"
              >
                <FileSpreadsheet size={15} />
                <span>📊 Экспорт бенчмарка (CSV / PDF)</span>
              </button>
            </div>

            {/* Test input bar */}
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите например: «космос и время» или «киберпанк»..."
                className="flex-1 px-4 py-3 bg-[#141424] border border-[#1e1e35] rounded-xl text-sm text-[#e8e8f0] focus:outline-none focus:border-[#b478ff]"
              />
              <button
                onClick={() => handlePerformSearch(searchQuery || 'космос и время')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#b478ff] text-black font-bold text-xs mono hover:opacity-90 cursor-pointer"
              >
                Сравнить результаты
              </button>
            </div>

            {/* 2-Column Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Traditional Search (Keyword-based) */}
              <div className="p-5 rounded-xl bg-[#141424] border border-[#ff6b9d]/30 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#ff6b9d]/20 pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-[#ff6b9d]" />
                    <span className="font-bold text-sm text-[#ff6b9d] mono">
                      Обычный поиск (по ключевым словам)
                    </span>
                  </div>
                  <span className="text-[11px] mono text-[#8a8aa3]">SQL LIKE / Elastic naive</span>
                </div>

                <div className="text-xs text-[#8a8aa3]">
                  Ищет лишь строгое вхождение подстроки. Если слов нет в описании — товар потерян.
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  {keywordResults.length === 0 ? (
                    <div className="py-10 text-center text-xs text-[#ff6b9d] bg-[#0e0e18] rounded-lg border border-[#ff6b9d]/20">
                      ❌ Ничего не найдено. Поисковик не понял запрос «{submittedQuery || '...'}».
                    </div>
                  ) : (
                    keywordResults.slice(0, 4).map((kr) => (
                      <div
                        key={kr.item.id}
                        className="p-3 rounded-lg bg-[#0e0e18] border border-[#1e1e35] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span>{kr.item.icon || '📦'}</span>
                          <span className="font-semibold text-[#e8e8f0]">{kr.item.title}</span>
                        </div>
                        <span className="mono text-[10px] text-[#ff6b9d] bg-[#ff6b9d]/10 px-2 py-0.5 rounded">
                          Слова: {kr.matchedWords.join(', ')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: EIDOS AI (Semantic Vector-based) */}
              <div className="p-5 rounded-xl bg-[#141424] border border-[#00f0ff]/30 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#00f0ff]/20 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-[#00f0ff]" />
                    <span className="font-bold text-sm text-[#00f0ff] mono">
                      EIDOS AI (Семантический поиск по смыслу)
                    </span>
                  </div>
                  <span className="text-[11px] mono text-[#3ee89a]">E5 Vector Engine</span>
                </div>

                <div className="text-xs text-[#8a8aa3]">
                  Понимает контекст, концепты времени, гравитации, симуляции даже без прямых слов.
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  {!searchResults || searchResults.length === 0 ? (
                    <div className="py-10 text-center text-xs text-[#8a8aa3] bg-[#0e0e18] rounded-lg border border-[#1e1e35]">
                      Нажмите «Сравнить результаты» выше для демонстрации.
                    </div>
                  ) : (
                    searchResults.slice(0, 4).map((sr) => (
                      <div
                        key={sr.item.id}
                        className="p-3 rounded-lg bg-[#0e0e18] border border-[#00f0ff]/30 flex flex-col gap-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{sr.item.icon || '📦'}</span>
                            <span className="font-semibold text-[#e8e8f0]">{sr.item.title}</span>
                          </div>
                          <span className="mono text-xs font-bold text-[#3ee89a] bg-[#3ee89a]/10 px-2 py-0.5 rounded">
                            {(sr.sim * 100).toFixed(0)}% совпадение
                          </span>
                        </div>
                        <div className="text-[11px] text-[#8a8aa3]">{sr.whyRecommended}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODE 3: ENGINE (Under The Hood / ML & Embeddings Map)         */}
        {/* ============================================================ */}
        {activeMode === 'engine' && (
          <div className="p-6 bg-[#0e0e18] border border-[#1e1e35] rounded-2xl shadow-xl flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[#1e1e35] pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-[#e8e8f0] mono flex items-center gap-2">
                  <Cpu size={20} className="text-[#3ee89a]" />
                  <span>Архитектура ядра EIDOS (Under The Hood)</span>
                </h3>
                <p className="text-xs text-[#8a8aa3] mt-0.5">
                  Эмбеддинги E5 Multilingual, косинусная матрица сходства и топологический граф связей.
                </p>
              </div>

              {/* Threshold slider */}
              <div className="flex items-center gap-2 text-xs mono text-[#8a8aa3]">
                <Sliders size={13} />
                <span>Порог связей:</span>
                <span className="text-[#00f0ff] font-bold">{(minSimThreshold * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min={0.05}
                  max={0.5}
                  step={0.05}
                  value={minSimThreshold}
                  onChange={(e) => setMinSimThreshold(parseFloat(e.target.value))}
                  className="w-28 h-1 bg-[#141424] rounded appearance-none cursor-pointer accent-[#00f0ff]"
                />
              </div>
            </div>

            {/* Interactive Canvas Graph */}
            <div className="w-full h-[360px] bg-[#0a0a10] rounded-xl border border-[#1e1e35] relative overflow-hidden flex items-center justify-center">
              <canvas ref={canvasRef} className="w-full h-full block" />
              <div className="absolute bottom-3 left-4 text-xs mono text-[#8a8aa3] bg-[#0e0e18]/80 px-2.5 py-1 rounded border border-[#1e1e35]">
                ● Бирюзовые линии: связи с выбранным объектом «{selectedItem?.title || 'Нет'}»
              </div>
            </div>

            {/* Top Pairwise Semantic Edges */}
            <div className="flex flex-col gap-2">
              <span className="text-xs mono uppercase tracking-wider text-[#8a8aa3] font-bold">
                Сильнейшие межтоварные семантические пары (Top Edges):
              </span>
              <div className="flex flex-wrap gap-2">
                {topEdges.map((edge, idx) => (
                  <span
                    key={`${edge.fromId}-${edge.toId}-${idx}`}
                    className="inline-flex items-center gap-2 bg-[#141424] border border-[#1e1e35] hover:border-[#00f0ff]/50 px-3 py-1.5 rounded-full text-xs transition-colors"
                  >
                    <strong className="text-[#e8e8f0] font-medium">{edge.from}</strong>
                    <span className="text-[#b478ff]">↔</span>
                    <strong className="text-[#e8e8f0] font-medium">{edge.to}</strong>
                    <span className="mono text-[#3ee89a] font-bold text-[11px] bg-[#3ee89a]/10 px-1.5 py-0.5 rounded">
                      {(edge.sim * 100).toFixed(0)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PitchModal
        isOpen={isPitchOpen}
        onClose={() => setIsPitchOpen(false)}
        onSelectItem={(item) => {
          setSelectedItem(item);
          setActiveMode('showcase');
        }}
        onSearchQuery={(q) => {
          setSearchQuery(q);
          handlePerformSearch(q);
          setActiveMode('comparison');
        }}
      />

      <ApiConsoleModal
        isOpen={isApiOpen}
        onClose={() => setIsApiOpen(false)}
        catalog={catalog}
      />

      <RoiCalculatorModal
        isOpen={isRoiOpen}
        onClose={() => setIsRoiOpen(false)}
        onOpenPitch={() => setIsPitchOpen(true)}
      />

      <FeedImporterModal
        isOpen={isFeedImporterOpen}
        onClose={() => setIsFeedImporterOpen(false)}
        onImportItems={handleImportFeedItems}
        onShowToast={onShowToast}
      />

      <ABTestReportModal
        isOpen={isABReportOpen}
        onClose={() => setIsABReportOpen(false)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
