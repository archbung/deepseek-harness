---
description: "The source-linked research-evidence plugin for the DeepSeek Harness — a durable evidence/recorded session event, its projection, and the ctx.researchEvidence service that records web citations and answers which evidence ids a session knows."
kind: "package-reference"
---

# @deepseek-ai/dsh-research-evidence

English | [中文](README.zh.md)

## Summary

`dsh-research-evidence` records source-linked evidence as durable session events and reads it back through a session projection. Each record wraps a `ctx.web` citation (`WebSearchSource`), so `url` is the only guaranteed field and a URL-only citation is a valid record. The service exposes the set of evidence ids a session has recorded, which the research claim-backing policy uses to reject report claims that cite evidence the session never captured. The store is append-only: one `evidence/recorded` event commits one complete record, and no event removes one.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Load this plugin alongside the session-projection registry and, where evidence comes from web results, a `ctx.web` provider. It registers the `ctx.researchEvidence` service and the `research/evidence` projection; it injects `sessionProjections` and needs no configuration.

### Minimal composition

```yaml
- name: '@deepseek-ai/dsh-session-projection'
- name: '@deepseek-ai/dsh-research-evidence'
```

### Service API (`ctx.researchEvidence`)

| Method | Returns | Meaning |
|---|---|---|
| `record(session, source)` | `EvidenceRecord` | Append one `WebSearchSource` as a durable `evidence/recorded` event and return the committed record with its freshly minted `EvidenceId`. |
| `records(session)` | `readonly EvidenceRecord[]` | Every evidence record in commit order; empty before any capture. |
| `knownIds(session)` | `ReadonlySet<EvidenceId>` | The evidence ids the session has recorded, for claim-backing checks. |

### Session event and projection

- `evidence/recorded` (`SessionEventMap`) carries the complete `EvidenceRecord`; the fold appends it in commit order.
- `research/evidence` (`SessionProjectionMap`) is the append-only list of those records, serving both host reads and the client Evidence view.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design philosophy

- **Model-visible means logged.** Evidence is a durable `evidence/recorded` session event, so every record is reconstructable from the log across reload, fork, and resume — the AGENTS.md rule that forces evidence to be an event rather than process state.
- **Reuse the citation shape.** A record wraps `WebSearchSource` from `ctx.web` rather than inventing a parallel type, honoring the web seam's documented optionality (`title`, `snippet`, `summary`, `publishedAt` may be absent; `url` is always present).
- **Append-only fold.** `applyEvidenceEvent` appends the record of each owned event and returns the same state reference for every unrelated event, as the projection contract requires. There is no removal, so the whole-value event rule holds trivially.
- **Read through a retained handle.** The service awaits projection registration in `[Service.init]` and reads via the retained `ProjectionHandle`, which keeps folding after unregistration, per the session-projection lifecycle rules.

### Source map

| File | Role |
|---|---|
| [`src/types.ts`](src/types.ts) | `EvidenceId`, `EvidenceRecord`, `EvidenceProjection`, and the `research/evidence` projection-key declaration |
| [`src/domain.ts`](src/domain.ts) | The `evidence/recorded` session event and the `applyEvidenceEvent` fold |
| [`src/index.ts`](src/index.ts) | `evidenceProjectionDefinition`, the `EvidenceService`, and the plugin entry |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Session projection reference](../../session/session-projection/README.md) — the registration, read, and checkpoint contracts this service depends on.
- [Web capability reference](../../web/web/README.md) — the `WebSearchSource` citation shape each record wraps.
- [dsh-session-projection skill](../../../.agents/skills/dsh-session-projection/SKILL.md) — the projection authoring rules followed here.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the research claim-backing policy and the client Evidence view that own all model-facing contribution.

#### KV Cache effect

Independent: this package appends durable session events and serves projection reads. It issues no model request and contributes no request tokens, so it neither grows nor invalidates any reusable request prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No deduplication.** Recording the same `WebSearchSource` twice commits two records with distinct ids; callers that want one record per URL deduplicate before `record`.
- **No model-facing tool.** This package provides only the service, event, and projection; a consumer package must expose capture to the model and render the Evidence view.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
