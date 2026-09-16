import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Home, Tag, RefreshCw, Pause, Play, Info } from 'lucide-react';
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
  const [hoveredNode, setHoveredNode] = useState<{
    node: ForceNode;
    cluster?: Cluster;
    degree: number;
    betweenness: number;
    neighbors: string[];
  } | null>(null);

  // Layout & view transforms
  const forceRef = useRef<ForceLayout | null>(null);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const interactionRef = useRef<{
    draggingNode: ForceNode | null;
    isPanning: boolean;
    panStart: { x: number; y: number };
    mousePos: { x: number; y: number };
  }>({
    draggingNode: null,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    mousePos: { x: 0, y: 0 },
  });

  // Cluster map
  const clusterMap = React.useMemo(() => {
    const map = new Map<string, Cluster>();
    clusters.forEach((c) => {
      c.concepts.forEach((concept) => map.set(concept, c));
    });
    return map;
  }, [clusters]);

  // Rebuild force layout when names or edges change
  const initLayout = useCallback(() => {
    if (!containerRef.current || names.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.32;

    const layout = new ForceLayout(names, edges, cx, cy, radius);
    // pre-warm physics
    for (let i = 0; i < 160; i++) {
      layout.step(1.5);
    }
    forceRef.current = layout;
  }, [names, edges]);

  useEffect(() => {
    initLayout();
  }, [initLayout]);

  // Reset view to center
  const resetView = () => {
    viewRef.current = { x: 0, y: 0, scale: 1 };
  };

  // Reheat physics
  const reheat = () => {
    initLayout();
  };

  // Coordinate transforms
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const { x: vx, y: vy, scale } = viewRef.current;
      return {
        x: (mx - vx) / scale,
        y: (my - vy) / scale,
      };
    },
    []
  );

  const findHitNode = useCallback(
    (worldX: number, worldY: number) => {
      if (!forceRef.current) return null;
      for (const n of forceRef.current.nodes) {
        const dx = n.x - worldX;
        const dy = n.y - worldY;
        if (dx * dx + dy * dy < 28 * 28) {
          return n;
        }
      }
      return null;
    },
    []
  );

  // Resize canvas according to devicePixelRatio
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    if (forceRef.current) {
      forceRef.current.cx = rect.width / 2;
      forceRef.current.cy = rect.height / 2;
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Animation Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // 1. Advance Physics step if active
      if (isSimulating && forceRef.current) {
        forceRef.current.step();
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Background subtle grid
      ctx.strokeStyle = 'rgba(30, 30, 53, 0.25)';
      ctx.lineWidth = 1;
      const gridSize = 40 * viewRef.current.scale;
      const offsetX = (viewRef.current.x % gridSize);
      const offsetY = (viewRef.current.y % gridSize);

      for (let x = offsetX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = offsetY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Empty State check
      if (!forceRef.current || forceRef.current.nodes.length === 0) {
        ctx.fillStyle = '#555570';
        ctx.font = '13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Запустите анализ, чтобы построить семантический граф', width / 2, height / 2);
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      // Apply view panning & zooming
      ctx.translate(viewRef.current.x, viewRef.current.y);
      ctx.scale(viewRef.current.scale, viewRef.current.scale);

      const activeNodes = forceRef.current.nodes;
      const activeEdges = forceRef.current.edges;
      const dragging = interactionRef.current.draggingNode;

      // 2. Draw Edges
      for (const e of activeEdges) {
        const a = activeNodes[e.a];
        const b = activeNodes[e.b];
        if (!a || !b) continue;

        const isConnectedToHover =
          hoveredNode &&
          (hoveredNode.node.name === a.name || hoveredNode.node.name === b.name);

        const isConnectedToHighlighted =
          highlightedConcept &&
          (highlightedConcept === a.name || highlightedConcept === b.name);

        let alpha = Math.max(0.06, Math.min(0.7, (e.sim - 0.2) * 1.3));
        let strokeColor = '#00e5ff';
        let lineWidth = 0.8 + e.sim * 2.2;

        if (isConnectedToHover || isConnectedToHighlighted) {
          alpha = 0.9;
          lineWidth += 1.5;
          strokeColor = '#3ee89a';
        } else if (hoveredNode || highlightedConcept) {
          alpha *= 0.25;
        }

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      ctx.globalAlpha = 1.0;

      // 3. Draw Nodes
      for (const n of activeNodes) {
        const cluster = clusterMap.get(n.name);
        const color = cluster ? cluster.color : '#00e5ff';

        const deg = metrics?.deg?.get(n.name) || 0;
        const bc = metrics?.bc?.get(n.name) || 0;
        const radius = Math.max(8, Math.min(22, 9 + deg * 1.4 + bc * 8));

        const isHover = hoveredNode?.node.name === n.name;
        const isDrag = dragging?.name === n.name;
        const isHighlight = highlightedConcept === n.name;

        // Glowing outer halo
        const haloRadius = radius * (isHover || isDrag || isHighlight ? 2.8 : 2.0);
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloRadius);
        grad.addColorStop(0, `${color}44`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Node circle background
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0a15';
        ctx.fill();

        // Node border
        ctx.lineWidth = isHover || isDrag || isHighlight ? 3.5 : 2;
        ctx.strokeStyle = isHover || isHighlight ? '#ffffff' : color;
        ctx.stroke();

        // Inner core dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label pill
        if (showLabels || isHover || isHighlight) {
          ctx.font = `${isHover || isHighlight ? '600 12px' : '500 11px'} 'Inter', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const label = n.name;
          const textMetrics = ctx.measureText(label);
          const textWidth = textMetrics.width;
          const pillHeight = 18;
          const pillPadding = 6;
          const pillWidth = textWidth + pillPadding * 2;
          const pillY = n.y + radius + 13;

          // Pill background
          ctx.fillStyle = isHover || isHighlight ? 'rgba(17, 17, 32, 0.95)' : 'rgba(7, 7, 12, 0.85)';
          ctx.strokeStyle = isHover || isHighlight ? color : '#1e1e35';
          ctx.lineWidth = 1;

          const rx = n.x - pillWidth / 2;
          const ry = pillY - pillHeight / 2;
          const r = 5;

          ctx.beginPath();
          ctx.moveTo(rx + r, ry);
          ctx.arcTo(rx + pillWidth, ry, rx + pillWidth, ry + pillHeight, r);
          ctx.arcTo(rx + pillWidth, ry + pillHeight, rx, ry + pillHeight, r);
          ctx.arcTo(rx, ry + pillHeight, rx, ry, r);
          ctx.arcTo(rx, ry, rx + pillWidth, ry, r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Pill text
          ctx.fillStyle = isHover || isHighlight ? '#ffffff' : '#e8e8f0';
          ctx.fillText(label, n.x, pillY);
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isSimulating, showLabels, clusterMap, metrics, highlightedConcept, hoveredNode]);

  // Mouse & Wheel Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const hit = findHitNode(worldPos.x, worldPos.y);

    if (hit) {
      interactionRef.current.draggingNode = hit;
    } else {
      interactionRef.current.isPanning = true;
      interactionRef.current.panStart = {
        x: e.clientX - viewRef.current.x,
        y: e.clientY - viewRef.current.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { draggingNode, isPanning, panStart } = interactionRef.current;
    interactionRef.current.mousePos = { x: e.clientX, y: e.clientY };

    if (draggingNode) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      draggingNode.x = worldPos.x;
      draggingNode.y = worldPos.y;
      draggingNode.vx = 0;
      draggingNode.vy = 0;
    } else if (isPanning) {
      viewRef.current.x = e.clientX - panStart.x;
      viewRef.current.y = e.clientY - panStart.y;
    } else {
      // Hover detection
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const hit = findHitNode(worldPos.x, worldPos.y);

      if (hit) {
        const cluster = clusterMap.get(hit.name);
        const deg = metrics?.deg?.get(hit.name) || 0;
        const bc = metrics?.bc?.get(hit.name) || 0;
        const neighbors = edges
          .filter((ed) => ed.from === hit.name || ed.to === hit.name)
          .map((ed) => (ed.from === hit.name ? ed.to : ed.from));

        setHoveredNode({
          node: hit,
          cluster,
          degree: deg,
          betweenness: bc,
          neighbors,
        });
      } else {
        setHoveredNode(null);
      }
    }
  };

  const handleMouseUp = () => {
    interactionRef.current.draggingNode = null;
    interactionRef.current.isPanning = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const oldScale = viewRef.current.scale;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.max(0.25, Math.min(4.0, oldScale * zoomFactor));

    viewRef.current.x = mx - (mx - viewRef.current.x) * (newScale / oldScale);
    viewRef.current.y = my - (my - viewRef.current.y) * (newScale / oldScale);
    viewRef.current.scale = newScale;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none bg-[#07070c]">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Top Left HUD */}
      <div className="absolute top-4 left-4 flex gap-2 flex-wrap pointer-events-none z-10">
        <div className="px-3 py-1.5 rounded-full bg-[#111120]/85 backdrop-blur-md border border-[#1e1e35] mono text-[11px] text-[#8a8aa3] shadow-lg">
          Связей: <strong className="text-[#00e5ff] font-semibold">{edges.length}</strong>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-[#111120]/85 backdrop-blur-md border border-[#1e1e35] mono text-[11px] text-[#8a8aa3] shadow-lg">
          Кластеров: <strong className="text-[#b478ff] font-semibold">{clusters.length}</strong>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-[#111120]/85 backdrop-blur-md border border-[#1e1e35] mono text-[11px] text-[#8a8aa3] shadow-lg">
          Порог: <strong className="text-[#3ee89a] font-semibold">{(threshold * 100).toFixed(0)}%</strong>
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-10">
        <button
          onClick={resetView}
          title="Сброс вида к центру"
          className="w-8 h-8 rounded-lg bg-[#111120]/85 backdrop-blur-md border border-[#1e1e35] text-[#8a8aa3] hover:text-[#00e5ff] hover:border-[#00e5ff] flex items-center justify-center transition-all cursor-pointer shadow-lg"
        >
          <Home size={14} />
        </button>
        <button
          onClick={() => setShowLabels(!showLabels)}
          title={showLabels ? 'Скрыть подписи' : 'Показать подписи'}
          className={`w-8 h-8 rounded-lg bg-[#111120]/85 backdrop-blur-md border border-[#1e1e35] flex items-center justify-center transition-all cursor-pointer shadow-lg ${
            showLabels ? 'text-[#00e5ff] border-[#00e5ff]/50' : 'text-[#8a8aa3] hover:text-[#00e5ff]'
          }`}
        >
          <Tag size={14} />
        </button>
        <button
          onClick={() => setIsSimulating(!isSimulating)}
          title={isSimulating ? 'Приостановить физику' : 'Запустить физику'}
          className={`w-8 h-8 rounded-lg bg-[#111120]/85 backdrop-blur-md border border-[#1e1e35] flex items-center justify-center transition-all cursor-pointer shadow-lg ${
            isSimulating ? 'text-[#3ee89a]' : 'text-[#8a8aa3] hover:text-[#3ee89a]'
          }`}
        >
          {isSimulating ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          onClick={reheat}
          title="Перестроить симуляцию"
          className="w-8 h-8 rounded-lg bg-[#111120]/85 backdrop-blur-md border border-[#1e1e35] text-[#8a8aa3] hover:text-[#b478ff] hover:border-[#b478ff] flex items-center justify-center transition-all cursor-pointer shadow-lg"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Hovered Node Inspection Card */}
      {hoveredNode && (
        <div className="absolute top-16 left-4 max-w-xs p-3.5 rounded-xl bg-[#111120]/90 backdrop-blur-xl border border-[#1e1e35] shadow-2xl z-10 pointer-events-none text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-[#1e1e35] pb-2">
            <span className="font-bold text-[#e8e8f0] text-sm">
              {hoveredNode.node.name}
            </span>
            {hoveredNode.cluster && (
              <span
                style={{ color: hoveredNode.cluster.color }}
                className="mono text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04]"
              >
                {hoveredNode.cluster.name}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] mono">
            <div className="text-[#8a8aa3]">
              Связей: <strong className="text-[#00e5ff]">{hoveredNode.degree}</strong>
            </div>
            <div className="text-[#8a8aa3]">
              Мост (BC):{' '}
              <strong className="text-[#b478ff]">
                {(hoveredNode.betweenness * 100).toFixed(0)}%
              </strong>
            </div>
          </div>
          {hoveredNode.neighbors.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] text-[#555570] uppercase mono">
                Соседи:
              </span>
              <div className="flex flex-wrap gap-1 mt-1 max-h-20 overflow-hidden">
                {hoveredNode.neighbors.slice(0, 6).map((nbr) => (
                  <span
                    key={nbr}
                    className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[#e8e8f0] text-[10px]"
                  >
                    {nbr}
                  </span>
                ))}
                {hoveredNode.neighbors.length > 6 && (
                  <span className="text-[10px] text-[#555570]">
                    +{hoveredNode.neighbors.length - 6}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Left Legend */}
      <div className="absolute bottom-4 left-4 flex gap-1.5 flex-wrap max-w-[70%] z-10 pointer-events-none">
        {clusters.slice(0, 6).map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111120]/85 backdrop-blur-md border border-[#1e1e35] text-[10px] mono text-[#8a8aa3] shadow-lg"
          >
            <span
              style={{ backgroundColor: c.color }}
              className="w-2 h-2 rounded-full inline-block"
            />
            <span className="text-[#e8e8f0] truncate max-w-[120px]">
              {c.concepts[0] || 'Кластер'}
            </span>
            <span className="text-[#555570]">+{Math.max(0, c.concepts.length - 1)}</span>
          </div>
        ))}
      </div>

      {/* Bottom Right Instruction Hint */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111120]/60 text-[10px] mono text-[#555570] pointer-events-none">
        <Info size={11} />
        <span>Drag — двигать узлы · Wheel — зум</span>
      </div>
    </div>
  );
};
