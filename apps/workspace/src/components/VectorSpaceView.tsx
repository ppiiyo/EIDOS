import React, { useState, useMemo } from "react";
import { Boxes, Network, Sliders, ArrowUpRight } from 'lucide-react';
import { CatalogItem } from '../types';
import { VectorCanvas3D } from './VectorCanvas3D';
import { GraphView } from './GraphView';
import { buildCatalogSimilarityMatrix } from '../utils/recommenderEngine';
import { extractEdges, detectClusters, computeMetrics } from '../utils/graphMath';

interface VectorSpaceViewProps {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  selectedItem: CatalogItem | null;
  onSelectItem: (item: CatalogItem) => void;
  onInspectRecommendations: (item: CatalogItem) => void;
}

export const VectorSpaceView: React.FC<VectorSpaceViewProps> = ({
  catalog,
  embeddings,
  selectedItem,
  onSelectItem,
  onInspectRecommendations,
}) => {
  const [spaceMode, setSpaceMode] = useState<'3d' | '2d'>('3d');
  const [threshold, setThreshold] = useState<number>(0.24);

  const graphCatalog = useMemo(() => catalog.slice(0, 80), [catalog]);

  const { names, edges, clusters, metrics } = useMemo(() => {
    const itemNames = graphCatalog.map((c) => c.title);
    const matrix = buildCatalogSimilarityMatrix(graphCatalog, embeddings);
    const extractedEdges = extractEdges(itemNames, matrix, threshold);
    const detectedClusters = detectClusters(itemNames, extractedEdges);
    const graphMetrics = computeMetrics(itemNames, matrix, extractedEdges);
    return {
      names: itemNames,
      edges: extractedEdges,
      clusters: detectedClusters,
      metrics: graphMetrics,
    };
  }, [graphCatalog, embeddings, threshold]);

  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">3D Vector Space & 2D Topology Graph</h1>
          <p className="page-sub">
            Interactive projection of 384-dimensional embeddings, HNSW graph layers (L0–L2), INT8 quantization lattice, and force-directed semantic clusters
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg border bg-[var(--bg-alt)] border-[var(--border)]">
          <button
            type="button"
            onClick={() => setSpaceMode('3d')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              spaceMode === '3d' ? 'bg-[var(--accent)] text-white' : 'bg-transparent text-[var(--text-sec)]'
            }`}
          >
            <Boxes size={14} />
            <span>3D WebGL Universe (Three.js)</span>
          </button>

          <button
            type="button"
            onClick={() => setSpaceMode('2d')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              spaceMode === '2d' ? 'bg-[var(--accent)] text-white' : 'bg-transparent text-[var(--text-sec)]'
            }`}
          >
            <Network size={14} />
            <span>2D Force Topology Graph</span>
          </button>
        </div>
      </div>

      {selectedItem && (
        <div className="card mb-5 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-[var(--border)]">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-lg">{selectedItem.icon || '📦'}</span>
            <div>
              <div className="font-semibold text-sm text-[var(--text)]">
                Active Vector Node: {selectedItem.title}
              </div>
              <div className="text-[var(--text-sec)]">
                <span>{selectedItem.category}</span>
                <span className="mx-1.5">·</span>
                <span className="mono">ID #{selectedItem.id}</span>
                <span className="mx-1.5">·</span>
                <span className="mono">384-d L2 Normalized</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onInspectRecommendations(selectedItem)}
            className="btn btn-secondary btn-sm"
          >
            <span>Inspect in MMR Recommendations</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
      )}

      {spaceMode === '3d' ? (
        <div className="rounded-xl overflow-hidden border border-[#1E293B] h-[640px]">
          <VectorCanvas3D
            catalog={catalog.slice(0, 150)}
            embeddings={embeddings}
            selectedItemId={selectedItem ? String(selectedItem.id) : String(catalog[0]?.id || '1')}
            onSelectItem={(id) => {
              const found = catalog.find((c) => String(c.id) === String(id));
              if (found) onSelectItem(found);
            }}
            onSetSeed={(item) => {
              onSelectItem(item);
              onInspectRecommendations(item);
            }}
            height="640px"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap text-xs">
              <div>
                <span className="text-[var(--text-sec)]">Nodes: </span>
                <strong className="mono">{names.length}</strong>
              </div>
              <span className="text-[var(--border-hi)]">·</span>
              <div>
                <span className="text-[var(--text-sec)]">Active Edges: </span>
                <strong className="mono">{edges.length}</strong>
              </div>
              <span className="text-[var(--border-hi)]">·</span>
              <div>
                <span className="text-[var(--text-sec)]">Detected Clusters: </span>
                <strong className="mono">{clusters.length}</strong>
              </div>
              <span className="text-[var(--border-hi)]">·</span>
              <div>
                <span className="text-[var(--text-sec)]">Graph Entropy: </span>
                <strong className="mono">{metrics.entropy.toFixed(2)} bits</strong>
              </div>
              <span className="text-[var(--border-hi)]">·</span>
              <div>
                <span className="text-[var(--text-sec)]">Clustering Coeff: </span>
                <strong className="mono">{(metrics.clustering * 100).toFixed(1)}%</strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Sliders size={14} className="text-[var(--text-sec)]" />
              <span className="text-xs font-medium text-[var(--text-sec)]">
                Cosine Edge Threshold:
              </span>
              <input
                type="range"
                min={0.1}
                max={0.75}
                step={0.02}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-[120px] accent-[var(--accent)]"
              />
              <span className="mono text-xs font-semibold text-[var(--accent)]">
                {(threshold * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-[#1E293B] h-[580px]">
            <GraphView
              names={names}
              edges={edges}
              clusters={clusters}
              metrics={metrics}
              threshold={threshold}
              highlightedConcept={selectedItem?.title || null}
            />
          </div>
        </div>
      )}
    </div>
  );
};
