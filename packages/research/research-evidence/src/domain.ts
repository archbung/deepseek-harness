/**
 * Host-side vocabulary of the research-evidence domain: the durable
 * `evidence/recorded` session event and the pure replay fold over it. Kept
 * separate from ./types.ts (the client-safe outlet) because the session-event
 * declaration merges into `@deepseek-ai/dsh-session`, pulling host-only
 * declarations into the program, which client aggregates forbid.
 *
 * Append-only domain: one event records one complete evidence record, and no
 * event removes one. The whole-value event rule holds trivially — each event
 * carries its full {@link EvidenceRecord}.
 *
 * @module @deepseek-ai/dsh-research-evidence
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { EvidenceProjection, EvidenceRecord } from './types.ts'

/** Durable append of one source-linked evidence record. */
export interface EvidenceRecordedMeta {
  readonly kind: 'evidence/recorded'
  readonly version: 1
  /** The complete record this event commits. */
  readonly record: EvidenceRecord
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * One source-linked evidence record captured during a research run. The
     * payload carries the complete {@link EvidenceRecord}; the evidence
     * projection appends it in commit order.
     */
    'evidence/recorded': EvidenceRecordedMeta
  }
}

/** Version this fold understands for `evidence/recorded` payloads. */
export const EVIDENCE_RECORDED_VERSION = 1

/**
 * Pure replay fold of durable evidence facts. Appends the record of each
 * `evidence/recorded` event and returns the same state reference for every
 * unrelated event, as the projection contract requires.
 * @param state - the projection covering all prior events.
 * @param event - the next committed session event.
 * @returns the next projection (same reference when the event is unrelated).
 */
export function applyEvidenceEvent(
  state: EvidenceProjection,
  event: SessionEvent,
): EvidenceProjection {
  if (event.type !== 'evidence/recorded') return state
  return { records: [...state.records, event.data.record] }
}
