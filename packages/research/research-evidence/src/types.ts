/**
 * Pure, client-safe vocabulary of the research-evidence domain: the stable
 * `EvidenceId` brand, the durable `EvidenceRecord` payload, and the ONE home of
 * the `research/evidence` session-projection key declaration. Kept free of
 * host-side imports (cordis, the service) so client aggregates can re-export it
 * with zero content duplication, mirroring `dsh-goal/types`.
 *
 * An evidence record is one source-linked excerpt captured during a research
 * run. It wraps the portable `WebSearchSource` citation shape from `ctx.web`
 * so this package never invents a parallel citation type: `url` is the only
 * guaranteed field, exactly as the web seam documents.
 *
 * @module @deepseek-ai/dsh-research-evidence/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { WebSearchSource } from '@deepseek-ai/dsh-web'

/**
 * Stable identity for one evidence record within a session. A report claim
 * cites evidence by this id; the claim-backing policy rejects any cited id the
 * evidence projection does not know.
 */
export type EvidenceId = Branded<'EvidenceId'>

/**
 * One source-linked excerpt available to support report claims. The `source`
 * is the exact `ctx.web` citation that produced it, so `title`, `snippet`,
 * `summary`, and `publishedAt` stay optional — a URL-only citation is a valid
 * record. `capturedAt` is epoch milliseconds at record time.
 */
export interface EvidenceRecord {
  /** Stable record identity, unique within the session. */
  readonly id: EvidenceId
  /** The portable citation this record wraps; `source.url` is always present. */
  readonly source: WebSearchSource
  /** Epoch milliseconds when the record was committed. */
  readonly capturedAt: number
}

/**
 * The `research/evidence` projection value: every evidence record committed in
 * the session, in commit order. A fixed set of records per session, each a
 * small citation payload; the list grows one entry per capture.
 */
export interface EvidenceProjection {
  /** All committed evidence records in commit order. */
  readonly records: readonly EvidenceRecord[]
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /**
     * Every source-linked evidence record committed in the session, in commit
     * order. Each matching `evidence/recorded` event appends its complete
     * record; no event removes one.
     */
    'research/evidence': EvidenceProjection
  }
}
