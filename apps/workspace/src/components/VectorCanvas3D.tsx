import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from 'three';
import { CatalogItem } from '../types';
import { cosineSimilarity } from '@eidos/core';
import { mulberry32 } from '../utils/recommenderEngine';
import {
  CATEGORY_COLORS,
  TopologyMode,
  compute3DTopologyCoordinates,
} from './vectorspace/vector3dMath';
import { Vector3DHud } from './vectorspace/Vector3DHud';

interface VectorCanvas3DProps {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onSetSeed?: (item: CatalogItem) => void;
  height?: string;
}

export const VectorCanvas3D: React.FC<VectorCanvas3DProps> = ({
  catalog,
  embeddings,
  selectedItemId,
  onSelectItem,
  onSetSeed,
  height = '100%',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<CatalogItem | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showBeams, setShowBeams] = useState(true);
  const [showCapsules, setShowCapsules] = useState(false);
  const [topologyMode, setTopologyMode] = useState<TopologyMode>('hypersphere');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodesGroupRef = useRef<THREE.Group | null>(null);
  const beamsGroupRef = useRef<THREE.Group | null>(null);
  const capsulesGroupRef = useRef<THREE.Group | null>(null);

  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0.25, y: 0.6 });
  const cameraDistanceRef = useRef(300);

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((i) => i.category))).sort(),
    [catalog]
  );

  const itemCoordinates = useMemo(
    () => compute3DTopologyCoordinates(catalog, embeddings, topologyMode),
    [catalog, embeddings, topologyMode]
  );

  const selectedItem = useMemo(
    () => catalog.find((c) => c.id === selectedItemId) || catalog[0] || null,
    [catalog, selectedItemId]
  );

  const topNeighbors = useMemo(() => {
    if (!selectedItem) return [];
    const targetEmb = embeddings.get(selectedItem.id);
    if (!targetEmb) return [];

    return catalog
      .filter((c) => c.id !== selectedItem.id && embeddings.has(c.id))
      .map((item) => ({
        item,
        sim: cosineSimilarity(targetEmb, embeddings.get(item.id)!),
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 5);
  }, [selectedItem, catalog, embeddings]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const h = container.clientHeight || 560;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06060e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(52, width / h, 1, 2000);
    camera.position.set(0, 60, cameraDistanceRef.current);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch {
      return;
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.0);
    dirLight.position.set(250, 350, 250);
    scene.add(dirLight);

    // Deterministic Starfield via mulberry32(2026)
    const rng = mulberry32(2026);
    const particleCount = 450;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      particlePositions[i] = (rng() - 0.5) * 900;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    scene.add(
      new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({ color: 0x38bdf8, size: 1.8, transparent: true, opacity: 0.4 })
      )
    );

    const nodesGroup = new THREE.Group();
    const beamsGroup = new THREE.Group();
    const capsulesGroup = new THREE.Group();
    scene.add(nodesGroup, beamsGroup, capsulesGroup);
    nodesGroupRef.current = nodesGroup;
    beamsGroupRef.current = beamsGroup;
    capsulesGroupRef.current = capsulesGroup;

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (autoRotate && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.0025;
      }
      const dist = cameraDistanceRef.current;
      const rx = targetRotationRef.current.x;
      const ry = targetRotationRef.current.y;
      camera.position.x = dist * Math.sin(ry) * Math.cos(rx);
      camera.position.y = dist * Math.sin(rx);
      camera.position.z = dist * Math.cos(ry) * Math.cos(rx);
      camera.lookAt(0, 0, 0);
      renderer?.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer?.dispose();
    };
  }, []);

  useEffect(() => {
    const nodesGroup = nodesGroupRef.current;
    const beamsGroup = beamsGroupRef.current;
    if (!nodesGroup || !beamsGroup) return;

    nodesGroup.clear();
    beamsGroup.clear();

    const sphereGeom = new THREE.SphereGeometry(3.4, 14, 14);
    catalog.forEach((item) => {
      if (filterCategory !== 'all' && item.category !== filterCategory) return;
      const pos = itemCoordinates.get(item.id);
      if (!pos) return;
      const isSelected = selectedItem?.id === item.id;
      const palette = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Default;
      const mat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffffff : palette.hex,
        emissive: palette.hex,
        emissiveIntensity: isSelected ? 1.4 : 0.45,
      });
      const mesh = new THREE.Mesh(sphereGeom, mat);
      mesh.position.copy(pos);
      if (isSelected) mesh.scale.setScalar(1.8);
      mesh.userData = { item };
      nodesGroup.add(mesh);
    });

    if (showBeams && selectedItem) {
      const originPos = itemCoordinates.get(selectedItem.id);
      if (originPos) {
        topNeighbors.forEach(({ item }) => {
          const targetPos = itemCoordinates.get(item.id);
          if (!targetPos) return;
          const lineGeom = new THREE.BufferGeometry().setFromPoints([originPos, targetPos]);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.65,
          });
          beamsGroup.add(new THREE.Line(lineGeom, lineMat));
        });
      }
    }
  }, [catalog, itemCoordinates, selectedItem, topNeighbors, showBeams, filterCategory]);

  return (
    <div className="relative w-full bg-[#06060e] select-none overflow-hidden" style={{ height }}>
      <Vector3DHud
        topologyMode={topologyMode}
        autoRotate={autoRotate}
        showBeams={showBeams}
        showCapsules={showCapsules}
        filterCategory={filterCategory}
        categories={categories}
        hoveredItem={hoveredItem}
        selectedItem={selectedItem}
        neighbors={topNeighbors}
        onChangeTopology={setTopologyMode}
        onToggleAutoRotate={() => setAutoRotate((v) => !v)}
        onToggleBeams={() => setShowBeams((v) => !v)}
        onToggleCapsules={() => setShowCapsules((v) => !v)}
        onChangeCategory={setFilterCategory}
        onZoom={(delta) => {
          cameraDistanceRef.current = Math.max(120, Math.min(520, cameraDistanceRef.current + delta));
        }}
        onResetCamera={() => {
          targetRotationRef.current = { x: 0.25, y: 0.6 };
          cameraDistanceRef.current = 300;
        }}
        onSelectNeighbor={(item) => onSelectItem(String(item.id))}
        onSetSeed={onSetSeed}
      />

      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          isDraggingRef.current = true;
          previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseMove={(e) => {
          if (!isDraggingRef.current) return;
          const dx = e.clientX - previousMousePositionRef.current.x;
          const dy = e.clientY - previousMousePositionRef.current.y;
          targetRotationRef.current.y += dx * 0.005;
          targetRotationRef.current.x = Math.max(
            -1.3,
            Math.min(1.3, targetRotationRef.current.x + dy * 0.005)
          );
          previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseUp={() => {
          isDraggingRef.current = false;
        }}
        onMouseLeave={() => {
          isDraggingRef.current = false;
          setHoveredItem(null);
        }}
      />
    </div>
  );
};
export default VectorCanvas3D;
