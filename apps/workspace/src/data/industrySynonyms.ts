type Listener = () => void;

const customSynonyms: Array<{ source: string; target: string }> = [];
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l();
}

/** Subscribe to synonym dictionary changes. Returns unsubscribe. */
export function subscribeSynonyms(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addCustomSynonym(source: string, target: string): void {
  const s = source.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!s || !t) return;
  customSynonyms.push({ source: s, target: t });
  notify();
}

export function listCustomSynonyms(): Array<{ source: string; target: string }> {
  return [...customSynonyms];
}

const BUILTIN: Record<string, string[]> = {
  'наушники': ['headphones', 'earbuds', 'гарнитура', 'airpods'],
  'кроссовки': ['sneakers', 'running shoes', 'кеды'],
  'смартфон': ['phone', 'mobile', 'телефон'],
  'недорогие': ['cheap', 'budget', 'доступные'],
};

/** Expand query tokens with industry + custom synonyms (simple bag expansion). */
export function expandQueryWithSynonyms(query: string): string {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set(tokens);
  for (const t of tokens) {
    for (const syn of BUILTIN[t] ?? []) out.add(syn);
    for (const c of customSynonyms) {
      if (c.source === t) out.add(c.target);
      if (c.target === t) out.add(c.source);
    }
  }
  return [...out].join(' ');
}
