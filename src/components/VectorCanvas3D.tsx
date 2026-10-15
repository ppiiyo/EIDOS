import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { CatalogItem } from '../types';
import { cosineSimilarity } from '@eidos/core';
import {
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Compass,
  Layers,
  Info,
  Maximize2,
  Send,
  Zap,
  Boxes,
  CircleDot,
  Sliders,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

interface VectorCanvas3DProps {
  catalog: CatalogItem[];
  embeddings: Map<number, Float32Array>;
  selectedItemId: number | null;
  onSelectItem: (id: number) => void;
  onSetSeed?: (item: CatalogItem) => void;
  height?: string;
}

const CATEGORY_COLORS: Record<string, { hex: number; css: string }> = {
  Электроника: { hex: 0x00f0ff, css: '#00f0ff' },
  Игры: { hex: 0xa855f7, css: '#a855f7' },
  Книги: { hex: 0x10b981, css: '#10b981' },
  Фильмы: { hex: 0xf43f5e, css: '#f43f5e' },
  Техника: { hex: 0xf59e0b, css: '#f59e0b' },
  Одежда: { hex: 0xec4899, css: '#ec4899' },
  Default: { hex: 0x6366f1, css: '#6366f1' },
};

type TopologyMode = 'hypersphere' | 'hnsw_layers' | 'int8_grid';

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

  // Vector Steering Interactive State
  const [steerQuery, setSteerQuery] = useState('');
  const [isSteeringActive, setIsSteeringActive] = useState(false);
  const [steerTargetPos, setSteerTargetPos] = useState<THREE.Vector3 | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodesGroupRef = useRef<THREE.Group | null>(null);
  const beamsGroupRef = useRef<THREE.Group | null>(null);
  const capsulesGroupRef = useRef<THREE.Group | null>(null);
  const steerProbeRef = useRef<THREE.Mesh | null>(null);
  const steerBeamRef = useRef<THREE.Line | null>(null);

  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0.25, y: 0.6 });
  const cameraDistanceRef = useRef(300);

  // Compute 3D positions based on current topology mode
  const itemCoordinates = useMemo(() => {
    const coords = new Map<number, THREE.Vector3>();
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
        const phi = Math.acos(1 - (2 * (index + 0.5)) / catalog.length);
        const theta = Math.PI * (1 + 5 ** 0.5) * index;
        x = radius * Math.cos(theta) * Math.sin(phi);
        y = radius * Math.sin(theta) * Math.sin(phi);
        z = radius * Math.cos(phi);
      }

      if (topologyMode === 'hnsw_layers') {
        // HNSW Layering: partition items into 3 vertical tiers
        // L0 (base layer, all items), L1 (intermediate ~30%), L2 (highway top layer ~10%)
        const layer = (item.id * 17) % 100 < 15 ? 2 : (item.id * 17) % 100 < 45 ? 1 : 0;
        const layerZ = layer === 2 ? 80 : layer === 1 ? 0 : -80;
        const spread = layer === 2 ? 0.6 : layer === 1 ? 0.85 : 1.1;
        coords.set(item.id, new THREE.Vector3(x * spread, y * spread, layerZ));
      } else if (topologyMode === 'int8_grid') {
        // INT8 Discrete Grid: snap coordinates to quantized steps
        const step = 22;
        const qx = Math.round(x / step) * step;
        const qy = Math.round(y / step) * step;
        const qz = Math.round(z / step) * step;
        coords.set(item.id, new THREE.Vector3(qx, qy, qz));
      } else {
        // Default: Hypersphere
        coords.set(item.id, new THREE.Vector3(x, y, z));
      }
    });

    return coords;
  }, [catalog, embeddings, topologyMode]);

  const selectedItem = useMemo(() => {
    return catalog.find((i) => i.id === selectedItemId) || null;
  }, [catalog, selectedItemId]);

  const nearestNeighbors = useMemo(() => {
    if (!selectedItemId || !embeddings.has(selectedItemId)) return [];
    const sourceEmb = embeddings.get(selectedItemId)!;
    const scores: { item: CatalogItem; sim: number; pos: THREE.Vector3 }[] = [];

    catalog.forEach((it) => {
      if (it.id === selectedItemId) return;
      const targetEmb = embeddings.get(it.id);
      if (!targetEmb) return;
      const sim = cosineSimilarity(Array.from(sourceEmb), Array.from(targetEmb));
      const pos = itemCoordinates.get(it.id);
      if (pos) {
        scores.push({ item: it, sim, pos });
      }
    });

    scores.sort((a, b) => b.sim - a.sim);
    return scores.slice(0, 5);
  }, [selectedItemId, embeddings, catalog, itemCoordinates]);

  // Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const heightPx = container.clientHeight || 550;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 2500);
    camera.position.set(0, 40, cameraDistanceRef.current);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 2.0);
    dirLight1.position.set(250, 350, 250);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 1.6);
    dirLight2.position.set(-250, -250, -250);
    scene.add(dirLight2);

    // Background Particle Starfield
    const particleCount = 650;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      particlePositions[i] = (Math.random() - 0.5) * 1000;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 1.8,
      transparent: true,
      opacity: 0.45,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Celestial Grid Rings
    const ringGroup = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const ringSphere = new THREE.Mesh(new THREE.SphereGeometry(130, 24, 24), ringMat);
    ringGroup.add(ringSphere);
    scene.add(ringGroup);

    // Node, Beam, Capsule, and Steering Groups
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);
    nodesGroupRef.current = nodesGroup;

    const beamsGroup = new THREE.Group();
    scene.add(beamsGroup);
    beamsGroupRef.current = beamsGroup;

    const capsulesGroup = new THREE.Group();
    scene.add(capsulesGroup);
    capsulesGroupRef.current = capsulesGroup;

    // Steering Probe Sphere
    const probeGeom = new THREE.SphereGeometry(4.5, 16, 16);
    const probeMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.5,
    });
    const steerProbe = new THREE.Mesh(probeGeom, probeMat);
    steerProbe.visible = false;
    scene.add(steerProbe);
    steerProbeRef.current = steerProbe;

    // Controls
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      targetRotationRef.current.y += deltaX * 0.005;
      targetRotationRef.current.x += deltaY * 0.005;
      targetRotationRef.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotationRef.current.x));

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistanceRef.current = Math.max(120, Math.min(550, cameraDistanceRef.current + e.deltaY * 0.35));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', onResize);

    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      if (autoRotate && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.0016;
      }

      if (camera) {
        const radius = cameraDistanceRef.current;
        const phi = Math.PI / 2 - targetRotationRef.current.x;
        const theta = targetRotationRef.current.y;

        camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
        camera.position.y = radius * Math.cos(phi);
        camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
        camera.lookAt(0, 0, 0);
      }

      particles.rotation.y += 0.0003;
      ringGroup.rotation.y += 0.0006;

      // Animate Steering Probe Pulse
      if (steerProbeRef.current && steerProbeRef.current.visible) {
        const scale = 1 + Math.sin(elapsedTime * 6) * 0.25;
        steerProbeRef.current.scale.set(scale, scale, scale);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [autoRotate]);

  // Update Nodes Mesh
  useEffect(() => {
    const nodesGroup = nodesGroupRef.current;
    if (!nodesGroup) return;

    while (nodesGroup.children.length > 0) {
      nodesGroup.remove(nodesGroup.children[0]);
    }

    const sphereGeom = new THREE.SphereGeometry(3.8, 16, 16);

    catalog.forEach((item) => {
      if (filterCategory !== 'all' && item.category !== filterCategory) return;
      const pos = itemCoordinates.get(item.id);
      if (!pos) return;

      const isSelected = item.id === selectedItemId;
      const catConfig = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Default;
      const baseColor = catConfig.hex;

      const mat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffffff : baseColor,
        emissive: isSelected ? 0x00f0ff : baseColor,
        emissiveIntensity: isSelected ? 1.2 : 0.45,
        roughness: 0.15,
        metalness: 0.8,
      });

      const mesh = new THREE.Mesh(sphereGeom, mat);
      mesh.position.copy(pos);
      mesh.userData = { id: item.id, item };

      if (isSelected) {
        // Double Glowing Halo Rings
        const ringGeom = new THREE.RingGeometry(6.0, 7.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.lookAt(mesh.position.clone().multiplyScalar(2));
        mesh.add(ring);
      }

      nodesGroup.add(mesh);
    });
  }, [catalog, itemCoordinates, selectedItemId, filterCategory]);

  // Update Semantic Beams
  useEffect(() => {
    const beamsGroup = beamsGroupRef.current;
    if (!beamsGroup) return;

    while (beamsGroup.children.length > 0) {
      beamsGroup.remove(beamsGroup.children[0]);
    }

    if (!showBeams || !selectedItemId || nearestNeighbors.length === 0) return;

    const sourcePos = itemCoordinates.get(selectedItemId);
    if (!sourcePos) return;

    nearestNeighbors.forEach((nn) => {
      // Dynamic curved bezier beam
      const mid = new THREE.Vector3()
        .addVectors(sourcePos, nn.pos)
        .multiplyScalar(0.5)
        .multiplyScalar(1.15); // Push outward for graceful arc

      const curve = new THREE.QuadraticBezierCurve3(sourcePos, mid, nn.pos);
      const tubeGeom = new THREE.TubeGeometry(curve, 24, 0.7, 8, false);

      const mat = new THREE.MeshBasicMaterial({
        color: nn.sim > 0.85 ? 0x00f0ff : 0xa855f7,
        transparent: true,
        opacity: Math.max(0.35, nn.sim * 0.95),
      });

      beamsGroup.add(new THREE.Mesh(tubeGeom, mat));
    });
  }, [selectedItemId, nearestNeighbors, showBeams, itemCoordinates]);

  // Update Multi-Interest Capsules (MIND)
  useEffect(() => {
    const capsulesGroup = capsulesGroupRef.current;
    if (!capsulesGroup) return;

    while (capsulesGroup.children.length > 0) {
      capsulesGroup.remove(capsulesGroup.children[0]);
    }

    if (!showCapsules) return;

    // Create 3 representative user interest centroids in 3D
    const centroids = [
      { name: 'Капсула 1: Гаджеты & Аудио', pos: new THREE.Vector3(60, 45, 70), color: 0x00f0ff },
      { name: 'Капсула 2: Sci-Fi & Космос', pos: new THREE.Vector3(-70, 30, -50), color: 0xa855f7 },
      { name: 'Капсула 3: Умный дом & Быт', pos: new THREE.Vector3(20, -75, 40), color: 0x3ee89a },
    ];

    centroids.forEach((c) => {
      const ringGeom = new THREE.RingGeometry(16, 18, 36);
      const ringMat = new THREE.MeshBasicMaterial({
        color: c.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.copy(c.pos);
      ring.lookAt(c.pos.clone().multiplyScalar(2));
      capsulesGroup.add(ring);

      const sphereGeom = new THREE.SphereGeometry(3.5, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: c.color,
        emissive: c.color,
        emissiveIntensity: 1.2,
      });
      const core = new THREE.Mesh(sphereGeom, sphereMat);
      core.position.copy(c.pos);
      capsulesGroup.add(core);
    });
  }, [showCapsules]);

  // Execute Vector Steering Trajectory
  const handleExecuteSteer = (label: string) => {
    if (!selectedItemId) return;
    const basePos = itemCoordinates.get(selectedItemId);
    if (!basePos) return;

    setIsSteeringActive(true);
    // Calculate new shifted vector coordinate
    const shiftVector = new THREE.Vector3(
      label.includes('премиум') ? 35 : -35,
      label.includes('белый') ? 40 : -25,
      label.includes('минимум') ? -45 : 35
    );
    const target = basePos.clone().add(shiftVector).normalize().multiplyScalar(130);
    setSteerTargetPos(target);

    if (steerProbeRef.current) {
      steerProbeRef.current.position.copy(target);
      steerProbeRef.current.visible = true;
    }

    // Animate target camera toward the steer probe
    targetRotationRef.current.y += 0.4;
  };

  const handleResetSteer = () => {
    setIsSteeringActive(false);
    setSteerTargetPos(null);
    setSteerQuery('');
    if (steerProbeRef.current) {
      steerProbeRef.current.visible = false;
    }
  };

  // Pointer Click Interaction
  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!container || !camera || !scene) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const nodesGroup = nodesGroupRef.current;
    if (!nodesGroup) return;

    const intersects = raycaster.intersectObjects(nodesGroup.children, true);
    if (intersects.length > 0) {
      let targetMesh: THREE.Object3D | null = intersects[0].object;
      while (targetMesh && !targetMesh.userData?.id && targetMesh.parent) {
        targetMesh = targetMesh.parent;
      }
      if (targetMesh && targetMesh.userData?.id) {
        onSelectItem(targetMesh.userData.id);
      }
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-[#070912] via-[#090b16] to-[#06070d] border border-[#1b2136] shadow-2xl flex flex-col" style={{ height }}>
      {/* 3D Canvas Mount Point */}
      <div
        ref={mountRef}
        onMouseDown={handlePointerDown}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* TOP CONTROLS & TOPOLOGY SWITCHER */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between flex-wrap gap-3 pointer-events-none">
        {/* Left: Topologies */}
        <div className="flex items-center gap-1.5 bg-[#0b0e1b]/80 backdrop-blur-md p-1.5 rounded-xl border border-[#1e253d] pointer-events-auto shadow-xl">
          <span className="text-[10px] font-mono text-[#64748b] px-2 font-semibold">ТОПОЛОГИЯ:</span>
          {(
            [
              { key: 'hypersphere', label: 'Гиперсфера (3D)', icon: CircleDot },
              { key: 'hnsw_layers', label: 'Слои HNSW (L0-L2)', icon: Layers },
              { key: 'int8_grid', label: 'Сетка INT8', icon: Boxes },
            ] as const
          ).map((t) => {
            const isActive = topologyMode === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTopologyMode(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                    : 'text-[#8a8aa3] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Quick Toggles */}
        <div className="flex items-center gap-2 bg-[#0b0e1b]/80 backdrop-blur-md p-1.5 rounded-xl border border-[#1e253d] pointer-events-auto shadow-xl">
          <button
            onClick={() => setShowCapsules(!showCapsules)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
              showCapsules
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                : 'text-[#8a8aa3] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Капсулы MIND {showCapsules ? '✓' : ''}</span>
          </button>

          <button
            onClick={() => setShowBeams(!showBeams)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
              showBeams
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-[#8a8aa3] hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Лучи kNN {showBeams ? '✓' : ''}</span>
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
              autoRotate ? 'text-cyan-400 bg-cyan-500/10' : 'text-[#8a8aa3] hover:text-white'
            }`}
            title="Авто-вращение камеры"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BOTTOM BAR: CONVERSATIONAL VECTOR STEERING */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row items-center justify-between gap-3 pointer-events-none">
        {/* Steering Input Toolbar */}
        <div className="flex items-center gap-2 bg-[#0b0e1b]/90 backdrop-blur-md p-2 rounded-xl border border-[#1e253d] pointer-events-auto shadow-2xl max-w-xl w-full">
          <span className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-1 shrink-0">
            <Compass className="w-4 h-4" />
            <span className="hidden sm:inline">Steering:</span>
          </span>

          <input
            type="text"
            value={steerQuery}
            onChange={(e) => setSteerQuery(e.target.value)}
            placeholder="Сдвиг вектора: «минимализм», «белый»…"
            className="flex-1 bg-[#121628] border border-[#202844] rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-[#64748b] focus:outline-none focus:border-cyan-400"
          />

          <button
            onClick={() => handleExecuteSteer(steerQuery || 'премиум минимализм')}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-sky-500 text-black font-mono text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 hover:opacity-95"
          >
            <Send className="w-3 h-3" />
            <span>Сдвинуть</span>
          </button>

          {isSteeringActive && (
            <button
              onClick={handleResetSteer}
              className="p-1.5 text-[#8a8aa3] hover:text-rose-400 cursor-pointer"
              title="Сбросить сдвиг"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selected Item Floating HUD Card */}
        {selectedItem && (
          <div className="p-3.5 bg-[#0c1020]/90 backdrop-blur-md rounded-xl border border-cyan-500/30 pointer-events-auto shadow-2xl flex items-center gap-3 shrink-0">
            <span className="text-2xl">{selectedItem.icon || '📦'}</span>
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold text-white">{selectedItem.title}</span>
              <span className="text-[10px] font-mono text-cyan-400">
                {selectedItem.category} {selectedItem.price ? `· ${selectedItem.price}` : ''}
              </span>
            </div>
            {onSetSeed && (
              <button
                onClick={() => onSetSeed(selectedItem)}
                className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-mono font-bold hover:bg-cyan-500/30 transition-all cursor-pointer"
              >
                Опорный
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
