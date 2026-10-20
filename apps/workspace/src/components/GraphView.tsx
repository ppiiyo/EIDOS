import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Home, Tag, RefreshCw, Pause, Play } from 'lucide-react';
import { Edge, Cluster, GraphMetrics, ForceNode } from '../types';
import { ForceLayout } from '../utils/forceLayout';

interface GraphViewProps {
  names: string[];
  edges: Edge[];
  clusters: Cluster[];
  metrics: GraphMetrics | null;
  threshold: number;
  highlightedConcept?: string | null;
}

export const GraphView: React.FC<GraphViewProps> = ({
  names,
  edges,
  clusters,
  metrics,
  threshold,
  highlightedConcept,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [showLabels, setShowLabels] = useState(true);
  const [isSimulating, setIsSimulating] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<ForceNode | null>(null);

  const forceRef = useRef<ForceLayout | null>(null);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });

  const getClusterForNode = useCallback(
    (nodeName: string): Cluster | undefined =>
      clusters.find((c) => c.concepts.includes(nodeName)),
    [clusters]
  );

  const rebuildLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;
    forceRef.current = new ForceLayout(
      names,
      edges,
      width / 2,
      height / 2,
      Math.min(width, height) * 0.36
    );
  }, [names, edges]);

  useEffect(() => {
    rebuildLayout();
  }, [rebuildLayout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const render = () => {
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 560;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const layout = forceRef.current;
      if (layout && isSimulating) {
        layout.step();
      }

      ctx.fillStyle = '#070913';
      ctx.fillRect(0, 0, width, height);

      if (layout) {
        ctx.save();
        ctx.translate(viewRef.current.x, viewRef.current.y);
        ctx.scale(viewRef.current.scale, viewRef.current.scale);

        // Draw edges
        for (const edge of layout.edges) {
          const u = layout.nodes[edge.a];
          const v = layout.nodes[edge.b];
          if (!u || !v) continue;
          ctx.beginPath();
          ctx.moveTo(u.x, u.y);
          ctx.lineTo(v.x, v.y);
          ctx.strokeStyle = `rgba(56, 189, 248, ${Math.min(0.65, edge.sim * 0.55)})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Draw nodes
        for (const node of layout.nodes) {
          const cl = getClusterForNode(node.name);
          const isHighlighted = highlightedConcept && node.name === highlightedConcept;
          const radius = isHighlighted ? 9 : 6;

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = isHighlighted ? '#ffffff' : cl?.color || '#38bdf8';
          ctx.fill();

          if (showLabels) {
            ctx.font = '11px Inter, sans-serif';
            ctx.fillStyle = isHighlighted ? '#38bdf8' : '#cbd5e1';
            ctx.fillText(node.name.slice(0, 26), node.x + radius + 4, node.y + 3);
          }
        }
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [edges, isSimulating, showLabels, highlightedConcept, getClusterForNode]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#070913] overflow-hidden">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsSimulating((v) => !v)}
          className="btn btn-secondary btn-sm"
        >
          {isSimulating ? <Pause size={13} /> : <Play size={13} />}
          <span>{isSimulating ? 'Pause Physics' : 'Resume'}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowLabels((v) => !v)}
          className="btn btn-secondary btn-sm"
        >
          <Tag size={13} />
          <span>{showLabels ? 'Hide Labels' : 'Show Labels'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            viewRef.current = { x: 0, y: 0, scale: 1 };
          }}
          className="btn btn-secondary btn-sm"
        >
          <Home size={13} />
          <span>Reset View</span>
        </button>
        <button
          type="button"
          onClick={rebuildLayout}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw size={13} />
          <span>Reheat</span>
        </button>
      </div>

      <div className="absolute bottom-3 left-3 z-10 text-xs mono text-slate-400 bg-slate-900/85 border border-slate-800 px-3 py-1.5 rounded-lg">
        Nodes: {names.length} · Edges: {edges.length} · Threshold: {(threshold * 100).toFixed(0)}%
        {metrics ? ` · Modularity: ${metrics.clustering.toFixed(2)}` : ''}
      </div>

      {hoveredNode && (
        <div className="absolute top-3 right-3 z-10 bg-slate-950/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
          {hoveredNode.name}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const nodes = forceRef.current?.nodes || [];
          const hit = nodes.find((n) => Math.hypot(n.x - mx, n.y - my) < 12) || null;
          setHoveredNode(hit);
        }}
      />
    </div>
  );
};
export default GraphView;
