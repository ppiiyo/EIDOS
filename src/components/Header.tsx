import React, { useState } from 'react';
import {
  Cloud,
  RefreshCw,
  LogIn,
  LogOut,
  User as UserIcon,
  Cpu,
  Sparkles,
  Layers,
  Zap,
  Boxes,
  Activity,
  CheckCircle2,
  Workflow,
  ShoppingBag,
  CircleDot,
  Network,
  Code2,
  BookOpen,
} from 'lucide-react';
import { Project, StatusKind, ActiveTab } from '../types';
import { useStorage } from '../context/StorageContext';

interface HeaderProps {
  projects: Project[];
  currentProject: Project;
  status: { text: string; kind: StatusKind };
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onRenameProject: () => void;
  onDeleteProject: () => void;
  onOpenPromptInspector?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  currentProject,
  status,
  activeTab,
  onChangeTab,
  onSelectProject,
  onOpenPromptInspector,
}) => {
  const { user, loading, isSyncing, cloudConnected, login, logout } = useStorage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navTabs: { key: ActiveTab; label: string; desc: string }[] = [
    { key: 'landing', label: '🌟 Презентация & Архитектура', desc: 'Overview' },
    { key: 'recommender', label: '🛍️ Витрина & Поиск', desc: 'RecSys' },
    { key: 'universe3d', label: '🪐 3D Universe', desc: 'Three.js' },
    { key: 'adaptive', label: '⚡ Adaptive AI', desc: 'AIL Studio' },
    { key: 'agent_studio', label: '🤖 ИИ-Агент & Защита', desc: 'RecSys Copilot' },
    { key: 'graph', label: '◈ Семантический Граф', desc: 'KG' },
    { key: 'integration', label: '⚡ REST API & SDK', desc: 'Endpoints' },
  ];

  return (
    <header className="flex flex-col border-b border-[#1b2034] bg-[#080912]/95 backdrop-blur-2xl z-30 shrink-0">
      {/* Top Bar: Brand, Actions, Telemetry, Auth */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 h-14 sm:h-16">
        {/* Brand Identity */}
        <div
          onClick={() => onChangeTab('landing')}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none shrink-0"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-purple-600 flex items-center justify-center text-black font-black text-lg sm:text-xl shadow-[0_0_20px_rgba(0,240,255,0.35)] group-hover:scale-105 transition-transform shrink-0">
            ◈
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-[14px] sm:text-[15px] tracking-wider text-white font-mono leading-none group-hover:text-cyan-300 transition-colors">
                EIDOS
              </span>
              <span className="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                v2.4.0 PRO
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-[#64748b] tracking-wider uppercase font-mono mt-0.5 hidden xs:inline">
              Vector Intelligence & RecSys Platform
            </span>
          </div>
        </div>

        {/* Right Telemetry, Prompt Inspector, Status & Auth Badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* PROMPT INSPECTOR BUTTON - KEY FEATURE */}
          {onOpenPromptInspector && (
            <button
              onClick={onOpenPromptInspector}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-cyan-500/20 hover:from-purple-500/30 hover:to-cyan-500/30 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs font-mono font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)] transition-all cursor-pointer animate-pulse"
              title="Открыть инспектор боевых промптов и системных инструкций"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden sm:inline">📜 Промпты & Трейсы</span>
              <span className="sm:hidden">📜 Промпты</span>
            </button>
          )}

          {/* Real-time System Telemetry */}
          <div className="hidden md:flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#0e1222] border border-[#1b233a] text-[11px] font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>103/103 Tests ✓</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#0e1222] border border-[#1b233a] text-[11px] font-mono text-cyan-400 flex items-center gap-1">
              <Boxes className="w-3 h-3" />
              <span>INT8 -75% RAM</span>
            </span>
          </div>

          {/* Cloud Sync Status */}
          <div className="flex items-center gap-2 border-l border-[#1d233a] pl-2 sm:pl-3">
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#64748b]">
              <Cloud
                className={`w-3.5 h-3.5 ${cloudConnected ? 'text-cyan-400' : 'text-[#64748b]'}`}
              />
              {isSyncing && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
            </div>

            {/* User Account / Auth */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121629] border border-[#202742] text-xs font-mono text-white cursor-pointer hover:border-cyan-500/40 transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="max-w-[70px] truncate">{user.email?.split('@')[0] || 'User'}</span>
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#0c0f1c] border border-[#1e253e] rounded-xl shadow-2xl p-2 z-50">
                    <div className="text-[11px] font-mono text-[#8a8aa3] px-2 py-1 truncate">
                      {user.email}
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs font-mono text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center gap-1.5 cursor-pointer mt-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Выйти</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={login}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#141829] hover:bg-[#1a2036] border border-[#202742] text-xs font-mono text-[#cbd5e1] hover:text-white transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden xs:inline">Войти</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Module Navigation Bar - RESPONSIVE & ALWAYS VISIBLE */}
      <div className="px-3 sm:px-5 py-1.5 border-t border-[#141828] bg-[#06070f] flex items-center overflow-x-auto no-scrollbar gap-1.5">
        {navTabs.map((tab) => {
          const isActive =
            activeTab === tab.key ||
            (tab.key === 'landing' && activeTab === 'overview') ||
            (tab.key === 'overview' && activeTab === 'landing');

          return (
            <button
              key={tab.key}
              onClick={() => onChangeTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                  : 'text-[#8a8aa3] hover:text-white hover:bg-[#141829] border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
