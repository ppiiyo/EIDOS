/**
 * EIDOS Semantic Engine
 * Provides fast, deterministic, high-dimensional semantic embeddings
 * with semantic category projections and subword hashing.
 */

// Semantic anchor taxonomy (64 conceptual dimensions)
const SEMANTIC_ANCHORS: Array<{ name: string; words: string[] }> = [
  {
    name: 'consciousness_mind',
    words: [
      'сознание', 'разум', 'мысль', 'интеллект', 'память', 'психика', 'восприятие',
      'понимание', 'интуиция', 'внимание', 'дух', 'мышление', 'mind', 'consciousness', 'cognition'
    ],
  },
  {
    name: 'time_eternity',
    words: [
      'время', 'вечность', 'бесконечность', 'история', 'будущее', 'прошлое', 'момент',
      'эпоха', 'длительность', 'ритм', 'скорость', 'тайм', 'time', 'eternity', 'temporal'
    ],
  },
  {
    name: 'information_code',
    words: [
      'информация', 'код', 'данные', 'алгоритм', 'программа', 'бит', 'текст',
      'система', 'структура', 'модель', 'знак', 'символ', 'code', 'data', 'information'
    ],
  },
  {
    name: 'being_ontology',
    words: [
      'бытие', 'сущность', 'смысл', 'реальность', 'существование', 'жизнь', 'материя',
      'пустота', 'небытие', 'онтология', 'основа', 'мир', 'being', 'existence', 'reality'
    ],
  },
  {
    name: 'entropy_chaos',
    words: [
      'энтропия', 'хаос', 'порядок', 'смерть', 'распад', 'трансформация', 'кризис',
      'случайность', 'неопределенность', 'риск', 'разрушение', 'entropy', 'decay', 'chaos'
    ],
  },
  {
    name: 'affection_empathy',
    words: [
      'любовь', 'забота', 'тепло', 'близость', 'эмпатия', 'доверие', 'привязанность',
      'сердце', 'человечность', 'дружба', 'уют', 'love', 'care', 'empathy', 'warmth'
    ],
  },
  {
    name: 'tech_digital',
    words: [
      'ai', 'ии', 'нейросети', 'роботы', 'blockchain', 'quantum', 'web3', 'metaverse',
      'облако', 'интерфейс', 'технологии', 'чип', 'автоматизация', 'tech', 'digital', 'cyber'
    ],
  },
  {
    name: 'brand_trust_quality',
    words: [
      'доверие', 'качество', 'надёжность', 'надежность', 'репутация', 'бренд', 'традиция',
      'стабильность', 'гарантия', 'стандарт', 'устойчивость', 'trust', 'reliability', 'quality'
    ],
  },
  {
    name: 'innovation_freedom',
    words: [
      'инновация', 'свобода', 'смелость', 'открытость', 'прорыв', 'будущее', 'эксперимент',
      'творчество', 'креатив', 'инициатива', 'новое', 'innovation', 'freedom', 'creative'
    ],
  },
  {
    name: 'business_market',
    words: [
      'маркетинг', 'бизнес', 'продажи', 'рынок', 'конверсия', 'воронка', 'оффер',
      'ценность', 'прибыль', 'клиент', 'аудитория', 'продукт', 'позиционирование', 'market', 'business'
    ],
  },
  {
    name: 'emotions_positive',
    words: [
      'радость', 'счастье', 'вдохновение', 'азарт', 'восторг', 'легкость', 'лёгкость',
      'уверенность', 'ясность', 'триумф', 'улыбка', 'спокойствие', 'joy', 'inspiration', 'calm'
    ],
  },
  {
    name: 'simplicity_clarity',
    words: [
      'простота', 'ясность', 'минимализм', 'чистота', 'лаконичность', 'понятность',
      'удобство', 'доступность', 'фокус', 'суть', 'simple', 'clarity', 'minimal'
    ],
  },
  {
    name: 'nature_ecology',
    words: [
      'экология', 'природа', 'земля', 'биосфера', 'климат', 'среда', 'зеленый',
      'органика', 'планета', 'ресурс', 'nature', 'ecology', 'green', 'planet'
    ],
  },
  {
    name: 'society_culture',
    words: [
      'общество', 'культура', 'искусство', 'традиция', 'люди', 'социум', 'этика',
      'мораль', 'диалог', 'сообщество', 'коммуникация', 'culture', 'art', 'society'
    ],
  },
  {
    name: 'growth_speed',
    words: [
      'скорость', 'рост', 'масштаб', 'динамика', 'прогресс', 'энергия', 'сила',
      'движение', 'драйв', 'развитие', 'ускорение', 'speed', 'growth', 'scale'
    ],
  },
  {
    name: 'structure_logic',
    words: [
      'структура', 'логика', 'порядок', 'архитектура', 'каркас', 'связь', 'отношение',
      'закон', 'правило', 'иерархия', 'баланс', 'logic', 'structure', 'hierarchy'
    ],
  },
];

// Hash function for subword character n-grams
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const VECTOR_DIM = 64;

export function generateSemanticEmbedding(text: string): Float32Array {
  const vec = new Float32Array(VECTOR_DIM);
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/[\s,_\-—]+/);

  // 1. Anchor similarities (first 16 dimensions)
  for (let i = 0; i < SEMANTIC_ANCHORS.length; i++) {
    const anchor = SEMANTIC_ANCHORS[i];
    let score = 0;

    for (const w of words) {
      if (anchor.words.includes(w)) {
        score += 1.0;
      } else {
        // partial stem match
        for (const aw of anchor.words) {
          if (w.length >= 4 && aw.length >= 4) {
            const prefixLen = Math.min(4, Math.min(w.length, aw.length));
            if (w.slice(0, prefixLen) === aw.slice(0, prefixLen)) {
              score += 0.45;
              break;
            }
          }
        }
      }
    }
    vec[i] = score;
  }

  // 2. Character 3-grams & 4-grams hashing for morphological robustness (dimensions 16..47)
  const padded = `^${normalized}$`;
  for (let len = 3; len <= 4; len++) {
    for (let i = 0; i <= padded.length - len; i++) {
      const gram = padded.slice(i, i + len);
      const h = hashString(gram);
      const idx = 16 + (h % 32);
      const sign = (h & 0x80) ? 1 : -1;
      vec[idx] += sign * 0.35;
    }
  }

  // 3. Length, vowels & character rhythm distribution (dimensions 48..63)
  const lenNorm = Math.min(normalized.length / 25, 1.0);
  vec[48] += lenNorm;
  
  let vowelCount = 0;
  for (const ch of normalized) {
    if ('аеёиоуыэюяaeiouy'.includes(ch)) vowelCount++;
  }
  vec[49] += vowelCount / Math.max(1, normalized.length);

  for (let i = 0; i < normalized.length; i++) {
    const chCode = normalized.charCodeAt(i);
    const targetIdx = 50 + (chCode % 14);
    vec[targetIdx] += 0.2 * Math.sin((i + 1) * 0.7);
  }

  // Normalize L2
  let sumSq = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    sumSq += vec[i] * vec[i];
  }
  const mag = Math.sqrt(sumSq) || 1e-6;
  for (let i = 0; i < VECTOR_DIM; i++) {
    vec[i] /= mag;
  }

  return vec;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  // ensure clamped between 0 and 1 for positive semantic affinity
  return Math.max(0.0, Math.min(1.0, (dot + 0.1) / 1.1));
}

export function buildSimilarityMatrix(
  names: string[],
  embeddings: Map<string, Float32Array>
): Float32Array[] {
  const n = names.length;
  const M: Float32Array[] = Array.from({ length: n }, () => new Float32Array(n));

  for (let i = 0; i < n; i++) {
    M[i][i] = 1.0;
    const vA = embeddings.get(names[i]);
    if (!vA) continue;

    for (let j = i + 1; j < n; j++) {
      const vB = embeddings.get(names[j]);
      if (!vB) continue;
      const s = cosineSimilarity(vA, vB);
      M[i][j] = s;
      M[j][i] = s;
    }
  }

  return M;
}
