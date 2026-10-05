import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Sparkles,
  Terminal,
  CheckCircle2,
  Play,
  RotateCcw,
  Copy,
  Check,
  GitPullRequest,
  ShieldCheck,
  Zap,
  Code2,
  Layers,
  ArrowRight,
  GitBranch,
  Bot,
  Activity,
  Workflow,
  Search,
  BookOpen,
  Send,
  Boxes,
} from 'lucide-react';
import { CatalogItem } from '../types';

interface MultiAgentStudioViewProps {
  catalog: CatalogItem[];
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onNavigateToRecommender?: () => void;
}

interface AgentProfile {
  id: string;
  name: string;
  codename: string;
  role: string;
  specialty: string;
  avatar: string;
  color: string;
  borderColor: string;
  bgColor: string;
  status: 'idle' | 'thinking' | 'synthesizing' | 'verified';
  tasksCompleted: number;
}

interface MissionPreset {
  id: string;
  title: string;
  badge: string;
  objective: string;
  steps: {
    architect: string;
    prompt: string;
    code: string;
    qa: string;
    ops: string;
    sre: string;
  };
  generatedPrompt: string;
  codeSnippet: string;
  testOutput: string;
  prDetails: {
    branch: string;
    title: string;
    commit: string;
    checks: string[];
  };
}

const MISSIONS: MissionPreset[] = [
  {
    id: 'multi-interest',
    title: 'Multi-Interest Dynamic User Tower (MIND)',
    badge: 'Algorithmic RecSys',
    objective:
      'Ликвидировать проблему единого усредненного вектора пользователя через динамическую кластеризацию истории в K капсул интересов с Spherical K-Means и температурой softmax.',
    steps: {
      architect:
        'Архитектурный анализ: монолитный вектор пользователя приводит к размыванию интересов («купил книгу по философии» + «искал механическую клавиатуру»). Формулируем модель с K=3 капсулами, динамическим роутингом и L2-нормализацией.',
      prompt:
        'Генерация формального промпта: Staff ML Engineer spec с контрактом MultiInterestProfile, routingIterations=4, temperature=0.2, fallback на single capsule при пустой истории.',
      code:
        'Синтез модуля `packages/core/src/adaptive/multi-interest-tower.ts` с матричным soft assignment, пересчетом центроидов и фильтрацией пустых кластеров.',
      qa:
        'Запуск vitest: 5/5 тестов пройдены (empty history, single-interest fallback, multi-cluster separation, recency decay weighting). Задержка роутинга: 0.42мс.',
      ops:
        'CI/CD: GitHub Actions `ci.yml` валидирует сборку, lint, TypeScript strict types. Создание PR #42 «feat(core): dynamic multi-interest capsules».',
      sre:
        'SRE верификация: Latency p95: 1.12ms, Throughput: 14,200 req/sec, Zero memory leaks under 10k profile cycles.',
    },
    generatedPrompt: `РОЛЬ: Staff ML Systems Engineer (RecSys & Dense Retrieval)
ЗАДАЧА: Реализовать двухстадийный динамический роутинг интересов пользователя (MIND) в packages/core/src/adaptive/multi-interest-tower.ts.
ТРЕБОВАНИЯ:
1. Вычисление до maxInterests векторов интересов на основе истории item embeddings.
2. Применение Spherical K-Means c softmax soft-assignment: p_{ik} = softmax(s_{ik} / temperature).
3. Экспоненциальное затухание по времени: w_i = exp(-decayRate * daysAgo).
4. Fallback: при пустой истории возвращать единичный нулевой вектор; при < 2 товаров — единичный вектор.
5. Инкапсуляция в класс MultiInterestUserTower с асинхронным методом buildProfile(userId, history, embResolver).
6. 100% покрытие unit-тестами в vitest.`,
    codeSnippet: `export class MultiInterestUserTower {
  constructor(private readonly config: MultiInterestConfig) {}

  public async buildProfile(
    userId: string,
    history: string[],
    resolveEmbedding: (id: string) => Promise<Float32Array | null>
  ): Promise<MultiInterestProfile> {
    if (history.length === 0) {
      return { userId, history, interests: [{ id: 'default', vector: new Float32Array(384), weight: 1.0 }], updatedAt: Date.now() };
    }
    // Dynamic routing with spherical k-means
    const items = await this.resolveVectors(history, resolveEmbedding);
    return this.clusterInterests(userId, history, items);
  }
}`,
    testOutput: `✓ packages/core/src/tests/adaptive/multi-interest-tower.test.ts (5 tests) 7ms
  ✓ empty history produces valid profile with single capsule
  ✓ single item history returns single normalized interest
  ✓ diverse items cluster into distinct interest centroids
  ✓ recency decay applies correct weighting to older items
  ✓ soft-assignment temperature converges within 4 iterations
Tests: 5 passed (5)`,
    prDetails: {
      branch: 'feature/mind-dynamic-routing',
      title: 'feat(core): Multi-Interest Capsule Tower & Spherical K-Means',
      commit: '8b4d1a9',
      checks: [
        'Lint & TypeScript Strict: Passed',
        'Vitest Coverage > 90%: Passed',
        'Bundle Size Budget: +4.2 KB (Well within limit)',
        'CodeQL Security Scan: 0 Alerts',
      ],
    },
  },
  {
    id: 'contextual-bandits',
    title: 'Contextual Bandits (LinUCB & Thompson Sampling)',
    badge: 'Reinforcement Learning',
    objective:
      'Предотвратить информационные пузыри и деградацию каталога за счет динамического балансирования Exploration vs Exploitation через формулу Sherman-Morrison.',
    steps: {
      architect:
        'Формулируем модель многоруких бандитов с контекстом: $A_a \\in \\mathbb{R}^{d \\times d}$, $b_a \\in \\mathbb{R}^d$. Для O(d^2) обновления используем инкрементальное обновление обратной матрицы Sherman-Morrison.',
      prompt:
        'Спецификация для BanditExplorer: выбор режима LinUCB (с параметром alpha) и Thompson Sampling (с гауссовым сэмплированием через Box-Muller).',
      code:
        'Реализация `packages/core/src/adaptive/bandit-explorer.ts`. Методы: predictArm, scoreCandidates, update, evictStaleArms.',
      qa:
        'Vitest: 5/5 тестов пройдены. Проверено: неисследованные руки получают бонус неопределенности, позитивный фидбек увеличивает ожидаемый payoff.',
      ops:
        'GitHub Actions: проверена совместимость версий Node 20 и 22, автогенерация документации в docs/API.md.',
      sre:
        'Latency инкрементального обновления вектора: 0.08мс (без аллокаций больших массивов в цикле).',
    },
    generatedPrompt: `РОЛЬ: Senior RecSys & Reinforcement Learning Engineer
ЗАДАЧА: Разработать модуль контекстных бандитов BanditExplorer в packages/core/src/adaptive/bandit-explorer.ts.
ФОРМУЛЫ И ТРЕБОВАНИЯ:
1. LinUCB Score: score = \\hat{\\theta}^T x + \\alpha \\sqrt{x^T A^{-1} x}, где \\hat{\\theta} = A^{-1} b.
2. Инкрементальное обновление A^{-1} по формуле Шермана-Моррисона:
   A_{t+1}^{-1} = A_t^{-1} - \\frac{A_t^{-1} x x^T A_t^{-1}}{1 + x^T A_t^{-1} x}.
3. Поддержка Thompson Sampling через сэмплирование нормального вектора: \\tilde{\\theta} \\sim \\mathcal{N}(\\hat{\\theta}, v^2 A^{-1}).
4. LRU эвикция для предотвращения утечек памяти при миллионах кандидатов.`,
    codeSnippet: `export class BanditExplorer {
  public predictArm(armId: string, context: Float32Array): BanditArmScore {
    const arm = this.getOrInitArm(armId);
    const expectedPayoff = dot(arm.thetaHat, context);
    const variance = quadraticForm(context, arm.aInv);
    const bonus = this.config.alpha * Math.sqrt(Math.max(0, variance));
    return { armId, score: expectedPayoff + bonus, expectedPayoff, explorationBonus: bonus };
  }
}`,
    testOutput: `✓ packages/core/src/tests/adaptive/bandit-explorer.test.ts (5 tests) 6ms
  ✓ LinUCB provides higher exploration bonus to unpulled arms
  ✓ positive reward increases expected payoff
  ✓ Sherman-Morrison rank-1 update maintains precision
  ✓ Thompson sampling explores uncertain arms with probabilistic variance
  ✓ arm eviction maintains bounded memory usage
Tests: 5 passed (5)`,
    prDetails: {
      branch: 'feature/contextual-bandits-linucb',
      title: 'feat(adaptive): LinUCB & Thompson Sampling with Sherman-Morrison',
      commit: '3f92c10',
      checks: [
        'TypeCheck: 0 Errors',
        'Vitest Unit Tests: 5/5 Green',
        'Memory Leaks Check: Passed (0 leaks in 100k updates)',
        'Dependency Review: Clean',
      ],
    },
  },
  {
    id: 'hnsw-int8',
    title: 'HNSW Indexing & INT8 Scalar Quantization',
    badge: 'High-Scale Vector ANN',
    objective:
      'Масштабировать семантический поиск до 1,000,000+ векторов с субмиллисекундным kNN поиском и сжатием оперативной памяти на 75% без потери точности.',
    steps: {
      architect:
        'Проектирование иерархического графа малого мира (Malkov & Yashunin, 2018) + симметричное скалярное квантование Float32Array в Int8Array. Ускорение скалярного произведения на целых числах.',
      prompt:
        'Спецификация для ScalarQuantizer и HNSWIndex: maxElements, m=16, efConstruction=64, efSearch=32. Cosine distance на квантованных векторах.',
      code:
        'Реализация `packages/core/src/quantization.ts` и `packages/core/src/hnsw.ts`. Многоуровневые списки соседей, приоритетные очереди кандидатов.',
      qa:
        'Тесты: 5/5 пройдены. Сжатие памяти ровно в 4 раза (с 1536 байт до 384 байт на вектор). Точность восстановления косинусного сходства > 0.99.',
      ops:
        'GitHub Actions: запуск стресс-теста бенчмарка в scripts/benchmark.ts, валидация отсутствия деградации пропускной способности.',
      sre:
        'ANN Recall@10: 97.8%, Время kNN запроса: 0.65мс против 18.4мс у линейного перебора (ускорение в 28 раз).',
    },
    generatedPrompt: `РОЛЬ: Principal Systems & High-Performance Computing Engineer
ЗАДАЧА: Создать модуль симметричного INT8 квантования и структуру индекса HNSW в packages/core/src/hnsw.ts.
ТРЕБОВАНИЯ:
1. ScalarQuantizer: scale = max(|v_i|) / 127, data[i] = round(v_i / scale).
2. INT8 скалярное произведение: dot(u, v) = scale_u * scale_v * sum(u_q[i] * v_q[i]).
3. Иерархический граф HNSW с логарифмическим распределением слоев: layer = floor(-ln(rand()) * mL).
4. kNN поиск от верхнего слоя до нижнего L0 с использованием эвристики отбора соседей.
5. 100% совместимость с браузерным и Node.js рантаймом.`,
    codeSnippet: `export class ScalarQuantizer {
  public static quantize(vector: Float32Array, id?: string): QuantizedVector {
    let maxAbs = 0;
    for (let i = 0; i < vector.length; i++) {
      const abs = Math.abs(vector[i]);
      if (abs > maxAbs) maxAbs = abs;
    }
    const scale = maxAbs === 0 ? 1 : maxAbs / 127;
    const data = new Int8Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      data[i] = Math.round(vector[i] / scale);
    }
    return { id, data, scale, norm: 1.0 };
  }
}`,
    testOutput: `✓ packages/core/src/tests/hnsw-quantization.test.ts (5 tests) 58ms
  ✓ achieves exactly 4x memory footprint reduction
  ✓ reconstructed cosine similarity exceeds 0.99 fidelity
  ✓ HNSW hierarchical index inserts elements across layers
  ✓ sub-millisecond kNN recall matches brute-force top candidates
  ✓ serialized index can be saved and restored
Tests: 5 passed (5)`,
    prDetails: {
      branch: 'feature/hnsw-ann-quantization',
      title: 'feat(core): HNSW Index & Symmetric INT8 Scalar Quantization',
      commit: '7a18b4e',
      checks: [
        'RAM Profiler: 75% memory drop confirmed',
        'ANN Accuracy Benchmark: 98.2% Recall',
        'Vitest Suite: 5/5 Passed',
        'Zero Dependencies: Pure TypeScript',
      ],
    },
  },
  {
    id: 'conversational-steering',
    title: 'Conversational Vector Steering & Explainability',
    badge: 'Interactive AI',
    objective:
      'Дать пользователю возможность в реальном времени сдвигать целевой вектор естественным языком («как этот товар, но легче и в белом цвете») с прозрачным объяснением графа причин.',
    steps: {
      architect:
        'Формулируем проекцию дельта-векторов: $v_{target} = \\text{normalize}(v_{base} + \\sum w_i \\Delta v_i^+ - \\sum w_j \\Delta v_j^-)$. Модуль объяснимости на основе дерева признаков и Knowledge Graph связей.',
      prompt:
        'Спецификация VectorSteering и ExplainabilityEngine в packages/core/src/adaptive/explainability-steering.ts.',
      code:
        'Реализация классов VectorSteering, ExplainabilityEngine с генерацией структурированных атрибуций и текстовых обоснований на русском и английском языках.',
      qa:
        'Vitest: 6/6 тестов пройдены. Проверены позитивные/негативные модификаторы, весовая балансировка и построение графа связей.',
      ops:
        'Обновление документации API, интеграция в фронтенд-компонент AdaptivePanel и 3D Canvas.',
      sre:
        'Инференс дельта-проекции: < 0.05мс, объяснение рекомендации: 0.12мс.',
    },
    generatedPrompt: `РОЛЬ: Lead AI UX & Cognitive Systems Engineer
ЗАДАЧА: Разработать модуль управляемого векторного поиска (Vector Steering) и объяснимости (ExplainabilityEngine).
ФОРМУЛИРОВКА:
1. VectorSteering.steer(baseVector, modifiers):
   Сложение позитивных дельт и вычитание негативных с последующей L2-нормализацией.
2. ExplainabilityEngine.explain(candidateId, features, config, userHistory, kgPath):
   Расчет процентного вклада каждого фактора (семантика, популярность, свежесть, граф) и генерация понятного текстового резюме.
3. Полная типизация TypeScript и покрытие тестами.`,
    codeSnippet: `export class VectorSteering {
  public static steer(baseVector: Float32Array, modifiers: SteeringModifier[]): Float32Array {
    const steered = new Float32Array(baseVector);
    for (const mod of modifiers) {
      const sign = mod.type === 'positive' ? 1.0 : -1.0;
      for (let i = 0; i < steered.length; i++) {
        steered[i] += sign * mod.weight * mod.vector[i];
      }
    }
    return normalizeL2(steered);
  }
}`,
    testOutput: `✓ packages/core/src/tests/adaptive/explainability-steering.test.ts (6 tests) 7ms
  ✓ positive modifiers shift vector towards target direction
  ✓ negative modifiers penalize undesired concepts
  ✓ natural language explainability highlights top contributing features
  ✓ bilingual generation (RU/EN) produces clean summaries
  ✓ knowledge graph paths are incorporated into attribution tree
Tests: 6 passed (6)`,
    prDetails: {
      branch: 'feature/conversational-vector-steering',
      title: 'feat(adaptive): Natural Language Vector Steering & Graph Explanations',
      commit: '9c55f21',
      checks: [
        'TypeScript Compilation: Clean',
        'Vitest: 6/6 Green',
        'Explainability Precision: 100% Attribution Sum',
        'Docs: Updated in README & SDK',
      ],
    },
  },
];

export const MultiAgentStudioView: React.FC<MultiAgentStudioViewProps> = ({
  catalog,
  onShowToast,
  onNavigateToRecommender,
}) => {
  const [selectedMission, setSelectedMission] = useState<MissionPreset>(MISSIONS[0]);
  const [activeTab, setActiveTab] = useState<'flow' | 'prompt' | 'code' | 'qa' | 'github'>('flow');
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Agent States
  const [agents, setAgents] = useState<AgentProfile[]>([
    {
      id: 'architect',
      name: 'Neo-Architect',
      codename: 'AGENT-01',
      role: 'Chief AI & RecSys Architect',
      specialty: 'Algorithmic Formulations, Loss Optimization, Topology Design',
      avatar: '🧠',
      color: '#00f0ff',
      borderColor: 'border-cyan-500/40',
      bgColor: 'bg-cyan-500/10',
      status: 'idle',
      tasksCompleted: 42,
    },
    {
      id: 'prompt',
      name: 'Apex-Prompt',
      codename: 'AGENT-02',
      role: 'Prompt & RFC Engineer',
      specialty: 'Formal Specifications, LLM Instruction Tuning, System Contracts',
      avatar: '📝',
      color: '#b478ff',
      borderColor: 'border-purple-500/40',
      bgColor: 'bg-purple-500/10',
      status: 'idle',
      tasksCompleted: 38,
    },
    {
      id: 'code',
      name: 'Codex-Dev',
      codename: 'AGENT-03',
      role: 'Core Systems Developer',
      specialty: 'High-Performance TypeScript, SIMD Math, WebGL 3D Shaders',
      avatar: '⚡',
      color: '#3ee89a',
      borderColor: 'border-emerald-500/40',
      bgColor: 'bg-emerald-500/10',
      status: 'idle',
      tasksCompleted: 56,
    },
    {
      id: 'qa',
      name: 'Sentinel-QA',
      codename: 'AGENT-04',
      role: 'Verification & Test Lead',
      specialty: 'Vitest Unit & Integration Suites, Zero Regression Verification',
      avatar: '🛡️',
      color: '#f59e0b',
      borderColor: 'border-amber-500/40',
      bgColor: 'bg-amber-500/10',
      status: 'idle',
      tasksCompleted: 49,
    },
    {
      id: 'ops',
      name: 'Atlas-Ops',
      codename: 'AGENT-05',
      role: 'DevOps & GitHub Architect',
      specialty: 'GitHub Actions CI/CD, Automated PRs, CodeQL Security',
      avatar: '🚀',
      color: '#f43f5e',
      borderColor: 'border-rose-500/40',
      bgColor: 'bg-rose-500/10',
      status: 'idle',
      tasksCompleted: 37,
    },
    {
      id: 'sre',
      name: 'Vanguard-SRE',
      codename: 'AGENT-06',
      role: 'Site Reliability & Latency Auditor',
      specialty: 'Sub-millisecond Latency, RAM Profiling, High-Load Telemetry',
      avatar: '📊',
      color: '#38bdf8',
      borderColor: 'border-sky-500/40',
      bgColor: 'bg-sky-500/10',
      status: 'idle',
      tasksCompleted: 44,
    },
  ]);

  const runSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setCurrentStep(1);
    onShowToast(`Запущен автономный мульти-агентный цикл: ${selectedMission.title}`, 'info');

    // Simulate multi-agent step progression
    const timers = [
      setTimeout(() => setCurrentStep(2), 1200),
      setTimeout(() => setCurrentStep(3), 2600),
      setTimeout(() => setCurrentStep(4), 4000),
      setTimeout(() => setCurrentStep(5), 5400),
      setTimeout(() => setCurrentStep(6), 6800),
      setTimeout(() => {
        setIsSimulating(false);
        setCurrentStep(7);
        onShowToast(`Цикл завершён: Код синтезирован, 100% тестов пройдены, PR готов!`, 'success');
      }, 8200),
    ];

    return () => timers.forEach(clearTimeout);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(selectedMission.generatedPrompt);
    setCopiedPrompt(true);
    onShowToast('Инженерный промпт скопирован в буфер', 'success');
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(selectedMission.codeSnippet);
    setCopiedCode(true);
    onShowToast('Код скопирован в буфер', 'success');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#07070c] text-[#e8e8f0] p-4 sm:p-6 selection:bg-[#00f0ff]/20">
      <div className="max-w-[1380px] w-full mx-auto flex flex-col gap-6">
        {/* HERO TITLE & MULTI-AGENT ORCHESTRATION HEADER */}
        <div className="p-6 bg-gradient-to-r from-[#0d0e1a] via-[#101222] to-[#0d0e1a] border border-[#1e2338] rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[450px] h-[250px] bg-gradient-to-bl from-cyan-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col gap-2 max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.2)]">
                  <Workflow className="w-3.5 h-3.5 animate-pulse" />
                  <span>AUTONOMOUS MULTI-AGENT MATRIX</span>
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  6 SPECIALIZED ROLES
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  88/88 TESTS PASSED (100%)
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                Центр Мульти-Агентной Разработки & Деплоя EIDOS
              </h1>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                Специализированная сеть автономных ИИ-агентов полного цикла: от математической идеи и
                составления промптов до синтеза высокопроизводительного кода, прогона unit-тестов,
                автоматического аудита безопасности и публикации в GitHub.
              </p>
            </div>

            {/* Simulation Trigger Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <button
                onClick={runSimulation}
                disabled={isSimulating}
                className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer ${
                  isSimulating
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse cursor-wait'
                    : 'bg-gradient-to-r from-cyan-400 via-sky-500 to-purple-600 text-black hover:opacity-95 shadow-[0_0_20px_rgba(0,240,255,0.35)]'
                }`}
              >
                {isSimulating ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    <span>Агенты работают ({currentStep}/6)…</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Запустить Multi-Agent Цикл</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 6 SPECIALIZED AGENTS DISPLAY GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {agents.map((agent, idx) => {
            const isActive = isSimulating && currentStep === idx + 1;
            const isCompleted = currentStep > idx + 1 || currentStep === 7;

            return (
              <div
                key={agent.id}
                className={`p-3.5 rounded-xl border transition-all duration-300 relative flex flex-col justify-between ${
                  isActive
                    ? 'bg-[#141828] border-cyan-400 shadow-[0_0_18px_rgba(0,240,255,0.3)] scale-[1.02]'
                    : isCompleted
                    ? 'bg-[#0c0e17] border-emerald-500/40'
                    : 'bg-[#0a0c14] border-[#1b2032] opacity-85 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-2xl p-1.5 rounded-lg bg-[#141724] border border-[#202538]">
                    {agent.avatar}
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-[#141724] text-[#64748b] border-[#1e2335]'
                    }`}
                  >
                    {isActive ? 'ACTIVE' : isCompleted ? 'DONE' : agent.codename}
                  </span>
                </div>

                <div>
                  <div className="font-mono text-xs font-bold text-white leading-tight">
                    {agent.name}
                  </div>
                  <div className="text-[10px] text-[#38bdf8] font-mono leading-tight mt-0.5">
                    {agent.role}
                  </div>
                  <div className="text-[9px] text-[#64748b] mt-1.5 leading-snug line-clamp-2">
                    {agent.specialty}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-[#181d2e] flex items-center justify-between text-[10px] font-mono text-[#8a8aa3]">
                  <span>Задач: {agent.tasksCompleted}</span>
                  {isCompleted && (
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> OK
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* MISSION SELECTOR TABS */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-mono uppercase tracking-wider text-[#64748b] font-semibold flex items-center gap-2">
            <Boxes className="w-3.5 h-3.5 text-cyan-400" />
            <span>Выберите исследовательскую задачу для агентов:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {MISSIONS.map((m) => {
              const isSelected = selectedMission.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMission(m);
                    setCurrentStep(0);
                    onShowToast(`Выбрана задача: ${m.title}`, 'info');
                  }}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#121626] border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                      : 'bg-[#0a0c14] border-[#1b2032] hover:border-[#2a324d] hover:bg-[#0f121d]'
                  }`}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        {m.badge}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
                      )}
                    </div>
                    <div className="font-mono text-xs font-bold text-white mt-1">{m.title}</div>
                    <div className="text-[11px] text-[#94a3b8] line-clamp-2 leading-relaxed">
                      {m.objective}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#181d2e] flex items-center justify-between text-[10px] font-mono text-cyan-400">
                    <span>Подробнее</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* WORKSPACE & ARTIFACTS VIEW */}
        <div className="bg-[#0a0c14] border border-[#1b2032] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Tabs bar */}
          <div className="flex items-center justify-between px-5 pt-3 border-b border-[#1b2032] bg-[#0c0f1a] overflow-x-auto">
            <div className="flex items-center gap-1">
              {[
                { key: 'flow', label: '🔄 Поток выполнения (Agent Flow)', icon: Workflow },
                { key: 'prompt', label: '📜 Эталонный Промпт (Prompt Spec)', icon: Terminal },
                { key: 'code', label: '⚡ Реализация в Ядре (Code)', icon: Code2 },
                { key: 'qa', label: '🧪 Тестирование & QA (Vitest)', icon: ShieldCheck },
                { key: 'github', label: '🐙 GitHub CI/CD & PR Record', icon: GitPullRequest },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`px-4 py-2.5 rounded-t-lg font-mono text-xs transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#121626] text-cyan-400 border-t-2 border-cyan-400 font-bold'
                        : 'text-[#64748b] hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'prompt' && (
              <button
                onClick={copyPrompt}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPrompt ? 'Скопировано!' : 'Копировать промпт'}</span>
              </button>
            )}

            {activeTab === 'code' && (
              <button
                onClick={copyCode}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Скопировано!' : 'Копировать код'}</span>
              </button>
            )}
          </div>

          {/* Active Tab Content Area */}
          <div className="p-6">
            {/* TAB 1: FLOW */}
            {activeTab === 'flow' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#181d2e]">
                  <div>
                    <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-cyan-400" />
                      <span>{selectedMission.title}</span>
                    </h3>
                    <p className="text-xs text-[#94a3b8] mt-1">{selectedMission.objective}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {[
                    {
                      step: 1,
                      agent: agents[0],
                      title: '1. Идея & Архитектурный Дизайн',
                      text: selectedMission.steps.architect,
                    },
                    {
                      step: 2,
                      agent: agents[1],
                      title: '2. Промпт-Инженерия & Формальная Спека',
                      text: selectedMission.steps.prompt,
                    },
                    {
                      step: 3,
                      agent: agents[2],
                      title: '3. Разработка & Синтез Кода',
                      text: selectedMission.steps.code,
                    },
                    {
                      step: 4,
                      agent: agents[3],
                      title: '4. Верификация & Автоматические Тесты',
                      text: selectedMission.steps.qa,
                    },
                    {
                      step: 5,
                      agent: agents[4],
                      title: '5. GitHub CI/CD, Безопасность & Релиз',
                      text: selectedMission.steps.ops,
                    },
                    {
                      step: 6,
                      agent: agents[5],
                      title: '6. SRE Аудит, Задержка & Нагрузка',
                      text: selectedMission.steps.sre,
                    },
                  ].map((s) => {
                    const isStepActive = isSimulating && currentStep === s.step;
                    const isStepDone = currentStep > s.step || currentStep === 7;

                    return (
                      <div
                        key={s.step}
                        className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start gap-4 ${
                          isStepActive
                            ? 'bg-[#141829] border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.25)] scale-[1.01]'
                            : isStepDone
                            ? 'bg-[#0d101b] border-emerald-500/30'
                            : 'bg-[#090b12] border-[#181d2e] opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xl p-2 rounded-lg bg-[#141724] border border-[#202538]">
                            {s.agent.avatar}
                          </span>
                          <div className="sm:hidden">
                            <span className="text-xs font-mono font-bold text-white">{s.title}</span>
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-1">
                          <div className="hidden sm:flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-white">{s.title}</span>
                            <span className="text-[10px] font-mono text-[#38bdf8]">
                              {s.agent.name} ({s.agent.role})
                            </span>
                          </div>
                          <p className="text-xs text-[#cbd5e1] leading-relaxed mt-0.5">{s.text}</p>
                        </div>

                        <div className="shrink-0 self-center sm:self-auto">
                          {isStepDone ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Завершено
                            </span>
                          ) : isStepActive ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                              В процессе…
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono text-[#64748b] bg-[#141724]">
                              Ожидание
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: PROMPT */}
            {activeTab === 'prompt' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-mono text-[#94a3b8]">
                  <span>Сгенерированный инженерный промпт (Prompt-Synth RFC):</span>
                  <span className="text-cyan-400">Формат: Markdown / System Instructions</span>
                </div>
                <pre className="p-4 rounded-xl bg-[#06070c] border border-[#1b2032] font-mono text-xs text-[#e2e8f0] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {selectedMission.generatedPrompt}
                </pre>
              </div>
            )}

            {/* TAB 3: CODE */}
            {activeTab === 'code' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-mono text-[#94a3b8]">
                  <span>Синтезированный модуль TypeScript:</span>
                  <span className="text-emerald-400">Pure TypeScript · Zero Lock-In</span>
                </div>
                <pre className="p-4 rounded-xl bg-[#06070c] border border-[#1b2032] font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {selectedMission.codeSnippet}
                </pre>
              </div>
            )}

            {/* TAB 4: QA */}
            {activeTab === 'qa' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-mono text-[#94a3b8]">
                  <span>Результат выполнения unit-тестов Vitest:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% Passed · Coverage: 92.4%
                  </span>
                </div>
                <pre className="p-4 rounded-xl bg-[#06070c] border border-[#1b2032] font-mono text-xs text-sky-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {selectedMission.testOutput}
                </pre>
              </div>
            )}

            {/* TAB 5: GITHUB */}
            {activeTab === 'github' && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-[#0e1220] border border-[#1e253d] flex flex-col gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="w-4 h-4 text-purple-400" />
                      <span className="font-mono text-xs font-bold text-white">
                        {selectedMission.prDetails.title}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      Open PR #42
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono text-[#94a3b8] flex-wrap">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Ветка: {selectedMission.prDetails.branch}</span>
                    </span>
                    <span>•</span>
                    <span>Commit: {selectedMission.prDetails.commit}</span>
                    <span>•</span>
                    <span className="text-emerald-400">All checks passed</span>
                  </div>

                  <div className="pt-2 border-t border-[#1a2034] flex flex-col gap-1.5">
                    <span className="text-[11px] font-mono text-[#64748b]">Автоматические CI проверки:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedMission.prDetails.checks.map((chk, i) => (
                        <div
                          key={i}
                          className="px-3 py-1.5 rounded-lg bg-[#070912] border border-[#1b2032] text-xs font-mono text-[#cbd5e1] flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{chk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
