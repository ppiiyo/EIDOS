import * as crypto from 'crypto';
import {
  CategoryFamilySpec,
  DEFAULT_FIELD_BOOSTS,
  DEFAULT_RANK_CONSTANT,
  DEFAULT_RANK_WINDOW,
  FieldBoosts,
  RankWindow,
} from '@eidos/core';
import { getPersistenceStore } from './persistence-store';

export interface QueryLogTopHit {
  id: string;
  title: string;
  category: string;
  scorePercent: number;
  score: number;
}

export interface QueryLogFlags {
  empty: boolean;
  gated: boolean;
  rewritten: boolean;
  fallback_not_applicable: boolean;
}

export interface QueryLogRecord {
  id: string;
  timestamp: string;
  tenantId: string;
  indexName: string;
  query: string;
  normalizedQuery: string;
  resultCount: number;
  latencyMs: number;
  cacheHit: boolean;
  headCategoryIntent: string | null;
  simpleCategoryGate: 'hard' | 'soft' | 'off';
  alpha: number;
  top1: QueryLogTopHit | null;
  flags: QueryLogFlags;
  appliedDictionaryRules?: string[];
  source?: 'full' | 'suggest';
}

export interface SynonymRule {
  id: string;
  phrase: string;
  replacement: string;
  enabled: boolean;
}

export interface SynonymGroup {
  id: string;
  enabled: boolean;
  terms: string[];
  bidirectional: true;
  createdAt: string;
  updatedAt: string;
}

export interface MerchRule {
  id: string;
  enabled: boolean;
  queryPattern: string;
  type: 'pin' | 'boost' | 'bury';
  productId: string;
  position?: 1 | 2 | 3;
  weight?: number;
  match?: { sku?: string; brand?: string; id?: string };
  value?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RewriteRule {
  id: string;
  from: string;
  to: string;
  enabled: boolean;
}

export interface TenantDictionaries {
  version: number;
  updatedAt: string;
  synonyms: SynonymRule[];
  synonymGroups?: SynonymGroup[];
  rewrites: RewriteRule[];
  stopwords: string[];
  categoryFamilies?: CategoryFamilySpec[];
}

export interface TenantRankingDefaults {
  simpleCategoryGate: 'hard' | 'soft' | 'off';
  defaultAlpha: number;
  minScore: number;
  minSimilarity: number;
  fieldBoosts: Required<FieldBoosts>;
  fieldImportance: Required<FieldBoosts>;
  rankWindow: Required<RankWindow>;
  channelWindows: Required<RankWindow>;
  rankConstant: number;
  weights: { semantic: number; lexical: number };
  queryShapeBias: { enabled: boolean };
  fusionMode: 'rrf' | 'linear';
  filterStrictMissing: boolean;
  constraintStrictMissing: boolean;
  updatedAt: string;
}

export interface StorefrontEventRecord {
  id: string;
  timestamp: string;
  tenantId: string;
  type: 'click' | 'add_to_cart' | 'purchase';
  searchId?: string;
  query?: string;
  productId: string;
}

export interface CatalogUpsertSummary {
  timestamp: string;
  tenantId: string;
  indexName: string;
  upserted: number;
  failed: number;
  sampleRowErrors: Array<{ row: number; field: string; message: string }>;
}

export interface YmlSyncConfig {
  url: string;
  intervalHours: 0 | 1 | 6 | 24;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncCount: number;
  lastSyncStatus: 'idle' | 'ok' | 'error';
  lastError?: string | null;
  updatedAt: string;
}

export interface QueryRewriteItem {
  type: 'layout' | 'synonym' | 'rewrite' | 'stopwords';
  from: string;
  to: string;
}

export interface QueryPreprocessResult {
  processedQuery: string;
  rewritten: boolean;
  appliedRules: string[];
  rewrites: QueryRewriteItem[];
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class AdminConsoleStore {
  private static instance: AdminConsoleStore;
  private readonly maxLogs = 2500;
  private readonly maxEvents = 5000;
  private queryLogs: QueryLogRecord[] = [];
  private events: StorefrontEventRecord[] = [];
  private dictionariesByTenant = new Map<string, TenantDictionaries>();
  private synonymGroupsByTenant = new Map<string, SynonymGroup[]>();
  private merchRulesByTenant = new Map<string, MerchRule[]>();
  private rankingDefaultsByTenant = new Map<string, TenantRankingDefaults>();
  private lastUpsertByTenant = new Map<string, CatalogUpsertSummary>();
  private ymlSyncByTenant = new Map<string, YmlSyncConfig>();
  private error5xxCountByTenant = new Map<string, number>();

  constructor() {
    const saved = getPersistenceStore().read<Record<string, any> | null>('admin_console_state', null);
    if (saved) {
      this.importState(saved);
    }
    this.startPersistence();
  }

  public static getInstance(): AdminConsoleStore {
    if (!AdminConsoleStore.instance) {
      AdminConsoleStore.instance = new AdminConsoleStore();
    }
    return AdminConsoleStore.instance;
  }

  public static resetInstance(): void {
    AdminConsoleStore.instance = new AdminConsoleStore();
  }

  private persistTimer: NodeJS.Timeout | null = null;

  public exportState(): Record<string, any> {
    const mapToObj = <V>(m: Map<string, V>): Record<string, V> => Object.fromEntries(m.entries());
    return {
      dictionariesByTenant: mapToObj(this.dictionariesByTenant),
      synonymGroupsByTenant: mapToObj(this.synonymGroupsByTenant),
      merchRulesByTenant: mapToObj(this.merchRulesByTenant),
      rankingDefaultsByTenant: mapToObj(this.rankingDefaultsByTenant),
      lastUpsertByTenant: mapToObj(this.lastUpsertByTenant),
      ymlSyncByTenant: mapToObj(this.ymlSyncByTenant),
      queryLogs: this.queryLogs.slice(-500),
      events: this.events.slice(-1000),
    };
  }

  public importState(raw: Record<string, any>): void {
    if (!raw || typeof raw !== 'object') return;
    const objToMap = <V>(o: unknown): Map<string, V> =>
      o && typeof o === 'object' ? new Map(Object.entries(o as Record<string, V>)) : new Map();

    if (raw.dictionariesByTenant) this.dictionariesByTenant = objToMap(raw.dictionariesByTenant);
    if (raw.synonymGroupsByTenant) this.synonymGroupsByTenant = objToMap(raw.synonymGroupsByTenant);
    if (raw.merchRulesByTenant) this.merchRulesByTenant = objToMap(raw.merchRulesByTenant);
    if (raw.rankingDefaultsByTenant) this.rankingDefaultsByTenant = objToMap(raw.rankingDefaultsByTenant);
    if (raw.lastUpsertByTenant) this.lastUpsertByTenant = objToMap(raw.lastUpsertByTenant);
    if (raw.ymlSyncByTenant) this.ymlSyncByTenant = objToMap(raw.ymlSyncByTenant);
    if (Array.isArray(raw.queryLogs)) this.queryLogs = raw.queryLogs.slice(-this.maxLogs);
    if (Array.isArray(raw.events)) this.events = raw.events.slice(-this.maxEvents);
  }

  public flushStateToDisk(): void {
    getPersistenceStore().write('admin_console_state', this.exportState());
  }

  public startPersistence(): void {
    if (this.persistTimer) return;
    this.persistTimer = setInterval(() => {
      this.flushStateToDisk();
    }, 2_000);
    if (typeof this.persistTimer.unref === 'function') {
      this.persistTimer.unref();
    }
  }

  public getSynonymGroups(tenantId = 'default'): SynonymGroup[] {
    return this.synonymGroupsByTenant.get(tenantId) || [];
  }

  public createSynonymGroup(
    tenantId = 'default',
    input: { terms: string[]; enabled?: boolean; id?: string }
  ): SynonymGroup {
    const cleanTerms = Array.from(
      new Set(
        (input.terms || [])
          .map((t) => String(t || '').trim().toLowerCase())
          .filter((t) => t.length > 0)
      )
    );
    const now = new Date().toISOString();
    const group: SynonymGroup = {
      id: input.id || `syngrp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      enabled: input.enabled !== false,
      terms: cleanTerms,
      bidirectional: true,
      createdAt: now,
      updatedAt: now,
    };
    const existing = this.getSynonymGroups(tenantId).slice();
    existing.push(group);
    this.synonymGroupsByTenant.set(tenantId, existing);
    this.syncSynonymGroupsIntoLegacyRules(tenantId, existing);
    this.flushStateToDisk();
    return group;
  }

  public updateSynonymGroup(
    tenantId = 'default',
    id: string,
    patch: { terms?: string[]; enabled?: boolean }
  ): SynonymGroup | null {
    const existing = this.getSynonymGroups(tenantId).slice();
    const idx = existing.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    const current = existing[idx];
    const cleanTerms =
      patch.terms !== undefined
        ? Array.from(
            new Set(
              patch.terms
                .map((t) => String(t || '').trim().toLowerCase())
                .filter((t) => t.length > 0)
            )
          )
        : current.terms;
    const updated: SynonymGroup = {
      ...current,
      enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
      terms: cleanTerms,
      updatedAt: new Date().toISOString(),
    };
    existing[idx] = updated;
    this.synonymGroupsByTenant.set(tenantId, existing);
    this.syncSynonymGroupsIntoLegacyRules(tenantId, existing);
    this.flushStateToDisk();
    return updated;
  }

  public deleteSynonymGroup(tenantId = 'default', id: string): boolean {
    const existing = this.getSynonymGroups(tenantId);
    const next = existing.filter((g) => g.id !== id);
    if (next.length === existing.length) return false;
    this.synonymGroupsByTenant.set(tenantId, next);
    this.syncSynonymGroupsIntoLegacyRules(tenantId, next);
    this.flushStateToDisk();
    return true;
  }

  private syncSynonymGroupsIntoLegacyRules(tenantId: string, groups: SynonymGroup[]): void {
    const current = this.getDictionaries(tenantId);
    const nonGroupSynonyms = current.synonyms.filter((s) => !s.id.startsWith('syngrp_'));
    const groupSynonyms: SynonymRule[] = [];
    for (const grp of groups) {
      if (grp.terms.length < 2) continue;
      const canonical = grp.terms[0];
      for (let i = 1; i < grp.terms.length; i++) {
        groupSynonyms.push({
          id: `${grp.id}_${i}`,
          phrase: grp.terms[i],
          replacement: canonical,
          enabled: grp.enabled,
        });
      }
    }
    this.dictionariesByTenant.set(tenantId, {
      ...current,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      synonyms: [...nonGroupSynonyms, ...groupSynonyms],
      synonymGroups: groups,
    });
  }

  public getMerchRules(tenantId = 'default'): MerchRule[] {
    return this.merchRulesByTenant.get(tenantId) || [];
  }

  public createMerchRule(
    tenantId = 'default',
    input: {
      id?: string;
      enabled?: boolean;
      queryPattern?: string;
      type: 'pin' | 'boost' | 'bury';
      productId?: string;
      position?: 1 | 2 | 3;
      weight?: number;
      match?: { sku?: string; brand?: string; id?: string };
      value?: number;
    }
  ): MerchRule {
    const now = new Date().toISOString();
    const resolvedProductId =
      input.productId || input.match?.id || input.match?.sku || '';
    const rule: MerchRule = {
      id: input.id || `merch_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      enabled: input.enabled !== false,
      queryPattern: (input.queryPattern || '*').trim(),
      type: input.type,
      productId: String(resolvedProductId).trim(),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.weight !== undefined ? { weight: input.weight } : {}),
      match: input.match || { id: resolvedProductId },
      value: Number(input.value ?? input.weight ?? input.position ?? 1),
      createdAt: now,
      updatedAt: now,
    };
    const existing = this.getMerchRules(tenantId).slice();
    existing.push(rule);
    this.merchRulesByTenant.set(tenantId, existing);
    this.flushStateToDisk();
    return rule;
  }

  public updateMerchRule(
    tenantId = 'default',
    id: string,
    patch: Partial<Omit<MerchRule, 'id' | 'createdAt' | 'updatedAt'>>
  ): MerchRule | null {
    const existing = this.getMerchRules(tenantId).slice();
    const idx = existing.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const current = existing[idx];
    const updated: MerchRule = {
      ...current,
      enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
      queryPattern:
        patch.queryPattern !== undefined ? patch.queryPattern.trim() : current.queryPattern,
      type: patch.type ?? current.type,
      productId:
        patch.productId !== undefined ? String(patch.productId).trim() : current.productId,
      position: patch.position ?? current.position,
      weight: patch.weight ?? current.weight,
      match: patch.match ?? current.match,
      value: patch.value !== undefined ? Number(patch.value) : current.value,
      updatedAt: new Date().toISOString(),
    };
    existing[idx] = updated;
    this.merchRulesByTenant.set(tenantId, existing);
    this.flushStateToDisk();
    return updated;
  }

  public deleteMerchRule(tenantId = 'default', id: string): boolean {
    const existing = this.getMerchRules(tenantId);
    const next = existing.filter((r) => r.id !== id);
    if (next.length === existing.length) return false;
    this.merchRulesByTenant.set(tenantId, next);
    this.flushStateToDisk();
    return true;
  }

  public getDictionaries(tenantId = 'default'): TenantDictionaries {
    const existing = this.dictionariesByTenant.get(tenantId);
    if (existing) {
      return {
        ...existing,
        synonymGroups: this.getSynonymGroups(tenantId),
      };
    }
    const initial: TenantDictionaries = {
      version: 1,
      updatedAt: new Date().toISOString(),
      synonyms: [],
      synonymGroups: [],
      rewrites: [],
      stopwords: [],
    };
    this.dictionariesByTenant.set(tenantId, initial);
    return initial;
  }

  public getCategoryFamilies(tenantId = 'default'): CategoryFamilySpec[] {
    return this.getDictionaries(tenantId).categoryFamilies || [];
  }

  public updateDictionaries(
    tenantId = 'default',
    patch: {
      synonyms?: Array<{ id?: string; phrase: string; replacement: string; enabled?: boolean }>;
      rewrites?: Array<{ id?: string; from: string; to: string; enabled?: boolean }>;
      stopwords?: string[];
      categoryFamilies?: CategoryFamilySpec[];
    }
  ): TenantDictionaries {
    const current = this.getDictionaries(tenantId);
    const synonyms: SynonymRule[] =
      patch.synonyms !== undefined
        ? patch.synonyms
            .map((s, idx) => ({
              id: s.id || `syn_${idx + 1}_${crypto.randomBytes(2).toString('hex')}`,
              phrase: String(s.phrase || '').trim(),
              replacement: String(s.replacement || '').trim(),
              enabled: s.enabled !== false,
            }))
            .filter((s) => s.phrase.length > 0 && s.replacement.length > 0)
        : current.synonyms;

    if (patch.synonyms !== undefined) {
      // Rebuild SynonymGroups from updated synonyms list
      const syncedGroups: SynonymGroup[] = synonyms.map((s) => ({
        id: s.id.startsWith('syngrp_') ? s.id.replace(/_\d+$/, '') : `syngrp_${s.id}`,
        enabled: s.enabled,
        terms: [s.replacement.toLowerCase(), s.phrase.toLowerCase()],
        bidirectional: true,
        createdAt: current.updatedAt,
        updatedAt: new Date().toISOString(),
      }));
      this.synonymGroupsByTenant.set(tenantId, syncedGroups);
    }

    const rewrites: RewriteRule[] =
      patch.rewrites !== undefined
        ? patch.rewrites
            .map((r, idx) => ({
              id: r.id || `rw_${idx + 1}_${crypto.randomBytes(2).toString('hex')}`,
              from: String(r.from || '').trim(),
              to: String(r.to || '').trim(),
              enabled: r.enabled !== false,
            }))
            .filter((r) => r.from.length > 0 && r.to.length > 0)
        : current.rewrites;

    const stopwords: string[] =
      patch.stopwords !== undefined
        ? Array.from(
            new Set(
              patch.stopwords
                .map((w) => String(w || '').trim().toLowerCase())
                .filter((w) => w.length > 0)
            )
          )
        : current.stopwords;

    const categoryFamilies: CategoryFamilySpec[] | undefined =
      patch.categoryFamilies !== undefined
        ? patch.categoryFamilies.filter(
            (cf) =>
              cf &&
              typeof cf.key === 'string' &&
              Array.isArray(cf.queryTriggers) &&
              Array.isArray(cf.categoryMatchers) &&
              Array.isArray(cf.titleMatchers)
          )
        : current.categoryFamilies;

    const updated: TenantDictionaries = {
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      synonyms,
      synonymGroups: this.getSynonymGroups(tenantId),
      rewrites,
      stopwords,
      ...(categoryFamilies !== undefined ? { categoryFamilies } : {}),
    };
    this.dictionariesByTenant.set(tenantId, updated);
    this.flushStateToDisk();
    return updated;
  }

  public preprocessQuery(rawQuery: string, tenantId = 'default'): QueryPreprocessResult {
    const dict = this.getDictionaries(tenantId);
    const groups = this.getSynonymGroups(tenantId);
    let working = rawQuery.trim();
    if (!working) {
      return { processedQuery: rawQuery, rewritten: false, appliedRules: [], rewrites: [] };
    }

    const appliedRules: string[] = [];
    const rewrites: QueryRewriteItem[] = [];
    let replacementCount = 0;
    const maxReplacements = 5;

    // 1. Apply exact or phrase rewrites (longest match first)
    const sortedRewrites = dict.rewrites
      .filter((rw) => rw.enabled && rw.from && rw.to)
      .slice()
      .sort((a, b) => b.from.length - a.from.length);

    for (const rw of sortedRewrites) {
      if (replacementCount >= maxReplacements) break;
      const pattern = new RegExp(`(^|\\s|[.,!?;:()\\[\\]"'-])${escapeRegExp(rw.from)}(?=$|\\s|[.,!?;:()\\[\\]"'-])`, 'giu');
      if (pattern.test(working)) {
        working = working.replace(pattern, `$1${rw.to}`).replace(/\s+/g, ' ').trim();
        appliedRules.push(`rewrite:${rw.from}->${rw.to}`);
        rewrites.push({ type: 'rewrite', from: rw.from, to: rw.to });
        replacementCount++;
      }
    }

    // 2. Build unified single-pass synonym candidates (longest multi-word match first)
    const synCandidates: Array<{ from: string; to: string }> = [];
    for (const grp of groups) {
      if (!grp.enabled || grp.terms.length < 2) continue;
      const canonical = grp.terms[0];
      for (let i = 1; i < grp.terms.length; i++) {
        if (grp.terms[i] && grp.terms[i] !== canonical) {
          synCandidates.push({ from: grp.terms[i], to: canonical });
        }
      }
    }
    for (const syn of dict.synonyms) {
      if (!syn.enabled || !syn.phrase || !syn.replacement) continue;
      if (!synCandidates.some((c) => c.from.toLowerCase() === syn.phrase.toLowerCase())) {
        synCandidates.push({ from: syn.phrase, to: syn.replacement });
      }
    }
    synCandidates.sort((a, b) => b.from.length - a.from.length);

    // One-pass replacement using placeholders so replaced spans never chain-trigger further rules
    const placeholders: Array<{ token: string; replacement: string }> = [];
    for (const cand of synCandidates) {
      if (replacementCount >= maxReplacements) break;
      const pattern = new RegExp(`(^|\\s|[.,!?;:()\\[\\]"'-])(${escapeRegExp(cand.from)})(?=$|\\s|[.,!?;:()\\[\\]"'-])`, 'giu');
      if (pattern.test(working)) {
        const ph = `__EIDOS_SYN_${placeholders.length}__`;
        placeholders.push({ token: ph, replacement: cand.to });
        working = working.replace(pattern, `$1${ph}`).replace(/\s+/g, ' ').trim();
        appliedRules.push(`synonym:${cand.from}->${cand.to}`);
        rewrites.push({ type: 'synonym', from: cand.from, to: cand.to });
        replacementCount++;
      }
    }
    for (const ph of placeholders) {
      working = working.split(ph.token).join(ph.replacement);
    }

    // 3. Apply stopwords removal (never strip if it would leave 0 tokens)
    if (dict.stopwords.length > 0) {
      const stopSet = new Set(dict.stopwords.map((w) => w.toLowerCase()));
      const tokens = working.split(/\s+/);
      const removed: string[] = [];
      const filtered = tokens.filter((tok) => {
        const clean = tok.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
        if (stopSet.has(clean)) {
          removed.push(clean);
          return false;
        }
        return true;
      });
      if (filtered.length > 0 && filtered.length < tokens.length) {
        working = filtered.join(' ').trim();
        appliedRules.push('stopwords');
        rewrites.push({ type: 'stopwords', from: removed.join(', '), to: '' });
      }
    }

    const rewritten = working.toLowerCase() !== rawQuery.trim().toLowerCase();
    return {
      processedQuery: working || rawQuery.trim(),
      rewritten,
      appliedRules,
      rewrites,
    };
  }

  public getRankingDefaults(tenantId = 'default'): TenantRankingDefaults {
    const existing = this.rankingDefaultsByTenant.get(tenantId);
    if (existing) return existing;
    const defaults: TenantRankingDefaults = {
      simpleCategoryGate: 'hard',
      defaultAlpha: 0.5,
      minScore: 0.09,
      minSimilarity: 0.25,
      fieldBoosts: { ...DEFAULT_FIELD_BOOSTS },
      fieldImportance: { ...DEFAULT_FIELD_BOOSTS },
      rankWindow: { ...DEFAULT_RANK_WINDOW },
      channelWindows: { ...DEFAULT_RANK_WINDOW },
      rankConstant: DEFAULT_RANK_CONSTANT,
      weights: { semantic: 0.5, lexical: 0.5 },
      queryShapeBias: { enabled: true },
      fusionMode: 'rrf',
      filterStrictMissing: true,
      constraintStrictMissing: true,
      updatedAt: new Date().toISOString(),
    };
    this.rankingDefaultsByTenant.set(tenantId, defaults);
    return defaults;
  }

  public updateRankingDefaults(
    tenantId = 'default',
    patch: Partial<
      Omit<
        TenantRankingDefaults,
        'updatedAt' | 'fieldBoosts' | 'fieldImportance' | 'rankWindow' | 'channelWindows' | 'weights' | 'queryShapeBias'
      >
    > & {
      fieldBoosts?: Partial<FieldBoosts>;
      fieldImportance?: Partial<FieldBoosts>;
      rankWindow?: Partial<RankWindow>;
      channelWindows?: Partial<RankWindow>;
      weights?: Partial<{ semantic: number; lexical: number }>;
      queryShapeBias?: Partial<{ enabled: boolean }>;
    }
  ): TenantRankingDefaults {
    const current = this.getRankingDefaults(tenantId);
    const nextAlpha =
      typeof patch.defaultAlpha === 'number'
        ? Math.min(1, Math.max(0, Number(patch.defaultAlpha.toFixed(4))))
        : typeof patch.weights?.semantic === 'number'
        ? Math.min(1, Math.max(0, Number(patch.weights.semantic.toFixed(4))))
        : current.defaultAlpha;

    const nextWeights = patch.weights
      ? {
          semantic:
            typeof patch.weights.semantic === 'number'
              ? Math.max(0, Number(patch.weights.semantic.toFixed(4)))
              : current.weights.semantic,
          lexical:
            typeof patch.weights.lexical === 'number'
              ? Math.max(0, Number(patch.weights.lexical.toFixed(4)))
              : current.weights.lexical,
        }
      : typeof patch.defaultAlpha === 'number'
      ? {
          semantic: nextAlpha,
          lexical: Number((1 - nextAlpha).toFixed(4)),
        }
      : { ...current.weights };

    const fiPatch = patch.fieldImportance ?? patch.fieldBoosts;
    const nextFieldBoosts: Required<FieldBoosts> = {
      title:
        typeof fiPatch?.title === 'number' && fiPatch.title >= 0
          ? fiPatch.title
          : current.fieldBoosts.title,
      sku:
        typeof fiPatch?.sku === 'number' && fiPatch.sku >= 0
          ? fiPatch.sku
          : current.fieldBoosts.sku,
      brand:
        typeof fiPatch?.brand === 'number' && fiPatch.brand >= 0
          ? fiPatch.brand
          : current.fieldBoosts.brand,
      category:
        typeof fiPatch?.category === 'number' && fiPatch.category >= 0
          ? fiPatch.category
          : current.fieldBoosts.category,
      description:
        typeof fiPatch?.description === 'number' && fiPatch.description >= 0
          ? fiPatch.description
          : current.fieldBoosts.description,
    };

    const cwPatch = patch.channelWindows ?? patch.rankWindow;
    const nextRankWindow: Required<RankWindow> = {
      lexical:
        typeof cwPatch?.lexical === 'number'
          ? Math.min(200, Math.max(1, Math.round(cwPatch.lexical)))
          : current.rankWindow.lexical,
      dense:
        typeof cwPatch?.dense === 'number'
          ? Math.min(200, Math.max(1, Math.round(cwPatch.dense)))
          : current.rankWindow.dense,
    };

    const nextStrictMissing =
      typeof patch.constraintStrictMissing === 'boolean'
        ? patch.constraintStrictMissing
        : typeof patch.filterStrictMissing === 'boolean'
        ? patch.filterStrictMissing
        : current.filterStrictMissing;

    const updated: TenantRankingDefaults = {
      simpleCategoryGate: patch.simpleCategoryGate ?? current.simpleCategoryGate,
      defaultAlpha: nextAlpha,
      minScore:
        typeof patch.minScore === 'number'
          ? Math.min(1, Math.max(0, Number(patch.minScore.toFixed(4))))
          : current.minScore,
      minSimilarity:
        typeof patch.minSimilarity === 'number'
          ? Math.min(1, Math.max(0, Number(patch.minSimilarity.toFixed(4))))
          : current.minSimilarity,
      fieldBoosts: { ...nextFieldBoosts },
      fieldImportance: { ...nextFieldBoosts },
      rankWindow: { ...nextRankWindow },
      channelWindows: { ...nextRankWindow },
      rankConstant:
        typeof patch.rankConstant === 'number' && patch.rankConstant > 0
          ? patch.rankConstant
          : current.rankConstant,
      weights: nextWeights,
      queryShapeBias: {
        enabled:
          typeof patch.queryShapeBias?.enabled === 'boolean'
            ? patch.queryShapeBias.enabled
            : current.queryShapeBias.enabled,
      },
      fusionMode:
        patch.fusionMode === 'linear' || patch.fusionMode === 'rrf'
          ? patch.fusionMode
          : current.fusionMode,
      filterStrictMissing: nextStrictMissing,
      constraintStrictMissing: nextStrictMissing,
      updatedAt: new Date().toISOString(),
    };
    this.rankingDefaultsByTenant.set(tenantId, updated);
    this.flushStateToDisk();
    return updated;
  }

  public recordQueryLog(
    input: Omit<QueryLogRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ): QueryLogRecord {
    const entry: QueryLogRecord = {
      id: input.id || `qlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: input.timestamp || new Date().toISOString(),
      tenantId: input.tenantId || 'default',
      indexName: input.indexName || 'default',
      query: input.query,
      normalizedQuery: input.normalizedQuery || input.query,
      resultCount: input.resultCount,
      latencyMs: Math.round(input.latencyMs * 100) / 100,
      cacheHit: Boolean(input.cacheHit),
      headCategoryIntent: input.headCategoryIntent ?? null,
      simpleCategoryGate: input.simpleCategoryGate || 'hard',
      alpha: input.alpha ?? 0.5,
      top1: input.top1 ?? null,
      flags: input.flags,
      ...(input.source ? { source: input.source } : {}),
      ...(input.appliedDictionaryRules?.length
        ? { appliedDictionaryRules: input.appliedDictionaryRules }
        : {}),
    };

    this.queryLogs.push(entry);
    if (this.queryLogs.length > this.maxLogs) {
      this.queryLogs.splice(0, this.queryLogs.length - this.maxLogs);
    }
    return entry;
  }

  public listQueryLogs(options?: {
    tenantId?: string;
    q?: string;
    emptyOnly?: boolean;
    gatedOnly?: boolean;
    rewrittenOnly?: boolean;
    period?: '24h' | '7d' | '30d';
    page?: number;
    limit?: number;
  }): {
    total: number;
    page: number;
    limit: number;
    items: QueryLogRecord[];
  } {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(200, Math.max(1, options?.limit || 50));
    const cutoffMs = this.resolvePeriodCutoffMs(options?.period || '30d');
    const qLower = options?.q ? options.q.trim().toLowerCase() : '';

    const filtered = this.queryLogs
      .filter((r) => {
        if (options?.tenantId && r.tenantId !== options.tenantId) return false;
        const ts = Date.parse(r.timestamp);
        if (!Number.isNaN(ts) && ts < cutoffMs) return false;
        if (options?.emptyOnly && !r.flags.empty) return false;
        if (options?.gatedOnly && !r.flags.gated) return false;
        if (options?.rewrittenOnly && !r.flags.rewritten) return false;
        if (qLower) {
          const hay = `${r.query} ${r.normalizedQuery} ${r.top1?.title || ''} ${r.top1?.category || ''} ${r.headCategoryIntent || ''}`.toLowerCase();
          if (!hay.includes(qLower)) return false;
        }
        return true;
      })
      .slice()
      .reverse();

    const start = (page - 1) * limit;
    return {
      total: filtered.length,
      page,
      limit,
      items: filtered.slice(start, start + limit),
    };
  }

  public recordStorefrontEvent(input: {
    tenantId?: string;
    type: 'click' | 'add_to_cart' | 'purchase';
    searchId?: string;
    query?: string;
    productId: string;
  }): StorefrontEventRecord {
    const ev: StorefrontEventRecord = {
      id: `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      tenantId: input.tenantId || 'default',
      type: input.type,
      searchId: input.searchId,
      query: input.query,
      productId: input.productId,
    };
    this.events.push(ev);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
    return ev;
  }

  public recordCatalogUpsert(summary: Omit<CatalogUpsertSummary, 'timestamp'> & { timestamp?: string }): void {
    this.lastUpsertByTenant.set(summary.tenantId || 'default', {
      timestamp: summary.timestamp || new Date().toISOString(),
      tenantId: summary.tenantId || 'default',
      indexName: summary.indexName || 'default',
      upserted: summary.upserted,
      failed: summary.failed,
      sampleRowErrors: (summary.sampleRowErrors || []).slice(0, 20),
    });
  }

  public getLastCatalogUpsert(tenantId = 'default'): CatalogUpsertSummary | null {
    return this.lastUpsertByTenant.get(tenantId) || null;
  }

  public recordSearch5xxError(tenantId = 'default'): void {
    this.error5xxCountByTenant.set(tenantId, (this.error5xxCountByTenant.get(tenantId) || 0) + 1);
  }

  public getAnalyticsSummary(options?: {
    tenantId?: string;
    period?: '24h' | '7d' | '30d';
  }) {
    const period = options?.period || '7d';
    const cutoffMs = this.resolvePeriodCutoffMs(period);
    const tenantId = options?.tenantId;

    const logs = this.queryLogs.filter((r) => {
      if (tenantId && r.tenantId !== tenantId) return false;
      const ts = Date.parse(r.timestamp);
      return Number.isNaN(ts) || ts >= cutoffMs;
    });

    const periodEvents = this.events.filter((e) => {
      if (tenantId && e.tenantId !== tenantId) return false;
      const ts = Date.parse(e.timestamp);
      return Number.isNaN(ts) || ts >= cutoffMs;
    });

    const totalSearches = logs.length;
    const emptySearches = logs.filter((l) => l.flags.empty).length;
    const categoryGateBlocks = logs.filter((l) => l.flags.gated).length;
    const rewrittenSearches = logs.filter((l) => l.flags.rewritten).length;
    const zeroResultRate =
      totalSearches > 0 ? Number(((emptySearches / totalSearches) * 100).toFixed(2)) : 0;

    const latencies = logs.map((l) => l.latencyMs).sort((a, b) => a - b);
    const avgLatencyMs =
      latencies.length > 0
        ? Number((latencies.reduce((s, v) => s + v, 0) / latencies.length).toFixed(2))
        : 0;
    const p50LatencyMs =
      latencies.length > 0 ? Number(latencies[Math.floor(latencies.length * 0.5)].toFixed(2)) : 0;
    const p95LatencyMs =
      latencies.length > 0
        ? Number(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))].toFixed(2))
        : 0;

    // Group by day
    const byDayMap = new Map<string, { searches: number; empty: number; latencies: number[] }>();
    for (const l of logs) {
      const dayKey = l.timestamp.slice(0, 10);
      const bucket = byDayMap.get(dayKey) || { searches: 0, empty: 0, latencies: [] };
      bucket.searches += 1;
      if (l.flags.empty) bucket.empty += 1;
      bucket.latencies.push(l.latencyMs);
      byDayMap.set(dayKey, bucket);
    }

    const searchesByDay = Array.from(byDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => {
        const sortedLat = b.latencies.slice().sort((x, y) => x - y);
        const dayP95 =
          sortedLat.length > 0
            ? Number(sortedLat[Math.min(sortedLat.length - 1, Math.floor(sortedLat.length * 0.95))].toFixed(2))
            : 0;
        return {
          date,
          searches: b.searches,
          emptySearches: b.empty,
          zeroResultShare: b.searches > 0 ? Number(((b.empty / b.searches) * 100).toFixed(1)) : 0,
          p95LatencyMs: dayP95,
        };
      });

    // Top queries & Top zero-result queries
    const queryAgg = new Map<
      string,
      {
        query: string;
        count: number;
        emptyCount: number;
        totalLatency: number;
        top1Category: string | null;
        lastSeenAt: string;
        headCategoryIntent: string | null;
      }
    >();

    for (const l of logs) {
      const k = l.query.trim().toLowerCase();
      if (!k) continue;
      const existing = queryAgg.get(k);
      if (existing) {
        existing.count += 1;
        if (l.flags.empty) existing.emptyCount += 1;
        existing.totalLatency += l.latencyMs;
        if (l.top1?.category) existing.top1Category = l.top1.category;
        if (l.timestamp > existing.lastSeenAt) existing.lastSeenAt = l.timestamp;
      } else {
        queryAgg.set(k, {
          query: l.query.trim(),
          count: 1,
          emptyCount: l.flags.empty ? 1 : 0,
          totalLatency: l.latencyMs,
          top1Category: l.top1?.category ?? null,
          lastSeenAt: l.timestamp,
          headCategoryIntent: l.headCategoryIntent ?? null,
        });
      }
    }

    const topQueries = Array.from(queryAgg.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((q) => ({
        query: q.query,
        count: q.count,
        emptyCount: q.emptyCount,
        avgLatencyMs: Number((q.totalLatency / q.count).toFixed(2)),
        top1Category: q.top1Category,
      }));

    const topZeroResultQueries = Array.from(queryAgg.values())
      .filter((q) => q.emptyCount > 0)
      .sort((a, b) => b.emptyCount - a.emptyCount)
      .slice(0, 15)
      .map((q) => ({
        query: q.query,
        count: q.emptyCount,
        lastSeenAt: q.lastSeenAt,
        headCategoryIntent: q.headCategoryIntent,
      }));

    const clicks = periodEvents.filter((e) => e.type === 'click').length;
    const addToCart = periodEvents.filter((e) => e.type === 'add_to_cart').length;
    const purchases = periodEvents.filter((e) => e.type === 'purchase').length;
    const ctrPercent =
      totalSearches > 0 ? Number(Math.min(100, (clicks / totalSearches) * 100).toFixed(2)) : 0;

    const error5xxCount = this.error5xxCountByTenant.get(tenantId || 'default') || 0;

    return {
      period,
      totalSearches,
      totalQueries: totalSearches,
      uniqueQueries: queryAgg.size,
      emptySearches,
      zeroResultCount: emptySearches,
      zeroResultRate,
      avgLatencyMs,
      p50LatencyMs,
      p95LatencyMs,
      categoryGateBlocks,
      rewrittenSearches,
      error5xxCount,
      searchesByDay,
      topQueries,
      topZeroResultQueries,
      topZeroQueries: topZeroResultQueries,
      clickCount: clicks,
      clickEventsCount: clicks,
      ctrEstimate: ctrPercent,
      hasClickEvents: clicks > 0,
      honestFunnel: {
        searches: totalSearches,
        clicks,
        addToCart,
        purchases,
        ctrPercent,
        hasStorefrontOrderEvents: purchases > 0,
      },
      searchesWithClick: clicks,
    };
  }

  public exportAnalyticsCsv(options?: {
    tenantId?: string;
    period?: '24h' | '7d' | '30d';
    filter?: 'zero' | 'all';
  }): string {
    const listed = this.listQueryLogs({
      tenantId: options?.tenantId,
      period: options?.period || '7d',
      emptyOnly: options?.filter === 'zero',
      page: 1,
      limit: 500,
    });
    const escapeCsv = (val: unknown): string => {
      const s = String(val ?? '');
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = [
      'query',
      'normalizedQuery',
      'resultCount',
      'latencyMs',
      'top1Category',
      'timestamp',
    ].join(',');

    const rows = listed.items.map((item) =>
      [
        escapeCsv(item.query),
        escapeCsv(item.normalizedQuery),
        item.resultCount,
        item.latencyMs,
        escapeCsv(item.top1?.category || ''),
        escapeCsv(item.timestamp),
      ].join(',')
    );

    return `\uFEFF${[header, ...rows].join('\n')}\n`;
  }

  public getYmlSyncConfig(tenantId = 'default'): YmlSyncConfig {
    const existing = this.ymlSyncByTenant.get(tenantId);
    if (existing) return existing;
    const def: YmlSyncConfig = {
      url: '',
      intervalHours: 0,
      enabled: false,
      lastSyncAt: null,
      lastSyncCount: 0,
      lastSyncStatus: 'idle',
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
    this.ymlSyncByTenant.set(tenantId, def);
    return def;
  }

  public updateYmlSyncConfig(
    tenantId = 'default',
    patch: Partial<Omit<YmlSyncConfig, 'updatedAt'>>
  ): YmlSyncConfig {
    const current = this.getYmlSyncConfig(tenantId);
    const intervalRaw =
      patch.intervalHours !== undefined ? Number(patch.intervalHours) : current.intervalHours;
    const intervalHours: 0 | 1 | 6 | 24 =
      intervalRaw === 1 || intervalRaw === 6 || intervalRaw === 24 ? intervalRaw : 0;
    const url = patch.url !== undefined ? String(patch.url).trim() : current.url;
    const enabled =
      patch.enabled !== undefined ? Boolean(patch.enabled) : intervalHours > 0 && url.length > 0;
    const next: YmlSyncConfig = {
      ...current,
      ...patch,
      url,
      intervalHours,
      enabled,
      updatedAt: new Date().toISOString(),
    };
    this.ymlSyncByTenant.set(tenantId, next);
    return next;
  }

  public resetForTests(): void {
    this.queryLogs = [];
    this.events = [];
    this.dictionariesByTenant.clear();
    this.synonymGroupsByTenant.clear();
    this.merchRulesByTenant.clear();
    this.rankingDefaultsByTenant.clear();
    this.lastUpsertByTenant.clear();
    this.ymlSyncByTenant.clear();
    this.error5xxCountByTenant.clear();
  }

  private resolvePeriodCutoffMs(period: '24h' | '7d' | '30d'): number {
    const now = Date.now();
    if (period === '24h') return now - 24 * 3600_000;
    if (period === '7d') return now - 7 * 24 * 3600_000;
    return now - 30 * 24 * 3600_000;
  }
}

export function getAdminConsoleStore(): AdminConsoleStore {
  return AdminConsoleStore.getInstance();
}

