/**
 * Chrono-Cognitive & Circadian Session Tempo Engine
 * Models the user's circadian context (time of day, day of week) and interaction cadence
 * to dynamically shift between "Sniper Utility Mode" and "Dopamine Discovery Mode".
 */

export type ChronoCognitiveMode = 'sniper_utility' | 'balanced_flow' | 'dopamine_discovery';

export interface ChronoCognitiveInput {
  /** Local hour of the user (0..23) */
  localHour?: number;
  /** Day of week (0 = Sunday .. 6 = Saturday) */
  dayOfWeek?: number;
  /** Current session duration in seconds */
  sessionDurationSec?: number;
  /** Interactions (queries + clicks + hovers) per minute */
  actionsPerMinute?: number;
}

export interface ChronoCognitiveProfile {
  mode: ChronoCognitiveMode;
  modeLabelRu: string;
  modeLabelEn: string;
  /** Exploration temperature in [0, 1] */
  explorationTemperature: number;
  /** Choice fatigue index in [0, 1] based on prolonged session duration */
  choiceFatigueIndex: number;
  /** Recommended weight for Serendipity vector (0.0 .. 0.45) */
  recommendedSerendipityWeight: number;
  /** Recommended MMR diversity lambda (0.15 .. 0.65) */
  recommendedMmrLambda: number;
  /** Recommended shift to dense semantic alpha (-0.15 .. +0.20) */
  recommendedAlphaShift: number;
  /** Explanation of circadian and tempo factors */
  rationale: string;
}

export class ChronoCognitiveEngine {
  public static evaluate(input?: ChronoCognitiveInput): ChronoCognitiveProfile {
    const now = new Date();
    const hour =
      typeof input?.localHour === 'number' && input.localHour >= 0 && input.localHour <= 23
        ? Math.floor(input.localHour)
        : now.getHours();
    const day =
      typeof input?.dayOfWeek === 'number' && input.dayOfWeek >= 0 && input.dayOfWeek <= 6
        ? Math.floor(input.dayOfWeek)
        : now.getDay();
    const durationSec = Math.max(0, input?.sessionDurationSec ?? 45);
    const apm = Math.max(0.1, input?.actionsPerMinute ?? 3.5);

    const isWeekend = day === 0 || day === 6;
    const isMorningWorkHours = !isWeekend && hour >= 8 && hour <= 13;
    const isLateEvening = hour >= 20 || hour <= 2;

    // Calculate circadian exploration baseline
    let circadianTemp = 0.45;
    if (isMorningWorkHours) {
      circadianTemp = 0.22; // Pragmatic, goal-directed utility mode
    } else if (isLateEvening || isWeekend) {
      circadianTemp = 0.74; // Evening / weekend exploratory browsing
    }

    // Session tempo modulation: high APM with short duration = urgent goal;
    // longer duration with moderate APM = exploratory / inspiration seeking
    const tempoFactor = apm > 8 && durationSec < 90 ? -0.18 : durationSec > 180 ? +0.16 : 0;

    const explorationTemperature =
      Math.round(Math.min(0.95, Math.max(0.1, circadianTemp + tempoFactor)) * 100) / 100;

    // Choice fatigue grows logarithmically after 3 minutes of searching
    const choiceFatigueIndex =
      Math.round(Math.min(1, Math.max(0, Math.log1p(Math.max(0, durationSec - 60) / 120) * 0.55)) * 100) /
      100;

    let mode: ChronoCognitiveMode = 'balanced_flow';
    if (explorationTemperature <= 0.35) {
      mode = 'sniper_utility';
    } else if (explorationTemperature >= 0.62) {
      mode = 'dopamine_discovery';
    }

    const recommendedSerendipityWeight =
      Math.round((0.08 + explorationTemperature * 0.32) * 100) / 100;
    const recommendedMmrLambda =
      Math.round((0.18 + explorationTemperature * 0.42) * 100) / 100;
    const recommendedAlphaShift =
      mode === 'sniper_utility' ? -0.08 : mode === 'dopamine_discovery' ? +0.12 : 0.0;

    const timePeriodLabel =
      hour >= 5 && hour < 12
        ? 'утренний прагматичный цикл'
        : hour >= 12 && hour < 18
        ? 'дневной рабочий цикл'
        : hour >= 18 && hour < 23
        ? 'вечерний исследовательский цикл'
        : 'ночной инсайт-цикл';

    const rationale =
      mode === 'sniper_utility'
        ? `Локальное время ${hour}:00 (${timePeriodLabel}), высокий темп (${apm.toFixed(1)} действ/мин) → активирован снайперский режим точного попадания.`
        : mode === 'dopamine_discovery'
        ? `Локальное время ${hour}:00 (${timePeriodLabel}), температура исследования ${(explorationTemperature * 100).toFixed(0)}% → усилен вектор неожиданных открытий (Serendipity).`
        : `Сбалансированный хроно-когнитивный поток (${hour}:00, усталость выбора ${(choiceFatigueIndex * 100).toFixed(0)}%).`;

    return {
      mode,
      modeLabelRu:
        mode === 'sniper_utility'
          ? 'Снайперский утилитарный ритм'
          : mode === 'dopamine_discovery'
          ? 'Дофаминовый режим открытий'
          : 'Сбалансированный когнитивный поток',
      modeLabelEn:
        mode === 'sniper_utility'
          ? 'Sniper Utility Mode'
          : mode === 'dopamine_discovery'
          ? 'Dopamine Discovery Mode'
          : 'Balanced Cognitive Flow',
      explorationTemperature,
      choiceFatigueIndex,
      recommendedSerendipityWeight,
      recommendedMmrLambda,
      recommendedAlphaShift,
      rationale,
    };
  }
}
