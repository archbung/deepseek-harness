/**
 * The research-evidence package: the `evidence/recorded` append fold, the
 * `research/evidence` projection served on the history tail, and the
 * `ctx.researchEvidence` service that records web citations and reports the
 * evidence ids a session knows. Also checks a composition without the service
 * exposes no `research/evidence` key, and that unmounting drops it (HMR safety).
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import type { WebSearchSource } from '@deepseek-ai/dsh-web'
import { EvidenceService, applyEvidenceEvent, evidenceProjectionDefinition } from '@deepseek-ai/dsh-research-evidence'
import type { EvidenceProjection } from '@deepseek-ai/dsh-research-evidence'

interface Bench {
  ctx: Context
  session: Session
  tailValue(): EvidenceProjection | undefined
}

async function harness(withService: boolean): Promise<Bench> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  if (withService) await ctx.plugin(EvidenceService)
  const session = ctx.sessions.create()
  return {
    ctx,
    session,
    tailValue: () => ctx.sessionProjections.snapshot(session).values['research/evidence'],
  }
}

const source: WebSearchSource = { url: 'https://example.com/a', title: 'A' }
const urlOnly: WebSearchSource = { url: 'https://example.com/b' }

describe('research-evidence fold', () => {
  it('appends a record per evidence/recorded event and keeps commit order', () => {
    const empty = evidenceProjectionDefinition.init()
    expect(empty).toEqual({ records: [] })

    const first = {
      type: 'evidence/recorded', seq: 0, time: 1,
      data: { kind: 'evidence/recorded', version: 1, record: { id: 'e1', source, capturedAt: 1 } },
    } as never
    const afterFirst = applyEvidenceEvent(empty, first)
    expect(afterFirst.records.map(r => r.id)).toEqual(['e1'])

    const second = {
      type: 'evidence/recorded', seq: 1, time: 2,
      data: { kind: 'evidence/recorded', version: 1, record: { id: 'e2', source: urlOnly, capturedAt: 2 } },
    } as never
    expect(applyEvidenceEvent(afterFirst, second).records.map(r => r.id)).toEqual(['e1', 'e2'])
  })

  it('returns the same state reference for unrelated events', () => {
    const state: EvidenceProjection = { records: [{ id: 'e1', source, capturedAt: 1 } as never] }
    const turnStart = { type: 'turn/start', seq: 2, time: 3, data: { turn: 1 } } as never
    expect(applyEvidenceEvent(state, turnStart)).toBe(state)
  })

  it('accepts the init and recorded states through the state schema', () => {
    const empty = evidenceProjectionDefinition.init()
    expect(evidenceProjectionDefinition.stateSchema.parse(empty)).toEqual(empty)
    const recorded = { records: [{ id: 'e1', source: urlOnly, capturedAt: 1 }] }
    expect(evidenceProjectionDefinition.stateSchema.safeParse(recorded).success).toBe(true)
    expect(evidenceProjectionDefinition.stateSchema.safeParse({ records: [{ source: urlOnly }] }).success).toBe(false)
  })
})

describe('ctx.researchEvidence service', () => {
  it('records a citation and serves it on the projection tail', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    try {
      const bench = await harness(true)
      const record = bench.ctx.researchEvidence.record(bench.session, source)
      expect(record.source).toEqual(source)
      expect(record.capturedAt).toBe(1_700_000_000_000)
      expect(record.id).toMatch(/^evidence-/)
      expect(bench.ctx.researchEvidence.records(bench.session).map(r => r.id)).toEqual([record.id])
      expect(bench.tailValue()?.records.map(r => r.id)).toEqual([record.id])
    } finally {
      vi.useRealTimers()
    }
  })

  it('exposes recorded ids through knownIds and omits unrecorded ones', async () => {
    const bench = await harness(true)
    const a = bench.ctx.researchEvidence.record(bench.session, source)
    const b = bench.ctx.researchEvidence.record(bench.session, urlOnly)
    const known = bench.ctx.researchEvidence.knownIds(bench.session)
    expect(known.has(a.id)).toBe(true)
    expect(known.has(b.id)).toBe(true)
    expect(known.size).toBe(2)
  })

  it('has no research/evidence key without the service and drops it on unload (HMR safety)', async () => {
    const bench = await harness(false)
    expect('research/evidence' in bench.ctx.sessionProjections.snapshot(bench.session).values).toBe(false)
    const fiber = await bench.ctx.plugin(EvidenceService)
    expect(bench.tailValue()).toEqual({ records: [] })
    await fiber.dispose()
    expect('research/evidence' in bench.ctx.sessionProjections.snapshot(bench.session).values).toBe(false)
  })
})
