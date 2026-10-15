import { EdgeLine, NodePoint } from '../semantic/graph';

export class GraphCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nodes: NodePoint[] = [];
  private edges: EdgeLine[] = [];
  private animId: number | null = null;
  private selectedNodeId: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire 2D canvas context');
    this.ctx = ctx;

    this.setupInteractions();
  }

  public setData(nodes: NodePoint[], edges: EdgeLine[]): void {
    this.nodes = nodes;
    this.edges = edges;
    this.startSimulation();
  }

  public setSelectedNode(id: string | null): void {
    this.selectedNodeId = id;
    this.render();
  }

  private setupInteractions(): void {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const node of this.nodes) {
        const dx = node.x - x;
        const dy = node.y - y;
        if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 4) {
          this.selectedNodeId = node.id;
          const event = new CustomEvent('node-selected', { detail: { id: node.id } });
          this.canvas.dispatchEvent(event);
          this.render();
          return;
        }
      }
    });
  }

  private startSimulation(): void {
    if (this.animId) cancelAnimationFrame(this.animId);

    let step = 0;
    const loop = () => {
      if (step < 60) {
        // Simple force relaxation
        for (let i = 0; i < this.nodes.length; i++) {
          for (let j = i + 1; j < this.nodes.length; j++) {
            const nA = this.nodes[i];
            const nB = this.nodes[j];
            const dx = nB.x - nA.x;
            const dy = nB.y - nA.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 80) {
              const force = (80 - dist) / dist * 0.05;
              nA.x -= dx * force;
              nA.y -= dy * force;
              nB.x += dx * force;
              nB.y += dy * force;
            }
          }
        }
        step++;
      }

      this.render();
      this.animId = requestAnimationFrame(loop);
    };

    loop();
  }

  private render(): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    // Draw edges
    const nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.ctx.lineWidth = 1;

    for (const edge of this.edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      const isHighlighted =
        this.selectedNodeId && (src.id === this.selectedNodeId || tgt.id === this.selectedNodeId);

      this.ctx.strokeStyle = isHighlighted
        ? 'rgba(56, 189, 248, 0.8)'
        : 'rgba(38, 46, 61, 0.5)';
      this.ctx.beginPath();
      this.ctx.moveTo(src.x, src.y);
      this.ctx.lineTo(tgt.x, tgt.y);
      this.ctx.stroke();
    }

    // Draw nodes
    for (const node of this.nodes) {
      const isSelected = node.id === this.selectedNodeId;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, isSelected ? node.radius + 3 : node.radius, 0, 2 * Math.PI);
      this.ctx.fillStyle = node.color;
      this.ctx.fill();

      if (isSelected) {
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.stroke();

        // Node label
        this.ctx.fillStyle = '#f1f5f9';
        this.ctx.font = '11px sans-serif';
        this.ctx.fillText(node.title.slice(0, 20), node.x + 10, node.y + 4);
      }
    }
  }

  public destroy(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
  }
}
