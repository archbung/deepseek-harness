---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-27-research-report

[English](2026-10-27-research-report.md) | 中文

## 概述

新增 report/submitted 会话事件，用于提交某一轮研究报告的论断。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-27-research-report
baseline: false
changes:
  - root: "event:report/submitted"
    previous: null
    after: "2b511c80dfd8592b8387069472c9ccdd8d4bc6f528ec89d7aee36d3942fbe45e"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

该事件是仅追加的新增项，没有先前形态，因此已有日志不受影响并照常解码。未加载 research-claim-backing 包的读取方通过可合并扩展的默认分支折叠该事件并忽略它；research/report 投影是唯一消费方，仅在组合该包时存在。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/research/research-claim-backing：1 个文件，8 个测试通过。

<a id="dev-note"></a>
## 开发备注

无。
