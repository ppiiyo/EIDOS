import React from 'react';
import { Activity, Clock, Cpu, Gauge, Sparkles } from 'lucide-react';
import {
  KineticAttentionProfile,
  ChronoCognitiveProfile,
  QueryRouteDecision,
  ParetoOptimizationReport,
  ParetoCandidateSolution,
} from '@eidos/core';
import { UiLanguage } from '../../i18n/uiTranslations';

interface KineticBiometricsHUDProps {
  kineticProfile: KineticAttentionProfile;
  chronoProfile: ChronoCognitiveProfile;
  routeDecision: QueryRouteDecision;
  paretoReport: ParetoOptimizationReport;
  scrollVelocityPxPerSec: number;
  comparisonAlternations: number;
  priceHoverCount: number;
  simulatedHour: number | null;
  onChangeSimulatedHour: (hour: number | null) => void;
  onSimulateArchetype: (preset: 'comparer' | 'price_hesitant' | 'scanner' | 'sniper') => void;
  onApplyParetoSolution: (sol: ParetoCandidateSolution) => void;
  uiLang?: UiLanguage;
}

export const KineticBiometricsHUD: React.FC<KineticBiometricsHUDProps> = ({
  kineticProfile,
  chronoProfile,
  routeDecision,
  paretoReport,
  scrollVelocityPxPerSec,
  comparisonAlternations,
  priceHoverCount,
  simulatedHour,
  onChangeSimulatedHour,
  onSimulateArchetype,
  onApplyParetoSolution,
  uiLang = 'ru',
}) => {
  const isRu = uiLang === 'ru';

  const paretoPresets = [
    paretoReport.recommendedBalanced,
    paretoReport.recommendedMaxRelevance,
    paretoReport.recommendedMaxDiscovery,
    paretoReport.recommendedMaxCommercial,
  ];

  return (
    <div
      className="card p-4 border border-[var(--border)] bg-[var(--bg-alt)]"
      data-testid="kinetic-biometrics-hud"
    >
      {/* Top Row: Live Attention Biometrics & Adaptive Router */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[var(--success)]" />
          <div>
            <div className="text-sm font-bold text-[var(--text)]">
              {isRu
                ? 'Живой HUD биометрии внимания и когнитивной маршрутизации'
                : 'Live Kinetic Attention Biometrics & Query Router HUD'}
            </div>
            <div className="text-[0.6875rem] text-[var(--text-sec)]">
              {isRu
                ? '16-мерный вектор физики курсора (до клика) + Хроно-ритм сессии + Парето-оптимизатор'
                : '16-d pre-click cursor physics vector + Circadian tempo + Multi-objective Pareto optimizer'}
            </div>
          </div>
        </div>

        <span
          className="badge badge-success mono text-[0.6875rem]"
          data-testid="kinetic-archetype-badge"
        >
          {isRu ? kineticProfile.archetypeLabelRu : kineticProfile.archetypeLabelEn} ·{' '}
          {Math.round(kineticProfile.confidence * 100)}%
        </span>
      </div>

      {/* 3-Column Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3">
        {/* 1. Kinetic Micro-Physics */}
        <div className="p-2.5 rounded-md bg-[var(--bg)] border border-[var(--border)]">
          <div className="flex items-center justify-between text-[0.6875rem] text-[var(--text-sec)] mb-1">
            <span className="font-semibold flex items-center gap-1">
              <Gauge size={12} className="text-[var(--accent)]" />
              {isRu ? 'Физика курсора и скролла' : 'Cursor & Scroll Physics'}
            </span>
            <span className="mono text-[var(--accent)]">16-d Vec</span>
          </div>

          <div className="grid grid-cols-3 gap-1 text-center my-1.5">
            <div className="p-1 rounded bg-[var(--bg-alt)]">
              <div className="mono text-xs font-bold text-[var(--text)]">
                {Math.round(scrollVelocityPxPerSec)}
              </div>
              <div className="text-[0.625rem] text-[var(--text-sec)]">px/s</div>
            </div>
            <div className="p-1 rounded bg-[var(--bg-alt)]">
              <div className="mono text-xs font-bold text-[var(--text)]">
                {comparisonAlternations}
              </div>
              <div className="text-[0.625rem] text-[var(--text-sec)]">A↔B сравн.</div>
            </div>
            <div className="p-1 rounded bg-[var(--bg-alt)]">
              <div className="mono text-xs font-bold text-[var(--text)]">{priceHoverCount}</div>
              <div className="text-[0.625rem] text-[var(--text-sec)]">Цена-фокус</div>
            </div>
          </div>

          {/* 16-d Biometric Vector Spectrogram Bars */}
          <div className="flex items-end gap-0.5 h-5 mt-1" title="16-d Normalized Biometric Attention Vector">
            {kineticProfile.biometricVector.map((val, idx) => (
              <div
                key={idx}
                className="flex-1 bg-[var(--accent)] rounded-t transition-all duration-150"
                style={{
                  height: `${Math.max(15, Math.min(100, Math.round(Math.abs(val) * 180)))}%`,
                  opacity: 0.45 + Math.min(0.55, Math.abs(val)),
                }}
              />
            ))}
          </div>
        </div>

        {/* 2. Chrono-Cognitive Session Rhythm */}
        <div className="p-2.5 rounded-md bg-[var(--bg)] border border-[var(--border)]">
          <div className="flex items-center justify-between text-[0.6875rem] text-[var(--text-sec)] mb-1">
            <span className="font-semibold flex items-center gap-1">
              <Clock size={12} className="text-[var(--success)]" />
              {isRu ? 'Хроно-когнитивный вектор' : 'Chrono-Cognitive Vector'}
            </span>
            <span className="mono text-[var(--success)]">
              T={Math.round(chronoProfile.explorationTemperature * 100)}%
            </span>
          </div>

          <div className="text-xs font-bold text-[var(--text)] truncate">
            {isRu ? chronoProfile.modeLabelRu : chronoProfile.modeLabelEn}
          </div>
          <div className="text-[0.6875rem] text-[var(--text-sec)] mt-0.5 line-clamp-2">
            {chronoProfile.rationale}
          </div>

          <div className="flex items-center gap-1 mt-2">
            {[
              { label: isRu ? 'Авто' : 'Auto', hr: null },
              { label: '09:00', hr: 9 },
              { label: '15:00', hr: 15 },
              { label: '23:00', hr: 23 },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onChangeSimulatedHour(item.hr)}
                className={
                  simulatedHour === item.hr
                    ? 'btn btn-primary btn-sm !px-1.5 !py-0.5 !text-[0.625rem]'
                    : 'btn btn-secondary btn-sm !px-1.5 !py-0.5 !text-[0.625rem]'
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Adaptive Query Complexity Router */}
        <div className="p-2.5 rounded-md bg-[var(--bg)] border border-[var(--border)]">
          <div className="flex items-center justify-between text-[0.6875rem] text-[var(--text-sec)] mb-1">
            <span className="font-semibold flex items-center gap-1">
              <Cpu size={12} className="text-[var(--accent)]" />
              {isRu ? 'Адаптивный маршрутизатор' : 'Adaptive Query Router'}
            </span>
            <span className="mono text-[var(--success)]">
              -{routeDecision.estimatedComputeSavingsPct}% CPU
            </span>
          </div>

          <div className="mono text-xs font-bold text-[var(--accent)] truncate" data-testid="query-route-badge">
            {routeDecision.route}
          </div>
          <div className="text-[0.6875rem] text-[var(--text-sec)] mt-0.5">
            efSearch={routeDecision.efSearch} · Сложн.={Math.round(routeDecision.complexityScore * 100)}% ·{' '}
            {routeDecision.enableSerendipity ? 'Serendipity ON' : 'Fast Lexical'}
          </div>
          <div className="text-[0.625rem] text-[var(--text-mut)] mt-1 line-clamp-1">
            {routeDecision.rationale}
          </div>
        </div>
      </div>

      {/* Diagnostic summary + Quick Biometric Simulators */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[var(--border)]">
        <div className="text-xs text-[var(--text-sec)]">
          {kineticProfile.diagnosticSummary}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[0.6875rem] text-[var(--text-sec)] mr-1">
            {isRu ? 'Симуляция биометрии:' : 'Simulate physics:'}
          </span>
          {[
            { id: 'comparer' as const, label: isRu ? 'Сравнение A↔B' : 'Compare A↔B' },
            { id: 'price_hesitant' as const, label: isRu ? 'Сомнение в цене' : 'Price Hesitation' },
            { id: 'scanner' as const, label: isRu ? 'Быстрый скролл' : 'Fast Scroll' },
            { id: 'sniper' as const, label: isRu ? 'Снайпер' : 'Sniper' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => onSimulateArchetype(btn.id)}
              className="btn btn-secondary btn-sm !py-0.5 !px-2 !text-[0.6875rem]"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-Objective Pareto Frontier Optimizer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text)]">
          <Sparkles size={13} className="text-[var(--accent)]" />
          <span>
            {isRu
              ? `Парето-фронт весов (${paretoReport.frontier.length} недоминируемых решений из ${paretoReport.evaluatedGridSize}):`
              : `Pareto Frontier (${paretoReport.frontier.length}/${paretoReport.evaluatedGridSize} non-dominated):`}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {paretoPresets.map((sol) => (
            <button
              key={sol.labelRu}
              type="button"
              data-testid="pareto-preset-btn"
              onClick={() => onApplyParetoSolution(sol)}
              className="btn btn-secondary btn-sm !py-1 !px-2.5 !text-[0.6875rem]"
              title={`α=${sol.weights.alpha}, MMR=${sol.weights.mmrLambda}, Serendipity=${sol.weights.serendipityWeight} | NDCG=${sol.objectives.relevanceScore}, Disc=${sol.objectives.discoveryScore}, GMV=${sol.objectives.commercialScore}`}
            >
              <span>{isRu ? sol.labelRu : sol.labelEn}</span>
              <span className="mono text-[var(--accent)] ml-1">
                (α={sol.weights.alpha.toFixed(2)})
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
