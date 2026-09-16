import { Edge, Cluster, GraphMetrics, Insight } from '../types';
import { CLUSTER_COLORS } from '../data/presets';

export function extractEdges(
  names: string[],
  matrix: Float32Array[],
  threshold: number
): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const sim = matrix[i]?.[j] ?? 0;
      if (sim >= threshold) {
        edges.push({ from: names[i], to: names[j], sim });
      }
    }
  }
  return edges.sort((a, b) => b.sim - a.sim);
}

export function detectClusters(
  nodes: string[],
  edges: Edge[],
  iterations = 18
): Cluster[] {
  if (!nodes.length) return [];

  const label = new Map<string, string>(nodes.map((n) => [n, n]));
  const adj = new Map<string, Array<{ to: string; sim: number }>>(
    nodes.map((n) => [n, []])
  );

  for (const e of edges) {
    adj.get(e.from)?.push({ to: e.to, sim: e.sim });
    adj.get(e.to)?.push({ to: e.from, sim: e.sim });
  }

  for (let it = 0; it < iterations; it++) {
    let changed = false;
    const order = [...nodes].sort(() => Math.random() - 0.5);

    for (const n of order) {
      const neighbors = adj.get(n) || [];
      if (!neighbors.length) continue;

      const weights = new Map<string, number>();
      for (const { to, sim } of neighbors) {
        const l = label.get(to) || to;
        weights.set(l, (weights.get(l) || 0) + sim);
      }

      let bestL = label.get(n) || n;
      let bestW = -Infinity;

      for (const [l, w] of weights) {
        if (w > bestW) {
          bestW = w;
          bestL = l;
        }
      }

      if (bestL !== label.get(n)) {
        label.set(n, bestL);
        changed = true;
      }
    }

    if (!changed) break;
  }

  const groups = new Map<string, string[]>();
  for (const [n, l] of label) {
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l)!.push(n);
  }

  const clusters: Cluster[] = Array.from(groups.entries())
    .map(([head, members], idx) => {
      return {
        id: `cluster-${idx + 1}`,
        name: `Кластер #${idx + 1}: ${head}`,
        color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
        concepts: members,
        cohesion: 0,
      };
    })
    .filter((c) => c.concepts.length > 0)
    .sort((a, b) => b.concepts.length - a.concepts.length);

  return clusters;
}

export function computeBetweenness(
  nodes: string[],
  edges: Edge[]
): Map<string, number> {
  const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    adj.get(e.to)?.push(e.from);
  }

  const CB = new Map<string, number>(nodes.map((n) => [n, 0]));

  for (const s of nodes) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>(nodes.map((n) => [n, []]));
    const sigma = new Map<string, number>(nodes.map((n) => [n, 0]));
    const dist = new Map<string, number>(nodes.map((n) => [n, -1]));

    sigma.set(s, 1);
    dist.set(s, 0);
    const queue: string[] = [s];

    while (queue.length) {
      const v = queue.shift()!;
      stack.push(v);

      for (const w of adj.get(v) || []) {
        if ((dist.get(w) ?? -1) < 0) {
          dist.set(w, (dist.get(v) ?? 0) + 1);
          queue.push(w);
        }
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          pred.get(w)?.push(v);
        }
      }
    }

    const delta = new Map<string, number>(nodes.map((n) => [n, 0]));
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w) || []) {
        const c =
          ((sigma.get(v) ?? 0) / (sigma.get(w) || 1)) *
          (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + c);
      }
      if (w !== s) {
        CB.set(w, (CB.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  // Undirected graph: divide by 2, then normalize to [0, 1]
  let max = 0;
  for (const [k, v] of CB) {
    const half = v / 2;
    CB.set(k, half);
    if (half > max) max = half;
  }
  if (max > 0) {
    for (const [k, v] of CB) {
      CB.set(k, v / max);
    }
  }

  return CB;
}

export function shortestPath(
  nodes: string[],
  edges: Edge[],
  from: string,
  to: string
): string[] | null {
  if (from === to) return [from];
  const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    adj.get(e.to)?.push(e.from);
  }

  const queue = [from];
  const prev = new Map<string, string | null>([[from, null]]);

  while (queue.length) {
    const v = queue.shift()!;
    if (v === to) break;

    for (const w of adj.get(v) || []) {
      if (!prev.has(w)) {
        prev.set(w, v);
        queue.push(w);
      }
    }
  }

  if (!prev.has(to)) return null;
  const path: string[] = [];
  let cur: string | null = to;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return path;
}

export function shannonEntropy(values: number[], bins = 12): number {
  if (!values.length) return 0;
  const hist = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.max(0, Math.min(bins - 1, Math.floor(v * bins)));
    hist[idx]++;
  }

  const total = values.length;
  let H = 0;
  for (const h of hist) {
    if (!h) continue;
    const p = h / total;
    H -= p * Math.log2(p);
  }
  return H;
}

export function computeMetrics(
  names: string[],
  matrix: Float32Array[],
  edges: Edge[]
): GraphMetrics {
  const n = names.length;
  const allSims: number[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allSims.push(matrix[i]?.[j] ?? 0);
    }
  }

  const density = n > 1 ? (2 * edges.length) / (n * (n - 1)) : 0;
  const avgSim = allSims.length
    ? allSims.reduce((a, b) => a + b, 0) / allSims.length
    : 0;
  const maxSim = allSims.length ? Math.max(...allSims) : 0;
  const minSim = allSims.length ? Math.min(...allSims) : 0;
  const entropy = shannonEntropy(allSims, 12);
  const maxEntropy = Math.log2(12);
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  // Degrees
  const deg = new Map<string, number>(names.map((nm) => [nm, 0]));
  for (const e of edges) {
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  }

  // Betweenness centrality
  const bc = computeBetweenness(names, edges);

  // Graph diameter (within connected components)
  let diameter = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p = shortestPath(names, edges, names[i], names[j]);
      if (p && p.length - 1 > diameter) {
        diameter = p.length - 1;
      }
    }
  }

  // Average clustering coefficient
  const adj = new Map<string, Set<string>>(names.map((nm) => [nm, new Set()]));
  for (const e of edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }

  let ccSum = 0;
  let ccCount = 0;
  for (const node of names) {
    const neighbors = Array.from(adj.get(node) || []);
    if (neighbors.length < 2) continue;

    let links = 0;
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        if (adj.get(neighbors[i])?.has(neighbors[j])) {
          links++;
        }
      }
    }
    const possible = (neighbors.length * (neighbors.length - 1)) / 2;
    ccSum += links / possible;
    ccCount++;
  }
  const clustering = ccCount > 0 ? ccSum / ccCount : 0;

  return {
    density,
    avgSim,
    maxSim,
    minSim,
    entropy,
    normalizedEntropy,
    diameter,
    clustering,
    deg,
    bc,
  };
}

export function generateInsights(
  names: string[],
  matrix: Float32Array[],
  edges: Edge[],
  clusters: Cluster[],
  metrics: GraphMetrics
): Insight[] {
  const out: Insight[] = [];
  const idxMap = new Map(names.map((n, i) => [n, i]));
  const clusterOf = new Map<string, number>();

  clusters.forEach((c, i) => {
    c.concepts.forEach((n) => clusterOf.set(n, i));
  });

  // Calculate cluster cohesion
  clusters.forEach((cl) => {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < cl.concepts.length; i++) {
      const idxA = idxMap.get(cl.concepts[i]) ?? -1;
      for (let j = i + 1; j < cl.concepts.length; j++) {
        const idxB = idxMap.get(cl.concepts[j]) ?? -1;
        if (idxA >= 0 && idxB >= 0) {
          sum += matrix[idxA]?.[idxB] ?? 0;
          count++;
        }
      }
    }
    cl.cohesion = count > 0 ? sum / count : 1.0;
  });

  // 1. Top Connections
  edges.slice(0, 5).forEach((e, i) => {
    const cA = clusterOf.get(e.from);
    const cB = clusterOf.get(e.to);
    const sameCluster = cA !== undefined && cA === cB;
    const cname = sameCluster
      ? `кластер #${(cA ?? 0) + 1}`
      : 'межкластерная смысловая связь';

    out.push({
      id: `conn-${i}`,
      type: 'connection',
      priority: 10 - i,
      title: `«${e.from}» ↔ «${e.to}»`,
      text: `Плотная семантическая пара с корреляцией ${(e.sim * 100).toFixed(0)}%. ${
        sameCluster
          ? `Оба концепта формируют ядро в ${cname}.`
          : `Связывает разные полюса смыслового поля (${cname}).`
      }`,
      concepts: [e.from, e.to],
      metric: e.sim,
      metricLabel: 'сходство (cosine)',
    });
  });

  // 2. Semantic Contrast (Maximum distance / polarity)
  let minPair: [string, string] | null = null;
  let minVal = 2.0;

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const s = matrix[i]?.[j] ?? 1.0;
      if (s < minVal) {
        minVal = s;
        minPair = [names[i], names[j]];
      }
    }
  }

  if (minPair) {
    out.push({
      id: 'contrast-1',
      type: 'contrast',
      priority: 8,
      title: `«${minPair[0]}» ⟷ «${minPair[1]}»`,
      text: `Максимальный семантический контраст (сходство ${(minVal * 100).toFixed(0)}%). Противоположные полюса смыслового пространства создают творческое напряжение и основу для сильных позиционирующих метафор.`,
      concepts: minPair,
      metric: minVal,
      metricLabel: 'мин. сходство',
    });
  }

  // 3. Bridges (High Betweenness Centrality)
  const sortedBc = Array.from(metrics.bc.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  sortedBc.slice(0, 3).forEach(([node, score], i) => {
    if (score < 0.08) return;
    const degree = metrics.deg.get(node) || 0;
    out.push({
      id: `bridge-${i}`,
      type: 'bridge',
      priority: 9 - i,
      title: `«${node}» — ключевой семантический мост`,
      text: `Узел с высокой посреднической центральностью (betweenness ${(score * 100).toFixed(0)}%). Объединяет ${degree} смежных смыслов, через него пролегают кратчайшие маршруты ассоциаций.`,
      concepts: [node],
      metric: score,
      metricLabel: 'центральность',
    });
  });

  // 4. Clusters with high cohesion
  clusters.forEach((c, i) => {
    if (c.concepts.length < 2) return;
    out.push({
      id: `cluster-${i}`,
      type: 'cluster',
      priority: 7 - i,
      title: `${c.name}`,
      text: `Содержит ${c.concepts.length} концептов: ${c.concepts.join(', ')}. Внутренняя смысловая плотность (когезия) составляет ${(c.cohesion * 100).toFixed(0)}%.`,
      concepts: c.concepts,
      metric: c.cohesion,
      metricLabel: 'когезия',
    });
  });

  // 5. Semantic Outliers
  const avgSimPerNode = new Map<string, number>();
  for (const n of names) {
    let sum = 0;
    let cnt = 0;
    const nIdx = idxMap.get(n) ?? -1;
    for (const m of names) {
      if (m === n) continue;
      const mIdx = idxMap.get(m) ?? -1;
      if (nIdx >= 0 && mIdx >= 0) {
        sum += matrix[nIdx]?.[mIdx] ?? 0;
        cnt++;
      }
    }
    avgSimPerNode.set(n, cnt > 0 ? sum / cnt : 0);
  }

  const sortedAvg = Array.from(avgSimPerNode.entries()).sort(
    (a, b) => a[1] - b[1]
  );
  sortedAvg.slice(0, 2).forEach(([node, avg], i) => {
    const cIdx = clusterOf.get(node);
    if (cIdx !== undefined && clusters[cIdx]?.concepts.length > 3) return;

    out.push({
      id: `outlier-${i}`,
      type: 'outlier',
      priority: 5,
      title: `«${node}» — семантический аутсайдер`,
      text: `Средняя связность с остальным полем ${(avg * 100).toFixed(0)}%. Это уникальная, независимая точка зрения, способная стать отличительным дифференциатором темы.`,
      concepts: [node],
      metric: avg,
      metricLabel: 'средн. связь',
    });
  });

  // 6. Overall Topology & Density
  const dPct = (metrics.density * 100).toFixed(0);
  const stateLabel =
    metrics.density > 0.5
      ? 'монолитное, высокоплотное'
      : metrics.density > 0.25
      ? 'сбалансированное, модульное'
      : metrics.density > 0.1
      ? 'разреженное, полифоническое'
      : 'фрагментированное';

  out.push({
    id: 'density-1',
    type: 'density',
    priority: 4,
    title: `Архитектура поля: ${stateLabel}`,
    text: `Активно ${dPct}% потенциальных ассоциативных путей. Энтропия поля составляет ${metrics.entropy.toFixed(2)} (${(metrics.normalizedEntropy * 100).toFixed(0)}% от максимума), что свидетельствует о ${
      metrics.normalizedEntropy > 0.7
        ? 'богатом смысловом разнообразии'
        : 'умеренной концентрации смыслов'
    }.`,
    concepts: [],
    metric: metrics.density,
    metricLabel: 'плотность (ρ)',
  });

  return out.sort((a, b) => b.priority - a.priority);
}
