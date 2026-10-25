import * as fs from 'fs';
import * as path from 'path';

export interface DemoCatalogSeedItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  rating?: number;
}

const CATEGORIES = [
  'Electronics',
  'Books',
  'Games',
  'Appliances',
  'Sports',
  'Fashion',
  'Home',
  'Toys',
  'Movies',
] as const;

const ADJECTIVES = [
  'Quantum',
  'Neural',
  'UltraLight',
  'ProGrade',
  'Titanium',
  'Precision',
  'Ergonomic',
  'Modular',
  'Carbon',
  'Studio',
  'Acoustic',
  'Tactical',
  'Autonomous',
  'Cryo',
  'HyperSpeed',
  'Bespoke',
  'Artisan',
  'NextGen',
  'Spatial',
  'Kinetic',
];

const CATEGORY_NOUNS: Record<string, { nouns: string[]; tags: string[]; basePrice: number }> = {
  Electronics: {
    nouns: [
      'Spatial Audio Headphones',
      'QD-OLED Curved Monitor',
      'Split Mechanical Keyboard',
      'Thunderbolt NVMe Array',
      'Mirrorless Cinema Camera',
      'DSP Audio Interface',
      'GaN 240W Desktop Charger',
      'Wi-Fi 7 Mesh Router',
      'MicroLED Drawing Tablet',
      'Low-Latency Wireless Mouse',
    ],
    tags: ['electronics', 'hardware', 'tech', 'wireless', 'creator', 'pro'],
    basePrice: 249.99,
  },
  Books: {
    nouns: [
      'Distributed Systems Architecture',
      'Approximate Nearest Neighbor Search',
      'Deep Recommender Systems',
      'High-Performance TypeScript',
      'Cyberpunk Neuromancer Chronicles',
      'Linear Algebra for Machine Learning',
      'Bayesian Contextual Bandits',
      'Rust Systems Programming',
      'Graph Neural Networks Handbook',
      'Quantum Information Theory',
    ],
    tags: ['books', 'engineering', 'ai', 'algorithms', 'math', 'programming'],
    basePrice: 39.99,
  },
  Games: {
    nouns: [
      'Starfield Shattered Horizon',
      'Cyberpunk Night City Chronicles',
      'Factorio Orbital Automation',
      'Tactical Fantasy Chronicles',
      'SimRacing GT Telemetry Pro',
      'Orbital Colony Simulator',
      'Mecha Vanguard Tactics',
      'Rogue AI Cybernetic Protocol',
      'Deep Space Fleet Commander',
      'Quantum Puzzle Odyssey',
    ],
    tags: ['games', 'rpg', 'scifi', 'simulation', 'strategy', 'cyberpunk'],
    basePrice: 49.99,
  },
  Appliances: {
    nouns: [
      'Dual-Boiler PID Espresso Machine',
      'Smart Induction Sous-Vide Cooker',
      'HEPA 14 Laser Air Purifier',
      'LiDAR Mapping Robot Vacuum',
      'Flat-Burr Single Dose Grinder',
      'Countertop Steam Convection Oven',
      'Ultrasonic Cold Brew Extractor',
      'Smart Wine Preservation Cabinet',
      'Variable Temperature Gooseneck Kettle',
      'Brushless High-Torque Blender',
    ],
    tags: ['appliances', 'kitchen', 'smart-home', 'coffee', 'espresso', 'automation'],
    basePrice: 329.0,
  },
  Sports: {
    nouns: [
      'Carbon Plate Marathon Shoes',
      'Multi-Band GPS Triathlon Watch',
      'Direct-Drive Smart Bike Trainer',
      'Adjustable Competition Kettlebell',
      '800-Fill Alpine Down Jacket',
      'Aero Carbon Road Helmet',
      'Hydration Trail Running Vest',
      'Smart Rowing Ergometer',
      'Titanium Trekking Poles',
      'Infrared Muscle Recovery Gun',
    ],
    tags: ['sports', 'fitness', 'running', 'endurance', 'outdoor', 'training'],
    basePrice: 189.0,
  },
  Fashion: {
    nouns: [
      'Merino Wool Technical Hoodie',
      'Gore-Tex Pro Storm Shell',
      'Selvedge Japanese Denim Jeans',
      'Minimalist Full-Grain Leather Sneaker',
      'Ballistic Nylon Commuter Backpack',
      'Titanium Polarized Aviator Sunglasses',
      'Cashmere Structured Overcoat',
      'Waterproof Chelsea Boots',
      'Breathable Linen Overshirt',
      'Chronograph Automatic Field Watch',
    ],
    tags: ['fashion', 'apparel', 'minimalist', 'technical', 'outerwear', 'style'],
    basePrice: 159.0,
  },
  Home: {
    nouns: [
      'Ergonomic Mesh Task Chair',
      'Dual-Motor Standing Desk Frame',
      'Full-Spectrum Circadian Desk Lamp',
      'Acoustic Walnut Wall Panels',
      'Weighted Bamboo Cooling Blanket',
      'Modular Aluminum Shelving System',
      'Smart Matter Thread Thermostat',
      'Organic Linen Duvet Set',
      'Minimalist Concrete Planter',
      'Solid Walnut Monitor Riser',
    ],
    tags: ['home', 'office', 'ergonomic', 'interior', 'workspace', 'design'],
    basePrice: 219.0,
  },
  Toys: {
    nouns: [
      'Programmable Robotics STEM Kit',
      'Architectural Technic Crane Set',
      'FPV Brushless Micro Drone',
      'Magnetic Neodymium Geometry Tiles',
      'Wooden Montessori Logic Board',
      'Solar Rover Engineering Kit',
      'Die-Cast Scale Formula Car',
      'Electronic Synthesizer Building Blocks',
      'Telescope Astrophotography Starter',
      'RC Rock Crawler 4x4 Chassis',
    ],
    tags: ['toys', 'stem', 'robotics', 'educational', 'building', 'engineering'],
    basePrice: 79.99,
  },
  Movies: {
    nouns: [
      'Sci-Fi Cybernetic Thriller 4K',
      'Interstellar Space Odyssey',
      'Quantum Paradox Documentary',
      'Dystopian AI Rebellion Epic',
      'Neon Noir Detective Chronicle',
      'Artificial Consciousness Drama',
      'Galactic Fleet Commander Saga',
      'Virtual Simulation Reality Film',
      'Deep Time Horizon Cinema',
      'Neural Network Awakening Special',
    ],
    tags: ['movies', 'cinema', 'scifi', 'cyberpunk', 'ai', 'space', '4k'],
    basePrice: 19.99,
  },
};

/**
 * Generates deterministic 384-d unit-normalized vector from item metadata in <0.01ms.
 */
export function computeDeterministicSeedVector(
  id: string,
  category: string,
  title: string,
  tags: string[]
): Float32Array {
  const vec = new Float32Array(384);
  const catIdx = Math.max(0, CATEGORIES.indexOf(category as any));

  // Category subspace anchor (dims 0..63)
  const baseDim = (catIdx * 8) % 64;
  for (let d = 0; d < 8; d++) {
    vec[baseDim + d] = 0.65;
  }

  // Deterministic token hashing across dims 64..383
  const text = `${id} ${category} ${title} ${tags.join(' ')}`.toLowerCase();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
    const targetDim = 64 + ((h + i * 17) % 320);
    vec[targetDim] += ((h & 0xff) / 255.0 - 0.5) * 0.4;
  }

  // L2 normalize
  let sumSq = 0;
  for (let i = 0; i < 384; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < 384; i++) {
    vec[i] /= norm;
  }
  return vec;
}

/**
 * Generates 5,005+ deterministic, realistic e-commerce seed items
 * (5 core legacy items '1'..'5' + 5,000+ unique items across 8 categories).
 */
export function generateDemoCatalog(targetCount = 5005): DemoCatalogSeedItem[] {
  const baseFive: DemoCatalogSeedItem[] = [
    {
      id: '1',
      title: 'Cyberpunk 2077',
      description: 'Open-world cyberpunk sci-fi RPG set in Night City with neural implants and AI.',
      category: 'Games',
      tags: ['cyberpunk', 'rpg', 'scifi', 'simulation'],
      price: 59.99,
      rating: 4.8,
    },
    {
      id: '2',
      title: 'The Matrix',
      description: 'Cult sci-fi movie about simulated reality, artificial intelligence, and rebellion.',
      category: 'Movies',
      tags: ['scifi', 'simulation', 'cyberpunk', 'ai'],
      price: 14.99,
      rating: 4.9,
    },
    {
      id: '3',
      title: 'Dune',
      description: 'Epic science fiction novel about desert planet Arrakis, politics, and ecology.',
      category: 'Books',
      tags: ['scifi', 'space', 'politics'],
      price: 19.99,
      rating: 4.9,
    },
    {
      id: '4',
      title: 'Python Machine Learning Handbook',
      description: 'Complete guide to programming, algorithms, deep learning, and neural networks.',
      category: 'Books',
      tags: ['programming', 'python', 'ai', 'code'],
      price: 39.99,
      rating: 4.7,
    },
    {
      id: '5',
      title: 'Barista Pro Espresso Machine',
      description: '15-bar automatic coffee maker with integrated conical burr grinder.',
      category: 'Appliances',
      tags: ['coffee', 'espresso', 'kitchen'],
      price: 499.0,
      rating: 4.8,
    },
  ];

  const items: DemoCatalogSeedItem[] = [...baseFive];
  const countToGenerate = Math.max(0, targetCount - baseFive.length);

  for (let i = 0; i < countToGenerate; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const spec = CATEGORY_NOUNS[category];
    const adj = ADJECTIVES[Math.floor(i / CATEGORIES.length) % ADJECTIVES.length];
    const noun = spec.nouns[Math.floor(i / (CATEGORIES.length * ADJECTIVES.length)) % spec.nouns.length];
    const seriesNum = Math.floor(i / 80) + 1;
    const itemId = `item-${i + 6}`;

    const priceFactor = 0.75 + ((i * 19) % 150) / 100;
    const price = Math.round(spec.basePrice * priceFactor * 100) / 100;
    const rating = Math.round((4.1 + ((i * 7) % 9) * 0.1) * 10) / 10;

    items.push({
      id: itemId,
      title: `${adj} ${noun} Gen-${seriesNum}`,
      description: `High-performance ${adj.toLowerCase()} ${noun.toLowerCase()} in ${category} category (Series ${seriesNum}, SKU #${itemId}). Engineered for low-latency workflows and reliability.`,
      category,
      tags: [adj.toLowerCase(), ...spec.tags.slice(0, 4)],
      price,
      rating,
    });
  }

  return items;
}

if (require.main === module) {
  const countArgIdx = process.argv.indexOf('--count');
  const requestedCount =
    countArgIdx !== -1 && process.argv[countArgIdx + 1]
      ? Math.max(5000, parseInt(process.argv[countArgIdx + 1], 10))
      : 5005;

  const dataset = generateDemoCatalog(requestedCount);
  const outPath = path.resolve(process.cwd(), 'data/demo-seed-100.json');
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf-8');
  console.log(`✅ Generated ${dataset.length} seed items at ${outPath}`);
}
