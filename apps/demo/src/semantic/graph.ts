import { computeCosine } from './similarity';

export interface CatalogItemWithVector {
  id: string;
  title: string;
  category: string;
  embedding: Float32Array | number[];
}

export interface NodePoint {
  id: string;
  title: string;
  category: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export interface EdgeLine {
  source: string;
  target: string;
  weight: number;
}

export function generateGraphStructure(
  items: CatalogItemWithVector[],
  threshold = 0.55
): { nodes: NodePoint[]; edges: EdgeLine[] } {
  const categoryColors: Record<string, string> = {
    Electronics: '#38bdf8',
    Audio: '#a855f7',
    Office: '#10b981',
    Accessories: '#f59e0b',
    Software: '#ec4899',
    Default: '#64748b',
  };

  const nodes: NodePoint[] = items.map((item, idx) => {
    const angle = (idx / items.length) * 2 * Math.PI;
    const dist = 160 + (idx % 3) * 50;
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      x: 350 + Math.cos(angle) * dist,
      y: 280 + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      radius: 6,
      color: categoryColors[item.category] || categoryColors.Default,
    };
  });

  const edges: EdgeLine[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = computeCosine(items[i].embedding, items[j].embedding);
      if (sim >= threshold) {
        edges.push({
          source: items[i].id,
          target: items[j].id,
          weight: sim,
        });
      }
    }
  }

  return { nodes, edges };
}
