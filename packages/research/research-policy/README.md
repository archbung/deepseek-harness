---
description: "The research action policy plugin for the DeepSeek Harness — a tools/pre-execute gate mapping configured per-tool rules to allow, approval, or deny, plus a monotonic tools guard for hard per-turn call caps that approval cannot override."
kind: "package-reference"
---

# @deepseek-ai/dsh-research-policy

English | [中文](README.zh.md)

## Summary

`dsh-research-policy` governs which tool calls a research agent may make. A `tools/pre-execute` gate maps each tool name to one of three effects — allow, require approval, or deny — with a secure deny default for any tool no rule names; `require-approval` becomes an `ask` the approval service resolves. A monotonic `tools.guard()` enforces hard per-turn call caps that no later listener or granted approval can override. Rules and caps are validated `Config` fields changeable from cordis.yml, not hardcoded tunables.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Load this plugin with the tool and agent registries; route `require-approval` outcomes through an approval service. It injects `tools` and `agents` and registers no service.

### Minimal composition

```yaml
- name: '@deepseek-ai/dsh-research-policy'
  config:
    rules:
      - { tool: web_search, effect: allow }
      - { tool: web_fetch, effect: allow }
      - { tool: report, effect: allow }
    caps:
      - { tool: web_search, maxPerTurn: 3 }
```

### Configuration

| Field | Default | Meaning |
|---|---|---|
| `rules` | `[]` | Per-tool permission rules in precedence order. A tool no rule names is denied by the secure default. Tool names must be unique. |
| `caps` | `[]` | Hard per-turn call caps enforced by the monotonic guard, independent of the permission rule and any granted approval. Tool names must be unique. |

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design philosophy

- **Two axes: soft permission and hard caps.** The reorderable `tools/pre-execute` waterfall decides what is permitted and returns a typed `PreToolDecision` (`allow`/`ask`/`deny`). The monotonic guard has no allow result, so once a cap is exceeded no later listener — including a granted approval — turns the denial back into permission.
- **Secure default.** A tool no rule names is denied, mirroring the mini-research policy engine's deny-unknown-action default.
- **No hardcoded tunables.** Rules and caps are validated configuration changeable from cordis.yml; the plugin rejects a rule or cap set that names one tool more than once.
- **Decoupled evaluation.** The decision rules are a pure `evaluatePolicy` function the gate consumes; the guard reads the current turn from the plugin's own injected `ctx.agents`, not through the calling agent's context.

### Source map

| File | Role |
|---|---|
| [`src/policy.ts`](src/policy.ts) | `evaluatePolicy`, the `PolicyRule`/`PolicyEffect`/`PolicyDecision` vocabulary |
| [`src/index.ts`](src/index.ts) | the `Config`, the `tools/pre-execute` gate, and the per-turn cap guard |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Tools subsystem reference](../../../docs/subsystems/tools.md) — the `tools/pre-execute` waterfall and the monotonic guard.
- [Approval subsystem reference](../../../docs/subsystems/approval.md) — how an `ask` decision is resolved.
- [Research subsystem](../../../docs/subsystems/research.md) — the governed-research model this policy serves.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the tool pipeline and the approval service that surface a denial or an approval prompt.

#### KV Cache effect

Independent: this plugin decides tool admission and contributes no prompt or schema, so it neither grows nor invalidates any reusable request prefix. A denial or approval result the pipeline records is owned by the tool pipeline, not this package.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Tool-name rules only.** A rule matches on the model-facing tool name; it does not inspect tool arguments. Argument-level constraints (a URL allowlist, for example) belong to a dedicated gate or the tool itself.
- **Per-turn caps only.** Caps reset at each turn boundary; this package offers no per-session or per-run budget.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
