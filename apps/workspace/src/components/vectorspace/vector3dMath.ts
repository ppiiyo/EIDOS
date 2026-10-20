import * as THREE from "three";
import { CatalogItem } from '../../types';

export type TopologyMode = 'hypersphere' | 'hnsw_layers' | 'int8_grid';

export const CATEGORY_COLORS: Record<string, { hex: number; css: string }> = {
  Электроника: { hex: 0x00f0ff, css: '#00f0ff' },
  Игры: { hex: 0xa855f7, css: '#a855f7' },
  Книги: { hex: 0x10b981, css: '#10b981' },
  Фильмы: { hex: 0xf43f5e, css: '#f43f5e' },
  Техника: { hex: 0xf59e0b, css: '#f59e0b' },
  Одежда: { hex: 0xec4899, css: '#ec4899' },
  Default: { hex: 0x6366f1, css: '#6366f1' },
};

export function compute3DTopologyCoordinates(
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>,
  topologyMode: TopologyMode
): Map<string, THREE.Vector3> {
  const coords = new Map<string, THREE.Vector3>();
  const radius = 130;

  catalog.forEach((item, index) => {
    const emb = embeddings.get(item.id);
    let x = 0;
    let y = 0;
    let z = 0;

    if (emb && emb.length >= 3) {
      x = emb[0];
      y = emb[1];
      z = emb[2];
      const len = Math.hypot(x, y, z) || 1;
      x = (x / len) * radius;
      y = (y / len) * radius;
      z = (z / len) * radius;
    } else {
      const phi = Math.acos(1 - (2 * (index + 0.5)) / Math.max(1, catalog.length));
      const theta = Math.PI * (1 + 5 ** 0.5) * index;
      x = radius * Math.cos(theta) * Math.sin(phi);
      y = radius * Math.sin(theta) * Math.sin(phi);
      z = radius * Math.cos(phi);
    }

    if (topologyMode === 'hnsw_layers') {
      const idNum = parseInt(item.id.replace(/\D/g, ''), 10) || index + 1;
      const layer = (idNum * 17) % 100 < 15 ? 2 : (idNum * 17) % 100 < 45 ? 1 : 0;
      const layerZ = layer === 2 ? 80 : layer === 1 ? 0 : -80;
      const spread = layer === 2 ? 0.6 : layer === 1 ? 0.85 : 1.1;
      coords.set(item.id, new THREE.Vector3(x * spread, y * spread, layerZ));
    } else if (topologyMode === 'int8_grid') {
      const step = 22;
      const qx = Math.round(x / step) * step;
      const qy = Math.round(y / step) * step;
      const qz = Math.round(z / step) * step;
      coords.set(item.id, new THREE.Vector3(qx, qy, qz));
    } else {
      coords.set(item.id, new THREE.Vector3(x, y, z));
    }
  });

  return coords;
}
