# 研究

[English](research.md) | 中文

[研究包族](../../packages/research/README.zh.md)支持受治理的研究工作流，其中每条事实性论断都有已记录的来源作为支撑。证据被捕获为持久的会话事件，因此能在重载、派生与恢复后留存；下游策略消费方利用这些证据拒绝引用了会话从未记录的来源的报告论断。本子系统自身不拥有面向模型的工具；消费方包暴露捕获与渲染。

## 归属

| 归属 | 职责 |
|---|---|
| [research-evidence](../../packages/research/research-evidence/README.zh.md) | `ctx.researchEvidence`：作为持久 `evidence/recorded` 事件的来源可追溯证据、其投影，以及已知 id 读取器 |

## 证据记录

证据记录是研究运行期间捕获的一条有来源的摘录。每条记录包装来自 `ctx.web` 的可移植 [`WebSearchSource`](../../packages/web/web/src/types.ts) 引用，因此 `url` 是唯一保证存在的字段，仅含 URL 的引用也是有效记录。`EvidenceId` 在会话内标识记录身份；报告论断通过该 id 引用证据。

记录会追加携带完整记录的 `evidence/recorded` 会话事件。`research/evidence` 投影按提交顺序将这些事件折叠为会话记录；任何事件都不会删除记录，因此该存储是仅追加的，且每个值都可从日志重建。`ctx.researchEvidence.knownIds(session)` 返回已记录的 id，供论断溯源策略据以拒绝引用了会话从未捕获的证据的论断。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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

Types: [Session](session.zh.md) · [WebSearchSource](web.zh.md)

Source: [`packages/research/research-evidence/src/index.ts`](../../packages/research/research-evidence/src/index.ts)
<!-- END GENERATED cordis-surface -->
