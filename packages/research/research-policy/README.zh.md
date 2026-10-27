---
description: "DeepSeek Harness 的研究行为策略插件——一个将配置的按工具规则映射为允许、审批或拒绝的 tools/pre-execute 门控，外加用于强制审批无法覆盖的每轮调用硬上限的单调 tools 守卫。"
kind: "package-reference"
---

# @deepseek-ai/dsh-research-policy

[English](README.md) | 中文

## 概述

`dsh-research-policy` 管控研究代理可以发起哪些工具调用。一个 `tools/pre-execute` 门控将每个工具名映射为三种效果之一——允许、要求审批或拒绝——并对任何无规则命名的工具采用安全的拒绝默认；`require-approval` 会成为由审批服务解析的 `ask`。一个单调的 `tools.guard()` 强制每轮调用硬上限，任何后续监听器或已授予的审批都无法覆盖它。规则与上限是可从 cordis.yml 修改的、经校验的 `Config` 字段，而非硬编码可调项。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未竟工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

与工具注册表和代理注册表一起加载本插件；将 `require-approval` 结果路由到审批服务。它注入 `tools` 与 `agents` 且不注册服务。

### 最小组合

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

### 配置

| 字段 | 默认 | 含义 |
|---|---|---|
| `rules` | `[]` | 按优先级排列的按工具权限规则。无规则命名的工具由安全默认拒绝。工具名必须唯一。 |
| `caps` | `[]` | 由单调守卫强制的每轮调用硬上限，独立于权限规则与任何已授予的审批。工具名必须唯一。 |

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

### 设计理念

- **两条轴：软权限与硬上限。** 可重排的 `tools/pre-execute` 瀑布决定何者被许可，并返回类型化的 `PreToolDecision`（`allow`/`ask`/`deny`）。单调守卫没有允许结果，因此一旦超过上限，任何后续监听器——包括已授予的审批——都无法将拒绝翻回许可。
- **安全默认。** 无规则命名的工具被拒绝，对应 mini-research 策略引擎的拒绝未知行为默认。
- **无硬编码可调项。** 规则与上限是可从 cordis.yml 修改的、经校验的配置；插件会拒绝将同一工具命名多次的规则或上限集合。
- **解耦的评估。** 决策规则是门控消费的纯函数 `evaluatePolicy`；守卫从插件自身注入的 `ctx.agents` 读取当前轮次，而非通过调用代理的上下文。

### 源码索引

| 文件 | 职责 |
|---|---|
| [`src/policy.ts`](src/policy.ts) | `evaluatePolicy` 与 `PolicyRule`/`PolicyEffect`/`PolicyDecision` 词汇 |
| [`src/index.ts`](src/index.ts) | `Config`、`tools/pre-execute` 门控与每轮上限守卫 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [工具子系统参考](../../../docs/subsystems/tools.zh.md)——`tools/pre-execute` 瀑布与单调守卫。
- [审批子系统参考](../../../docs/subsystems/approval.zh.md)——`ask` 决策如何被解析。
- [研究子系统](../../../docs/subsystems/research.zh.md)——本策略服务的受治理研究模型。

-----

<a id="model-experience"></a>
## 模型体验

间接地，通过工具流水线与审批服务，二者呈现拒绝或审批提示。

#### KV 缓存影响

独立：本插件决定工具准入，不贡献提示或模式，因此既不增长也不使任何可复用的请求前缀失效。流水线记录的拒绝或审批结果由工具流水线拥有，而非本包。

## 已知限制与未竟工作

<a id="known-limitations-and-deferred-work"></a>

- **仅按工具名规则。** 规则按面向模型的工具名匹配；它不检查工具参数。参数级约束（例如 URL 白名单）属于专门的门控或工具自身。
- **仅每轮上限。** 上限在每个轮次边界重置；本包不提供按会话或按运行的预算。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
