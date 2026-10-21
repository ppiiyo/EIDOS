import * as fs from 'fs';
import * as path from 'path';

export interface DemoCatalogSeedItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
}

const CATEGORY_TEMPLATES: Array<{
  category: string;
  items: Array<{ title: string; desc: string; tags: string[]; basePrice: number }>;
}> = [
  {
    category: 'Electronics',
    items: [
      {
        title: 'Neural Spatial Audio Headphones Pro',
        desc: 'Active noise cancelling wireless headphones with 3D spatial head tracking and lossless LDAC codec.',
        tags: ['audio', 'headphones', 'wireless', 'anc', 'spatial'],
        basePrice: 349.99,
      },
      {
        title: 'UltraWide 49" OLED Curved Monitor',
        desc: '240Hz 0.03ms QD-OLED display for software engineering, trading, and sim racing.',
        tags: ['monitor', 'oled', 'ultrawide', 'display', 'gaming'],
        basePrice: 1199.0,
      },
      {
        title: 'Split Ergonomic Mechanical Keyboard',
        desc: 'Hot-swappable programmable QMK/VIA wireless split keyboard with tactile switches.',
        tags: ['keyboard', 'mechanical', 'ergonomic', 'qmk', 'peripherals'],
        basePrice: 229.0,
      },
      {
        title: 'Thunderbolt 5 NVMe Enclosure 8TB',
        desc: '80Gbps rugged aluminum SSD array with active cooling for 8K RAW video editing.',
        tags: ['storage', 'ssd', 'nvme', 'thunderbolt', 'creator'],
        basePrice: 649.0,
      },
      {
        title: 'Full-Frame Mirrorless Cinema Camera',
        desc: '6K 60fps 15-stop dynamic range hybrid camera with phase-detect autofocus.',
        tags: ['camera', 'cinema', 'mirrorless', 'photography', 'video'],
        basePrice: 2499.0,
      },
    ],
  },
  {
    category: 'Books',
    items: [
      {
        title: 'Designing Data-Intensive Applications',
        desc: 'Deep architectural guide to distributed systems, consensus, replication, and stream processing.',
        tags: ['distributed-systems', 'architecture', 'databases', 'engineering'],
        basePrice: 44.99,
      },
      {
        title: 'Approximate Nearest Neighbor Search in High Dimensions',
        desc: 'Mathematical foundations of HNSW graphs, product quantization, and vector similarity search.',
        tags: ['hnsw', 'vector-search', 'math', 'machine-learning', 'ai'],
        basePrice: 54.0,
      },
      {
        title: 'Deep Recommender Systems at Scale',
        desc: 'Two-tower retrieval, multi-interest capsules, contextual bandits, and online learning.',
        tags: ['recommenders', 'deep-learning', 'bandits', 'personalization'],
        basePrice: 49.5,
      },
      {
        title: 'Neuromancer Anniversary Edition',
        desc: 'Foundational cyberpunk science fiction novel exploring artificial intelligence and cyberspace.',
        tags: ['scifi', 'cyberpunk', 'ai', 'classic'],
        basePrice: 18.99,
      },
      {
        title: 'High-Performance TypeScript & V8 Internals',
        desc: 'TypedArrays, SIMD optimization, memory layout, and zero-allocation algorithms in Node.js.',
        tags: ['typescript', 'nodejs', 'performance', 'v8', 'programming'],
        basePrice: 38.0,
      },
    ],
  },
  {
    category: 'Games',
    items: [
      {
        title: 'Starfield Shattered Horizon',
        desc: 'Interstellar space exploration RPG with procedural planetary systems and ship engineering.',
        tags: ['scifi', 'space', 'rpg', 'exploration'],
        basePrice: 69.99,
      },
      {
        title: 'Detroit: Synthetic Dawn',
        desc: 'Interactive narrative thriller about android consciousness and moral branching choices.',
        tags: ['cyberpunk', 'ai', 'narrative', 'scifi'],
        basePrice: 39.99,
      },
      {
        title: 'Factorio Space Age Expansion',
        desc: 'Industrial automation, logistics networks, interplanetary orbital platforms, and circuit logic.',
        tags: ['simulation', 'strategy', 'automation', 'engineering'],
        basePrice: 35.0,
      },
      {
        title: 'Baldur Gate Tactical Chronicles',
        desc: 'Party-based tactical fantasy RPG with deep systemic interactions and co-op campaign.',
        tags: ['rpg', 'tactical', 'fantasy', 'strategy'],
        basePrice: 59.99,
      },
      {
        title: 'SimRacing GT Telemetry Pro',
        desc: 'Laser-scanned circuit racing simulator with real-time tire thermodynamics and force feedback.',
        tags: ['simulation', 'racing', 'esports', 'physics'],
        basePrice: 49.99,
      },
    ],
  },
  {
    category: 'Appliances',
    items: [
      {
        title: 'Dual-Boiler PID Espresso Workstation',
        desc: 'Commercial rotary pump espresso machine with flow profiling and precision PID temperature control.',
        tags: ['coffee', 'espresso', 'kitchen', 'barista'],
        basePrice: 1490.0,
      },
      {
        title: 'Smart Induction Sous-Vide Precision Cooker',
        desc: 'Wi-Fi connected 1800W immersion circulator with 0.05C thermal stability.',
        tags: ['kitchen', 'cooking', 'smart-home', 'appliance'],
        basePrice: 199.0,
      },
      {
        title: 'HEPA 14 Laser Air Purifier Studio',
        desc: 'Real-time PM2.5 and VOC spectrometer air filtration system with whisper-quiet brushless motor.',
        tags: ['smart-home', 'air-purifier', 'health', 'sensors'],
        basePrice: 429.0,
      },
      {
        title: 'Robotic LiDAR Mapping Vacuum Station',
        desc: '3D dToF laser navigation robot vacuum with self-emptying hot-water mop washing dock.',
        tags: ['robotics', 'smart-home', 'lidar', 'cleaning'],
        basePrice: 899.0,
      },
      {
        title: 'Artisan Flat-Burr Single Dose Grinder',
        desc: '64mm DLC-coated stepless flat burr grinder with zero-retention bellows for specialty coffee.',
        tags: ['coffee', 'grinder', 'espresso', 'kitchen'],
        basePrice: 399.0,
      },
    ],
  },
  {
    category: 'Sports',
    items: [
      {
        title: 'Carbon Plate Marathon Racing Shoes',
        desc: 'Featherweight Pebax foam running shoes with full-length carbon fiber propulsion plate.',
        tags: ['running', 'marathon', 'carbon', 'fitness'],
        basePrice: 249.99,
      },
      {
        title: 'GPS Multi-Band Sapphire Triathlon Watch',
        desc: 'Dual-frequency GNSS adventure smartwatch with solar charging, HRV recovery, and offline topo maps.',
        tags: ['wearable', 'gps', 'triathlon', 'running', 'fitness'],
        basePrice: 799.0,
      },
      {
        title: 'Direct-Drive Smart Indoor Cycling Trainer',
        desc: '2500W electromagnetic resistance bike trainer with virtual shifting and 1% power accuracy.',
        tags: ['cycling', 'indoor-trainer', 'watts', 'fitness'],
        basePrice: 999.0,
      },
      {
        title: 'Adjustable Cast-Iron Kettlebell Pro',
        desc: 'Competition-grade steel kettlebell adjustable from 12kg to 32kg for strength conditioning.',
        tags: ['strength', 'kettlebell', 'gym', 'conditioning'],
        basePrice: 219.0,
      },
      {
        title: 'Ultralight 800-Fill Down Alpine Jacket',
        desc: 'Packable Pertex Quantum windproof mountaineering jacket for high-altitude expeditions.',
        tags: ['outdoor', 'mountaineering', 'apparel', 'alpine'],
        basePrice: 329.0,
      },
    ],
  },
];

/**
 * Generates 105 deterministic, realistic e-commerce seed items (5 core legacy items + 100 extended items).
 */
export function generateDemoCatalog(targetCount = 105): DemoCatalogSeedItem[] {
  const baseFive: DemoCatalogSeedItem[] = [
    {
      id: '1',
      title: 'Cyberpunk 2077',
      description: 'Open-world cyberpunk sci-fi RPG set in Night City with neural implants and AI.',
      category: 'Games',
      tags: ['cyberpunk', 'rpg', 'scifi', 'simulation'],
      price: 59.99,
    },
    {
      id: '2',
      title: 'The Matrix',
      description: 'Cult sci-fi movie about simulated reality, artificial intelligence, and rebellion.',
      category: 'Movies',
      tags: ['scifi', 'simulation', 'cyberpunk', 'ai'],
      price: 14.99,
    },
    {
      id: '3',
      title: 'Dune',
      description: 'Epic science fiction novel about desert planet Arrakis, politics, and ecology.',
      category: 'Books',
      tags: ['scifi', 'space', 'politics'],
      price: 19.99,
    },
    {
      id: '4',
      title: 'Python Machine Learning Handbook',
      description: 'Complete guide to programming, algorithms, deep learning, and neural networks.',
      category: 'Books',
      tags: ['programming', 'python', 'ai', 'code'],
      price: 39.99,
    },
    {
      id: '5',
      title: 'Barista Pro Espresso Machine',
      description: '15-bar automatic coffee maker with integrated conical burr grinder.',
      category: 'Appliances',
      tags: ['coffee', 'espresso', 'kitchen'],
      price: 499.0,
    },
  ];

  const editions = ['Mark I', 'Mark II', 'Studio Edition', 'Enterprise Pro', 'Ultra'];
  const items: DemoCatalogSeedItem[] = [...baseFive];
  let nextId = 6;

  for (const edition of editions) {
    for (const group of CATEGORY_TEMPLATES) {
      for (const tpl of group.items) {
        if (items.length >= targetCount) break;
        const editionMultiplier = 1 + editions.indexOf(edition) * 0.08;
        items.push({
          id: String(nextId++),
          title: `${tpl.title} — ${edition}`,
          description: `${tpl.desc} (${edition} configuration with calibrated telemetry).`,
          category: group.category,
          tags: [...tpl.tags, group.category.toLowerCase()],
          price: Math.round(tpl.basePrice * editionMultiplier * 100) / 100,
        });
      }
    }
  }

  return items;
}

if (require.main === module) {
  const dataset = generateDemoCatalog(105);
  const outPath = path.resolve(process.cwd(), 'data/demo-seed-100.json');
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf-8');
  console.log(`Generated ${dataset.length} seed items at ${outPath}`);
}
