import React from 'react';
import {
  Brain,
  Tag,
  Layers,
  FileText,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { DetailedSemanticExplanation } from '../utils/featureAttribution';

interface VisualExplanationLayerProps {
  explanation: DetailedSemanticExplanation;
  targetIcon?: string;
  recommendedIcon?: string;
  isCompact?: boolean;
}

export const VisualExplanationLayer: React.FC<VisualExplanationLayerProps> = ({
  explanation,
  targetIcon = '📦',
  recommendedIcon = '✨',
  isCompact = false,
}) => {
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Brain':
        return <Brain size={13} />;
      case 'Tag':
        return <Tag size={13} />;
      case 'Layers':
        return <Layers size={13} />;
      case 'FileText':
        return <FileText size={13} />;
      case 'Users':
        return <Users size={13} />;
      default:
        return <Sparkles size={13} />;
    }
  };

  return (
    <div className="rounded-xl bg-[#090912] border border-[#00f0ff]/30 p-3.5 flex flex-col gap-3 shadow-[0_4px_24px_rgba(0,240,255,0.08)] animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Header of the Explanation Layer */}
      <div className="flex items-center justify-between border-b border-[#1e1e35] pb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center text-[#00f0ff]">
            <Brain size={12} />
          </div>
          <span className="font-mono text-[11px] font-bold text-white uppercase tracking-wider">
            Декомпозиция схожести (Feature Attribution)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className="text-[#8a8aa3]">Дистанция:</span>
          <span className="text-[#3ee89a] font-bold">{explanation.vectorDistance}</span>
          <span className="px-1.5 py-0.2 rounded bg-[#1e1e35] text-[#8a8aa3] text-[9px]">
            {explanation.confidenceLevel}
          </span>
        </div>
      </div>

      {/* Semantic Connection Bridge */}
      <div className="p-2 rounded-lg bg-[#111120] border border-[#1e1e35] flex items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm shrink-0">{targetIcon}</span>
          <span className="text-[#8a8aa3] truncate text-[11px]">{explanation.targetTitle}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] font-bold text-[10px]">
          <span>{(explanation.similarityScore * 100).toFixed(0)}%</span>
          <ArrowRight size={10} />
        </div>
        <div className="flex items-center gap-1.5 min-w-0 justify-end">
          <span className="text-white truncate text-[11px] font-semibold">{explanation.recommendedTitle}</span>
          <span className="text-sm shrink-0">{recommendedIcon}</span>
        </div>
      </div>

      {/* Segmented Contribution Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-[#8a8aa3]">
          <span>Вклад факторов в сходство (100%):</span>
          <span className="text-[#00f0ff] font-semibold">{explanation.topLatentConcept}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#141424] overflow-hidden flex gap-0.5 p-0.5 border border-[#1e1e35]">
          {explanation.features.map((feature) => (
            <div
              key={feature.id}
              className="h-full rounded-sm transition-all duration-300 relative group cursor-help"
              style={{
                width: `${feature.percentage}%`,
                backgroundColor: feature.color,
              }}
              title={`${feature.label}: ${feature.percentage}% (+${feature.absoluteContribution})`}
            />
          ))}
        </div>
      </div>

      {/* Individual Feature Breakdown Cards */}
      <div className="grid grid-cols-1 gap-2">
        {explanation.features.map((feature) => (
          <div
            key={feature.id}
            className="p-2 rounded-lg bg-[#121222] border border-[#1e1e35] hover:border-[#2e2e4a] transition-colors flex flex-col gap-1.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span style={{ color: feature.color }} className="shrink-0">
                  {getIconComponent(feature.icon)}
                </span>
                <span className="font-semibold text-[#e8e8f0] text-[11px] truncate">
                  {feature.label}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-[#1a1a2e] text-white font-bold">
                  {feature.percentage}%
                </span>
                <span className="font-bold" style={{ color: feature.color }}>
                  +{feature.absoluteContribution}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-[#8a8aa3] leading-normal">
              {feature.description}
            </p>

            {/* Matched Token / Attribute Badges */}
            {feature.matchedItems && feature.matchedItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[9px] font-mono text-[#8a8aa3]">Совпадение:</span>
                {feature.matchedItems.map((token, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border"
                    style={{
                      backgroundColor: `${feature.color}15`,
                      borderColor: `${feature.color}40`,
                      color: feature.color,
                    }}
                  >
                    {token}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Micro footer hint */}
      <div className="flex items-center justify-between text-[9px] font-mono text-[#8a8aa3] pt-1 border-t border-[#1e1e35]/60">
        <span className="flex items-center gap-1">
          <ShieldCheck size={11} className="text-[#3ee89a]" />
          Детерминированный векторный расчет в рантайме
        </span>
        <span className="text-[#00f0ff]">Cosine Similarity Vector Decomposition</span>
      </div>
    </div>
  );
};
