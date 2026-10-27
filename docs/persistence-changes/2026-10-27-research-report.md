---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-27-research-report

English | [中文](2026-10-27-research-report.zh.md)

## Summary

Adds the report/submitted session event that commits one research report's claims for the turn.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

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
## Compatibility

The event is an append-only addition with no prior form, so existing logs are unaffected and decode unchanged. A reader without the research-claim-backing package folds the event through the merge-extensible default and ignores it; the research/report projection is the only consumer and is present only when the package is composed.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/research/research-claim-backing: 1 file, 8 tests passed.

<a id="dev-note"></a>
## Dev Note

None.
