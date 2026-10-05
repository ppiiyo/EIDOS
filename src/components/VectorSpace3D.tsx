import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { CatalogItem } from '../types';
import { cosineSimilarity } from '@eidos/core';
import {
  RotateCcw,
  Eye,
  Search,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Compass,
} from 'lucide-react';

interface VectorSpace3DProps {
  catalog: CatalogItem[];
  embeddings: Map<number, Float32Array>;
  selectedItemId: number | null;
  onSelectItem: (id: number) => void;
  onSetAsSeed?: (item: CatalogItem) => void;
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

export const VectorSpace3D: React.FC<VectorSpace3DProps> = ({
  catalog,
  embeddings,
  selectedItemId,
  onSelectItem,
  onSetAsSeed,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<CatalogItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [autoRotate, setAutoRotate] = useState(true);
  const [showBeams, setShowBeams] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  // References to Three.js instances for animation and cleanup
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodesGroupRef = useRef<THREE.Group | null>(null);
  const beamsGroupRef = useRef<THREE.Group | null>(null);
  const meshesMapRef = useRef<Map<number, THREE.Mesh>>(new Map());

  // Mouse interaction state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0.2, y: 0.5 });
  const cameraDistanceRef = useRef(320);

  // Compute 3D coordinates for each item from its 384-dim embedding
  const itemCoordinates = useMemo(() => {
    const coords = new Map<number, THREE.Vector3>();
    const radius = 130;

    catalog.forEach((item, index) => {
      const emb = embeddings.get(item.id);
      if (emb && emb.length >= 3) {
        // High-fidelity spherical projection from top 3 dense dimensions
        let x = emb[0];
        let y = emb[1];
        let z = emb[2];
        const len = Math.hypot(x, y, z) || 1;
        coords.set(
          item.id,
          new THREE.Vector3((x / len) * radius, (y / len) * radius, (z / len) * radius)
        );
      } else {
        // Fibonacci sphere distribution fallback
        const phi = Math.acos(1 - (2 * (index + 0.5)) / catalog.length);
        const theta = Math.PI * (1 + 5 ** 0.5) * index;
        coords.set(
          item.id,
          new THREE.Vector3(
            radius * Math.cos(theta) * Math.sin(phi),
            radius * Math.sin(theta) * Math.sin(phi),
            radius * Math.cos(phi)
          )
        );
      }
    });

    return coords;
  }, [catalog, embeddings]);

  // Selected item object
  const selectedItem = useMemo(() => {
    return catalog.find((i) => i.id === selectedItemId) || null;
  }, [catalog, selectedItemId]);

  // Nearest neighbors to selected item
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

  // Setup Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 50, cameraDistanceRef.current);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Ambient and directional lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.5);
    dirLight1.position.set(200, 300, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 1.2);
    dirLight2.position.set(-200, -200, -200);
    scene.add(dirLight2);

    // Background particle dust
    const particleCount = 400;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      particlePositions[i] = (Math.random() - 0.5) * 800;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x3b82f6,
      size: 1.8,
      transparent: true,
      opacity: 0.35,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Reference wireframe sphere
    const wireSphereGeom = new THREE.SphereGeometry(130, 24, 24);
    const wireSphereMat = new THREE.MeshBasicMaterial({
      color: 0x1f293d,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const wireSphere = new THREE.Mesh(wireSphereGeom, wireSphereMat);
    scene.add(wireSphere);

    // Groups
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);
    nodesGroupRef.current = nodesGroup;

    const beamsGroup = new THREE.Group();
    scene.add(beamsGroup);
    beamsGroupRef.current = beamsGroup;

    // Mouse event handlers for smooth orbit rotation
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

      // Limit pitch
      targetRotationRef.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotationRef.current.x));

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistanceRef.current = Math.max(160, Math.min(550, cameraDistanceRef.current + e.deltaY * 0.35));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Window resize handler
    const onResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', onResize);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (autoRotate && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.0015;
      }

      // Smooth camera interpolation
      if (camera) {
        const radius = cameraDistanceRef.current;
        const phi = Math.PI / 2 - targetRotationRef.current.x;
        const theta = targetRotationRef.current.y;

        camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
        camera.position.y = radius * Math.cos(phi);
        camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
        camera.lookAt(0, 0, 0);
      }

      // Slowly rotate particle dust
      particles.rotation.y += 0.0003;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
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
  }, []);

  // Update item nodes in the Three.js scene
  useEffect(() => {
    const nodesGroup = nodesGroupRef.current;
    if (!nodesGroup) return;

    // Clear previous node meshes
    while (nodesGroup.children.length > 0) {
      nodesGroup.remove(nodesGroup.children[0]);
    }
    meshesMapRef.current.clear();

    const sphereGeom = new THREE.SphereGeometry(3.5, 16, 16);

    catalog.forEach((item) => {
      const pos = itemCoordinates.get(item.id);
      if (!pos) return;

      const isSelected = item.id === selectedItemId;
      const catConfig = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Default;
      const baseColor = catConfig.hex;

      const mat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffffff : baseColor,
        emissive: isSelected ? 0x00f0ff : baseColor,
        emissiveIntensity: isSelected ? 0.9 : 0.4,
        roughness: 0.2,
        metalness: 0.7,
      });

      const mesh = new THREE.Mesh(sphereGeom, mat);
      mesh.position.copy(pos);
      mesh.userData = { id: item.id, item };

      // Halo ring for selected item
      if (isSelected) {
        const ringGeom = new THREE.RingGeometry(5.5, 6.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.lookAt(mesh.position.clone().multiplyScalar(2));
        mesh.add(ring);
      }

      nodesGroup.add(mesh);
      meshesMapRef.current.set(item.id, mesh);
    });
  }, [catalog, itemCoordinates, selectedItemId]);

  // Update similarity beams connecting selected node to nearest neighbors
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
      const points = [sourcePos, nn.pos];
      const curve = new THREE.LineCurve3(sourcePos, nn.pos);
      const tubeGeom = new THREE.TubeGeometry(curve, 20, 0.6, 6, false);

      // Color intensity based on cosine similarity
      const mat = new THREE.MeshBasicMaterial({
        color: nn.sim > 0.85 ? 0x00f0ff : 0xa855f7,
        transparent: true,
        opacity: Math.max(0.2, nn.sim * 0.9),
      });

      const tube = new THREE.Mesh(tubeGeom, mat);
      beamsGroup.add(tube);
    });
  }, [selectedItemId, nearestNeighbors, showBeams, itemCoordinates]);

  // Raycasting for click and hover selection
  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    const camera = cameraRef.current;
    const nodesGroup = nodesGroupRef.current;
    if (!container || !camera || !nodesGroup) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const intersects = raycaster.intersectObjects(nodesGroup.children, true);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const itemId = hit.userData?.id;
      if (itemId) {
        onSelectItem(itemId);
      }
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    const camera = cameraRef.current;
    const nodesGroup = nodesGroupRef.current;
    if (!container || !camera || !nodesGroup || isDraggingRef.current) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const intersects = raycaster.intersectObjects(nodesGroup.children, true);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const item = hit.userData?.item;
      if (item) {
        setHoveredItem(item);
        return;
      }
    }
    setHoveredItem(null);
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(catalog.map((i) => i.category));
    return ['all', ...Array.from(set)];
  }, [catalog]);

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter((it) => {
      const matchCat = selectedCategory === 'all' || it.category === selectedCategory;
      const matchQuery =
        !searchQuery ||
        it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [catalog, selectedCategory, searchQuery]);

  return (
    <div className="relative w-full h-full flex overflow-hidden select-none bg-[#07070c]">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
      />

      {/* Top Floating Telemetry & Controls HUD */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 bg-[#0d0d17]/85 backdrop-blur-md border border-[#1f1f33] px-3.5 py-2 rounded-xl shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>3D VECTOR TOPOLOGY</span>
          </div>
          <span className="text-[#33334d]" aria-hidden="true">|</span>
          <span className="text-xs text-[#8a8aa3] font-mono">
            {catalog.length} NODES · 384-DIM HYPERSPHERE
          </span>
        </div>

        {/* View Controls Toolbar */}
        <div className="flex items-center gap-1.5 bg-[#0d0d17]/85 backdrop-blur-md border border-[#1f1f33] p-1.5 rounded-xl shadow-2xl pointer-events-auto">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle Auto-Rotation"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
              autoRotate ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-[#8a8aa3] hover:text-white'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            <span>Orbit</span>
          </button>

          <button
            onClick={() => setShowBeams(!showBeams)}
            title="Toggle Similarity Beams"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
              showBeams ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-[#8a8aa3] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Beams</span>
          </button>

          <div className="w-[1px] h-4 bg-[#1f1f33] mx-1" />

          <button
            onClick={() => {
              cameraDistanceRef.current = Math.max(160, cameraDistanceRef.current - 40);
            }}
            title="Zoom In"
            className="p-1.5 rounded-lg text-[#8a8aa3] hover:text-white hover:bg-[#1a1a2e] transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              cameraDistanceRef.current = Math.min(550, cameraDistanceRef.current + 40);
            }}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-[#8a8aa3] hover:text-white hover:bg-[#1a1a2e] transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              targetRotationRef.current = { x: 0.2, y: 0.5 };
              cameraDistanceRef.current = 320;
            }}
            title="Reset Camera Orientation"
            className="p-1.5 rounded-lg text-[#8a8aa3] hover:text-white hover:bg-[#1a1a2e] transition-colors"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredItem && !selectedItem && (
        <div className="absolute bottom-6 left-6 max-w-sm bg-[#0e0e1a]/95 backdrop-blur-md border border-[#2a2a44] p-3.5 rounded-xl shadow-2xl pointer-events-none z-20 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{hoveredItem.icon || '📦'}</span>
            <span className="font-medium text-sm text-white truncate">{hoveredItem.title}</span>
          </div>
          <p className="text-xs text-[#8a8aa3] line-clamp-2 leading-relaxed mb-2">
            {hoveredItem.description}
          </p>
          <div className="flex items-center justify-between text-[11px] font-mono text-[#555570]">
            <span className="text-cyan-400">{hoveredItem.category}</span>
            <span>{hoveredItem.price}</span>
          </div>
        </div>
      )}

      {/* Bottom Category Filter Segmented Tabs */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#0d0d17]/85 backdrop-blur-md border border-[#1f1f33] p-1 rounded-xl shadow-2xl z-10 max-w-[90vw] overflow-x-auto">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all capitalize whitespace-nowrap ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-[#8a8aa3] hover:text-white hover:bg-[#151524]'
              }`}
            >
              {cat === 'all' ? 'All Domains' : cat}
            </button>
          );
        })}
      </div>

      {/* Right-Side Node Inspector Drawer */}
      {selectedItem && (
        <div className="absolute top-16 right-4 bottom-16 w-84 bg-[#0d0d18]/95 backdrop-blur-xl border border-[#24243b] rounded-2xl shadow-2xl p-4 flex flex-col z-20 animate-in slide-in-from-right duration-200">
          <div className="flex items-start justify-between pb-3 border-b border-[#1f1f33] mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-2 rounded-xl bg-[#141424] border border-[#24243b]">
                {selectedItem.icon || '💎'}
              </span>
              <div>
                <h4 className="text-sm font-semibold text-white leading-tight">{selectedItem.title}</h4>
                <span className="text-xs text-cyan-400 font-mono">{selectedItem.category}</span>
              </div>
            </div>
            <button
              onClick={() => onSelectItem(0)}
              className="text-[#666680] hover:text-white p-1 rounded-lg hover:bg-[#1a1a2a]"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-[#a0a0ba] leading-relaxed mb-4">
            {selectedItem.description}
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-[#121222] border border-[#1e1e32] p-2.5 rounded-xl">
              <span className="text-[10px] text-[#6b6b88] font-mono block">VALUATION</span>
              <span className="text-xs font-mono font-semibold text-white">{selectedItem.price || 'N/A'}</span>
            </div>
            <div className="bg-[#121222] border border-[#1e1e32] p-2.5 rounded-xl">
              <span className="text-[10px] text-[#6b6b88] font-mono block">RATING</span>
              <span className="text-xs font-mono font-semibold text-amber-400">
                ★ {selectedItem.rating || 4.8} ({selectedItem.reviews || 120})
              </span>
            </div>
          </div>

          {/* Action buttons */}
          {onSetAsSeed && (
            <button
              onClick={() => onSetAsSeed(selectedItem)}
              className="w-full py-2 mb-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-950/20"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Use as RecSys Seed Item</span>
            </button>
          )}

          {/* Nearest Semantic Neighbors in 3D Space */}
          <div className="flex-1 overflow-y-auto">
            <span className="text-[11px] font-mono text-[#8a8aa3] uppercase tracking-wider block mb-2">
              Nearest Semantic Beams
            </span>
            <div className="space-y-1.5">
              {nearestNeighbors.map((nn) => (
                <div
                  key={nn.item.id}
                  onClick={() => onSelectItem(nn.item.id)}
                  className="p-2 rounded-xl bg-[#121222] hover:bg-[#18182e] border border-[#1e1e32] hover:border-cyan-500/30 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="text-sm">{nn.item.icon || '📦'}</span>
                    <span className="text-xs text-white truncate">{nn.item.title}</span>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 font-semibold whitespace-nowrap">
                    {(nn.sim * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
