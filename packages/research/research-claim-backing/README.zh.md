---
description: "DeepSeek Harness 的来源溯源强制插件——一个结构化论断必须引用已记录证据的 report 工具、确定性的引用完整性校验，以及在每条论断都有来源前保持研究轮次开启的 agent/turn-stopping 守卫。"
kind: "package-reference"
---

# @deepseek-ai/dsh-research-claim-backing

[English](README.md) | 中文

## 概述

`dsh-research-claim-backing` 强制每条研究论断都可追溯到已记录的来源。它注册一个面向模型的 `report` 工具，其每条论断都携带 `evidence_ids`；引用了空证据或未知 id 的论断在调用时被拒绝，不会提交任何无来源的报告。`agent/turn-stopping` 守卫是兜底：若关闭轮次的最新已提交报告仍有无来源论断，它会引导一次纠正步骤（最多 `maxRevisions` 次），随后让轮次关闭，以免卡住的模型被困住。溯源是针对 `ctx.researchEvidence.knownIds` 的确定性引用完整性检查；语义支持是另一项由评审器负责的、基于模型的工作。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未竟工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

与工具注册表、代理注册表、证据服务和投影注册表一起加载本插件。它注册 `report` 工具、`research/report` 投影与轮次停止守卫；它注入 `tools`、`agents`、`researchEvidence` 与 `sessionProjections`。

### 最小组合

```yaml
- name: '@deepseek-ai/dsh-session-projection'
- name: '@deepseek-ai/dsh-research-evidence'
- name: '@deepseek-ai/dsh-research-claim-backing'
  config:
    maxRevisions: 1
```

### 配置

| 字段 | 默认 | 含义 |
|---|---|---|
| `maxRevisions` | `1` | 在无来源论断仍存在时，轮次停止守卫在让轮次关闭前引导的纠正步骤次数。`0` 关闭兜底；工具仍会拒绝无来源的提交。 |

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

### 设计理念

- **一个不变式，两个强制点。** 工具在调用时拒绝无来源论断以给出即时、具体的反馈；轮次停止守卫作为兜底，在轮次边界重新检查已提交的报告。二者读取同一个确定性的 `findUnbackedClaims` 检查。
- **确定性引用完整性，而非语义评审。** 当论断引用了至少一个存在于 `ctx.researchEvidence.knownIds` 的 id 时即视为有来源。被引用的摘录是否真正支持论断，是本包不执行的、另一项基于模型的工作。
- **有界纠正。** 守卫每个会话最多引导 `maxRevisions` 次，随后让轮次关闭，使无法满足检查的模型不会陷入无尽的修订循环。
- **模型可见即已记录。** 已提交的报告是持久的 `report/submitted` 事件；`research/report` 投影折叠最新一条，守卫通过保留的句柄读取它。

### 源码索引

| 文件 | 职责 |
|---|---|
| [`src/claims.ts`](src/claims.ts) | `findUnbackedClaims`、`describeUnbackedClaims` 与 `ReportClaim` 词汇 |
| [`src/types.ts`](src/types.ts) | `report/submitted` 事件、`research/report` 投影键及其折叠 |
| [`src/index.ts`](src/index.ts) | `report` 工具、投影注册与轮次停止守卫 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [研究子系统](../../../docs/subsystems/research.zh.md)——证据记录与论断溯源强制模型。
- [研究证据参考](../research-evidence/README.zh.md)——本守卫据以检查的 `knownIds` 来源。
- [核心代理参考](../../core/agent/README.zh.md)——`agent/turn-stopping` 串行接缝与 `agent.steer`。

-----

<a id="model-experience"></a>
## 模型体验

### `report` 工具

#### 模型所见

一个名为 `report` 的工具，接受 `claims` 数组，每条论断是包含 `id`、`text` 与 `evidence_ids` 的对象。任一论断引用空证据或未知 id 的提交返回命名了违规论断及缺失或未知 id 的错误；完全有来源的提交返回被接受的论断数。

#### 词元影响

每次 `report` 调用一条小结果。一次轮次停止修订会增加一条命名无来源论断的被引导用户消息，最多 `maxRevisions` 次。

#### KV 缓存影响

仅追加：工具结果与任何被引导的修订都跟随可复用的请求前缀，不使已有的 KV 缓存条目失效。

## 已知限制与未竟工作

<a id="known-limitations-and-deferred-work"></a>

- **无语义支持检查。** 溯源仅校验引用完整性；论断可能引用了一个并不真正支持它的已记录来源。基于模型的评审器是另一项工作。
- **仅保留最新报告。** `research/report` 投影仅保留最近一次提交；一个提交多份报告的轮次会以最后一份为准进行检查。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
