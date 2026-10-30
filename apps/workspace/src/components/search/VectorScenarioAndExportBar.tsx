import React, { useState, useMemo } from 'react';
import { Sparkles, Code2, Copy, Check, Activity, Wand2, Layers } from 'lucide-react';
import { IntentRadarCoordinates } from '@eidos/core';
import {
  VectorScenarioPresetId,
  CognitiveStageTimings,
} from '../../hooks/useSearchCognitiveState';
import { UiLanguage } from '../../i18n/uiTranslations';

export type SearchComplexityLevel = 'simple' | 'advanced' | 'expert';

interface VectorScenarioAndExportBarProps {
  query: string;
  alpha: number;
  effectiveAlpha: number;
  radarCoords: IntentRadarCoordinates;
  simulatedHour: number | null;
  activeScenarioId: VectorScenarioPresetId;
  stageTimingsMs: CognitiveStageTimings;
  retrievalLatencyMs: number;
  onSelectScenario: (id: VectorScenarioPresetId) => void;
  uiLang?: UiLanguage;
  cacheStatus?: 'HIT' | 'MISS';
  complexityLevel?: SearchComplexityLevel;
  onChangeComplexityLevel?: (level: SearchComplexityLevel) => void;
  disableIntentBoost?: boolean;
  onToggleDisableIntentBoost?: () => void;
  disableMmrPenalty?: boolean;
  onToggleDisableMmrPenalty?: () => void;
  wowTourActive?: boolean;
  onTriggerWowMoment?: () => void;
}

type ExportFormat = 'json' | 'curl' | 'ts' | 'python';

export const VectorScenarioAndExportBar: React.FC<VectorScenarioAndExportBarProps> = ({
  query,
  alpha,
  effectiveAlpha,
  radarCoords,
  simulatedHour,
  activeScenarioId,
  stageTimingsMs,
  retrievalLatencyMs,
  onSelectScenario,
  uiLang = 'ru',
  cacheStatus = 'MISS',
  complexityLevel = 'expert',
  onChangeComplexityLevel,
  disableIntentBoost = false,
  onToggleDisableIntentBoost,
  disableMmrPenalty = false,
  onToggleDisableMmrPenalty,
  wowTourActive = false,
  onTriggerWowMoment,
}) => {
  const isRu = uiLang === 'ru';
  const [showExporter, setShowExporter] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [copied, setCopied] = useState(false);

  const scenarios: Array<{ id: VectorScenarioPresetId; label: string; badge: string; desc: string }> = [
    {
      id: 'baseline',
      label: isRu ? '🎯 Классический RRF' : '🎯 Baseline RRF',
      badge: 'α=0.70 · 10:00',
      desc: isRu ? 'Сбалансированный гибридный поиск (HNSW + BM25)' : 'Balanced hybrid search (HNSW + BM25)',
    },
    {
      id: 'kinetic_compare',
      label: isRu ? '⚖️ Сравнение A↔B + Цена' : '⚖️ A↔B Compare + Price',
      badge: 'Kinetic V1',
      desc: isRu ? 'Симуляция выбора между товарами и чувствительности к цене' : 'Simulates A/B item comparison & price hover sensitivity',
    },
    {
      id: 'night_serendipity',
      label: isRu ? '✨ Анти-Эхо-Камера (23:00)' : '✨ Anti-Echo Serendipity (23:00)',
      badge: 'Gram-Schmidt V2+V3',
      desc: isRu ? 'Вечерний дофаминовый серфинг + ортогональные открытия Грама-Шмидта' : 'Late-night discovery tempo + Gram-Schmidt orthogonal ray',
    },
    {
      id: 'intent_budget',
      label: isRu ? '🧠 Бюджетный Intent-запрос' : '🧠 Budget Intent Query',
      badge: 'Intent-Aware',
      desc: isRu ? 'Авто-извлечение категории, сценария и ценового потолка' : 'Automatic category, use-case, and budget extraction',
    },
  ];

  const exportSnippet = useMemo(() => {
    const cleanQuery = query || 'недорогие наушники для бега';
    const payload = {
      query: cleanQuery,
      topK: 12,
      alpha: effectiveAlpha,
      baseAlpha: alpha,
      includeExplanation: true,
      abFlags: { disableIntentBoost, disableMmrPenalty },
      cognitiveVectors: {
        intentRadar: { axisDiscovery: radarCoords.axisDiscovery, axisTier: radarCoords.axisTier },
        chronoSessionHour: simulatedHour ?? new Date().getHours(),
        serendipityOrthogonalRay: radarCoords.axisDiscovery > 0.1,
      },
    };
    if (exportFormat === 'json') return JSON.stringify(payload, null, 2);
    if (exportFormat === 'curl') {
      return `curl -X POST http://localhost:3001/v1/search \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: eidos_dev_key" \\\n  -d '${JSON.stringify(payload)}'`;
    }
    if (exportFormat === 'ts') {
      return `import { EidosClient } from '@eidos/sdk';\n\nconst eidos = new EidosClient({ baseUrl: 'http://localhost:3001', apiKey: process.env.EIDOS_API_KEY ?? 'eidos_dev_key' });\nconst response = await eidos.search({ query: ${JSON.stringify(cleanQuery)}, topK: 12, alpha: ${effectiveAlpha}, includeExplanation: true });\nconsole.log(response.extractedIntent, response.results);`;
    }
    return `from eidos_sdk import EidosClient\n\nclient = EidosClient(base_url="http://localhost:3001", api_key="eidos_dev_key")\nres = client.search(query=${JSON.stringify(cleanQuery)}, top_k=12, alpha=${effectiveAlpha}, include_explanation=True)\nprint(res["extractedIntent"], len(res["results"]))`;
  }, [query, alpha, effectiveAlpha, radarCoords, simulatedHour, exportFormat, disableIntentBoost, disableMmrPenalty]);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(exportSnippet).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="card p-4 mb-4 border border-[var(--border)] bg-[var(--surface)]" data-testid="vector-scenario-export-bar">
      {/* Row 1: Progressive Disclosure Levels + 15-sec Wow CTA + 1-click A/B Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-sec)] flex items-center gap-1 mr-1">
            <Layers size={12} />
            <span>{isRu ? 'Режим:' : 'Level:'}</span>
          </span>
          {(
            [
              { id: 'simple', label: isRu ? '1. Простой' : '1. Simple' },
              { id: 'advanced', label: isRu ? '2. Продвинутый' : '2. Advanced' },
              { id: 'expert', label: isRu ? '3. Эксперт (Лаб)' : '3. Expert (Lab)' },
            ] as const
          ).map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              data-testid={`complexity-level-${lvl.id}`}
              onClick={() => onChangeComplexityLevel?.(lvl.id)}
              className={complexityLevel === lvl.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              {lvl.label}
            </button>
          ))}

          {onTriggerWowMoment && (
            <button
              type="button"
              data-testid="trigger-wow-moment-btn"
              onClick={onTriggerWowMoment}
              className="btn btn-primary btn-sm flex items-center gap-1.5 ml-1"
              title={isRu ? 'Запустить 15-секундный демо-сценарий с разбором Intent и X-Ray' : 'Run 15-second guided Wow scenario'}
            >
              <Wand2 size={13} />
              <span>{isRu ? '✨ Показать магию (15 сек)' : '✨ Show Magic (15s Wow)'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-[var(--text-sec)]">
            {isRu ? 'Быстрый A/B:' : 'Quick A/B:'}
          </span>
          <button
            type="button"
            data-testid="toggle-disable-intent"
            onClick={onToggleDisableIntentBoost}
            className={disableIntentBoost ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            title={isRu ? 'Отключить Intent-буст и сравнить выдачу' : 'Disable Intent boost for A/B comparison'}
          >
            {disableIntentBoost ? (isRu ? '🚫 Без Intent: ВКЛ' : '🚫 No Intent: ON') : isRu ? 'Без Intent' : 'Without Intent'}
          </button>
          <button
            type="button"
            data-testid="toggle-disable-mmr"
            onClick={onToggleDisableMmrPenalty}
            className={disableMmrPenalty ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            title={isRu ? 'Отключить штраф за дубликаты MMR' : 'Disable MMR diversity penalty'}
          >
            {disableMmrPenalty ? (isRu ? '🚫 Без MMR: ВКЛ' : '🚫 No MMR: ON') : isRu ? 'Без MMR' : 'Without MMR'}
          </button>
        </div>
      </div>

      {wowTourActive && (
        <div
          data-testid="wow-moment-coaching-banner"
          className="mb-3 px-3.5 py-2.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text)]"
        >
          <span>
            {isRu
              ? '💡 Запрос «недорогие наушники для бега» разобран за < 1 мс: выделены Категория (наушники) + Сценарий (бег) + Бюджет. Попробуй изменить вес Semantic ↔ Lexical или нажать «Без Intent»!'
              : '💡 Query parsed in < 1 ms: extracted Category + Use-Case + Budget. Try adjusting Semantic ↔ Lexical weight or clicking "Without Intent"!'}
          </span>
          <span className="badge badge-accent mono text-[10px]">15-SEC WOW ACTIVE</span>
        </div>
      )}

      {/* Row 2: 3-Vector Scenarios + Live Latency Profiler + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
            <Sparkles size={13} />
            <span>{isRu ? 'Сценарии 3 векторов (1-клик A/B):' : '1-Click Vector Scenarios:'}</span>
          </span>
          {scenarios.map((sc) => (
            <button
              key={sc.id}
              type="button"
              data-testid={`scenario-btn-${sc.id}`}
              onClick={() => onSelectScenario(sc.id)}
              title={sc.desc}
              className={activeScenarioId === sc.id ? 'btn btn-primary btn-sm flex items-center gap-1.5' : 'btn btn-secondary btn-sm flex items-center gap-1.5'}
            >
              <span>{sc.label}</span>
              <span className="mono text-[0.625rem] opacity-80 px-1 py-0.5 rounded bg-black/15">{sc.badge}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--bg-alt)] border border-[var(--border)] text-[0.6875rem] mono"
            data-testid="pipeline-stage-profiler"
          >
            <Activity size={12} className="text-[var(--success)]" />
            <span className="text-[var(--text-sec)]">
              Embed: <strong className="text-[var(--text)]">{stageTimingsMs.vectorizeMs.toFixed(2)}ms</strong>
            </span>
            <span className="text-[var(--text-mut)]">·</span>
            <span className="text-[var(--text-sec)]">
              HNSW+BM25: <strong className="text-[var(--text)]">{retrievalLatencyMs.toFixed(1)}ms</strong>
            </span>
            <span className="text-[var(--text-mut)]">·</span>
            <span className="text-[var(--text-sec)]">
              3-Vectors: <strong className="text-[var(--accent)]">{stageTimingsMs.cognitiveMs.toFixed(2)}ms</strong>
            </span>
            <span className="text-[var(--text-mut)]">·</span>
            <span className="text-[var(--text-sec)]">
              Pareto: <strong className="text-[var(--success)]">{stageTimingsMs.paretoMs.toFixed(2)}ms</strong>
            </span>
            <span
              data-testid="pipeline-cache-badge"
              className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                cacheStatus === 'HIT' ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--accent)]/15 text-[var(--accent)]'
              }`}
            >
              CACHE {cacheStatus}
            </span>
          </div>

          <button
            type="button"
            data-testid="toggle-config-exporter"
            onClick={() => setShowExporter((v) => !v)}
            className={showExporter ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <Code2 size={13} />
            <span>{isRu ? 'Экспорт конфига / SDK' : 'Export Config / SDK'}</span>
          </button>
        </div>
      </div>

      {showExporter && (
        <div className="mt-3.5 pt-3.5 border-t border-[var(--border)]" data-testid="config-exporter-drawer">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              {(['json', 'curl', 'ts', 'python'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  data-testid={`export-tab-${tab}`}
                  onClick={() => setExportFormat(tab)}
                  className={exportFormat === tab ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                >
                  {tab === 'json' ? 'JSON Config' : tab === 'curl' ? 'cURL (/v1/search)' : tab === 'ts' ? 'TypeScript (@eidos/sdk)' : 'Python (eidos-sdk)'}
                </button>
              ))}
            </div>
            <button type="button" data-testid="copy-export-snippet" onClick={handleCopy} className="btn btn-secondary btn-sm flex items-center gap-1.5">
              {copied ? <Check size={13} className="text-[var(--success)]" /> : <Copy size={13} />}
              <span>{copied ? (isRu ? 'Скопировано!' : 'Copied!') : isRu ? 'Копировать код' : 'Copy Snippet'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-md bg-[var(--bg)] border border-[var(--border)] mono text-xs text-[var(--text)] overflow-x-auto leading-relaxed">
            {exportSnippet}
          </pre>
        </div>
      )}
    </div>
  );
};
