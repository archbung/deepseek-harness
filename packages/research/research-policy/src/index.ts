/**
 * Research action policy plugin: a `tools/pre-execute` gate that maps each tool
 * call to allow, approval, or deny by operator-configured rules, plus a
 * monotonic `tools.guard()` enforcing hard per-turn call caps that approval
 * cannot override.
 *
 * Two enforcement axes, by design:
 *
 * - The reorderable `tools/pre-execute` waterfall returns a typed
 *   {@link PreToolDecision}; `require-approval` becomes an `ask` the approval
 *   service resolves, so a reorderable policy layer decides what is permitted.
 * - The guard is monotonic: once a tool's configured per-turn cap is exceeded,
 *   it denies with no allow result, so no later listener — including a granted
 *   approval — can turn the denial back into permission. Hard caps (a bounded
 *   search budget) live here; soft permission lives on the gate.
 *
 * Rules and caps are validated `Config` fields changeable from cordis.yml, not
 * hardcoded tunables.
 *
 * @module @deepseek-ai/dsh-research-policy
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import { evaluatePolicy } from './policy.ts'
import type { PolicyRule } from './policy.ts'

export type * from './policy.ts'
export { evaluatePolicy } from './policy.ts'

/** One operator-configured per-turn cap for a tool's call count. */
export interface ToolCallCap {
  /** The model-facing tool name the cap limits. */
  tool: string
  /** Maximum calls to that tool per turn; a positive integer. */
  maxPerTurn: number
}

/** Deployment research policy. */
export interface Config {
  /**
   * Per-tool permission rules in precedence order. Any tool no rule names is
   * denied by the secure default. Tool names must be unique.
   */
  rules?: PolicyRule[]
  /**
   * Hard per-turn call caps enforced by the monotonic guard. A capped tool's
   * calls beyond `maxPerTurn` within one turn are denied regardless of the
   * permission rule or any granted approval. Tool names must be unique.
   */
  caps?: ToolCallCap[]
}

/** Schemastery configuration for the research policy plugin. */
export const Config: z<Config> = z.object({
  rules: z.array(z.object({
    tool: z.string().required(),
    effect: z.union(['allow', 'require-approval', 'deny']).required(),
  })).default([]),
  caps: z.array(z.object({
    tool: z.string().required(),
    maxPerTurn: z.natural().min(1).required(),
  })).default([]),
})

/** Reject a rule or cap set that names one tool more than once. */
function assertUniqueTools(label: string, tools: readonly string[]): void {
  if (new Set(tools).size !== tools.length) {
    throw new Error(`research-policy ${label} must name each tool at most once`)
  }
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'research-policy'

/** The tool registry this plugin gates and guards, and the agent registry it reads turn boundaries from. */
export const inject = ['tools', 'agents']

/**
 * Register the research-policy `tools/pre-execute` gate and the per-turn cap
 * guard.
 * @param ctx - registrant context carrying the tool registry.
 * @param config - deployment permission rules and hard caps.
 */
export function apply(ctx: Context, config: Config): void {
  const rules = config.rules ?? []
  const caps = config.caps ?? []
  assertUniqueTools('rules', rules.map(rule => rule.tool))
  assertUniqueTools('caps', caps.map(cap => cap.tool))
  const capByTool = new Map(caps.map(cap => [cap.tool, cap.maxPerTurn]))

  // Per-turn call counts keyed by the opaque root call's agent session turn.
  // A WeakMap over the agent keeps counts process-local; a new turn resets by
  // keying counts on `(agent, turn)`.
  let countsByAgent = new WeakMap<object, Map<string, { turn: number; count: number }>>()

  ctx.effect(() => () => {
    // Drop per-turn counters on disposal (HMR safety); replacing the map makes
    // the release observable and immediate for tests.
    countsByAgent = new WeakMap<object, Map<string, { turn: number; count: number }>>()
  }, 'research-policy cap-counter teardown')

  ctx.on('tools/pre-execute', (exec, next): Promise<PreToolDecision> => {
    const decision = evaluatePolicy(exec.name, rules)
    switch (decision.effect) {
      case 'allow':
        return next()
      case 'deny':
        return Promise.resolve<PreToolDecision>({ kind: 'deny', reason: decision.reason })
      case 'require-approval':
        return Promise.resolve<PreToolDecision>({
          kind: 'ask',
          reason: decision.reason,
          displayReason: { en: decision.reason },
        })
    }
  })

  ctx.tools.guard((exec: Readonly<ToolExecution>): string | undefined => {
    const cap = capByTool.get(exec.name)
    if (cap === undefined) return undefined
    const agent = exec.agent
    if (agent === undefined) return undefined
    const turn = ctx.agents.turnBoundaryOf(agent.session).lastTurn
    let byTool = countsByAgent.get(agent)
    if (byTool === undefined) {
      byTool = new Map()
      countsByAgent.set(agent, byTool)
    }
    const entry = byTool.get(exec.name)
    const count = entry !== undefined && entry.turn === turn ? entry.count + 1 : 1
    byTool.set(exec.name, { turn, count })
    if (count > cap) {
      return `tool "${exec.name}" exceeded its research policy cap of ${cap} call(s) in turn ${turn}`
    }
    return undefined
  })
}
