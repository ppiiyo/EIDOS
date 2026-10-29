import React, { useState, useMemo } from 'react';
import { Sparkles, Code2, Copy, Check, Activity } from 'lucide-react';
import { IntentRadarCoordinates } from '@eidos/core';
import {
  VectorScenarioPresetId,
  CognitiveStageTimings,
} from '../../hooks/useSearchCognitiveState';
import { UiLanguage } from '../../i18n/uiTranslations';

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
}) => {
  const isRu = uiLang === 'ru';
  const [showExporter, setShowExporter] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [copied, setCopied] = useState(false);

  const scenarios: Array<{
    id: VectorScenarioPresetId;
    label: string;
    badge: string;
    desc: string;
  }> = [
    {
      id: 'baseline',
      label: isRu ? '🎯 Классический RRF' : '🎯 Baseline RRF',
      badge: 'α=0.70 · 10:00',
      desc: isRu
        ? 'Сбалансированный гибридный поиск (HNSW + BM25) для точного утреннего интента'
        : 'Balanced hybrid search (HNSW + BM25) for focused daytime intent',
    },
    {
      id: 'kinetic_compare',
      label: isRu ? '⚖️ Сравнение A↔B + Цена' : '⚖️ A↔B Compare + Price',
      badge: 'Kinetic V1',
      desc: isRu
        ? 'Симуляция выбора между товарами: буст соотношения цена/качество и сигнатур внимания'
        : 'Simulates A/B item comparison & price hover sensitivity boost',
    },
    {
      id: 'night_serendipity',
      label: isRu ? '✨ Анти-Эхо-Камера (23:00)' : '✨ Anti-Echo Serendipity (23:00)',
      badge: 'Gram-Schmidt V2+V3',
      desc: isRu
        ? 'Вечерний дофаминовый серфинг + ортогональные открытия Грама-Шмидта за пределами доминирующей категории'
        : 'Late-night discovery tempo + Gram-Schmidt orthogonal serendipity ray',
    },
    {
      id: 'intent_budget',
      label: isRu ? '🧠 Бюджетный Intent-запрос' : '🧠 Budget Intent Query',
      badge: 'Intent-Aware',
      desc: isRu
        ? 'Авто-извлечение категории, сценария и ценового потолка из естественного запроса'
        : 'Automatic category, use-case, and budget constraint extraction',
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
      cognitiveVectors: {
        intentRadar: {
          axisDiscovery: radarCoords.axisDiscovery,
          axisTier: radarCoords.axisTier,
        },
        chronoSessionHour: simulatedHour ?? new Date().getHours(),
        serendipityOrthogonalRay: radarCoords.axisDiscovery > 0.1,
      },
    };

    if (exportFormat === 'json') {
      return JSON.stringify(payload, null, 2);
    }
    if (exportFormat === 'curl') {
      return `curl -X POST http://localhost:3001/v1/search \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: eidos_dev_key" \\
  -d '${JSON.stringify(payload)}'`;
    }
    if (exportFormat === 'ts') {
      return `import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.EIDOS_API_KEY ?? 'eidos_dev_key',
});

const response = await eidos.search({
  query: ${JSON.stringify(cleanQuery)},
  topK: 12,
  alpha: ${effectiveAlpha},
  includeExplanation: true,
});
console.log(response.extractedIntent, response.results);`;
    }
    return `from eidos_sdk import EidosClient

client = EidosClient(base_url="http://localhost:3001", api_key="eidos_dev_key")
res = client.search(
    query=${JSON.stringify(cleanQuery)},
    top_k=12,
    alpha=${effectiveAlpha},
    include_explanation=True,
)
print(res["extractedIntent"], len(res["results"]))`;
  }, [query, alpha, effectiveAlpha, radarCoords, simulatedHour, exportFormat]);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(exportSnippet).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="card p-4 mb-4 border border-[var(--border)] bg-[var(--surface)]"
      data-testid="vector-scenario-export-bar"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
            <Sparkles size={13} />
            <span>{isRu ? 'Сценарии 3 векторов (1-клик A/B):' : '1-Click Vector Scenarios:'}</span>
          </span>
          {scenarios.map((sc) => {
            const active = activeScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                data-testid={`scenario-btn-${sc.id}`}
                onClick={() => onSelectScenario(sc.id)}
                title={sc.desc}
                className={
                  active
                    ? 'btn btn-primary btn-sm flex items-center gap-1.5'
                    : 'btn btn-secondary btn-sm flex items-center gap-1.5'
                }
              >
                <span>{sc.label}</span>
                <span className="mono text-[0.625rem] opacity-80 px-1 py-0.5 rounded bg-black/15">
                  {sc.badge}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--bg-alt)] border border-[var(--border)] text-[0.6875rem] mono"
            data-testid="pipeline-stage-profiler"
            title={
              isRu
                ? 'Декомпозиция задержки конвейера в реальном времени'
                : 'Real-time search & cognitive pipeline stage timings'
            }
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
        <div
          className="mt-3.5 pt-3.5 border-t border-[var(--border)]"
          data-testid="config-exporter-drawer"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'json', label: 'JSON Config' },
                  { id: 'curl', label: 'cURL (/v1/search)' },
                  { id: 'ts', label: 'TypeScript (@eidos/sdk)' },
                  { id: 'python', label: 'Python (eidos-sdk)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`export-tab-${tab.id}`}
                  onClick={() => setExportFormat(tab.id)}
                  className={
                    exportFormat === tab.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-testid="copy-export-snippet"
              onClick={handleCopy}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
            >
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
