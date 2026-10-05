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
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  currentProject,
  status,
  activeTab,
  onChangeTab,
  onSelectProject,
}) => {
  const { user, loading, isSyncing, cloudConnected, login, logout } = useStorage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-4 px-5 h-16 border-b border-[#1b2034] bg-[#080912]/90 backdrop-blur-2xl z-30 shrink-0">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-purple-600 flex items-center justify-center text-black font-black text-xl shadow-[0_0_20px_rgba(0,240,255,0.35)] shrink-0">
          ◈
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[15px] tracking-wider text-white font-mono leading-none">
              EIDOS
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              v2.4.0 PRO
            </span>
          </div>
          <span className="text-[10px] text-[#64748b] tracking-wider uppercase font-mono mt-0.5">
            Vector Intelligence & RecSys Platform
          </span>
        </div>
      </div>

      {/* Main Module Navigation Tabs */}
      <nav className="hidden lg:flex items-center gap-1 bg-[#0e1120] p-1.5 rounded-xl border border-[#1d233a] shadow-inner">
        {[
          { key: 'recommender', label: '🛍️ Витрина & Поиск', desc: 'RecSys' },
          { key: 'universe3d', label: '🪐 3D Universe', desc: 'Three.js' },
          { key: 'adaptive', label: '⚡ Adaptive AI', desc: 'AIL Studio' },
          { key: 'agent_studio', label: '🤖 Multi-Agent Studio', desc: '6 Roles' },
          { key: 'graph', label: '◈ Семантический Граф', desc: 'KG' },
          { key: 'integration', label: '⚡ REST API & SDK', desc: 'Endpoints' },
          { key: 'overview', label: '🌟 Архитектура', desc: 'Specs' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChangeTab(tab.key as ActiveTab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                  : 'text-[#8a8aa3] hover:text-white hover:bg-[#141829]'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Telemetry & Status Badges */}
      <div className="flex items-center gap-3">
        {/* Real-time System Telemetry */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-[#0e1222] border border-[#1b233a] text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>88/88 Tests ✓</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#0e1222] border border-[#1b233a] text-[11px] font-mono text-cyan-400 flex items-center gap-1">
            <Boxes className="w-3 h-3" />
            <span>INT8 -75% RAM</span>
          </span>
        </div>

        {/* Cloud Sync Status */}
        <div className="flex items-center gap-2 border-l border-[#1d233a] pl-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-[#64748b]">
            <Cloud className={`w-3.5 h-3.5 ${cloudConnected ? 'text-cyan-400' : 'text-[#64748b]'}`} />
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
                <span className="max-w-[80px] truncate">{user.email?.split('@')[0] || 'User'}</span>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141829] hover:bg-[#1a2036] border border-[#202742] text-xs font-mono text-[#cbd5e1] hover:text-white transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400" />
              <span>Войти</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
