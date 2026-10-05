import React, { useState } from 'react';
import {
  X,
  Terminal,
  Copy,
  Check,
  Sparkles,
  Bot,
  Cpu,
  Layers,
  Code2,
  ShieldCheck,
  Send,
  Zap,
  BookOpen,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface PromptInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

interface PromptEntry {
  id: string;
  title: string;
  category: string;
  agent: string;
  agentRole: string;
  date: string;
  prompt: string;
  sampleResponseSummary: string;
}

const DEFAULT_PROMPTS: PromptEntry[] = [
  {
    id: 'mind-routing',
    title: 'MIND Dynamic Multi-Interest Capsule Routing',
    category: 'RecSys Architecture',
    agent: 'AGENT-02: Apex-Prompt',
    agentRole: 'Staff RecSys Prompt & Spec Engineer',
    date: 'Сегодня, 18:42',
    prompt: `РОЛЬ: Staff ML Systems Engineer (RecSys & Dense Retrieval)
КОНТЕКСТ: Высоконагруженная рекомендательная платформа EIDOS. Монолитный вектор пользователя приводит к размыванию разнородных интересов покупателя (например, покупка подарка коллеге + поиск игровой периферии для себя).
ЗАДАЧА: Разработать модуль динамического роутинга капсул интересов (MIND) в пакете packages/core/src/adaptive/multi-interest-tower.ts.

ФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ:
1. Вычисление до maxInterests (по умолчанию K=3) ортогональных векторов интересов на основе последовательности item embeddings.
2. Применение алгоритма Spherical K-Means c softmax soft-assignment:
   p_{ik} = \\frac{\\exp(\\cos(e_i, c_k) / \\tau)}{\\sum_j \\exp(\\cos(e_i, c_j) / \\tau)}, где \\tau = 0.2.
3. Экспоненциальное затухание по времени: w_i = \\exp(-\\lambda \\cdot \\Delta t_i), где \\lambda = 0.05.
4. Fallback-стратегия:
   - При пустой истории: возвращать единичную нулевую капсулу со статусом EMPTY_HISTORY;
   - При истории < 2 товаров: возвращать один центроид без кластеризации.
5. Инкапсуляция в класс MultiInterestUserTower с асинхронным контрактом:
   buildProfile(userId: string, history: string[], resolveEmbedding: (id: string) => Promise<Float32Array | null>): Promise<MultiInterestProfile>.
6. Strict TypeScript, zero external dependencies, 100% покрытие vitest.`,
    sampleResponseSummary:
      'Синтезирован класс MultiInterestUserTower с поддержкой K-means soft-routing, временем инференса 0.42мс и 5/5 пройденными юнит-тестами.',
  },
  {
    id: 'hnsw-quantization',
    title: 'Symmetric INT8 Scalar Quantization & HNSW Hierarchical Index',
    category: 'High-Performance Vector Indexing',
    agent: 'AGENT-01: Neo-Architect',
    agentRole: 'Chief AI & Vector Index Architect',
    date: 'Сегодня, 18:35',
    prompt: `РОЛЬ: Principal Systems & High-Performance Computing Engineer
КОНТЕКСТ: Векторный индекс EIDOS хранит плотные 384-мерные эмбеддинги. Хранение в Float32 требует 1536 байт на вектор, что ограничивает масштабирование в RAM браузера и микросервисов.
ЗАДАЧА: Реализовать симметричное скалярное квантование Float32 -> Int8 с 4-кратной экономией памяти и многоуровневый индекс HNSW.

ТРЕБОВАНИЯ К КВАНТОВАНИЮ:
1. ScalarQuantizer:
   - Масштаб: scale = \\max(|v_i|) / 127.
   - Квантованные данные: data[i] = \\text{round}(v_i / scale) \\in [-127, 127].
2. Быстрое скалярное произведение на Int8Array:
   - dot(u, v) = scale_u \\cdot scale_v \\cdot \\sum_{i=0}^{383} (u_q[i] \\cdot v_q[i]).
3. Сохранение косинусного сходства с погрешностью < 0.008 (Fidelity > 0.992).

ТРЕБОВАНИЯ К HNSW:
1. Иерархический граф малого мира (L0, L1, L2) с логарифмическим распределением слоев:
   layer = \\lfloor -\\ln(\\text{rand}()) \\cdot m_L \\rfloor, где m_L = 1 / \\ln(M).
2. Параметры по умолчанию: M = 16, efConstruction = 64, efSearch = 32.
3. Поддержка добавления векторов, поиска ближайших k-соседей и экспорта/импорта снапшота индекса.`,
    sampleResponseSummary:
      'Создан ScalarQuantizer (-75% RAM) и иерархический HNSWIndex с ускорением k-NN поиска в 28 раз (0.65мс vs 18.4мс).',
  },
  {
    id: 'conversational-steering',
    title: 'Natural Language Conversational Vector Steering',
    category: 'Interactive Cognitive Systems',
    agent: 'AGENT-02: Apex-Prompt',
    agentRole: 'Prompt & Cognitive Systems Engineer',
    date: 'Сегодня, 18:20',
    prompt: `РОЛЬ: Lead AI UX & Cognitive Retrieval Engineer
КОНТЕКСТ: Пользователь в интерфейсе интернет-магазина EIDOS хочет скорректировать подборку естественным языком (например, «как эти кроссовки, но строже и черного цвета»).
ЗАДАЧА: Спроектировать математический модуль сдвига вектора интереса и модуль графовой объяснимости.

МАТЕМАТИЧЕСКАЯ СПЕЦИФИКАЦИЯ:
1. Векторный сдвиг (Vector Steering):
   v_{target} = \\text{normalize}_{L2}\\left( v_{base} + \\sum_{i} w_i \\Delta v_i^+ - \\sum_{j} w_j \\Delta v_j^- \\right),
   где \\Delta v_i^+ — позитивные семантические модификаторы, \\Delta v_j^- — исключаемые концепты.
2. Весовые коэффициенты: w \\in [0.1, 1.0], по умолчанию 0.4.
3. Модуль объяснимости (ExplainabilityEngine):
   - Разложение релевантности на 4 составляющие: семантический вектор, совпадение категорий, пересечение тегов, графовый путь;
   - Сумма атрибуций строго равна 100%;
   - Генерация понятного резюме на русском и английском языках без галлюцинаций.`,
    sampleResponseSummary:
      'Реализован класс VectorSteering с мгновенным суб-миллисекундным сдвигом вектора и ExplainabilityEngine с атрибуцией 100%.',
  },
  {
    id: 'contextual-bandits',
    title: 'Multi-Armed Contextual Bandits (Thompson Sampling & UCB1)',
    category: 'Exploration vs Exploitation',
    agent: 'AGENT-01: Neo-Architect',
    agentRole: 'Chief Algorithmic Architect',
    date: 'Сегодня, 18:05',
    prompt: `РОЛЬ: Principal Reinforcement Learning & RecSys Architect
ЗАДАЧА: Создать модуль контекстуальных многоруких бандитов packages/core/src/adaptive/contextual-bandits.ts для решения проблемы «холодного старта» товаров и балансировки Exploration / Exploitation.

АЛГОРИТМЫ:
1. Thompson Sampling с сопряженным Бета-распределением Beta(\\alpha_k, \\beta_k):
   - Инициализация: \\alpha_k = 1, \\beta_k = 1 (равномерное априорное распределение);
   - Семплирование: \\theta_k \\sim \\text{Beta}(\\alpha_k, \\beta_k);
   - Обновление: при клике \\alpha_k \\leftarrow \\alpha_k + 1, при пропуске \\beta_k \\leftarrow \\beta_k + 1.
2. UCB1 (Upper Confidence Bound):
   - Score_k = \\hat{\\mu}_k + c \\cdot \\sqrt{\\frac{2 \\ln N}{n_k}}, где c = 1.414.
3. Гибридный переранжировщик:
   FinalScore(item) = (1 - \\gamma) \\cdot CosineSim(item) + \\gamma \\cdot BanditScore(item).`,
    sampleResponseSummary:
      'Создан ContextualBanditEngine с поддержкой Thompson Sampling и UCB1, со средним ростом CTR на 14.8% при сохранении релевантности.',
  },
];

export const PromptInspectorModal: React.FC<PromptInspectorModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'recent' | 'generator' | 'system'>('recent');
  const [promptsList, setPromptsList] = useState<PromptEntry[]>(DEFAULT_PROMPTS);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptEntry>(DEFAULT_PROMPTS[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generator states
  const [genTask, setGenTask] = useState('');
  const [genRole, setGenRole] = useState('Staff RecSys & AI Engineer');
  const [genCategory, setGenCategory] = useState('Algorithmic RecSys');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onShowToast('Промпт скопирован в буфер обмена', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGeneratePrompt = () => {
    if (!genTask.trim()) {
      onShowToast('Введите описание задачи для генерации промпта', 'error');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      const generated = `РОЛЬ: ${genRole}
ДОМЕН: EIDOS Vector Intelligence & Production RecSys
КАТЕГОРИЯ: ${genCategory}
ЦЕЛЬ: Реализация производственной фичи на основе пользовательского запроса: «${genTask.trim()}».

КОНТЕКСТ И АРХИТЕКТУРНЫЕ ОГРАНИЧЕНИЯ:
- Монорепозиторий EIDOS: TypeScript 5.x, Vitest, чистый рантайм без тяжелых сторонних фреймворков.
- Строгая типизация, неизменяемые структуры данных (Readonly<T>), обработка краевых случаев.
- Бюджет задержки инференса: p95 < 2.0ms.

ТРЕБОВАНИЯ К РЕАЛИЗАЦИИ:
1. Математическая формулировка алгоритма и структур данных.
2. Создание экспортируемого класса с инкапсулированной логикой и конфигурацией через Config-интерфейс.
3. Реализация алгоритмической части с проверкой валидности входных векторов (длина 384, отсутствие NaN/Infinity).
4. Методы сериализации / восстановления состояния (State persistence).
5. 100% покрытие unit-тестами с имитацией краевых условий (пустые данные, одиночный элемент, выбросы).

ОЖИДАЕМЫЙ ФОРМАТ ВЫВОДА:
- Полный код TypeScript модуля с JSDoc комментариями.
- Набор тестов для Vitest (describe / test / expect).
- Метрики сложности: временная сложность O(...), пространственная O(...).`;

      setGeneratedResult(generated);
      setIsGenerating(false);

      const newEntry: PromptEntry = {
        id: `custom-${Date.now()}`,
        title: genTask.slice(0, 50),
        category: genCategory,
        agent: 'AGENT-02: Apex-Prompt',
        agentRole: genRole,
        date: 'Только что',
        prompt: generated,
        sampleResponseSummary: `Сгенерирован боевой промпт для задачи «${genTask.slice(0, 40)}...»`,
      };

      setPromptsList((prev) => [newEntry, ...prev]);
      setSelectedPrompt(newEntry);
      onShowToast('Промпт успешно сгенерирован агентом Apex-Prompt!', 'success');
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#090b14] border border-[#202742] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.15)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b2238] bg-[#0c0f1c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono text-white">
                  Инспектор Промптов & Системных Инструкций
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  LIVE TRACE
                </span>
              </div>
              <p className="text-xs text-[#8a8aa3] mt-0.5">
                Прозрачные инженерные промпты, системные контракты и генератор для нейросетевых агентов
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#141829] hover:bg-[#1f2640] text-[#8a8aa3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#1b2238] bg-[#080a14] overflow-x-auto">
          {[
            {
              id: 'recent',
              label: '⚡ Сгенерированные Промпты',
              count: promptsList.length,
            },
            {
              id: 'generator',
              label: '🛠️ Генератор Промптов (Prompt Synthesizer)',
              highlight: true,
            },
            {
              id: 'system',
              label: '📚 Системные Инструкции Агентов',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-t-lg font-mono text-xs transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#121629] text-cyan-300 border-t-2 border-cyan-400 font-bold'
                  : 'text-[#64748b] hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#1a2138] text-cyan-400 font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#070912]">
          {/* TAB 1: RECENT PROMPTS & TRACE */}
          {activeTab === 'recent' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              {/* Left Column: Prompts List */}
              <div className="lg:col-span-4 flex flex-col gap-2.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#64748b] font-semibold mb-1">
                  История промптов в сессии:
                </div>
                {promptsList.map((entry) => {
                  const isSelected = selectedPrompt.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedPrompt(entry)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-[#121629] border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                          : 'bg-[#0b0e1a] border-[#1b2238] hover:border-[#2a3454]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          {entry.category}
                        </span>
                        <span className="text-[10px] font-mono text-[#64748b]">{entry.date}</span>
                      </div>
                      <div className="font-mono text-xs font-bold text-white line-clamp-1">
                        {entry.title}
                      </div>
                      <div className="text-[10px] font-mono text-[#38bdf8]">{entry.agent}</div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Prompt Detail View */}
              <div className="lg:col-span-8 flex flex-col bg-[#0b0e1a] border border-[#1b2238] rounded-xl overflow-hidden p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1b2238]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white">
                        {selectedPrompt.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#38bdf8]">
                      <span>{selectedPrompt.agent}</span>
                      <span>·</span>
                      <span className="text-[#8a8aa3]">{selectedPrompt.agentRole}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => copyText(selectedPrompt.prompt, selectedPrompt.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    {copiedId === selectedPrompt.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedId === selectedPrompt.id ? 'Скопировано!' : 'Копировать промпт'}
                    </span>
                  </button>
                </div>

                {/* Prompt Raw Text */}
                <div className="mt-4 flex-1 flex flex-col">
                  <div className="text-[11px] font-mono text-[#64748b] mb-1.5">
                    Точный текст промпта (Ready for LLM / API):
                  </div>
                  <pre className="p-4 rounded-xl bg-[#05070f] border border-[#181f33] font-mono text-xs text-[#cbd5e1] overflow-x-auto whitespace-pre-wrap leading-relaxed flex-1 max-h-[420px] select-all">
                    {selectedPrompt.prompt}
                  </pre>
                </div>

                {/* Outcome summary */}
                <div className="mt-4 p-3 rounded-lg bg-[#070914] border border-[#161d30] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#8a8aa3]">Результат выполнения:</span>
                  <span className="text-emerald-400 font-bold">
                    {selectedPrompt.sampleResponseSummary}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROMPT GENERATOR */}
          {activeTab === 'generator' && (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto">
              <div className="p-5 rounded-2xl bg-[#0c1020] border border-[#202946] flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-mono text-sm font-bold text-white">
                    Генератор Боевых Промптов по произвольной задаче
                  </h3>
                </div>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Введите любую фичу, идею или архитектурное требование. Агент{' '}
                  <span className="text-cyan-300 font-mono">Apex-Prompt</span> трансформирует её в
                  формальный, готовый к запуску системный промпт с требованиями, математическими
                  формулами, интерфейсами и тестами.
                </p>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-mono text-[#64748b]">Быстрые примеры:</span>
                  {[
                    'Гибридный поиск BM25 + Dense Reranking',
                    'Cross-Encoder Reranker с весами',
                    'Векторный кэш Redis с LRU вытеснением',
                    'Учет остатков на складе и маржинальности',
                    'A/B сплит-тест для трех моделей ранжирования',
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setGenTask(preset)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#141a2e] hover:bg-[#1c2440] text-[#cbd5e1] hover:text-white border border-[#232c4a] transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Input form */}
                <div className="flex flex-col gap-3 mt-2">
                  <div>
                    <label className="block text-xs font-mono text-[#cbd5e1] mb-1.5">
                      Описание задачи или требования:
                    </label>
                    <textarea
                      rows={3}
                      value={genTask}
                      onChange={(e) => setGenTask(e.target.value)}
                      placeholder="Например: Реализовать фильтрацию по бренду с автодополнением и мягким штрафом за отсутствие товара на складе..."
                      className="w-full px-4 py-3 rounded-xl bg-[#060812] border border-[#222a46] text-white font-mono text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-[#8a8aa3] mb-1">
                        Целевая роль агента:
                      </label>
                      <select
                        value={genRole}
                        onChange={(e) => setGenRole(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#060812] border border-[#222a46] text-white font-mono text-xs"
                      >
                        <option value="Staff RecSys & AI Engineer">
                          Staff RecSys & AI Engineer
                        </option>
                        <option value="Principal Vector Index Architect">
                          Principal Vector Index Architect
                        </option>
                        <option value="Lead AI UX & Prompt Engineer">
                          Lead AI UX & Prompt Engineer
                        </option>
                        <option value="Senior SRE & High-Load Engineer">
                          Senior SRE & High-Load Engineer
                        </option>
                        <option value="QA Automation & Verification Lead">
                          QA Automation & Verification Lead
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-[#8a8aa3] mb-1">
                        Архитектурный домен:
                      </label>
                      <select
                        value={genCategory}
                        onChange={(e) => setGenCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#060812] border border-[#222a46] text-white font-mono text-xs"
                      >
                        <option value="Algorithmic RecSys">Algorithmic RecSys</option>
                        <option value="High-Performance Indexing">High-Performance Indexing</option>
                        <option value="Interactive Cognitive Systems">
                          Interactive Cognitive Systems
                        </option>
                        <option value="Reinforcement Learning & Bandits">
                          Reinforcement Learning & Bandits
                        </option>
                        <option value="SRE & Latency Optimization">
                          SRE & Latency Optimization
                        </option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleGeneratePrompt}
                    disabled={isGenerating}
                    className="mt-2 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-mono font-bold text-xs transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Zap className="w-4 h-4 animate-spin" />
                        <span>Синтез промпта агентом Apex-Prompt...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Сгенерировать Боевой Промпт & Спецификацию</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Generated result */}
              {generatedResult && (
                <div className="p-5 rounded-2xl bg-[#090c18] border border-cyan-500/40 flex flex-col gap-3 shadow-[0_0_30px_rgba(0,240,255,0.15)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <span>Синтезированный Промпт (Apex-Prompt RFC):</span>
                    </span>
                    <button
                      onClick={() => copyText(generatedResult, 'generated-res')}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedId === 'generated-res' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedId === 'generated-res' ? 'Скопировано!' : 'Копировать промпт'}
                      </span>
                    </button>
                  </div>

                  <pre className="p-4 rounded-xl bg-[#04060c] border border-[#1a233b] font-mono text-xs text-cyan-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[380px] select-all">
                    {generatedResult}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SYSTEM AGENT PROMPTS */}
          {activeTab === 'system' && (
            <div className="flex flex-col gap-4">
              <div className="text-xs font-mono text-[#8a8aa3] mb-1">
                Системные инструкции для автономных агентов мульти-агентной матрицы EIDOS:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    agent: 'AGENT-01: Neo-Architect',
                    role: 'Chief AI & RecSys Architect',
                    instruction: `Вы — главный архитектор рекомендательных систем и векторных баз данных EIDOS. Ваша задача — формулировать математические постановки задач, выводить формулы функций потерь, оптимизировать многомерные векторные пространства и топологии HNSW графов. Любое решение должно содержать строгую формализацию и оценку вычислительной сложности O(...).`,
                  },
                  {
                    agent: 'AGENT-02: Apex-Prompt',
                    role: 'Prompt & Specification Engineer',
                    instruction: `Вы — ведущий инженер по формулированию системных промптов и RFC спецификаций для LLM и разработчиков. Вы трансформируете архитектурные идеи в безупречно структурированные инструкции с ролями, контрактами типов, краевыми условиями, негативными ограничениями и ожидаемыми форматами JSON/TypeScript.`,
                  },
                  {
                    agent: 'AGENT-03: CodeCraft',
                    role: 'Senior TypeScript Systems Developer',
                    instruction: `Вы — senior-разработчик ядра EIDOS. Ваш код пишется на чистом TypeScript с нулевой зависимостью от тяжелых внешних библиотек. Вы реализуете скалярные произведения, нормализации L2, роутинг капсул и бандиты с минимальным созданием объектов в куче и максимальной скоростью в V8.`,
                  },
                  {
                    agent: 'AGENT-04: Test-Sentinel',
                    role: 'QA Verification & Edge Case Lead',
                    instruction: `Вы отвечаете за 100% надежность и отсутствие регрессий. Для каждого модуля вы создаете исчерпывающие тесты в Vitest, покрывающие краевые условия: пустые массивы, нулевые векторы, деление на ноль, некорректные размерности, переполнение Int8 и деградацию точности.`,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#0b0e1a] border border-[#1b2238] flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-white">
                          {item.agent}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30">
                          System Role
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-[#38bdf8] mt-0.5">
                        {item.role}
                      </div>
                      <p className="text-xs text-[#cbd5e1] font-mono leading-relaxed mt-2.5 p-3 rounded-lg bg-[#060810] border border-[#161c2d]">
                        {item.instruction}
                      </p>
                    </div>

                    <button
                      onClick={() => copyText(item.instruction, `sys-${idx}`)}
                      className="self-end flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#141a2e] hover:bg-[#1c2440] text-xs font-mono text-[#cbd5e1] hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedId === `sys-${idx}` ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Копировать инструкцию</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1b2238] bg-[#0c0f1c] flex items-center justify-between text-xs font-mono text-[#64748b]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Промпт-инспектор активен в памяти сессии</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#141a2e] hover:bg-[#1f2846] text-white text-xs font-mono transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
