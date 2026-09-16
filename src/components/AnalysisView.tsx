import React from 'react';
import { Edge, Cluster, GraphMetrics } from '../types';
import { ArrowRight, Layers, Hash } from 'lucide-react';

interface AnalysisViewProps {
  metrics: GraphMetrics | null;
  edges: Edge[];
  clusters: Cluster[];
  conceptCount: number;
  insightCount: number;
  onNavigateToGraph: () => void;
  onSelectConceptPair?: (from: string, to: string) => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  metrics,
  edges,
  clusters,
  conceptCount,
  insightCount,
  onNavigateToGraph,
}) => {
  if (!metrics) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00e5ff]/10 to-[#b478ff]/10 border border-[#1e1e35] flex items-center justify-center text-3xl text-[#00e5ff] mb-4 shadow-[0_0_30px_rgba(0,229,255,0.1)]">
          ◈
        </div>
        <h3 className="text-lg font-semibold text-[#e8e8f0] mb-2">
          Нет данных для анализа
        </h3>
        <p className="text-xs text-[#8a8aa3] max-w-md leading-relaxed">
          Добавьте концепты в левой панели (или загрузите готовый домен) и нажмите
          кнопку <span className="text-[#00e5ff]">«Запустить анализ»</span>.
          Система рассчитает семантические векторы, плотность поля, энтропию и выделит кластеры.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Entropy */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/60 border border-[#1e1e35] hover:border-[#2a2a4a] transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#b478ff]/30 to-transparent" />
          <div className="flex justify-between items-center text-[10px] mono uppercase text-[#555570] mb-2">
            <span>Энтропия</span>
            <span className="text-[#8a8aa3]">H</span>
          </div>
          <div className="text-2xl font-bold mono text-[#b478ff]">
            {metrics.entropy.toFixed(2)}
          </div>
          <div className="text-[10px] text-[#8a8aa3] mono mt-1">
            {(metrics.normalizedEntropy * 100).toFixed(0)}% от макс.
          </div>
        </div>

        {/* Density */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/60 border border-[#1e1e35] hover:border-[#2a2a4a] transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00e5ff]/30 to-transparent" />
          <div className="flex justify-between items-center text-[10px] mono uppercase text-[#555570] mb-2">
            <span>Плотность</span>
            <span className="text-[#8a8aa3]">ρ</span>
          </div>
          <div className="text-2xl font-bold mono text-[#00e5ff]">
            {(metrics.density * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-[#8a8aa3] mono mt-1">
            {edges.length} активных связей
          </div>
        </div>

        {/* Average Similarity */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/60 border border-[#1e1e35] hover:border-[#2a2a4a] transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#3ee89a]/30 to-transparent" />
          <div className="flex justify-between items-center text-[10px] mono uppercase text-[#555570] mb-2">
            <span>Среднее сходство</span>
            <span className="text-[#8a8aa3]">μ</span>
          </div>
          <div className="text-2xl font-bold mono text-[#3ee89a]">
            {(metrics.avgSim * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-[#8a8aa3] mono mt-1">
            max: {(metrics.maxSim * 100).toFixed(0)}%
          </div>
        </div>

        {/* Clusters */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/60 border border-[#1e1e35] hover:border-[#2a2a4a] transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#ffbe3d]/30 to-transparent" />
          <div className="flex justify-between items-center text-[10px] mono uppercase text-[#555570] mb-2">
            <span>Кластеры</span>
            <span className="text-[#8a8aa3]">K</span>
          </div>
          <div className="text-2xl font-bold mono text-[#ffbe3d]">
            {clusters.length}
          </div>
          <div className="text-[10px] text-[#8a8aa3] mono mt-1 truncate">
            {clusters.map((c) => c.concepts.length).join(' · ')} узлов
          </div>
        </div>

        {/* Diameter */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/60 border border-[#1e1e35] hover:border-[#2a2a4a] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-center text-[10px] mono uppercase text-[#555570] mb-2">
            <span>Диаметр</span>
            <span className="text-[#8a8aa3]">D</span>
          </div>
          <div className="text-2xl font-bold mono text-[#e8e8f0]">
            {metrics.diameter}
          </div>
          <div className="text-[10px] text-[#8a8aa3] mono mt-1">
            шагов в кратч. пути
          </div>
        </div>

        {/* Clustering Coefficient */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/60 border border-[#1e1e35] hover:border-[#2a2a4a] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-center text-[10px] mono uppercase text-[#555570] mb-2">
            <span>Кластеризация</span>
            <span className="text-[#8a8aa3]">CC</span>
          </div>
          <div className="text-2xl font-bold mono text-[#5aa9ff]">
            {(metrics.clustering * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-[#8a8aa3] mono mt-1">
            локальная связанность
          </div>
        </div>

        {/* Concepts */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/60 border border-[#1e1e35] hover:border-[#2a2a4a] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-center text-[10px] mono uppercase text-[#555570] mb-2">
            <span>Концептов</span>
            <span className="text-[#8a8aa3]">N</span>
          </div>
          <div className="text-2xl font-bold mono text-[#e8e8f0]">
            {conceptCount}
          </div>
          <div className="text-[10px] text-[#8a8aa3] mono mt-1">
            в смысловом поле
          </div>
        </div>

        {/* Insights */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/60 border border-[#1e1e35] hover:border-[#2a2a4a] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-center text-[10px] mono uppercase text-[#555570] mb-2">
            <span>Инсайтов</span>
            <span className="text-[#8a8aa3]">I</span>
          </div>
          <div className="text-2xl font-bold mono text-[#ff6b9d]">
            {insightCount}
          </div>
          <div className="text-[10px] text-[#8a8aa3] mono mt-1">
            готово к экспорту
          </div>
        </div>
      </div>

      {/* Top Semantic Pairs */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#15152a]/50 to-[#111120]/40 border border-[#1e1e35]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-[#00e5ff]" />
            <h4 className="text-xs font-semibold mono uppercase tracking-wider text-[#e8e8f0]">
              Топ семантических пар
            </h4>
          </div>
          <button
            onClick={onNavigateToGraph}
            className="text-[11px] text-[#00e5ff] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Смотреть на графе</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {edges.length === 0 ? (
          <div className="text-xs text-[#555570] py-4 text-center">
            Нет связей выше установленного порога. Попробуйте снизить порог связи в левой панели.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {edges.slice(0, 10).map((edge, idx) => {
              const simPct = (edge.sim * 100).toFixed(0);
              const isHigh = edge.sim >= 0.65;
              const isModerate = edge.sim >= 0.45 && edge.sim < 0.65;

              return (
                <div
                  key={`${edge.from}-${edge.to}`}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-[#1e1e35]/60 hover:border-[#00e5ff]/40 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="mono text-[10px] text-[#555570]">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="font-medium text-[#e8e8f0] truncate">
                      {edge.from}
                    </span>
                    <span className="text-[#555570] text-[10px]">↔</span>
                    <span className="font-medium text-[#e8e8f0] truncate">
                      {edge.to}
                    </span>
                  </div>

                  <span
                    className={`mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                      isHigh
                        ? 'bg-[#3ee89a]/15 text-[#3ee89a] border border-[#3ee89a]/30'
                        : isModerate
                        ? 'bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30'
                        : 'bg-[#ffbe3d]/15 text-[#ffbe3d] border border-[#ffbe3d]/30'
                    }`}
                  >
                    {simPct}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clusters breakdown */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#15152a]/50 to-[#111120]/40 border border-[#1e1e35]">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={14} className="text-[#b478ff]" />
          <h4 className="text-xs font-semibold mono uppercase tracking-wider text-[#e8e8f0]">
            Выявленные смысловые кластеры
          </h4>
        </div>

        {clusters.length === 0 ? (
          <div className="text-xs text-[#555570] py-4 text-center">
            Кластеры не выделены
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {clusters.map((cluster) => {
              return (
                <div
                  key={cluster.id}
                  style={{ borderLeftColor: cluster.color }}
                  className="p-3.5 rounded-xl bg-white/[0.02] border border-[#1e1e35] border-l-4 hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="font-semibold text-xs text-[#e8e8f0]">
                      {cluster.name}
                    </span>
                    <span className="text-[10px] mono px-2 py-0.5 rounded-full bg-black/40 text-[#8a8aa3]">
                      {cluster.concepts.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {cluster.concepts.map((concept) => (
                      <span
                        key={concept}
                        className="text-[11px] mono px-2 py-0.5 rounded-md bg-white/[0.03] text-[#8a8aa3] border border-[#1e1e35]"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
