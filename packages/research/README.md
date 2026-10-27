---
description: "The research group map: source-linked evidence, claim-backing, and policy for governed research workflows, for users and maintainers navigating the group."
kind: "package-group"
---

# packages/research

English | [中文](README.zh.md)

## Summary

The research group supports governed research workflows in which every factual claim is backed by a recorded source. Evidence is captured as durable session events so it survives reload, fork, and resume; downstream policy packages use that evidence to reject report claims citing sources the session never recorded.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`research-evidence`](research-evidence/README.md) | Source-linked evidence as durable session events, its projection, and the known-id reader | `ctx.researchEvidence` |

-----

<a id="related-documentation"></a>
## Related documentation

- [Research subsystem](../../docs/subsystems/research.md) — evidence records, the durable `evidence/recorded` event, and the generated service API.
- [Session projection reference](../session/session-projection/README.md) — the projection seam the evidence store builds on.
- [Web capability reference](../web/web/README.md) — the `WebSearchSource` citation shape evidence records wrap.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
