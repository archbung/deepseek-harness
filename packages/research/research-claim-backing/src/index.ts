/**
 * Research claim-backing enforcement: a model-facing `report` tool whose
 * structured claims must each cite recorded evidence, and an
 * `agent/turn-stopping` guard that keeps a research turn open until every claim
 * in the latest submitted report is backed.
 *
 * Two enforcement points, one invariant ("every claim traces to a recorded
 * source"):
 *
 * - The tool rejects a submission containing any unbacked claim at call time,
 *   so the model gets immediate, specific feedback and no unbacked report is
 *   ever committed.
 * - The turn-stopping guard is the backstop: if the latest committed report for
 *   the closing turn still has unbacked claims, it steers one corrective step
 *   (up to `maxRevisions`), then lets the turn close so a stuck model is not
 *   trapped. Backing is the deterministic citation-integrity check against
 *   `ctx.researchEvidence.knownIds`; semantic support is a separate concern.
 *
 * @module @deepseek-ai/dsh-research-claim-backing
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { ProjectionHandle } from '@deepseek-ai/dsh-session-projection'
import type { EvidenceId } from '@deepseek-ai/dsh-research-evidence'
import type { Session } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
// Type-only: resolves the required ctx.researchEvidence and ctx.sessionProjections declarations.
import type {} from '@deepseek-ai/dsh-research-evidence'
import type {} from '@deepseek-ai/dsh-session-projection'
import { describeUnbackedClaims, findUnbackedClaims } from './claims.ts'
import type { ReportClaim } from './claims.ts'
import { applyReportEvent } from './types.ts'
import type { ReportProjection } from './types.ts'

export type * from './claims.ts'
export type * from './types.ts'
export { describeUnbackedClaims, findUnbackedClaims } from './claims.ts'
export { applyReportEvent } from './types.ts'

/** Deployment policy for claim-backing enforcement. */
export interface Config {
  /**
   * How many corrective steps the turn-stopping guard steers while unbacked
   * claims remain in the latest report before letting the turn close. Zero
   * disables the backstop (the tool still rejects unbacked submissions).
   */
  maxRevisions?: number
}

/** Schemastery configuration for the claim-backing plugin. */
export const Config: z<Config> = z.object({
  maxRevisions: z.number().default(1),
})

/** Wire payload schema of the `research/report` projection. */
const reportProjectionSchema: ZodType<ReportProjection> = zod.union([
  zod.object({
    turn: zod.number().int().nonnegative(),
    claims: zod.array(zod.object({
      id: zod.string().min(1),
      text: zod.string().min(1),
      evidenceIds: zod.array(zod.string().min(1)),
    })),
  }),
  zod.null(),
]) as ZodType<ReportProjection>

/** Narrow the model-supplied claim arguments to branded {@link ReportClaim}s. */
function toReportClaims(raw: { id: string; text: string; evidence_ids: string[] }[]): ReportClaim[] {
  const seen = new Set<string>()
  return raw.map((claim) => {
    const id = claim.id.trim()
    if (id.length === 0) throw new Error('invalid claim: `id` must be a non-empty string')
    if (seen.has(id)) throw new Error(`invalid claims: duplicate claim id ${JSON.stringify(id)}`)
    seen.add(id)
    return {
      id,
      text: claim.text,
      evidenceIds: claim.evidence_ids.map(value => brandString<EvidenceId>(value)),
    }
  })
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'research-claim-backing'

/** Services this plugin consumes. */
export const inject = ['tools', 'agents', 'researchEvidence', 'sessionProjections']

/**
 * Register the `report` tool, the `research/report` projection, and the
 * `agent/turn-stopping` backing guard.
 * @param ctx - registrant context carrying the tool, projection, and evidence services.
 * @param config - deployment claim-backing policy.
 * @returns when the plugin is ready.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const maxRevisions = config.maxRevisions ?? 1
  let revisionsBySession = new WeakMap<Session, number>()

  const reportHandle: ProjectionHandle<ReportProjection> =
    await ctx.sessionProjections.register<'research/report', ReportProjection>({
      key: 'research/report',
      stateSchema: reportProjectionSchema,
      init: () => null,
      apply: applyReportEvent,
      wire: { viewSchema: reportProjectionSchema, view: state => state, summary: false },
      stateVersion: 1,
    })

  ctx.effect(() => () => {
    // Drop per-session revision counters on disposal (HMR safety); replacing
    // the WeakMap makes the release observable and immediate for tests.
    revisionsBySession = new WeakMap<Session, number>()
  }, 'research-claim-backing revision-state teardown')

  ctx.tools.register(defineTool({
    name: 'report',
    description:
      'Submit the research report as a list of claims. Every claim must cite at least one '
      + 'recorded evidence id (from a prior web result captured as evidence); a claim citing no '
      + 'evidence or an unknown id is rejected. Record sources before you claim them.',
    parameters: {
      claims: {
        type: 'array',
        required: true,
        description: 'The report claims, each a factual statement with its supporting evidence ids.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true, description: 'Stable identifier for this claim within the report.' },
            text: { type: 'string', required: true, description: 'The factual statement.' },
            evidence_ids: {
              type: 'array',
              required: true,
              description: 'Recorded evidence ids supporting this claim; at least one is required.',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claimCount: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `Report accepted with ${value.claimCount} backed claim(s).`,
      }],
    },
    execute(args, exec) {
      const agent = exec.agent
      if (agent === undefined) {
        throw new Error('the report tool requires an agent session to record claims')
      }
      const claims = toReportClaims(args.claims)
      const unbacked = findUnbackedClaims(claims, ctx.researchEvidence.knownIds(agent.session))
      if (unbacked.length > 0) {
        throw new Error(describeUnbackedClaims(unbacked))
      }
      const turn = ctx.agents.turnBoundaryOf(agent.session).lastTurn
      agent.session.append('report/submitted', { kind: 'report/submitted', version: 1, turn, claims })
      return Promise.resolve({ claimCount: claims.length })
    },
  }))

  ctx.on('agent/turn-stopping', ({ agent, turn }) => {
    if (maxRevisions <= 0) return
    const report = reportHandle.stateOf(agent.session)
    if (report === null || report.turn !== turn) return
    const unbacked = findUnbackedClaims(report.claims, ctx.researchEvidence.knownIds(agent.session))
    if (unbacked.length === 0) return
    const used = revisionsBySession.get(agent.session) ?? 0
    if (used >= maxRevisions) return
    revisionsBySession.set(agent.session, used + 1)
    agent.steer(createUserMessage({
      content: [{
        type: 'text',
        text: `${describeUnbackedClaims(unbacked)}\n\nRevise the report so every claim cites recorded evidence, then call \`report\` again.`,
      }],
      source: { kind: 'user' },
    }))
  })
}
