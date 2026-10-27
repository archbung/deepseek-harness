# Research

English | [中文](research.zh.md)

The [research package family](../../packages/research/README.md) supports governed research workflows in which every factual claim is backed by a recorded source. Evidence is captured as durable session events so it survives reload, fork, and resume; downstream policy consumers use that evidence to reject report claims citing sources the session never recorded. This subsystem owns no model-facing tool of its own; consumer packages expose capture and rendering.

## Ownership

| Owner | Responsibility |
|---|---|
| [research-evidence](../../packages/research/research-evidence/README.md) | `ctx.researchEvidence`: source-linked evidence as durable `evidence/recorded` events, its projection, and the known-id reader |

## Evidence records

An evidence record is one source-linked excerpt captured during a research run. Each record wraps the portable [`WebSearchSource`](../../packages/web/web/src/types.ts) citation from `ctx.web`, so `url` is the only guaranteed field and a URL-only citation is a valid record. `EvidenceId` brands the record identity within a session; a report claim cites evidence by that id.

Recording appends an `evidence/recorded` session event carrying the complete record. The `research/evidence` projection folds those events into the session's records in commit order; no event removes a record, so the store is append-only and every value is reconstructable from the log. `ctx.researchEvidence.knownIds(session)` returns the recorded ids, which a claim-backing policy consumes to reject claims citing evidence the session never captured.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxresearchevidence--evidenceservice"></a>

### `ctx.researchEvidence` — `EvidenceService`

Evidence service (`ctx.researchEvidence`): records source-linked citations as durable session events and reads them back through the retained projection handle. The handle keeps folding after unregistration, so reads survive disposal of the global drive.

```ts cordis-catalog
/**
 * Record one source-linked citation as a durable `evidence/recorded` event.
 * @param session - the session whose log receives the record.
 * @param source - the `ctx.web` citation to wrap; `source.url` must be present.
 * @returns the committed record, including its freshly minted id.
 */
record(session: Session, source: WebSearchSource): EvidenceRecord

/**
 * Every evidence record recorded in the session, in commit order.
 * @param session - the session whose evidence is read.
 * @returns the current records; empty before any capture.
 */
records(session: Session): readonly EvidenceRecord[]

/**
 * The set of evidence ids the session has recorded. The claim-backing policy
 * uses it to reject claims citing unknown evidence.
 * @param session - the session whose evidence is read.
 * @returns a fresh set of known evidence ids.
 */
knownIds(session: Session): ReadonlySet<EvidenceId>
```

Types: [Session](session.md) · [WebSearchSource](web.md)

Source: [`packages/research/research-evidence/src/index.ts`](../../packages/research/research-evidence/src/index.ts)
<!-- END GENERATED cordis-surface -->
