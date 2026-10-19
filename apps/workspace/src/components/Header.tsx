import React, { useState } from 'react';
import {
  Cloud,
  RefreshCw,
  LogIn,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  FileSpreadsheet,
  Terminal,
  ExternalLink,
  Github,
} from 'lucide-react';
import { Project, StatusKind, ActiveTab } from '../types';
import { useStorage } from '../context/StorageContext';
import { EidosLogo } from './EidosLogo';
import { MemoryMonitor } from './MemoryMonitor';

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
  onOpenCsvImporter?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  currentProject,
  status,
  activeTab,
  onChangeTab,
  onSelectProject,
  onOpenPromptInspector,
  onOpenCsvImporter,
}) => {
  const { user, loading, isSyncing, cloudConnected, login, logout } = useStorage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navTabs: { key: ActiveTab; label: string; desc: string }[] = [
    { key: 'landing', label: 'Overview', desc: 'Enterprise Spec & Architecture' },
    { key: 'recommender', label: 'Catalog & RecSys', desc: 'Real-time Vector Search' },
    { key: 'universe3d', label: '3D Vector Space', desc: 'Spatial Topology' },
    { key: 'adaptive', label: 'Adaptive Model', desc: 'Online LinUCB Learner' },
    { key: 'agent_studio', label: 'Agent Studio', desc: 'Conversational Security' },
    { key: 'graph', label: 'Knowledge Graph', desc: 'Semantic Graph Engine' },
    { key: 'integration', label: 'API & SDK', desc: 'OpenAPI & Tracing' },
  ];

  return (
    <header className="flex flex-col border-b border-[#222226] bg-[#0A0A0C] text-[#F5F5F5] z-30 shrink-0">
      {/* Top Bar: Brand, Project Switcher, Metrics, Auth */}
      <div className="flex items-center justify-between gap-4 px-5 h-14">
        {/* Left: Enterprise Logo & Version */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onChangeTab('landing')}
            className="flex items-center gap-3 cursor-pointer group select-none"
            title="Eidos Home"
          >
            <EidosLogo variant="inverted" size="md" />
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#1F1F24] text-[#A3A3A3] border border-[#2E2E33]">
              v2.1.0 prod
            </span>
          </div>

          {/* Project Breadcrumb / Switcher */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[#222226] text-xs font-mono text-[#A3A3A3]">
            <span>Project:</span>
            <select
              value={currentProject.id}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-[#141418] border border-[#26262B] text-[#F5F5F5] px-2.5 py-1 rounded-md text-xs font-sans focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.concepts.length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Key Telemetry, CSV Hub, Prompt Inspector, Auth */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Real-time Memory Monitor (performance.memory API) */}
          <MemoryMonitor />

          {/* Key Enterprise Stats */}
          <div className="hidden xl:flex items-center gap-3 text-xs font-mono text-[#A3A3A3] pr-2">
            <span className="flex items-center gap-1.5 text-[#10B981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
              <span>103/103 tests</span>
            </span>
            <span>·</span>
            <span>0.93µs sim</span>
            <span>·</span>
            <span>14ms p50</span>
          </div>

          {/* CSV Import/Export Button */}
          {onOpenCsvImporter && (
            <button
              onClick={onOpenCsvImporter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#141418] hover:bg-[#1C1C22] text-[#F5F5F5] border border-[#26262B] text-xs font-medium transition-colors cursor-pointer"
              title="CSV Data Management & Export"
            >
              <FileSpreadsheet size={13} className="text-[#2563EB]" />
              <span className="hidden sm:inline">CSV Manager</span>
              <span className="sm:hidden">CSV</span>
            </button>
          )}

          {/* Prompt & Trace Inspector */}
          {onOpenPromptInspector && (
            <button
              onClick={onOpenPromptInspector}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#141418] hover:bg-[#1C1C22] text-[#F5F5F5] border border-[#26262B] text-xs font-medium transition-colors cursor-pointer"
              title="Inspect Production Prompts and LLM Traces"
            >
              <Terminal size={13} className="text-[#A3A3A3]" />
              <span className="hidden sm:inline">Prompts & Traces</span>
              <span className="sm:hidden">Traces</span>
            </button>
          )}

          {/* GitHub Link */}
          <a
            href="https://github.com/ppiiyo/Eidos"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-[#141418] transition-colors"
            title="GitHub Repository"
          >
            <Github size={14} />
          </a>

          {/* Auth & Cloud Sync */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#222226]">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141418] border border-[#26262B] text-xs font-mono text-[#F5F5F5] hover:border-[#383840] transition-colors cursor-pointer"
                >
                  <UserIcon size={12} className="text-[#2563EB]" />
                  <span className="max-w-[70px] truncate">
                    {user.email?.split('@')[0] || 'User'}
                  </span>
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#141418] border border-[#26262B] rounded-lg shadow-xl p-2 z-50">
                    <div className="text-[11px] font-mono text-[#A3A3A3] px-2 py-1 truncate">
                      {user.email}
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-[#EF4444] hover:bg-[#EF4444]/10 rounded flex items-center gap-1.5 cursor-pointer mt-1"
                    >
                      <LogOut size={12} />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={login}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <LogIn size={13} />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Bar: Clean Linear / Vercel style tabs */}
      <div className="px-5 border-t border-[#1C1C20] bg-[#0E0E12] flex items-center overflow-x-auto no-scrollbar gap-1">
        {navTabs.map((tab) => {
          const isActive =
            activeTab === tab.key ||
            (tab.key === 'landing' && activeTab === 'overview') ||
            (tab.key === 'overview' && activeTab === 'landing');

          return (
            <button
              key={tab.key}
              onClick={() => onChangeTab(tab.key)}
              className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? 'border-[#2563EB] text-white font-semibold'
                  : 'border-transparent text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-white/[0.02]'
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
