/**
 * Статистический движок A/B тестирования.
 * Без внешних зависимостей. Детерминированное назначение вариантов.
 */

export interface Variant {
  name: string;
  users: number;
  conversions: number;
  revenue: number;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  variants: Variant[];
  trafficSplit: number[];   // доли трафика, сумма = 1
  metric: 'conversion' | 'revenue';
  status: 'draft' | 'running' | 'completed';
  createdAt: number;
  completedAt?: number;
}

export interface ExperimentResult {
  variantName: string;
  users: number;
  conversions: number;
  rate: number;            // доля конверсий
  zScore: number;
  pValue: number;
  significant: boolean;    // p < 0.05
  uplift: number;          // % относительно контроля
  confidence: number;      // (1-p)*100
}

// ── Детерминированный хэш для назначения ──────────────────────────────────
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;  // нормализуем в [0,1)
}

// ── Аппроксимация нормального CDF (Abramowitz & Stegun) ──────────────────
function normCDF(x: number): number {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741;
  const a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1) * t * Math.exp(-ax*ax);
  return 0.5 * (1 + sign * y);
}

// ── Хранилище ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'kostra44sip_ab_experiments';

function loadExperiments(): Experiment[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}
function saveExperiments(exps: Experiment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exps));
}

// ── API ────────────────────────────────────────────────────────────────────

export function createExperiment(cfg: {
  name: string;
  description: string;
  variantNames: string[];   // минимум 2: [контроль, вариант...]
  trafficSplit: number[];   // например [0.5, 0.5]
  metric: 'conversion' | 'revenue';
}): Experiment {
  if (cfg.variantNames.length < 2) throw new Error('Нужно минимум 2 варианта');
  if (cfg.trafficSplit.length !== cfg.variantNames.length)
    throw new Error('trafficSplit должен совпадать по длине с вариантами');
  const sum = cfg.trafficSplit.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.001) throw new Error('Сумма долей должна быть 1');

  const exp: Experiment = {
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    name: cfg.name,
    description: cfg.description,
    variants: cfg.variantNames.map(name => ({ name, users: 0, conversions: 0, revenue: 0 })),
    trafficSplit: cfg.trafficSplit,
    metric: cfg.metric,
    status: 'running',
    createdAt: Date.now(),
  };
  const all = loadExperiments();
  all.unshift(exp);
  saveExperiments(all);
  return exp;
}

export function listExperiments(): Experiment[] { return loadExperiments(); }

export function getExperiment(id: string): Experiment | undefined {
  return loadExperiments().find(e => e.id === id);
}

/**
 * Назначить пользователя в вариант. Детерминированно: один и тот же
 * userId всегда попадает в один и тот же вариант для данного эксперимента.
 */
export function assignVariant(experimentId: string, userId: string): string {
  const all = loadExperiments();
  const exp = all.find(e => e.id === experimentId);
  if (!exp || exp.status !== 'running') return exp?.variants[0].name ?? '';

  const bucket = fnv1a(userId + experimentId);
  let cum = 0;
  for (let i = 0; i < exp.trafficSplit.length; i++) {
    cum += exp.trafficSplit[i];
    if (bucket < cum) {
      exp.variants[i].users++;
      saveExperiments(all);
      return exp.variants[i].name;
    }
  }
  exp.variants[0].users++;
  saveExperiments(all);
  return exp.variants[0].name;
}

/**
 * Записать конверсию (или выручку) для пользователя.
 */
export function recordOutcome(
  experimentId: string,
  userId: string,
  converted: boolean,
  revenue: number = 0,
): void {
  const all = loadExperiments();
  const exp = all.find(e => e.id === experimentId);
  if (!exp || exp.status !== 'running') return;

  const bucket = fnv1a(userId + experimentId);
  let cum = 0, idx = 0;
  for (let i = 0; i < exp.trafficSplit.length; i++) {
    cum += exp.trafficSplit[i];
    if (bucket < cum) { idx = i; break; }
  }
  if (converted) exp.variants[idx].conversions++;
  exp.variants[idx].revenue += revenue;
  saveExperiments(all);
}

/**
 * Рассчитать статистическую значимость (двухпропорциональный z-тест).
 * Контроль — первый вариант.
 */
export function analyzeExperiment(experimentId: string): ExperimentResult[] {
  const exp = loadExperiments().find(e => e.id === experimentId);
  if (!exp) return [];

  const control = exp.variants[0];
  const p1 = control.users > 0 ? control.conversions / control.users : 0;

  return exp.variants.map((v, i) => {
    const rate = v.users > 0 ? v.conversions / v.users : 0;

    if (i === 0) {
      return { variantName: v.name, users: v.users, conversions: v.conversions,
               rate, zScore: 0, pValue: 1, significant: false, uplift: 0, confidence: 0 };
    }

    // pooled proportion
    const totalUsers = control.users + v.users;
    const totalConv  = control.conversions + v.conversions;
    const pooled = totalUsers > 0 ? totalConv / totalUsers : 0;

    const se = Math.sqrt(
      pooled * (1 - pooled) * (1/Math.max(control.users,1) + 1/Math.max(v.users,1))
    );

    const z = se > 1e-9 ? (rate - p1) / se : 0;
    const pValue = 2 * (1 - normCDF(Math.abs(z)));
    const uplift = p1 > 0 ? ((rate - p1) / p1) * 100 : 0;

    return {
      variantName: v.name,
      users: v.users,
      conversions: v.conversions,
      rate,
      zScore: z,
      pValue,
      significant: pValue < 0.05,
      uplift,
      confidence: (1 - pValue) * 100,
    };
  });
}

export function completeExperiment(experimentId: string): void {
  const all = loadExperiments();
  const exp = all.find(e => e.id === experimentId);
  if (exp) { exp.status = 'completed'; exp.completedAt = Date.now(); }
  saveExperiments(all);
}
