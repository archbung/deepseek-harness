/**
 * Research-evidence domain (`ctx.researchEvidence`): a durable, source-linked
 * evidence store backed exclusively by the owning session log. Recording one
 * record appends an `evidence/recorded` event; reads fold those events through
 * the registered `research/evidence` projection. No event removes a record, so
 * the store is append-only and every value is reconstructable from the log.
 *
 * The claim-backing policy (a sibling package) consumes {@link knownIds} to
 * reject report claims citing evidence the session never recorded.
 *
 * @module @deepseek-ai/dsh-research-evidence
 */

import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Session } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition, ProjectionHandle } from '@deepseek-ai/dsh-session-projection'
import type { WebSearchSource } from '@deepseek-ai/dsh-web'
import { applyEvidenceEvent } from './domain.ts'
import type { EvidenceId, EvidenceProjection, EvidenceRecord } from './types.ts'

export type * from './types.ts'
export type * from './domain.ts'
export { EVIDENCE_RECORDED_VERSION, applyEvidenceEvent } from './domain.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    researchEvidence: EvidenceService
  }
}

/** Wire and checkpoint schema of one evidence record. */
const evidenceRecordSchema: ZodType<EvidenceRecord> = zod.object({
  id: zod.string().min(1).transform(brandString<EvidenceId>),
  source: zod.object({
    url: zod.string().min(1),
    title: zod.string().optional(),
    snippet: zod.string().optional(),
    summary: zod.string().optional(),
    publishedAt: zod.string().optional(),
  }),
  capturedAt: zod.number(),
}) as ZodType<EvidenceRecord>

/** Schema of the `research/evidence` projection value. */
const evidenceProjectionSchema: ZodType<EvidenceProjection> = zod.object({
  records: zod.array(evidenceRecordSchema),
})

/**
 * The append-only evidence projection: the session's recorded citations in
 * commit order, serving both the host {@link EvidenceService} reads and the
 * client Evidence view.
 */
export const evidenceProjectionDefinition = {
  key: 'research/evidence',
  stateSchema: evidenceProjectionSchema,
  init: (): EvidenceProjection => ({ records: [] }),
  apply: applyEvidenceEvent,
  wire: { viewSchema: evidenceProjectionSchema, view: state => state },
  stateVersion: 1,
} satisfies ProjectionDefinition<'research/evidence', EvidenceProjection>

/**
 * Evidence service (`ctx.researchEvidence`): records source-linked citations as
 * durable session events and reads them back through the retained projection
 * handle. The handle keeps folding after unregistration, so reads survive
 * disposal of the global drive.
 */
export class EvidenceService extends Service {
  static inject = ['sessionProjections']

  private handle!: ProjectionHandle<EvidenceProjection>

  constructor(ctx: Context) {
    super(ctx, 'researchEvidence')
  }

  protected async [Service.init](): Promise<void> {
    this.handle = await this.ctx.sessionProjections.register(evidenceProjectionDefinition)
  }

  /**
   * Record one source-linked citation as a durable `evidence/recorded` event.
   * @param session - the session whose log receives the record.
   * @param source - the `ctx.web` citation to wrap; `source.url` must be present.
   * @returns the committed record, including its freshly minted id.
   */
  record(session: Session, source: WebSearchSource): EvidenceRecord {
    const record: EvidenceRecord = {
      id: brandString<EvidenceId>(`evidence-${randomUUID()}`),
      source,
      capturedAt: Date.now(),
    }
    session.append('evidence/recorded', { kind: 'evidence/recorded', version: 1, record })
    return record
  }

  /**
   * Every evidence record recorded in the session, in commit order.
   * @param session - the session whose evidence is read.
   * @returns the current records; empty before any capture.
   */
  records(session: Session): readonly EvidenceRecord[] {
    return this.handle.stateOf(session).records
  }

  /**
   * The set of evidence ids the session has recorded. The claim-backing policy
   * uses it to reject claims citing unknown evidence.
   * @param session - the session whose evidence is read.
   * @returns a fresh set of known evidence ids.
   */
  knownIds(session: Session): ReadonlySet<EvidenceId> {
    return new Set(this.records(session).map(record => record.id))
  }
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'research-evidence'

/** The projection registry this service depends on. */
export const inject = ['sessionProjections']

/** Register the evidence service on the context. */
export function apply(ctx: Context): void {
  ctx.plugin(EvidenceService)
}
