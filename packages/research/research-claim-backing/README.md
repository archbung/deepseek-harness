---
description: "The source-backing enforcement plugin for the DeepSeek Harness — a report tool whose structured claims must cite recorded evidence, deterministic citation-integrity validation, and an agent/turn-stopping guard that keeps a research turn open until every claim is backed."
kind: "package-reference"
---

# @deepseek-ai/dsh-research-claim-backing

English | [中文](README.zh.md)

## Summary

`dsh-research-claim-backing` enforces that every research claim traces to a recorded source. It registers a model-facing `report` tool whose claims each carry `evidence_ids`; a claim citing no evidence or an unknown id is rejected at call time, and no unbacked report is committed. An `agent/turn-stopping` guard is the backstop: if the latest submitted report for the closing turn still has unbacked claims, it steers one corrective step (up to `maxRevisions`), then lets the turn close so a stuck model is not trapped. Backing is the deterministic citation-integrity check against `ctx.researchEvidence.knownIds`; semantic support is a separate, model-backed concern left to a reviewer.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Load this plugin with the tool registry, the agent registry, the evidence service, and the projection registry. It registers the `report` tool, the `research/report` projection, and the turn-stopping guard; it injects `tools`, `agents`, `researchEvidence`, and `sessionProjections`.

### Minimal composition

```yaml
- name: '@deepseek-ai/dsh-session-projection'
- name: '@deepseek-ai/dsh-research-evidence'
- name: '@deepseek-ai/dsh-research-claim-backing'
  config:
    maxRevisions: 1
```

### Configuration

| Field | Default | Meaning |
|---|---|---|
| `maxRevisions` | `1` | Corrective steps the turn-stopping guard steers while unbacked claims remain before letting the turn close. `0` disables the backstop; the tool still rejects unbacked submissions. |

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design philosophy

- **One invariant, two enforcement points.** The tool rejects unbacked claims at call time for immediate, specific feedback; the turn-stopping guard is the backstop that re-checks the committed report at the turn boundary. Both read the same deterministic `findUnbackedClaims` check.
- **Deterministic citation integrity, not semantic review.** A claim is backed when it cites at least one id present in `ctx.researchEvidence.knownIds`. Whether the cited excerpt actually supports the claim is a separate model-backed concern this package does not perform.
- **Bounded correction.** The guard steers at most `maxRevisions` times per session, then lets the turn close, so a model that cannot satisfy the check is not trapped in an endless revision loop.
- **Model-visible means logged.** A submitted report is a durable `report/submitted` event; the `research/report` projection folds the latest, which the guard reads through a retained handle.

### Source map

| File | Role |
|---|---|
| [`src/claims.ts`](src/claims.ts) | `findUnbackedClaims`, `describeUnbackedClaims`, and the `ReportClaim` vocabulary |
| [`src/types.ts`](src/types.ts) | the `report/submitted` event, the `research/report` projection key, and its fold |
| [`src/index.ts`](src/index.ts) | the `report` tool, the projection registration, and the turn-stopping guard |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Research subsystem](../../../docs/subsystems/research.md) — evidence records and the claim-backing enforcement model.
- [Research evidence reference](../research-evidence/README.md) — the `knownIds` source this guard checks against.
- [Core agent reference](../../core/agent/README.md) — the `agent/turn-stopping` serial seam and `agent.steer`.

-----

<a id="model-experience"></a>
## Model Experience

### The `report` tool

#### What the model sees

A tool named `report` taking a `claims` array, each claim an object of `id`, `text`, and `evidence_ids`. A submission whose any claim cites no evidence or an unknown id returns an error naming the offending claims and the missing or unknown ids; a fully backed submission returns the accepted claim count.

#### Token effect

One small result per `report` call. A turn-stopping revision adds one steered user message naming the unbacked claims, up to `maxRevisions` times.

#### KV Cache effect

Append-only: the tool result and any steered revision follow the reusable request prefix and do not invalidate existing KV Cache entries.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No semantic support check.** Backing verifies citation integrity only; a claim can cite a recorded source that does not actually support it. A model-backed reviewer is a separate concern.
- **Single latest report.** The `research/report` projection keeps only the most recent submission; a turn that submits several reports is checked against the last one.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
