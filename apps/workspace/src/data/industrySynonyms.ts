export type IndustrySynonymPackId = 'electronics' | 'fashion' | 'auto' | 'general';

export interface IndustrySynonymPack {
  id: IndustrySynonymPackId;
  label: string;
  labelRu: string;
  pairs: Array<{ source: string; target: string }>;
}

export const INDUSTRY_SYNONYM_PACKS: IndustrySynonymPack[] = [
  {
    id: 'electronics',
    label: 'Electronics',
    labelRu: 'Электроника',
    pairs: [
      { source: 'наушники', target: 'headphones' },
      { source: 'earbuds', target: 'наушники' },
      { source: 'смартфон', target: 'phone' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion',
    labelRu: 'Одежда',
    pairs: [
      { source: 'кроссовки', target: 'sneakers' },
      { source: 'sneakers', target: 'кроссовки' },
    ],
  },
  {
    id: 'auto',
    label: 'Auto',
    labelRu: 'Авто',
    pairs: [
      { source: 'колодки', target: 'brake pads' },
      { source: 'камри', target: 'camry' },
    ],
  },
  {
    id: 'general',
    label: 'General',
    labelRu: 'Общие',
    pairs: [
      { source: 'недорогие', target: 'budget' },
      { source: 'cheap', target: 'недорогие' },
    ],
  },
];

type Listener = () => void;
const listeners = new Set<Listener>();
const activePackIds = new Set<IndustrySynonymPackId>(['electronics', 'general']);
const customSynonyms: Array<{ source: string; target: string }> = [];

function notify() {
  for (const l of listeners) l();
}

export function subscribeSynonyms(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addCustomSynonym(source: string, target: string): void {
  const s = source.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!s || !t) return;
  customSynonyms.push({ source: s, target: t });
  notify();
}

export function getCustomSynonyms(): Array<{ source: string; target: string }> {
  return [...customSynonyms];
}

export function listCustomSynonyms(): Array<{ source: string; target: string }> {
  return getCustomSynonyms();
}

export function getActiveSynonymPacks(): IndustrySynonymPack[] {
  return INDUSTRY_SYNONYM_PACKS.filter((p) => activePackIds.has(p.id));
}

export function toggleSynonymPack(id: IndustrySynonymPackId): void {
  if (activePackIds.has(id)) activePackIds.delete(id);
  else activePackIds.add(id);
  notify();
}

export function expandQueryWithSynonyms(query: string): {
  expandedQuery: string;
  matchedSynonyms: Array<{ source: string; target: string }>;
} {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set(tokens);
  const matched: Array<{ source: string; target: string }> = [];

  const pairs = [
    ...getActiveSynonymPacks().flatMap((p) => p.pairs),
    ...customSynonyms,
  ];

  for (const t of tokens) {
    for (const pair of pairs) {
      if (pair.source === t && !out.has(pair.target)) {
        out.add(pair.target);
        matched.push(pair);
      }
      if (pair.target === t && !out.has(pair.source)) {
        out.add(pair.source);
        matched.push(pair);
      }
    }
  }

  return {
    expandedQuery: [...out].join(' '),
    matchedSynonyms: matched,
  };
}
