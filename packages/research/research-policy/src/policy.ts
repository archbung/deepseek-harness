/**
 * Pure research-action policy evaluation, free of host-side imports so the
 * decision rules stay unit-testable. A policy maps a tool name to one of three
 * effects — allow, require approval, or deny — with a secure deny default for
 * any tool no rule names. Per-turn call caps are a separate hard limit the
 * monotonic guard enforces; approval cannot override a cap.
 *
 * This mirrors the mini-research PolicyEngine's allow/require_approval/deny
 * model, expressed as a plain evaluator the Cordis `tools/pre-execute` gate and
 * `tools.guard()` consume, rather than a central engine object.
 *
 * @module @deepseek-ai/dsh-research-policy/policy
 */

/** What the policy does with a named tool call. */
export type PolicyEffect = 'allow' | 'require-approval' | 'deny'

/** One operator-defined rule naming a tool and its effect. */
export interface PolicyRule {
  /** The model-facing tool name this rule governs. */
  readonly tool: string
  /** The effect applied when the tool is called. */
  readonly effect: PolicyEffect
}

/** A resolved decision for one tool call, with the rule that produced it. */
export interface PolicyDecision {
  /** The effect to apply. */
  readonly effect: PolicyEffect
  /** Human- and model-readable justification. */
  readonly reason: string
}

/**
 * Resolve the effect for one tool name against the rules. The first rule naming
 * the tool wins; with no matching rule, the secure default denies. The rule set
 * is validated at config load, so duplicate tool names cannot reach here.
 * @param tool - the model-facing tool name being called.
 * @param rules - the operator-defined rules in precedence order.
 * @returns the decision, including the matched rule or the deny default.
 */
export function evaluatePolicy(tool: string, rules: readonly PolicyRule[]): PolicyDecision {
  const rule = rules.find(candidate => candidate.tool === tool)
  if (rule === undefined) {
    return { effect: 'deny', reason: `no research policy rule allows tool "${tool}"; the default denies unnamed tools` }
  }
  switch (rule.effect) {
    case 'allow':
      return { effect: 'allow', reason: `tool "${tool}" is allowed by research policy` }
    case 'require-approval':
      return { effect: 'require-approval', reason: `tool "${tool}" requires approval by research policy` }
    case 'deny':
      return { effect: 'deny', reason: `tool "${tool}" is denied by research policy` }
  }
}
