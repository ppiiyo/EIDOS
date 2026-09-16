import { CatalogItem, CustomerPersona } from '../types';

export interface FeatureContribution {
  id: string;
  label: string;
  category: 'latent' | 'tags' | 'category' | 'lexical' | 'persona';
  percentage: number; // 0 to 100
  absoluteContribution: number; // e.g. +0.35
  description: string;
  color: string;
  matchedItems: string[];
  icon: string;
}

export interface DetailedSemanticExplanation {
  targetId: number;
  targetTitle: string;
  recommendedId: number;
  recommendedTitle: string;
  similarityScore: number; // 0..1 (e.g. 0.84)
  topLatentConcept: string;
  features: FeatureContribution[];
  matchedKeywords: string[];
  matchedTags: string[];
  crossCategorySynergyNote?: string;
  vectorDistance: number; // 1 - similarity
  confidenceLevel: 'Высокая (High)' | 'Сбалансированная (Balanced)' | 'Ассоциативная (Discovery)';
}

const SEMANTIC_CLUSTERS = [
  {
    id: 'cyberpunk_ai',
    title: 'Киберпанк, ИИ и цифровая симуляция',
    color: '#00f0ff',
    keywords: ['киберпанк', 'cyberpunk', '2077', 'матрица', 'симуляция', 'ии', 'будущее', 'роботы', 'код', 'stray', 'неон'],
  },
  {
    id: 'dev_hardware',
    title: 'Вычислительное железо и разработка ПО',
    color: '#3ee89a',
    keywords: ['ноутбук', 'компьютер', 'probook', 'intel', 'ram', 'процессор', 'python', 'код', 'программирование', 'developer', 'клавиатура', 'дисплей'],
  },
  {
    id: 'scifi_cosmos',
    title: 'Космос, гравитация и научная фантастика',
    color: '#b478ff',
    keywords: ['дюна', 'интерстеллар', 'космос', 'фантастика', 'планета', 'нолан', 'время', 'звезды', 'арракис', 'space', 'гравитация'],
  },
  {
    id: 'audio_acoustics',
    title: 'Hi-Fi акустика, звук и шумоподавление',
    color: '#38bdf8',
    keywords: ['наушники', 'звук', 'музыка', 'soundmax', 'шумоподавление', 'bluetooth', 'аудио', 'динамик', 'колонка', 'яндекс станция'],
  },
  {
    id: 'cloud_saas',
    title: 'Облачные базы данных и DevTools',
    color: '#a78bfa',
    keywords: ['clickhouse', 'qdrant', 'supabase', 'cloud', 'database', 'postgres', 'baas', 'векторный', 'аналитика', 'olap'],
  },
  {
    id: 'smart_home_robotics',
    title: 'Умный дом, IoT и робототехника',
    color: '#4ade80',
    keywords: ['умный дом', 'zigbee', 'алиса', 'пылесос', 'roborock', 'philips hue', 'подсветка', 'lidar', 'автоматизация'],
  },
  {
    id: 'minimal_luxury',
    title: 'Премиальный дизайн и капсульный стиль',
    color: '#f472b6',
    keywords: ['кашемир', 'шелк', 'пальто', 'рубашка', 'тоут', 'кожа', 'минимализм', 'дизайн', 'herman miller', 'кресло', 'эргономика'],
  },
  {
    id: 'philosophy_dystopia',
    title: 'Антиутопия, социум и исследование разума',
    color: '#fbbf24',
    keywords: ['1984', 'оруэлл', 'антиутопия', 'контроль', 'начало', 'сны', 'разум', 'сознание', 'нолан', 'подсознание'],
  },
  {
    id: 'fantasy_magic',
    title: 'Эпическое фэнтези, квесты и мифология',
    color: '#e879f9',
    keywords: ['ведьмак', 'гарри поттер', 'фэнтези', 'магия', 'чудовища', 'толкин', 'хогвартс', 'заклинания'],
  },
  {
    id: 'sport_wellness',
    title: 'Спорт, биометрия и активный образ жизни',
    color: '#34d399',
    keywords: ['кроссовки', 'runmax', 'бег', 'спорт', 'пульс', 'браслет', 'bandpro', 'амортизация', 'трекер'],
  },
  {
    id: 'comfort_lifestyle',
    title: 'Бытовой комфорт и продуктивная атмосфера',
    color: '#fb923c',
    keywords: ['кофемашина', 'кофе', 'эспрессо', 'капучино', 'зерновой', 'бариста', 'уют'],
  },
];

const STOP_WORDS = new Set([
  'и', 'в', 'на', 'с', 'по', 'для', 'к', 'от', 'до', 'из', 'о', 'об', 'за',
  'под', 'над', 'при', 'про', 'без', 'через', 'это', 'как', 'так', 'что',
  'или', 'но', 'а', 'же', 'то', 'все', 'его', 'ее', 'их', 'мы', 'вы', 'он',
  'она', 'они', 'был', 'были', 'будет', 'есть', 'быть', 'тот', 'этот',
  'the', 'and', 'with', 'for', 'of', 'in', 'on', 'at', 'to', 'from', 'by'
]);

function extractMeaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\wа-яё\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Decomposes similarity into exact visual feature contributions
 */
export function decomposeSimilarityFeatures(
  target: CatalogItem,
  recommended: CatalogItem,
  similarityScore: number,
  persona?: CustomerPersona
): DetailedSemanticExplanation {
  const tText = `${target.title} ${target.description} ${target.category} ${target.tags?.join(' ') || ''}`.toLowerCase();
  const rText = `${recommended.title} ${recommended.description} ${recommended.category} ${recommended.tags?.join(' ') || ''}`.toLowerCase();

  const tWords = extractMeaningfulWords(`${target.title} ${target.description}`);
  const rWords = extractMeaningfulWords(`${recommended.title} ${recommended.description}`);

  // 1. Shared Exact Lexical Tokens
  const sharedWordsSet = new Set<string>();
  for (const tw of tWords) {
    for (const rw of rWords) {
      if (tw === rw || (tw.length >= 4 && rw.startsWith(tw.slice(0, 4)))) {
        sharedWordsSet.add(tw);
        break;
      }
    }
  }
  const matchedKeywords = Array.from(sharedWordsSet).slice(0, 6);

  // 2. Shared Semantic Tags
  const tTags = target.tags || [];
  const rTags = recommended.tags || [];
  const matchedTags = tTags.filter((tag) =>
    rTags.some((rt) => rt.toLowerCase() === tag.toLowerCase())
  );

  // 3. Best Matching Latent Cluster
  let topCluster = SEMANTIC_CLUSTERS[0];
  let maxClusterScore = -1;
  const clusterMatchedKeywords: string[] = [];

  for (const cluster of SEMANTIC_CLUSTERS) {
    let tHits = 0;
    let rHits = 0;
    const commonClusterWords: string[] = [];

    for (const kw of cluster.keywords) {
      const inT = tText.includes(kw);
      const inR = rText.includes(kw);
      if (inT) tHits++;
      if (inR) rHits++;
      if (inT && inR) {
        commonClusterWords.push(kw);
      }
    }

    const overlap = tHits * rHits + commonClusterWords.length * 3;
    if (overlap > maxClusterScore && (tHits > 0 || rHits > 0)) {
      maxClusterScore = overlap;
      topCluster = cluster;
      clusterMatchedKeywords.length = 0;
      clusterMatchedKeywords.push(...commonClusterWords);
    }
  }

  // 4. Category Synergy
  const isSameCategory = target.category === recommended.category;
  let crossSynergyNote: string | undefined;

  if (isSameCategory) {
    crossSynergyNote = `Внутрикатегорийная релевантность: обе позиции относятся к ветке «${target.category}»`;
  } else {
    // Cross-category pairs
    const pair = [target.category, recommended.category].sort().join(' ↔ ');
    crossSynergyNote = `Кросс-категорийная связка [${pair}]: дополняющая покупка в едином пользовательском сценарии`;
  }

  // 5. Persona Impact
  let personaMatches: string[] = [];
  let personaWeight = 0;
  if (persona && persona.id !== 'neutral') {
    const pInCat = persona.preferredCategories.includes(recommended.category);
    const pTags = (recommended.tags || []).filter((t) =>
      persona.affinityTags.some((at) => at.toLowerCase() === t.toLowerCase())
    );
    if (pInCat || pTags.length > 0) {
      personaWeight = 15;
      personaMatches = [
        ...(pInCat ? [recommended.category] : []),
        ...pTags.map((t) => `#${t}`),
      ];
    }
  }

  // Calculate proportional weights of the components (sum to ~100%)
  // Raw contributions
  let rawLatent = Math.max(25, 35 + (clusterMatchedKeywords.length > 0 ? 15 : 0));
  let rawTags = matchedTags.length > 0 ? 25 + matchedTags.length * 5 : 12;
  let rawLexical = matchedKeywords.length > 0 ? 18 + matchedKeywords.length * 4 : 10;
  let rawCategory = isSameCategory ? 20 : 15;

  if (personaWeight > 0) {
    rawLatent *= 0.85;
    rawTags *= 0.85;
    rawLexical *= 0.85;
    rawCategory *= 0.85;
  }

  const rawSum = rawLatent + rawTags + rawLexical + rawCategory + personaWeight;
  const latentPct = Math.round((rawLatent / rawSum) * 100);
  const tagsPct = Math.round((rawTags / rawSum) * 100);
  const lexicalPct = Math.round((rawLexical / rawSum) * 100);
  const categoryPct = Math.round((rawCategory / rawSum) * 100);
  const personaPct = personaWeight > 0 ? 100 - (latentPct + tagsPct + lexicalPct + categoryPct) : 0;

  const features: FeatureContribution[] = [
    {
      id: 'latent',
      label: 'Семантическое ядро (E5 Embeddings)',
      category: 'latent',
      percentage: latentPct,
      absoluteContribution: Number((similarityScore * (latentPct / 100)).toFixed(2)),
      description: `Концептуальная проекция в кластер «${topCluster.title}»`,
      color: topCluster.color,
      matchedItems: clusterMatchedKeywords.length > 0 ? clusterMatchedKeywords : [topCluster.title],
      icon: 'Brain',
    },
    {
      id: 'tags',
      label: 'Таксономия и общие теги',
      category: 'tags',
      percentage: tagsPct,
      absoluteContribution: Number((similarityScore * (tagsPct / 100)).toFixed(2)),
      description: matchedTags.length > 0
        ? `Совпадение тегов: ${matchedTags.map((t) => `#${t}`).join(', ')}`
        : 'Близость атрибутов и характеристик в векторном пространстве',
      color: '#3ee89a',
      matchedItems: matchedTags.length > 0 ? matchedTags.map((t) => `#${t}`) : (recommended.tags?.slice(0, 3) || []).map((t) => `#${t}`),
      icon: 'Tag',
    },
    {
      id: 'category',
      label: isSameCategory ? 'Единая товарная категория' : 'Кросс-категорийная синергия',
      category: 'category',
      percentage: categoryPct,
      absoluteContribution: Number((similarityScore * (categoryPct / 100)).toFixed(2)),
      description: crossSynergyNote,
      color: '#b478ff',
      matchedItems: [target.category, ...(isSameCategory ? [] : [recommended.category])],
      icon: 'Layers',
    },
    {
      id: 'lexical',
      label: 'Лексическое и сущностное пересечение',
      category: 'lexical',
      percentage: lexicalPct,
      absoluteContribution: Number((similarityScore * (lexicalPct / 100)).toFixed(2)),
      description: matchedKeywords.length > 0
        ? `Общие ключевые термины и корни: ${matchedKeywords.join(', ')}`
        : 'Семантическое соответствие описания и функционала без прямого вхождения слов',
      color: '#38bdf8',
      matchedItems: matchedKeywords.length > 0 ? matchedKeywords : ['Семантический синоним'],
      icon: 'FileText',
    },
  ];

  if (personaWeight > 0 && persona) {
    features.push({
      id: 'persona',
      label: `Персональная аффинность: ${persona.name}`,
      category: 'persona',
      percentage: personaPct,
      absoluteContribution: Number((similarityScore * (personaPct / 100)).toFixed(2)),
      description: `Учет профиля «${persona.role}»: повышенный интерес к ${persona.preferredCategories.join(', ')}`,
      color: persona.color || '#ffbe3d',
      matchedItems: personaMatches.length > 0 ? personaMatches : [persona.role],
      icon: 'Users',
    });
  }

  const confLevel =
    similarityScore >= 0.75
      ? 'Высокая (High)'
      : similarityScore >= 0.45
      ? 'Сбалансированная (Balanced)'
      : 'Ассоциативная (Discovery)';

  return {
    targetId: target.id,
    targetTitle: target.title,
    recommendedId: recommended.id,
    recommendedTitle: recommended.title,
    similarityScore,
    topLatentConcept: topCluster.title,
    features,
    matchedKeywords,
    matchedTags,
    crossCategorySynergyNote: crossSynergyNote,
    vectorDistance: Number((1 - similarityScore).toFixed(2)),
    confidenceLevel: confLevel,
  };
}
