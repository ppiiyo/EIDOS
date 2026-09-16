import React, { useState } from 'react';
import { Insight, InsightType } from '../types';
import { Eye, Copy, Check, Lightbulb } from 'lucide-react';

interface InsightsViewProps {
  insights: Insight[];
  onHighlightConcept: (conceptName: string) => void;
}

const INSIGHT_FILTERS: Array<{ key: 'all' | InsightType; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'connection', label: 'Связи' },
  { key: 'cluster', label: 'Кластеры' },
  { key: 'bridge', label: 'Мосты' },
  { key: 'outlier', label: 'Аутсайдеры' },
  { key: 'contrast', label: 'Контрасты' },
  { key: 'density', label: 'Структура' },
];

export const InsightsView: React.FC<InsightsViewProps> = ({
  insights,
  onHighlightConcept,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | InsightType>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (insights.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-[#ffbe3d]/10 border border-[#1e1e35] flex items-center justify-center text-3xl text-[#ffbe3d] mb-4 shadow-[0_0_30px_rgba(255,190,61,0.1)]">
          <Lightbulb size={28} />
        </div>
        <h3 className="text-lg font-semibold text-[#e8e8f0] mb-2">
          Инсайты появятся после анализа
        </h3>
        <p className="text-xs text-[#8a8aa3] max-w-md leading-relaxed">
          Система автоматически определит ключевые семантические пары, мосты центральности,
          контрасты и обособленные концепты на основе эмбеддингов.
        </p>
      </div>
    );
  }

  const filtered =
    selectedFilter === 'all'
      ? insights
      : insights.filter((i) => i.type === selectedFilter);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="p-6 overflow-y-auto h-full space-y-5">
      {/* Filter toolbar */}
      <div className="flex gap-2 flex-wrap pb-2 border-b border-[#1e1e35]">
        {INSIGHT_FILTERS.map((f) => {
          const count =
            f.key === 'all'
              ? insights.length
              : insights.filter((i) => i.type === f.key).length;

          const isActive = selectedFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setSelectedFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs mono transition-all flex items-center gap-1.5 cursor-pointer border ${
                isActive
                  ? 'border-[#00e5ff] text-[#00e5ff] bg-[#00e5ff]/10 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                  : 'border-[#1e1e35] text-[#8a8aa3] hover:text-[#e8e8f0] bg-[#111120]'
              }`}
            >
              <span>{f.label}</span>
              <span className="text-[10px] text-[#555570]">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Insights Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((ins) => {
          const isCopied = copiedId === ins.id;

          const typeStyles: Record<InsightType, string> = {
            connection: 'bg-[#00e5ff]/15 text-[#00e5ff] border-[#00e5ff]/30',
            cluster: 'bg-[#b478ff]/15 text-[#b478ff] border-[#b478ff]/30',
            bridge: 'bg-[#ffbe3d]/15 text-[#ffbe3d] border-[#ffbe3d]/30',
            outlier: 'bg-[#ff6b9d]/15 text-[#ff6b9d] border-[#ff6b9d]/30',
            contrast: 'bg-[#5aa9ff]/15 text-[#5aa9ff] border-[#5aa9ff]/30',
            density: 'bg-[#3ee89a]/15 text-[#3ee89a] border-[#3ee89a]/30',
          };

          return (
            <div
              key={ins.id}
              className="p-4 rounded-xl bg-gradient-to-br from-[#15152a]/60 to-[#111120]/50 border border-[#1e1e35] hover:border-[#2a2a4a] transition-all flex flex-col gap-3 group relative"
            >
              {/* Head */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[9px] mono uppercase px-2.5 py-0.5 rounded-full border font-semibold ${
                    typeStyles[ins.type]
                  }`}
                >
                  {ins.type}
                </span>

                <button
                  onClick={() =>
                    handleCopy(
                      ins.id,
                      `[${ins.type.toUpperCase()}] ${ins.title}\n${ins.text}\n(${ins.metricLabel}: ${
                        ins.metric < 1
                          ? (ins.metric * 100).toFixed(0) + '%'
                          : ins.metric.toFixed(2)
                      })`
                    )
                  }
                  title="Скопировать инсайт"
                  className="text-[#555570] hover:text-[#e8e8f0] p-1 rounded hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  {isCopied ? (
                    <Check size={13} className="text-[#3ee89a]" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>

              {/* Title & Body */}
              <div>
                <h4 className="font-semibold text-sm text-[#e8e8f0] leading-snug mb-1.5">
                  {ins.title}
                </h4>
                <p className="text-xs text-[#8a8aa3] leading-relaxed">
                  {ins.text}
                </p>
              </div>

              {/* Related Concepts Chips */}
              {ins.concepts.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-[#1e1e35]/60">
                  {ins.concepts.map((c) => (
                    <button
                      key={c}
                      onClick={() => onHighlightConcept(c)}
                      title={`Найти «${c}» на графе`}
                      className="text-[10px] mono px-2 py-0.5 rounded-md bg-white/[0.03] text-[#8a8aa3] hover:text-[#00e5ff] hover:bg-[#00e5ff]/10 hover:border-[#00e5ff]/30 border border-[#1e1e35] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={10} />
                      <span>{c}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Metric Footer */}
              <div className="flex items-center justify-between text-[10px] mono text-[#555570] pt-1">
                <span>{ins.metricLabel}</span>
                <strong className="text-[#e8e8f0]">
                  {ins.metric < 1
                    ? (ins.metric * 100).toFixed(0) + '%'
                    : ins.metric.toFixed(2)}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
