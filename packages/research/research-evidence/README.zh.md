---
description: "DeepSeek Harness 的来源可追溯研究证据插件——持久的 evidence/recorded 会话事件、其投影，以及记录网页引用并回答会话已知哪些证据 id 的 ctx.researchEvidence 服务。"
kind: "package-reference"
---

# @deepseek-ai/dsh-research-evidence

[English](README.md) | 中文

## 概述

`dsh-research-evidence` 将有来源的证据记录为持久的会话事件，并通过会话投影读回。每条记录包装一个 `ctx.web` 引用（`WebSearchSource`），因此 `url` 是唯一保证存在的字段，仅含 URL 的引用也是有效记录。该服务公开会话已记录的证据 id 集合，供研究论断溯源策略据以拒绝引用了会话从未捕获的证据的报告论断。该存储是仅追加的：一个 `evidence/recorded` 事件提交一条完整记录，任何事件都不会删除记录。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未竟工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

与会话投影注册表一起加载本插件；当证据来自网页结果时，再加载一个 `ctx.web` 提供方。它注册 `ctx.researchEvidence` 服务与 `research/evidence` 投影；它注入 `sessionProjections` 且无需配置。

### 最小组合

```yaml
- name: '@deepseek-ai/dsh-session-projection'
- name: '@deepseek-ai/dsh-research-evidence'
```

### 服务 API（`ctx.researchEvidence`）

| 方法 | 返回 | 含义 |
|---|---|---|
| `record(session, source)` | `EvidenceRecord` | 将一个 `WebSearchSource` 作为持久的 `evidence/recorded` 事件追加，并返回带新生成 `EvidenceId` 的已提交记录。 |
| `records(session)` | `readonly EvidenceRecord[]` | 按提交顺序排列的所有证据记录；捕获之前为空。 |
| `knownIds(session)` | `ReadonlySet<EvidenceId>` | 会话已记录的证据 id，供论断溯源检查使用。 |

### 会话事件与投影

- `evidence/recorded`（`SessionEventMap`）携带完整的 `EvidenceRecord`；折叠按提交顺序追加它。
- `research/evidence`（`SessionProjectionMap`）是这些记录的仅追加列表，同时服务于宿主读取与客户端证据视图。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

### 设计理念

- **模型可见即已记录。** 证据是持久的 `evidence/recorded` 会话事件，因此每条记录在重载、派生与恢复后都可从日志重建——这正是 AGENTS.md 规则要求证据成为事件而非进程状态的原因。
- **复用引用形状。** 记录包装 `ctx.web` 的 `WebSearchSource`，而非自造一个平行类型，遵守网页接缝关于可选性的约定（`title`、`snippet`、`summary`、`publishedAt` 可缺省；`url` 始终存在）。
- **仅追加折叠。** `applyEvidenceEvent` 追加每个本域事件的记录，并对每个无关事件返回相同的状态引用，符合投影契约。没有删除，因此整值事件规则天然成立。
- **通过保留的句柄读取。** 服务在 `[Service.init]` 中等待投影注册，并通过保留的 `ProjectionHandle` 读取；该句柄在注销后仍持续折叠，符合会话投影生命周期规则。

### 源码索引

| 文件 | 职责 |
|---|---|
| [`src/types.ts`](src/types.ts) | `EvidenceId`、`EvidenceRecord`、`EvidenceProjection` 以及 `research/evidence` 投影键声明 |
| [`src/domain.ts`](src/domain.ts) | `evidence/recorded` 会话事件与 `applyEvidenceEvent` 折叠 |
| [`src/index.ts`](src/index.ts) | `evidenceProjectionDefinition`、`EvidenceService` 与插件入口 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [会话投影参考](../../session/session-projection/README.zh.md)——本服务依赖的注册、读取与检查点契约。
- [网页能力参考](../../web/web/README.zh.md)——每条记录所包装的 `WebSearchSource` 引用形状。
- [dsh-session-projection 技能](../../../.agents/skills/dsh-session-projection/SKILL.md)——此处遵循的投影编写规则。

-----

<a id="model-experience"></a>
## 模型体验

间接地，通过研究论断溯源策略与客户端证据视图，二者承担所有面向模型的贡献。

#### KV 缓存影响

独立：本包追加持久会话事件并服务于投影读取。它不发起模型请求，也不贡献请求词元，因此既不增长也不使任何可复用的请求前缀失效。

## 已知限制与未竟工作

<a id="known-limitations-and-deferred-work"></a>

- **无去重。** 两次记录同一个 `WebSearchSource` 会提交两条拥有不同 id 的记录；希望每个 URL 只有一条记录的调用方应在 `record` 之前自行去重。
- **无面向模型的工具。** 本包仅提供服务、事件与投影；消费方包必须向模型暴露捕获能力并渲染证据视图。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
