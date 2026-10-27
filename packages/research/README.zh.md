---
description: "研究分组导览：面向受治理研究工作流的来源可追溯证据、论断溯源与策略，供浏览该分组的用户与维护者使用。"
kind: "package-group"
---

# packages/research

[English](README.md) | 中文

## 概述

研究分组支持受治理的研究工作流，其中每条事实性论断都有已记录的来源作为支撑。证据被捕获为持久的会话事件，因此能在重载、派生与恢复后留存；下游策略包利用这些证据拒绝引用了会话从未记录的来源的报告论断。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`research-evidence`](research-evidence/README.zh.md) | 作为持久会话事件的来源可追溯证据、其投影，以及已知 id 读取器 | `ctx.researchEvidence` |

-----

<a id="related-documentation"></a>
## 相关文档

- [研究子系统](../../docs/subsystems/research.zh.md)——证据记录、持久的 `evidence/recorded` 事件，以及生成的服务 API。
- [会话投影参考](../session/session-projection/README.zh.md)——证据存储所基于的投影接缝。
- [网页能力参考](../web/web/README.zh.md)——证据记录所包装的 `WebSearchSource` 引用形状。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
