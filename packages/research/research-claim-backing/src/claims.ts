/**
 * Deterministic citation-integrity rules for research claims, free of host-side
 * imports so they stay unit-testable and reusable by the tool and the
 * `agent/turn-stopping` guard alike. A claim is backed only when it cites at
 * least one evidence id and every cited id is known to the session's evidence
 * store. Semantic support (does the excerpt actually support the claim?) is a
 * separate, model-backed concern left to a reviewer; this module enforces the
 * structural invariant that every claim is traceable to a recorded source.
 *
 * @module @deepseek-ai/dsh-research-claim-backing/claims
 */

import type { EvidenceId } from '@deepseek-ai/dsh-research-evidence'

/** One factual statement that must trace to recorded evidence. */
export interface ReportClaim {
  /** Stable claim identity within one report. */
  readonly id: string
  /** The claim text shown in the report. */
  readonly text: string
  /** Evidence ids intended to support the claim; at least one is required. */
  readonly evidenceIds: readonly EvidenceId[]
}

/** Why one claim is not backed by the session's recorded evidence. */
export interface UnbackedClaim {
  /** The offending claim. */
  readonly claim: ReportClaim
  /** `no-citation` when the claim cites nothing; `unknown-evidence` otherwise. */
  readonly reason: 'no-citation' | 'unknown-evidence'
  /** Cited ids absent from the known set; empty for `no-citation`. */
  readonly unknownEvidenceIds: readonly EvidenceId[]
}

/**
 * Partition claims by whether each is backed by known evidence. A claim with no
 * citation is `no-citation`; a claim citing any id outside `knownEvidenceIds`
 * is `unknown-evidence` carrying the offending ids. The deterministic citation
 * integrity check — no model call.
 * @param claims - the report's claims.
 * @param knownEvidenceIds - evidence ids the session has recorded.
 * @returns the unbacked claims; empty when every claim is backed.
 */
export function findUnbackedClaims(
  claims: readonly ReportClaim[],
  knownEvidenceIds: ReadonlySet<EvidenceId>,
): UnbackedClaim[] {
  const unbacked: UnbackedClaim[] = []
  for (const claim of claims) {
    if (claim.evidenceIds.length === 0) {
      unbacked.push({ claim, reason: 'no-citation', unknownEvidenceIds: [] })
      continue
    }
    const unknown = claim.evidenceIds.filter(id => !knownEvidenceIds.has(id))
    if (unknown.length > 0) {
      unbacked.push({ claim, reason: 'unknown-evidence', unknownEvidenceIds: unknown })
    }
  }
  return unbacked
}

/**
 * A model-facing explanation of why claims were rejected, naming each offending
 * claim and the exact missing or unknown citations so the model can fix them.
 * @param unbacked - the claims that failed the backing check.
 * @returns a single instruction string; empty when `unbacked` is empty.
 */
export function describeUnbackedClaims(unbacked: readonly UnbackedClaim[]): string {
  if (unbacked.length === 0) return ''
  const lines = unbacked.map(entry => entry.reason === 'no-citation'
    ? `- claim "${entry.claim.id}" cites no evidence; add at least one recorded evidence id or remove the claim`
    : `- claim "${entry.claim.id}" cites unknown evidence ${JSON.stringify(entry.unknownEvidenceIds)}; record those sources first or cite only known evidence`)
  return `Every report claim must cite recorded evidence. Unbacked claims:\n${lines.join('\n')}`
}
