import { RequestContext } from './types';

/**
 * ContextSignals evaluates environmental and session dynamics, including time-of-day
 * affinities, device characteristics, and short-term intra-session saturation.
 */
export class ContextSignals {
  private readonly timezoneOffset: number;

  /**
   * @param config - Options including user or server timezoneOffset in minutes
   */
  constructor(config?: { timezoneOffset?: number }) {
    this.timezoneOffset = config?.timezoneOffset ?? 0;
  }

  /**
   * Calculates contextual alignment for an item category given the current request context.
   *
   * @param category - Category of the candidate item
   * @param context - Client request context (timestamp, device, hour, etc.)
   * @param categoryAffinity - Map from category -> hourOfDay (0-23) -> affinity score [0, 1]
   * @returns Relevance score between 0.0 and 1.0
   */
  public getContextualRelevance(
    category: string,
    context: RequestContext,
    categoryAffinity?: Map<string, Map<number, number>>
  ): number {
    let hour = context.hourOfDay;
    if (hour === undefined) {
      const date = new Date(context.timestamp + this.timezoneOffset * 60 * 1000);
      hour = date.getUTCHours();
    }

    if (!categoryAffinity || !categoryAffinity.has(category)) {
      // Default baseline: mobile preference for lightweight/quick items, desktop for detailed
      if (context.device === 'mobile') {
        return 0.55;
      }
      return 0.5;
    }

    const hourMap = categoryAffinity.get(category);
    if (!hourMap || !hourMap.has(hour)) {
      return 0.5;
    }

    return Math.max(0, Math.min(1, hourMap.get(hour) ?? 0.5));
  }

  /**
   * Computes a session saturation penalty if the user has already viewed or interacted
   * with this item in the active session window.
   *
   * @param itemId - Candidate item ID
   * @param sessionHistory - Array of item IDs viewed in the active user session
   * @returns Penalty factor between 0.0 (not in session) and 1.0 (recent/repetitive)
   */
  public getSessionPenalty(itemId: string, sessionHistory?: string[]): number {
    if (!sessionHistory || sessionHistory.length === 0) {
      return 0.0;
    }

    const idx = sessionHistory.lastIndexOf(String(itemId));
    if (idx === -1) {
      return 0.0;
    }

    // Recent items in session incur higher penalty than items viewed long ago
    const distanceToLatest = sessionHistory.length - 1 - idx;
    return Math.max(0.1, Math.min(1.0, Math.exp(-distanceToLatest * 0.3)));
  }
}
