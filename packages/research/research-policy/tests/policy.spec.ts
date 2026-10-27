/**
 * The research-policy package: the pure permission evaluator (`evaluatePolicy`)
 * with its secure deny default, and the REAL plugin wiring — the
 * `tools/pre-execute` gate mapping rules to allow/ask/deny and the monotonic
 * per-turn cap guard — driven through `ctx.tools.execute` with a real
 * registered agent so scope-filtered dispatch reaches the gate and guard.
 */

import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { unsupportedModel, unsupportedInbox } from '@deepseek-ai/dsh-agent-loop-testkit'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import type { Session } from '@deepseek-ai/dsh-session'
import { evaluatePolicy } from '@deepseek-ai/dsh-research-policy'
import * as plugin from '../src/index.ts'

const testToolSignal = new AbortController().signal

describe('evaluatePolicy', () => {
  const rules = [
    { tool: 'web_search', effect: 'allow' as const },
    { tool: 'report', effect: 'require-approval' as const },
    { tool: 'danger', effect: 'deny' as const },
  ]

  it('returns the matched rule effect', () => {
    expect(evaluatePolicy('web_search', rules).effect).toBe('allow')
    expect(evaluatePolicy('report', rules).effect).toBe('require-approval')
    expect(evaluatePolicy('danger', rules).effect).toBe('deny')
  })

  it('denies any tool no rule names (secure default)', () => {
    const decision = evaluatePolicy('unlisted', rules)
    expect(decision.effect).toBe('deny')
    expect(decision.reason).toContain('default denies')
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
    inject: () => { throw new Error('research-policy tests do not inject model context') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle() { return Promise.resolve() },
  }
  await ctx.agents.register(agent)
  return agent
}

async function setup(config: plugin.Config): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  // A trivial always-allowed probe tool the policy gates and caps, registered
  // inside a plugin so ctx.tools is resolved before use.
  await ctx.plugin({
    name: 'probe-tool',
    inject: ['tools'],
    apply(probeCtx: Context) {
      probeCtx.tools.register(defineTool({
        name: 'probe',
        description: 'A no-op probe tool for policy tests.',
        parameters: {},
        output: { schema: { type: 'object', additionalProperties: false, properties: {} }, render: () => [{ type: 'text', text: 'ok' }] },
        execute: () => Promise.resolve({}),
      }))
    },
  })
  await ctx.plugin(plugin, config)
  return ctx
}

let callCounter = 0
function callProbe(ctx: Context, agent: Agent) {
  return executeToolFixture(ctx, {
    signal: testToolSignal,
    callId: ToolCallId(`call-${++callCounter}`),
    name: 'probe',
    arguments: {},
    agent,
  })
}

describe('research-policy gate', () => {
  it('allows a tool named with an allow rule', async () => {
    const ctx = await setup({ rules: [{ tool: 'probe', effect: 'allow' }] })
    const agent = await liveAgent(ctx, ctx.sessions.create())
    expect((await callProbe(ctx, agent)).isError).toBe(false)
  })

  it('denies a tool no rule names', async () => {
    const ctx = await setup({ rules: [] })
    const agent = await liveAgent(ctx, ctx.sessions.create())
    expect((await callProbe(ctx, agent)).isError).toBe(true)
  })

  it('rejects a config naming a tool in two rules', async () => {
    const result = await setup({ rules: [{ tool: 'probe', effect: 'allow' }, { tool: 'probe', effect: 'deny' }] })
      .then(() => 'resolved', (error: unknown) => (error as Error).message)
    expect(result).toMatch(/at most once/)
  })
})

describe('research-policy per-turn cap guard', () => {
  it('denies calls beyond the configured per-turn cap', async () => {
    const ctx = await setup({ rules: [{ tool: 'probe', effect: 'allow' }], caps: [{ tool: 'probe', maxPerTurn: 2 }] })
    const agent = await liveAgent(ctx, ctx.sessions.create())
    agent.session.append('turn/start', { turn: 1 })
    expect((await callProbe(ctx, agent)).isError).toBe(false)
    expect((await callProbe(ctx, agent)).isError).toBe(false)
    expect((await callProbe(ctx, agent)).isError).toBe(true)
  })
})
