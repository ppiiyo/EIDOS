import React, { useState } from 'react';
import { Plus, Clipboard, Zap, Sliders, Search, X } from 'lucide-react';
import { Project } from '../types';
import { PRESET_DOMAINS } from '../data/presets';

interface SidebarProps {
  project: Project;
  threshold: number;
  isAnalyzing: boolean;
  onSelectPreset: (presetKey: string) => void;
  onAddConcept: (name: string) => void;
  onRemoveConcept: (index: number) => void;
  onOpenBatchPaste: () => void;
  onChangeThreshold: (val: number) => void;
  onRunAnalysis: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  project,
  threshold,
  isAnalyzing,
  onSelectPreset,
  onAddConcept,
  onRemoveConcept,
  onOpenBatchPaste,
  onChangeThreshold,
  onRunAnalysis,
}) => {
  const [newConceptInput, setNewConceptInput] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  const handleAdd = () => {
    if (!newConceptInput.trim()) return;
    onAddConcept(newConceptInput.trim());
    setNewConceptInput('');
  };

  const filteredConcepts = project.concepts.filter((c) =>
    c.name.toLowerCase().includes(filterQuery.toLowerCase().trim())
  );

  return (
    <aside className="w-[310px] border-r border-[#1e1e35] bg-gradient-to-b from-[#0b0b13]/80 to-[#07070c]/95 flex flex-col overflow-hidden shrink-0 select-none">
      {/* 1. Domain Selector */}
      <div className="p-3.5 border-b border-[#1e1e35] flex flex-col gap-2">
        <div className="flex justify-between items-center mono text-[10px] uppercase tracking-wider text-[#555570] font-semibold">
          <span>Готовые домены</span>
          <span className="text-[#8a8aa3] text-[9px]">Пресеты</span>
        </div>
        <select
          id="preset-domain-select"
          onChange={(e) => {
            if (e.target.value) onSelectPreset(e.target.value);
          }}
          defaultValue=""
          className="w-full px-3 py-2 rounded-lg bg-[#111120] border border-[#1e1e35] text-[#e8e8f0] text-xs focus:outline-none focus:border-[#00e5ff] transition-colors cursor-pointer hover:border-[#2a2a4a]"
        >
          <option value="" disabled>
            — Выберите смысловое поле —
          </option>
          {Object.entries(PRESET_DOMAINS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.icon} {p.name} ({p.concepts.length})
            </option>
          ))}
        </select>
      </div>

      {/* 2. Concepts Section */}
      <div className="p-3.5 flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
        <div className="flex justify-between items-center mono text-[10px] uppercase tracking-wider text-[#555570] font-semibold">
          <span>Концепты</span>
          <span className="px-2 py-0.5 rounded-full bg-[#00e5ff]/10 text-[#00e5ff] text-[10px] font-bold">
            {project.concepts.length}
          </span>
        </div>

        {/* Search concepts filter if > 8 concepts */}
        {project.concepts.length > 8 && (
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555570]"
            />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Поиск по списку..."
              className="w-full pl-7 pr-7 py-1.5 rounded-lg bg-[#111120]/70 border border-[#1e1e35] text-xs text-[#e8e8f0] placeholder-[#555570] focus:outline-none focus:border-[#00e5ff]"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8a8aa3] hover:text-[#ff6b9d]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Scrollable list of concepts */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1">
          {filteredConcepts.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#555570]">
              {project.concepts.length === 0
                ? 'Нет концептов. Добавьте ниже или выберите домен.'
                : 'Ничего не найдено'}
            </div>
          ) : (
            filteredConcepts.map((c) => {
              const originalIndex = project.concepts.findIndex(
                (orig) => orig.id === c.id
              );
              return (
                <div
                  key={c.id}
                  className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.02] border border-transparent hover:border-[#1e1e35] hover:bg-white/[0.04] transition-all text-xs"
                >
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#00e5ff]/15 to-[#b478ff]/15 text-[#00e5ff] font-bold text-[10px] flex items-center justify-center shrink-0">
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="flex-1 text-[#e8e8f0] truncate">
                    {c.name}
                  </span>
                  <button
                    onClick={() => onRemoveConcept(originalIndex)}
                    title="Удалить"
                    className="w-5 h-5 rounded flex items-center justify-center text-[#555570] hover:text-[#ff6b9d] hover:bg-[#ff6b9d]/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Add single concept */}
        <div className="flex gap-1.5 pt-1">
          <input
            type="text"
            id="single-concept-input"
            value={newConceptInput}
            onChange={(e) => setNewConceptInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Новый концепт..."
            maxLength={45}
            className="flex-1 px-3 py-2 rounded-lg bg-[#111120] border border-[#1e1e35] text-xs text-[#e8e8f0] placeholder-[#555570] focus:outline-none focus:border-[#00e5ff] focus:shadow-[0_0_12px_rgba(0,229,255,0.2)]"
          />
          <button
            id="add-concept-button"
            onClick={handleAdd}
            disabled={!newConceptInput.trim()}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#b478ff] text-[#07070c] font-bold text-sm flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Batch paste trigger button */}
        <button
          id="batch-paste-open-btn"
          onClick={onOpenBatchPaste}
          className="w-full py-1.5 px-2 rounded-lg border border-dashed border-[#1e1e35] text-[#8a8aa3] hover:text-[#00e5ff] hover:border-[#00e5ff]/50 text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Clipboard size={12} />
          <span>Вставить список (Batch)</span>
        </button>
      </div>

      {/* 3. Threshold & Action Section */}
      <div className="p-3.5 border-t border-[#1e1e35] flex flex-col gap-3 bg-[#07070c]/50">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[10px] mono text-[#8a8aa3]">
            <span className="flex items-center gap-1 text-[#555570]">
              <Sliders size={11} /> Порог связи
            </span>
            <span className="text-[#00e5ff] font-semibold">
              {(threshold * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0.15}
            max={0.75}
            step={0.02}
            value={threshold}
            onChange={(e) => onChangeThreshold(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#111120] rounded-lg appearance-none cursor-pointer accent-[#00e5ff]"
          />
        </div>

        <button
          id="run-analysis-btn"
          onClick={onRunAnalysis}
          disabled={isAnalyzing || project.concepts.length < 2}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#00e5ff] via-[#b478ff] to-[#3ee89a] text-[#07070c] font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(0,229,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] cursor-pointer"
        >
          <Zap size={14} className={isAnalyzing ? 'animate-spin' : ''} />
          <span>{isAnalyzing ? 'Анализ...' : '⚡ Запустить анализ'}</span>
        </button>
      </div>
    </aside>
  );
};
