import React from 'react';
import {
  Package,
  Search,
  Lightbulb,
  Split,
  MessageSquare,
  BarChart3,
  ArrowRight,
  Boxes,
  Sliders,
  Layers,
} from 'lucide-react';
import { ViewId } from '../Sidebar';

interface DashboardKpiGridProps {
  stats: {
    itemsCount: number;
    embeddingsCount: number;
    searches: number;
    recs: number;
    entropyBits: number;
    uniqueCategories: number;
    activeExperiments: number;
  };
  dominantLang: string;
  onNavigate: (view: ViewId) => void;
  t: any;
}

export const DashboardKpiGrid: React.FC<DashboardKpiGridProps> = ({
  stats,
  dominantLang,
  onNavigate,
  t,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
      <div className="card px-5 py-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[0.8125rem] text-[var(--text-sec)] font-medium">
            {t.kpiCorpusTitle}
          </span>
          <Package size={15} color="var(--accent)" />
        </div>
        <div className="mono text-[1.625rem] font-bold text-[var(--text)]">
          {stats.itemsCount.toLocaleString()} SKU
        </div>
        <div className="text-xs text-[var(--text-sec)] mt-1">
          <span className="mono">{stats.embeddingsCount.toLocaleString()}</span> × 384-d L2 ({dominantLang.toUpperCase()})
        </div>
      </div>

      <div className="card px-5 py-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[0.8125rem] text-[var(--text-sec)] font-medium">
            {t.kpiEntropyTitle}
          </span>
          <Layers size={15} color="var(--success)" />
        </div>
        <div className="mono text-[1.625rem] font-bold text-[var(--text)]">
          H = {stats.entropyBits.toFixed(2)} bits
        </div>
        <div className="text-xs text-[var(--text-sec)] mt-1">
          {t.kpiEntropySub} <span className="mono">{stats.uniqueCategories}</span>
        </div>
      </div>

      <div className="card px-5 py-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[0.8125rem] text-[var(--text-sec)] font-medium">
            {t.kpiOpsTitle}
          </span>
          <Search size={15} color="var(--warning)" />
        </div>
        <div className="mono text-[1.625rem] font-bold text-[var(--text)]">
          {stats.searches + stats.recs} ops
        </div>
        <div className="text-xs text-[var(--text-sec)] mt-1">
          <span className="mono">{stats.searches}</span> / <span className="mono">{stats.recs}</span> {t.kpiOpsSub}
        </div>
      </div>

      <div className="card px-5 py-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[0.8125rem] text-[var(--text-sec)] font-medium">
            {t.kpiAbTitle}
          </span>
          <Split size={15} color="var(--accent)" />
        </div>
        <div className="mono text-[1.625rem] font-bold text-[var(--text)]">
          {stats.activeExperiments} running
        </div>
        <div className="text-xs text-[var(--text-sec)] mt-1">
          {t.kpiAbSub}
        </div>
      </div>
    </div>
  );
};

export const DashboardModulesGrid: React.FC<{
  onNavigate: (view: ViewId) => void;
  t: any;
}> = ({ onNavigate, t }) => {
  const modules: Array<{ id: ViewId; title: string; desc: string; icon: React.FC<{ size?: number; color?: string }> }> = [
    { id: 'vectorspace', title: t.modules.vectorspace.title, desc: t.modules.vectorspace.desc, icon: Boxes },
    { id: 'adaptive', title: t.modules.adaptive.title, desc: t.modules.adaptive.desc, icon: Sliders },
    { id: 'search', title: t.modules.search.title, desc: t.modules.search.desc, icon: Search },
    { id: 'recommendations', title: t.modules.recommendations.title, desc: t.modules.recommendations.desc, icon: Lightbulb },
    { id: 'catalog', title: t.modules.catalog.title, desc: t.modules.catalog.desc, icon: Package },
    { id: 'analytics', title: t.modules.analytics.title, desc: t.modules.analytics.desc, icon: BarChart3 },
    { id: 'abtest', title: t.modules.abtest.title, desc: t.modules.abtest.desc, icon: Split },
    { id: 'conversational', title: t.modules.conversational.title, desc: t.modules.conversational.desc, icon: MessageSquare },
  ];

  return (
    <div>
      <h2 className="text-base font-semibold text-[var(--text)] mb-3">
        {t.modulesTitle}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {modules.map(({ id, title, desc, icon: Icon }) => (
          <div
            key={id}
            className="card p-4 cursor-pointer flex flex-col justify-between"
            onClick={() => onNavigate(id)}
          >
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={16} color="var(--accent)" />
                <span className="font-semibold text-sm text-[var(--text)]">{title}</span>
              </div>
              <p className="text-xs text-[var(--text-sec)] m-0 leading-relaxed">{desc}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--accent)] font-semibold mt-3">
              <span>{t.openModule}</span>
              <ArrowRight size={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
