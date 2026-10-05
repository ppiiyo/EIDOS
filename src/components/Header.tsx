import React from 'react';
import {
  Globe2,
  Sliders,
  Layers,
  Zap,
  Network,
  Compass,
  Activity,
  Github,
  CheckCircle2,
} from 'lucide-react';

export type AppViewTab =
  | 'vector-space-3d'
  | 'workbench'
  | 'multi-interest'
  | 'bandits'
  | 'hnsw-quant'
  | 'steering'
  | 'benchmarks';

interface HeaderProps {
  activeTab: AppViewTab;
  onChangeTab: (tab: AppViewTab) => void;
  catalogCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onChangeTab,
  catalogCount,
}) => {
  const tabs = [
    { id: 'vector-space-3d' as const, label: '3D Vector Topology', icon: Globe2 },
    { id: 'workbench' as const, label: 'Adaptive Studio', icon: Sliders },
    { id: 'multi-interest' as const, label: 'Multi-Interest', icon: Layers },
    { id: 'bandits' as const, label: 'Contextual Bandits', icon: Zap },
    { id: 'hnsw-quant' as const, label: 'HNSW & INT8', icon: Network },
    { id: 'steering' as const, label: 'Vector Steering', icon: Compass },
    { id: 'benchmarks' as const, label: 'Live Benchmarks', icon: Activity },
  ];

  return (
    <header className="flex items-center justify-between px-6 h-16 border-b border-[#1b1b2f] bg-[#08080f]/90 backdrop-blur-xl z-30 shrink-0 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-emerald-400 flex items-center justify-center text-[#07070c] font-black text-lg shadow-[0_0_20px_rgba(0,240,255,0.25)]">
          ◈
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[15px] tracking-wider text-white font-mono">
              EIDOS
            </span>
            <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.2 rounded bg-cyan-950/50 border border-cyan-800/40">
              AIL v1.2
            </span>
          </div>
          <div className="text-[10px] text-[#6e6e88] font-mono tracking-tight">
            Adaptive Intelligence Recommender
          </div>
        </div>
      </div>

      {/* Primary Navigation Segmented Controls */}
      <nav className="hidden lg:flex items-center gap-1 p-1 rounded-xl bg-[#0f0f1b] border border-[#1d1d33]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChangeTab(t.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,240,255,0.15)] font-medium'
                  : 'text-[#8a8aa3] hover:text-white hover:bg-[#161628]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-[#6c6c88]'}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Telemetry and GitHub Link */}
      <div className="flex items-center gap-4">
        {/* Real-time status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f0f1b] border border-[#1d1d33] text-xs font-mono text-[#8a8aa3]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-semibold">p50: 0.91ms</span>
          <span className="text-[#3c3c55]" aria-hidden="true">·</span>
          <span>{catalogCount} SKU</span>
        </div>

        <a
          href="https://github.com/ppiiyo/EIDOS"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-xl bg-[#0f0f1b] hover:bg-[#1a1a2e] text-[#8a8aa3] hover:text-white border border-[#1d1d33] transition-colors"
          title="GitHub Repository"
        >
          <Github className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
};
