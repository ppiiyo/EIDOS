import React from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Project, StatusKind, ActiveTab } from '../types';

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
  onNewProject,
  onRenameProject,
  onDeleteProject,
}) => {
  const isRecommenderMode = activeTab === 'recommender';

  return (
    <header className="flex items-center gap-4 px-5 h-16 border-b border-[#1e1e35] bg-[#0b0b13]/80 backdrop-blur-xl z-20 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 min-w-[210px]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00e5ff] to-[#b478ff] flex items-center justify-center text-[#07070c] font-black text-xl shadow-[0_0_18px_rgba(0,229,255,0.3)]">
          {isRecommenderMode ? '🎯' : '◈'}
        </div>
        <div>
          <div className="font-extrabold text-[16px] tracking-wider bg-gradient-to-r from-[#00e5ff] via-[#b478ff] to-[#3ee89a] bg-clip-text text-transparent mono">
            {isRecommenderMode ? 'EIDOS Recommender' : 'EIDOS Ideation'}
          </div>
          <div className="text-[10px] text-[#8a8aa3] tracking-widest uppercase font-medium">
            {isRecommenderMode ? 'Семантические рекомендации' : 'Картирование смыслов'}
          </div>
        </div>
      </div>

      {/* Module Switcher Pills */}
      <div className="flex items-center gap-1 bg-[#111120] p-1 rounded-xl border border-[#1e1e35]">
        <button
          onClick={() => onChangeTab('landing')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs mono transition-all cursor-pointer ${
            activeTab === 'landing'
              ? 'bg-[#00e5ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-semibold shadow-[0_0_12px_rgba(0,229,255,0.2)]'
              : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
          }`}
        >
          <span>🌟 Презентация</span>
        </button>
        <button
          onClick={() => onChangeTab('recommender')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs mono transition-all cursor-pointer ${
            activeTab === 'recommender'
              ? 'bg-[#00e5ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-semibold shadow-[0_0_12px_rgba(0,229,255,0.2)]'
              : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
          }`}
        >
          <span>🎯 Витрина</span>
        </button>
        <button
          onClick={() => onChangeTab(activeTab === 'recommender' || activeTab === 'landing' ? 'analyze' : activeTab)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs mono transition-all cursor-pointer ${
            activeTab !== 'recommender' && activeTab !== 'landing'
              ? 'bg-[#b478ff]/15 text-[#b478ff] border border-[#b478ff]/30 font-semibold shadow-[0_0_12px_rgba(180,120,255,0.2)]'
              : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
          }`}
        >
          <span>◈ Ideation & Граф</span>
        </button>
      </div>

      {/* Project Selector Bar (visible in Ideation mode) */}
      {!isRecommenderMode && (
        <div className="flex items-center gap-1.5 flex-1 max-w-[420px]">
          <select
            id="project-selector-dropdown"
            value={currentProject.id}
            onChange={(e) => onSelectProject(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-[#111120] border border-[#1e1e35] text-[#e8e8f0] text-xs focus:outline-none focus:border-[#00e5ff] transition-colors cursor-pointer hover:border-[#2a2a4a]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.concepts.length} концептов)
              </option>
            ))}
          </select>

          <button
            id="new-project-header-btn"
            onClick={onNewProject}
            title="Новый проект"
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#1e1e35] bg-[#111120] text-[#8a8aa3] hover:text-[#00e5ff] hover:border-[#00e5ff] hover:shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-all cursor-pointer"
          >
            <Plus size={15} />
          </button>

          <button
            id="rename-project-header-btn"
            onClick={onRenameProject}
            title="Переименовать проект"
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#1e1e35] bg-[#111120] text-[#8a8aa3] hover:text-[#00e5ff] hover:border-[#00e5ff] transition-all cursor-pointer"
          >
            <Edit2 size={13} />
          </button>

          <button
            id="delete-project-header-btn"
            onClick={onDeleteProject}
            title="Удалить проект"
            disabled={projects.length <= 1}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border border-[#1e1e35] bg-[#111120] transition-all cursor-pointer ${
              projects.length <= 1
                ? 'opacity-30 cursor-not-allowed text-[#555570]'
                : 'text-[#8a8aa3] hover:text-[#ff6b9d] hover:border-[#ff6b9d] hover:shadow-[0_0_15px_rgba(255,107,157,0.2)]'
            }`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Status Pill */}
      <div className="ml-auto flex items-center gap-3">
        <div
          id="system-status-pill"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00e5ff]/5 border border-[#00e5ff]/15 mono text-[11px] text-[#8a8aa3]"
        >
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              status.kind === 'ready'
                ? 'bg-[#3ee89a] shadow-[0_0_8px_#3ee89a]'
                : status.kind === 'busy'
                ? 'bg-[#ffbe3d] pulse-glow'
                : 'bg-[#ff6b9d] shadow-[0_0_8px_#ff6b9d]'
            }`}
          />
          <span>{status.text}</span>
        </div>
      </div>
    </header>
  );
};
