import { get, set } from "idb-keyval";
import { getEidosIdbStore } from '../storage';

export interface Variant {
  name: string;
  weight: number;
  users: number;
  conversions: number;
  totalRevenue: number;
  clicks: number;
  impressions: number;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'paused' | 'completed';
  variants: Variant[];
  metric: 'ctr' | 'conversion' | 'revenue';
  createdAt: string;
  assignments: Record<string, string>;
}

export interface ExperimentResult {
  variantName: string;
  users: number;
  conversions: number;
  rate: number;
  uplift: number;
  pValue: number;
  significant: boolean;
  confidence95: [number, number];
}

const IDB_EXPERIMENTS_KEY = 'eidos_experiments_v2';

let memoryExperiments: Record<string, Experiment> = {};

export async function flushExperimentsToIdb(): Promise<void> {
  await set(IDB_EXPERIMENTS_KEY, memoryExperiments, getEidosIdbStore());
}

export async function hydrateExperimentsFromIdb(): Promise<Experiment[]> {
  try {
    const stored = await get<Record<string, Experiment>>(IDB_EXPERIMENTS_KEY, getEidosIdbStore());
    if (stored && typeof stored === 'object') {
      memoryExperiments = stored;
    }
  } catch {
    // ignore in restricted environments
  }
  return Object.values(memoryExperiments);
}

function hashUserToUnit(userId: string, experimentId: string): number {
  const str = `${userId}:${experimentId}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function twoProportionZTest(c1: number, n1: number, c2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 1;
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pPool = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return 1;
  const z = (p2 - p1) / se;
  return 2 * (1 - normalCDF(Math.abs(z)));
}

export function createExperiment(params: {
  name: string;
  description: string;
  variantNames: string[];
  trafficSplit?: number[];
  metric?: 'ctr' | 'conversion' | 'revenue';
}): Experiment {
  const n = params.variantNames.length;
  if (n < 2) throw new RangeError('Need at least 2 variants');
  const weights = params.trafficSplit || params.variantNames.map(() => 1 / n);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.01) throw new RangeError('Traffic split must sum to 1');

  const exp: Experiment = {
    id: `exp_${Date.now()}_${(Object.keys(memoryExperiments).length + 1).toString(36)}`,
    name: params.name,
    description: params.description,
    status: 'running',
    variants: params.variantNames.map((name, i) => ({
      name,
      weight: weights[i],
      users: 0,
      conversions: 0,
      totalRevenue: 0,
      clicks: 0,
      impressions: 0,
    })),
    metric: params.metric || 'conversion',
    createdAt: new Date().toISOString(),
    assignments: {},
  };
  memoryExperiments[exp.id] = exp;
  void flushExperimentsToIdb().catch(() => {});
  return exp;
}

export function assignVariant(experimentId: string, userId: string): string {
  const exp = memoryExperiments[experimentId];
  if (!exp) throw new Error(`Experiment ${experimentId} not found`);
  if (exp.assignments[userId]) return exp.assignments[userId];

  const u = hashUserToUnit(userId, experimentId);
  let cum = 0;
  let chosen = exp.variants[0].name;
  for (const v of exp.variants) {
    cum += v.weight;
    if (u <= cum) {
      chosen = v.name;
      break;
    }
  }
  exp.assignments[userId] = chosen;
  const vObj = exp.variants.find((v) => v.name === chosen)!;
  vObj.users++;
  vObj.impressions++;
  void flushExperimentsToIdb().catch(() => {});
  return chosen;
}

export function recordOutcome(
  experimentId: string,
  userId: string,
  converted: boolean,
  revenue = 0,
  clicked = false
): void {
  const exp = memoryExperiments[experimentId];
  if (!exp) return;
  const vName = exp.assignments[userId];
  if (!vName) return;
  const v = exp.variants.find((x) => x.name === vName);
  if (!v) return;
  if (clicked) v.clicks++;
  if (converted) v.conversions++;
  v.totalRevenue += revenue;
  void flushExperimentsToIdb().catch(() => {});
}

export function analyzeExperiment(experimentId: string): ExperimentResult[] {
  const exp = memoryExperiments[experimentId];
  if (!exp) throw new Error(`Experiment ${experimentId} not found`);
  const control = exp.variants[0];
  const controlRate = control.users > 0 ? control.conversions / control.users : 0;

  return exp.variants.map((v, i) => {
    const rate = v.users > 0 ? v.conversions / v.users : 0;
    const uplift = i === 0 || controlRate === 0 ? 0 : ((rate - controlRate) / controlRate) * 100;
    const pValue =
      i === 0
        ? 1
        : twoProportionZTest(control.conversions, control.users, v.conversions, v.users);
    const se = v.users > 0 ? Math.sqrt((rate * (1 - rate)) / v.users) : 0;
    const ci: [number, number] = [Math.max(0, rate - 1.96 * se), Math.min(1, rate + 1.96 * se)];
    return {
      variantName: v.name,
      users: v.users,
      conversions: v.conversions,
      rate,
      uplift,
      pValue,
      significant: pValue < 0.05 && v.users >= 30,
      confidence95: ci,
    };
  });
}

export function listExperiments(): Experiment[] {
  return Object.values(memoryExperiments);
}

export function getExperiment(id: string): Experiment | null {
  return memoryExperiments[id] || null;
}

export function completeExperiment(id: string): void {
  if (memoryExperiments[id]) {
    memoryExperiments[id].status = 'completed';
    void flushExperimentsToIdb().catch(() => {});
  }
}
