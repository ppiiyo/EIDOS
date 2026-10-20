import React from 'react';
import { RotateCcw, Sparkles, ZoomIn, ZoomOut, Compass, Layers } from 'lucide-react';
import { CatalogItem } from '../../types';
import { TopologyMode } from './vector3dMath';

interface Vector3DHudProps {
  topologyMode: TopologyMode;
  autoRotate: boolean;
  showBeams: boolean;
  showCapsules: boolean;
  filterCategory: string;
  categories: string[];
  hoveredItem: CatalogItem | null;
  selectedItem: CatalogItem | null;
  neighbors: Array<{ item: CatalogItem; sim: number }>;
  onChangeTopology: (mode: TopologyMode) => void;
  onToggleAutoRotate: () => void;
  onToggleBeams: () => void;
  onToggleCapsules: () => void;
  onChangeCategory: (cat: string) => void;
  onZoom: (delta: number) => void;
  onResetCamera: () => void;
  onSelectNeighbor: (item: CatalogItem) => void;
  onSetSeed?: (item: CatalogItem) => void;
}

export const Vector3DHud: React.FC<Vector3DHudProps> = ({
  topologyMode,
  autoRotate,
  showBeams,
  showCapsules,
  filterCategory,
  categories,
  hoveredItem,
  selectedItem,
  neighbors,
  onChangeTopology,
  onToggleAutoRotate,
  onToggleBeams,
  onToggleCapsules,
  onChangeCategory,
  onZoom,
  onResetCamera,
  onSelectNeighbor,
  onSetSeed,
}) => {
  return (
    <>
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 backdrop-blur">
          {[
            { id: 'hypersphere' as const, label: '384-d Hypersphere' },
            { id: 'hnsw_layers' as const, label: 'HNSW Layers (L0-L2)' },
            { id: 'int8_grid' as const, label: 'INT8 Lattice' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChangeTopology(m.id)}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                topologyMode === m.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <select
          value={filterCategory}
          onChange={(e) => onChangeCategory(e.target.value)}
          className="bg-slate-900/90 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-2.5 py-1.5"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleAutoRotate}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer flex items-center gap-1 ${
            autoRotate
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-900/90 border-slate-700 text-slate-300'
          }`}
        >
          <Compass size={13} />
          <span>Orbit</span>
        </button>
        <button
          type="button"
          onClick={onToggleBeams}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer flex items-center gap-1 ${
            showBeams
              ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
              : 'bg-slate-900/90 border-slate-700 text-slate-300'
          }`}
        >
          <Sparkles size={13} />
          <span>k-NN Edges</span>
        </button>
        <button
          type="button"
          onClick={onToggleCapsules}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer flex items-center gap-1 ${
            showCapsules
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-900/90 border-slate-700 text-slate-300'
          }`}
        >
          <Layers size={13} />
          <span>Capsules</span>
        </button>
        <button
          type="button"
          onClick={() => onZoom(-40)}
          className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 cursor-pointer"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          onClick={() => onZoom(40)}
          className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 cursor-pointer"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          onClick={onResetCamera}
          className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 cursor-pointer"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {hoveredItem && (
        <div className="absolute bottom-3 left-3 z-10 bg-slate-950/90 border border-cyan-500/40 rounded-lg px-3.5 py-2.5 max-w-xs backdrop-blur">
          <div className="text-xs font-bold text-white">
            {hoveredItem.icon} {hoveredItem.title}
          </div>
          <div className="text-[11px] text-cyan-300 mono mt-0.5">
            {hoveredItem.category} · {hoveredItem.price || '—'}
          </div>
        </div>
      )}

      {selectedItem && (
        <div className="absolute bottom-3 right-3 z-10 bg-slate-950/90 border border-slate-700/90 rounded-xl p-3.5 w-72 backdrop-blur">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono uppercase text-cyan-400">Selected Anchor</span>
            {onSetSeed && (
              <button
                type="button"
                onClick={() => onSetSeed(selectedItem)}
                className="text-[11px] text-cyan-300 underline cursor-pointer bg-transparent border-0"
              >
                Open MMR Recs
              </button>
            )}
          </div>
          <div className="text-xs font-bold text-white mb-2">
            {selectedItem.icon} {selectedItem.title}
          </div>
          <div className="flex flex-col gap-1">
            {neighbors.slice(0, 3).map(({ item, sim }) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNeighbor(item)}
                className="flex items-center justify-between text-left px-2 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-[11px] text-slate-200 cursor-pointer border-0"
              >
                <span className="truncate pr-2">
                  {item.icon} {item.title}
                </span>
                <span className="mono text-emerald-400 shrink-0">{(sim * 100).toFixed(0)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
