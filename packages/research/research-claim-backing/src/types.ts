/**
 * Durable vocabulary of the research claim-backing domain: the `report/submitted`
 * session event that commits one report's claims, and the `research/report`
 * projection key that exposes the latest submitted report per session. Kept
 * client-safe (no cordis/tool imports) so aggregates can re-export it.
 *
 * @module @deepseek-ai/dsh-research-claim-backing/types
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ReportClaim } from './claims.ts'

/** Complete post-submission report state committed by `report/submitted`. */
export interface ReportSubmittedMeta {
  readonly kind: 'report/submitted'
  readonly version: 1
  /** Turn the report was submitted in; the backing guard scopes to it. */
  readonly turn: number
  /** The report's claims, each citing evidence ids. */
  readonly claims: readonly ReportClaim[]
}

/**
 * The `research/report` projection value: the latest report submitted in the
 * session, or `null` before the first submission. One small record per session;
 * each submission replaces it.
 */
export type ReportProjection = {
  /** Turn of the latest submission. */
  readonly turn: number
  /** The latest report's claims. */
  readonly claims: readonly ReportClaim[]
} | null

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * One research report submitted for the turn, carrying its complete claim
     * list. The `research/report` projection keeps the latest; the backing
     * guard reads it at the turn-stop boundary.
     */
    'report/submitted': ReportSubmittedMeta
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /**
     * The latest report submitted in the session, or `null` before the first
     * submission. Each `report/submitted` event replaces the whole value.
     */
    'research/report': ReportProjection
  }
}

/**
 * Pure replay fold of the latest submitted report.
 * @param state - the projection covering all prior events.
 * @param event - the next committed session event.
 * @returns the next projection (same reference when the event is unrelated).
 */
export function applyReportEvent(state: ReportProjection, event: SessionEvent): ReportProjection {
  if (event.type !== 'report/submitted') return state
  return { turn: event.data.turn, claims: event.data.claims }
}
