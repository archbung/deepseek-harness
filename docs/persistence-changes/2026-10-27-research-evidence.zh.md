---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-27-research-evidence

[English](2026-10-27-research-evidence.md) | 中文

## 概述

新增 evidence/recorded 会话事件，用于提交一条有来源的研究证据记录。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-27-research-evidence
baseline: false
changes:
  - root: "event:evidence/recorded"
    previous: null
    after: "9d3493d613bc16b53e1d64659a8df5a3f68e386466bf047706fd737e474646ab"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

该事件是仅追加的新增项，没有先前形态，因此已有日志不受影响并照常解码。未加载 research-evidence 包的读取方通过可合并扩展的默认分支折叠该事件并忽略它；证据投影是唯一消费方，仅在组合该包时存在。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/research/research-evidence：1 个文件，6 个测试通过。

<a id="dev-note"></a>
## 开发备注

无。
