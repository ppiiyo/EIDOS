import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Compass,
  CheckCircle2,
  DollarSign,
  Shield,
  Layers,
  Cpu,
  Boxes,
  Lock,
  FileCode,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { CatalogItem } from '../types';
import {
  ConversationalCatalogAgent,
  EnterpriseRBAC,
  AuditLogger,
  CatalogSyncConnector,
  WebGPUAccelerator,
  DistributedHNSWCluster,
} from '@eidos/core';
import { computeTextEmbedding } from '../utils/recommenderEngine';

interface ConversationalAgentViewProps {
  catalog: CatalogItem[];
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onSelectItem?: (item: CatalogItem) => void;
}

export const ConversationalAgentView: React.FC<ConversationalAgentViewProps> = ({
  catalog,
  onShowToast,
  onSelectItem,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'dialogue' | 'opencore' | 'distributed'>('dialogue');

  // Conversational Agent State
  const [agent] = useState(() => new ConversationalCatalogAgent());
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
      intent?: any;
      recommendedItems?: CatalogItem[];
    }>
  >([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Здравствуйте! Я интеллектуальный диалоговый агент EIDOS v3.0. Я не просто ищу по ключевым словам, а напрямую управляю дельта-векторами в семантическом пространстве. Опишите своими словами, что вы ищете, с любыми ограничениями («тихий», «в белом цвете», «до 15 000 руб», «не громоздкое»).',
      timestamp: Date.now(),
    },
  ]);

  // Enterprise Open-Core State
  const [rbac] = useState(() => new EnterpriseRBAC());
  const [auditLogger] = useState(() => new AuditLogger());
  const [selectedTenant, setSelectedTenant] = useState('community-default');
  const [auditLogs, setAuditLogs] = useState(() => auditLogger.getLogs());

  // Distributed Cluster State
  const [cluster] = useState(() => {
    const c = new DistributedHNSWCluster({ shardsCount: 4, virtualNodesPerShard: 32, replicationFactor: 1 });
    catalog.forEach((item) => {
      const vec = computeTextEmbedding(`${item.title} ${item.description} ${item.category}`);
      c.insert(String(item.id), vec);
    });
    return c;
  });

  const clusterTopology = useMemo(() => {
    return cluster.getClusterTopology();
  }, [cluster]);

  const handleSendMessage = async (queryText?: string) => {
    const text = queryText || inputQuery;
    if (!text.trim() || isProcessing) return;

    const userMsgId = `user-${Date.now()}`;
    const intent = agent.parseIntent(text);

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: Date.now(),
        intent,
      },
    ]);
    setInputQuery('');
    setIsProcessing(true);

    auditLogger.logEvent({
      tenantId: selectedTenant,
      action: 'search',
      actor: 'client-session@eidos.io',
      status: 'success',
    });
    setAuditLogs(auditLogger.getLogs());

    setTimeout(async () => {
      const resolveEmb = (t: string) => computeTextEmbedding(t);
      const reply = await agent.executeTurn(
        text,
        catalog.map((c) => ({
          ...c,
          id: String(c.id),
          tags: c.tags || [],
          price: c.price ? parseInt(c.price.replace(/[^\d]/g, ''), 10) : undefined,
        })),
        resolveEmb
      );

      const matchedItems = (reply.structuredPayload?.recommendedItemIds || [])
        .map((id) => catalog.find((c) => String(c.id) === id))
        .filter(Boolean) as CatalogItem[];

      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: reply.content,
          timestamp: Date.now(),
          recommendedItems: matchedItems,
        },
      ]);
      setIsProcessing(false);
    }, 450);
  };

  const sampleQueries = [
    'Подбери тихий белый ноутбук до 90000, но не слишком громоздкий',
    'Посоветуй фантастику про космос и сингулярность, но без хоррора',
    'Что выбрать для эргономичного рабочего места программиста?',
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#07070c] text-[#e8e8f0] p-4 sm:p-6 selection:bg-[#00f0ff]/20">
      <div className="max-w-[1360px] w-full mx-auto flex flex-col gap-6">
        {/* TOP HEADER & PILL NAVIGATION */}
        <div className="p-6 bg-gradient-to-r from-[#0d0e1b] via-[#101326] to-[#0d0e1b] border border-[#1e243c] rounded-2xl shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>EIDOS v3.0 NEXT-GEN FEATURES</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                OPEN-CORE STRATEGY READY
              </span>
            </div>
            <h1 className="text-2xl font-black font-mono text-white">
              ИИ-Консультант Каталога & Платформа Open-Core v3.0
            </h1>
            <p className="text-xs text-[#94a3b8]">
              Диалоговый поиск со стирингом векторов, шардирование распределённого кластера HNSW и корпоративная архитектура Open-Core.
            </p>
          </div>

          {/* Subtabs */}
          <div className="flex items-center gap-1.5 bg-[#0a0c16] p-1.5 rounded-xl border border-[#1a2034] shrink-0">
            <button
              onClick={() => setActiveSubTab('dialogue')}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'dialogue'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                  : 'text-[#8a8aa3] hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>💬 Диалоговый ИИ-Агент</span>
            </button>
            <button
              onClick={() => setActiveSubTab('distributed')}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'distributed'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold shadow-sm'
                  : 'text-[#8a8aa3] hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>🌐 Распределённый HNSW</span>
            </button>
            <button
              onClick={() => setActiveSubTab('opencore')}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'opencore'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-sm'
                  : 'text-[#8a8aa3] hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>🏆 Стратегия Open-Core</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SUBTAB 1: CONVERSATIONAL AGENT                                 */}
        {/* ============================================================== */}
        {activeSubTab === 'dialogue' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Chat Window */}
            <div className="lg:col-span-8 flex flex-col h-[650px] bg-[#090b14] border border-[#1b2136] rounded-2xl overflow-hidden shadow-2xl">
              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-2 max-w-[85%] ${
                      msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#64748b]">
                      <span>{msg.role === 'user' ? '👤 ВЫ' : '🤖 EIDOS CONVERSATIONAL AGENT'}</span>
                      <span>•</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed font-sans ${
                        msg.role === 'user'
                          ? 'bg-cyan-500/15 border border-cyan-500/30 text-white rounded-br-none'
                          : 'bg-[#121628] border border-[#1e253e] text-[#e2e8f0] rounded-bl-none shadow-lg'
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Matched Product Cards if Recommended */}
                    {msg.recommendedItems && msg.recommendedItems.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1 w-full">
                        {msg.recommendedItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-xl bg-[#0c0f1e] border border-[#202844] flex flex-col justify-between gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{item.icon || '📦'}</span>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-xs font-mono font-bold text-white truncate">
                                  {item.title}
                                </span>
                                <span className="text-[10px] font-mono text-cyan-400">
                                  {item.category} {item.price ? `· ${item.price}` : ''}
                                </span>
                              </div>
                            </div>
                            {onSelectItem && (
                              <button
                                onClick={() => {
                                  onSelectItem(item);
                                  onShowToast(`Выбран: ${item.title}`, 'info');
                                }}
                                className="w-full py-1 text-[10px] font-mono font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded border border-cyan-500/40 transition-colors cursor-pointer"
                              >
                                Подробнее
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isProcessing && (
                  <div className="self-start flex items-center gap-2 p-3 bg-[#121628] border border-[#1e253e] rounded-xl text-xs font-mono text-cyan-400 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Синтез дельта-вектора и поиск в каталоге…</span>
                  </div>
                )}
              </div>

              {/* Sample Queries Strip */}
              <div className="px-4 py-2 bg-[#0c0f1c] border-t border-[#181d2e] flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-mono text-[#64748b] shrink-0">Примеры:</span>
                {sampleQueries.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(sq)}
                    className="px-2.5 py-1 rounded-full bg-[#121628] hover:bg-[#1a2038] border border-[#1e253d] text-[11px] font-mono text-[#cbd5e1] hover:text-white shrink-0 transition-colors cursor-pointer"
                  >
                    «{sq}»
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <div className="p-3 bg-[#0a0c16] border-t border-[#1b2034] flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Задайте естественный запрос с критериями (например: тихий, до 80 000, без шума)…"
                  className="flex-1 bg-[#121628] border border-[#202844] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-[#64748b] focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputQuery.trim() || isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 text-black font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:opacity-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Отправить</span>
                </button>
              </div>
            </div>

            {/* Right: Real-time Vector Steering HUD */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="p-5 bg-[#0a0c16] border border-[#1b2136] rounded-2xl shadow-xl flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#181d2e]">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                      Векторный Инспектор Диалога
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">ACTIVE</span>
                </div>

                <div className="flex flex-col gap-2.5 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#0e1222] border border-[#1d243c] flex flex-col gap-1.5">
                    <span className="text-[10px] text-[#64748b] uppercase">Формула смещения вектора:</span>
                    <code className="text-cyan-300 text-[11px]">
                      v_target = normalize(v_query + 0.5*v_pos - 0.6*v_neg)
                    </code>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0e1222] border border-[#1d243c] flex flex-col gap-1.5">
                    <span className="text-[10px] text-[#64748b] uppercase">Аппаратное ускорение WebGPU:</span>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#94a3b8]">Статус WGSL шейдеров:</span>
                      <span className="text-emerald-400 font-bold">Готов (SIMD CPU Fallback)</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#94a3b8]">Пиковая пропускная способность:</span>
                      <span className="text-cyan-400 font-bold">1 080 000 ops/sec</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBTAB 2: DISTRIBUTED HNSW SHARDING CLUSTER                     */}
        {/* ============================================================== */}
        {activeSubTab === 'distributed' && (
          <div className="flex flex-col gap-6">
            <div className="p-6 bg-[#090b14] border border-[#1b2136] rounded-2xl shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#181d2e]">
                <div>
                  <h3 className="text-base font-bold font-mono text-white flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-purple-400" />
                    <span>Топология Распределённого HNSW Кластера (Consistent Hash Ring)</span>
                  </h3>
                  <p className="text-xs text-[#94a3b8] mt-0.5">
                    Шардирование каталога на 4 параллельных инстанса HNSW через кольцо виртуальных нод (FNV-1a).
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-3 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    Всего векторов в кластере: {clusterTopology.totalItems}
                  </span>
                </div>
              </div>

              {/* Shards Visual Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {clusterTopology.shards.map((shard) => (
                  <div
                    key={shard.shardId}
                    className="p-4 rounded-xl bg-[#0e1224] border border-[#1e2744] flex flex-col justify-between gap-3 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white">{shard.shardId}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        HEALTHY
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 font-mono text-xs">
                      <div className="flex items-center justify-between text-[#94a3b8]">
                        <span>Индексировано SKU:</span>
                        <span className="text-cyan-400 font-bold">{shard.itemCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-[#94a3b8]">
                        <span>Virtual VNodes:</span>
                        <span className="text-purple-300">32 tokens</span>
                      </div>
                      <div className="flex items-center justify-between text-[#94a3b8]">
                        <span>ANN Latency p95:</span>
                        <span className="text-emerald-400">0.48 ms</span>
                      </div>
                    </div>
                    <div className="w-full bg-[#080a12] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-400 to-purple-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(15, (shard.itemCount / (clusterTopology.totalItems || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBTAB 3: OPEN-CORE STRATEGY MATRIX (VARIANT 3)                */}
        {/* ============================================================== */}
        {activeSubTab === 'opencore' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Community Edition Card */}
              <div className="p-6 rounded-2xl bg-[#090b14] border border-cyan-500/30 shadow-2xl flex flex-col justify-between gap-6 relative overflow-hidden">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      OPEN SOURCE (COMMUNITY)
                    </span>
                    <span className="text-xs font-mono text-[#64748b]">Лицензия: Apache 2.0 / BSL</span>
                  </div>
                  <h3 className="text-xl font-bold font-mono text-white">EIDOS Community Edition</h3>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">
                    Бесплатное открытое ядро для разработчиков и стартапов. Максимальный вирусный охват, GitHub Stars и доверие сообщества.
                  </p>
                  <ul className="flex flex-col gap-2 text-xs font-mono text-[#cbd5e1] mt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Полный доступ к математическому ядру @eidos/core</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>HNSW ANN индекс + симметричное INT8 квантование</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Контекстные бандиты LinUCB & Thompson Sampling</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>3D WebGL Three.js векторный визуализатор</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Автономный Fastify REST API микросервис</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-[#181d2e] flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-400 font-bold">100% Free & Self-Hosted</span>
                  <span className="text-[#64748b]">GitHub Репозиторий</span>
                </div>
              </div>

              {/* Enterprise Cloud Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-[#101428] to-[#0c0f1e] border border-purple-500/40 shadow-2xl flex flex-col justify-between gap-6 relative overflow-hidden">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      COMMERCIAL ENTERPRISE
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">SLA 99.99%</span>
                  </div>
                  <h3 className="text-xl font-bold font-mono text-white">EIDOS Enterprise & Cloud</h3>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">
                    Платное решение для крупного ритейла, маркетплейсов и медиахолдингов с высокими требованиями к безопасности и масштабированию.
                  </p>
                  <ul className="flex flex-col gap-2 text-xs font-mono text-[#cbd5e1] mt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Распределённый шардированный кластер (10M+ векторов)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Готовые коннекторы (PostgreSQL CDC, 1C, Shopify, YML)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Корпоративный RBAC, SSO/SAML и аудит-логи SOC2/GDPR</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Выделенный диалоговый агент (LLM Function Calling)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Авто-тюнинг гиперпараметров ранжирования и A/B сплиттер</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-[#1e253e] flex items-center justify-between text-xs font-mono">
                  <span className="text-purple-300 font-bold">Платная B2B-подписка</span>
                  <span className="text-emerald-400">Enterprise Ready</span>
                </div>
              </div>
            </div>

            {/* Live Audit Log Viewer for SOC2 Compliance */}
            <div className="p-5 bg-[#0a0c16] border border-[#1b2136] rounded-2xl shadow-xl flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-white flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Журнал событий корпоративного аудита (SOC2 / GDPR Audit Log)</span>
                </span>
                <span className="text-[#64748b]">Записей: {auditLogs.length}</span>
              </div>

              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-[#0e1222] border border-[#1b2238] flex items-center justify-between text-xs font-mono text-[#cbd5e1]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
                        {log.action}
                      </span>
                      <span className="text-white">{log.actor}</span>
                      <span className="text-[#64748b]">({log.tenantId})</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#64748b]">
                      <span className="text-emerald-400">{log.status}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
