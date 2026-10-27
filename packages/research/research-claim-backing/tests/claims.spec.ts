/**
 * The claim-backing package: the pure citation-integrity partition
 * (`findUnbackedClaims`) and its model-facing description, the `research/report`
 * fold that keeps the latest submitted report, and the REAL `report` tool
 * driven through `ctx.tools.execute` — recording backed claims as a
 * `report/submitted` event and rejecting any claim citing unknown evidence.
 */

import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { unsupportedModel, unsupportedInbox } from '@deepseek-ai/dsh-agent-loop-testkit'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import { EvidenceService } from '@deepseek-ai/dsh-research-evidence'
import type { EvidenceId } from '@deepseek-ai/dsh-research-evidence'
import {
  applyReportEvent,
  describeUnbackedClaims,
  findUnbackedClaims,
} from '@deepseek-ai/dsh-research-claim-backing'
import type { ReportClaim, ReportProjection } from '@deepseek-ai/dsh-research-claim-backing'
import * as plugin from '../src/index.ts'

const e1 = 'e1' as EvidenceId
const e2 = 'e2' as EvidenceId
const testToolSignal = new AbortController().signal

function claim(id: string, evidenceIds: EvidenceId[]): ReportClaim {
  return { id, text: `claim ${id}`, evidenceIds }
}

describe('findUnbackedClaims', () => {
  it('passes claims that cite only known evidence', () => {
    const known = new Set<EvidenceId>([e1, e2])
    expect(findUnbackedClaims([claim('a', [e1]), claim('b', [e1, e2])], known)).toEqual([])
  })

  it('flags a claim that cites nothing as no-citation', () => {
    const unbacked = findUnbackedClaims([claim('a', [])], new Set<EvidenceId>([e1]))
    expect(unbacked).toEqual([{ claim: claim('a', []), reason: 'no-citation', unknownEvidenceIds: [] }])
  })

  it('flags a claim that cites unknown evidence with the offending ids', () => {
    const unbacked = findUnbackedClaims([claim('a', [e1, e2])], new Set<EvidenceId>([e1]))
    expect(unbacked).toEqual([{ claim: claim('a', [e1, e2]), reason: 'unknown-evidence', unknownEvidenceIds: [e2] }])
  })

  it('describes unbacked claims with specific, per-claim guidance', () => {
    const unbacked = findUnbackedClaims([claim('a', []), claim('b', [e2])], new Set<EvidenceId>([e1]))
    const text = describeUnbackedClaims(unbacked)
    expect(text).toContain('claim "a" cites no evidence')
    expect(text).toContain('claim "b" cites unknown evidence')
    expect(describeUnbackedClaims([])).toBe('')
  })
})

describe('research/report fold', () => {
  it('keeps the latest submitted report and ignores unrelated events', () => {
    const first = {
      type: 'report/submitted', seq: 0, time: 1,
      data: { kind: 'report/submitted', version: 1, turn: 1, claims: [claim('a', [e1])] },
    } as never
    const afterFirst = applyReportEvent(null as ReportProjection, first)
    expect(afterFirst).toEqual({ turn: 1, claims: [claim('a', [e1])] })
    const unrelated = { type: 'turn/start', seq: 1, time: 2, data: { turn: 2 } } as never
    expect(applyReportEvent(afterFirst, unrelated)).toBe(afterFirst)
    const second = {
      type: 'report/submitted', seq: 2, time: 3,
      data: { kind: 'report/submitted', version: 1, turn: 2, claims: [claim('b', [e2])] },
    } as never
    expect(applyReportEvent(afterFirst, second)).toEqual({ turn: 2, claims: [claim('b', [e2])] })
  })
})

/** Register a minimal registry-compatible live agent over a store session. */
async function liveAgent(ctx: Context, session: Session): Promise<Agent> {
  const status: AgentStatus = 'idle'
  const agent: Agent = {
    id: session.id,
    options: {},
    session,
    model: unsupportedModel(),
    inbox: unsupportedInbox(),
    ctx,
    get status() { return status },
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => { throw new Error('research-claim-backing tests do not inject model context') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle() { return Promise.resolve() },
  }
  await ctx.agents.register(agent)
  return agent
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(EvidenceService)
  await ctx.plugin(plugin, { maxRevisions: 1 })
  return ctx
}

let callCounter = 0
function callReport(ctx: Context, args: unknown, agent: Agent) {
  return executeToolFixture(ctx, {
    signal: testToolSignal,
    callId: ToolCallId(`call-${++callCounter}`),
    name: 'report',
    arguments: args,
    agent,
  })
}

describe('report tool', () => {
  it('registers a `report` tool whose claims carry id/text/evidence_ids', async () => {
    const ctx = await setup()
    const schema = ctx.tools.schemas().find(s => s.name === 'report')
    expect(schema).toBeDefined()
    const props = (schema!.parameters as { properties?: Record<string, unknown> }).properties ?? {}
    expect(Object.keys(props)).toEqual(['claims'])
  })

  it('records a report/submitted event when every claim cites known evidence', async () => {
    const ctx = await setup()
    const agent = await liveAgent(ctx, ctx.sessions.create())
    const recorded = ctx.researchEvidence.record(agent.session, { url: 'https://example.com/a' })
    const result = await callReport(ctx, { claims: [{ id: 'a', text: 'backed', evidence_ids: [recorded.id] }] }, agent)
    expect(result.isError).toBe(false)
    const event = agent.session.snapshotEvents().findLast(e => e.type === 'report/submitted')
    expect(event?.data.claims[0]?.id).toBe('a')
  })

  it('rejects a submission whose claim cites unknown evidence and records nothing', async () => {
    const ctx = await setup()
    const agent = await liveAgent(ctx, ctx.sessions.create())
    const result = await callReport(ctx, { claims: [{ id: 'a', text: 'unbacked', evidence_ids: ['missing'] }] }, agent)
    expect(result.isError).toBe(true)
    expect(agent.session.snapshotEvents().some(e => e.type === 'report/submitted')).toBe(false)
  })
})
