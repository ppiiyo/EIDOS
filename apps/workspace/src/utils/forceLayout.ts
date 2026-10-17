import { ForceNode, ForceEdge, Edge } from '../types';

export class ForceLayout {
  nodes: ForceNode[];
  edges: ForceEdge[];
  cx: number;
  cy: number;
  private nodeMap: Map<string, number>;

  constructor(names: string[], edges: Edge[], cx: number, cy: number, radius: number) {
    this.cx = cx;
    this.cy = cy;
    this.nodeMap = new Map();

    const n = names.length;
    this.nodes = names.map((name, i) => {
      this.nodeMap.set(name, i);
      const angle = (i / Math.max(n, 1)) * Math.PI * 2;
      const r = radius * (0.45 + Math.random() * 0.45);
      return {
        id: `node-${i}`,
        name,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });

    this.edges = edges
      .map((e) => {
        const a = this.nodeMap.get(e.from);
        const b = this.nodeMap.get(e.to);
        if (a === undefined || b === undefined) return null;
        return {
          from: e.from,
          to: e.to,
          sim: e.sim,
          a,
          b,
        };
      })
      .filter((e): e is ForceEdge => e !== null);
  }

  step(speedMultiplier = 1): void {
    const N = this.nodes;
    const n = N.length;
    if (n === 0) return;

    // 1. Repulsion between all pairs
    const repulsionConstant = 4800;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = N[i];
        const b = N[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 80;
        const d = Math.sqrt(d2);
        const force = repulsionConstant / d2;
        const fx = (force * dx) / d;
        const fy = (force * dy) / d;

        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // 2. Spring attraction along edges
    for (const e of this.edges) {
      const a = N[e.a];
      const b = N[e.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.001;

      // Higher similarity -> closer equilibrium distance
      const targetDist = Math.max(60, 160 - e.sim * 100);
      const stiffness = 0.024 * (0.5 + e.sim);
      const force = (d - targetDist) * stiffness;

      const fx = (force * dx) / d;
      const fy = (force * dy) / d;

      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // 3. Centering force & damping
    const centerPull = 0.005;
    const damping = 0.84;
    const maxVelocity = 12;

    for (let i = 0; i < n; i++) {
      const node = N[i];
      node.vx += (this.cx - node.x) * centerPull;
      node.vy += (this.cy - node.y) * centerPull;

      // Clamp speed
      const v = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (v > maxVelocity) {
        node.vx = (node.vx / v) * maxVelocity;
        node.vy = (node.vy / v) * maxVelocity;
      }

      node.vx *= damping;
      node.vy *= damping;

      node.x += node.vx * 0.45 * speedMultiplier;
      node.y += node.vy * 0.45 * speedMultiplier;
    }
  }
}
