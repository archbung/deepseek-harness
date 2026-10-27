---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-27-research-evidence

English | [中文](2026-10-27-research-evidence.zh.md)

## Summary

Adds the evidence/recorded session event that commits one source-linked research evidence record.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

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
## Compatibility

The event is an append-only addition with no prior form, so existing logs are unaffected and decode unchanged. A reader without the research-evidence package folds the event through the merge-extensible default and ignores it; the evidence projection is the only consumer and is present only when the package is composed.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/research/research-evidence: 1 file, 6 tests passed.

<a id="dev-note"></a>
## Dev Note

None.
