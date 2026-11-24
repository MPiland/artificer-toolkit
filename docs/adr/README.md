# Architecture Decision Records

This directory records load-bearing architectural decisions for Artificer Toolkit. ADRs explain _why_ a boundary or model exists; the current implementation and tests remain the source of truth for what is actually shipped.

## Status and precedence

- `Status: decision` means the decision is accepted and should guide new work.
- `Status: accepted` means the same, recorded after the decision was implemented.
- `Status: transitional` means the decision is the intended direction while the implementation is still converging.
- No `historical` records are kept: an ADR whose only remaining value was explaining a superseded choice is deleted. ADRs 0002, 0005, 0007, 0008, 0011 and 0016 to 0022 were retired this way; recover one with `git log --diff-filter=D --name-only -- docs/adr` and `git show <commit>^:<path>`. Numbers are never reused or reassigned.
- A parenthetical in the index names the ADRs that supersede all or part of a record; the record's own `Status` line is authoritative.

When an ADR and code disagree, verify the code and tests first, then update the ADR or mark it transitional. Product intent lives in [PRODUCT.md](../../PRODUCT.md) and [DESIGN.md](../../DESIGN.md). Cross-module behavior is described in [the architecture guides](../architecture/overview.md); the glossary is [CONTEXT.md](../../CONTEXT.md).

## Index

### Rules engine

| ADR                                                         | Decision                                                              | Status                         |
| ----------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------ |
| [0023](0023-shared-rules-kernel-and-system-capabilities.md) | Shared Rules Kernel and platform-owned Game System capabilities       | decision                       |
| [0026](0026-bounded-action-phase-specialization.md)         | Bounded action test/outcome specialization                            | decision                       |
| [0038](0038-rules-authored-from-core-options.md)            | Rules mechanics are authored from core options; `CLOSED_RULE` deleted | accepted                       |
| [0039](0039-composable-system-neutral-rules-engine.md)      | Composable, System-neutral rules engine; size and import ratchets     | decision (RULES-2 in progress) |
| [0042](0042-tree-shakable-system-capability-registries.md)  | Tree-shakable System capability registries, one list per capability   | accepted (PERF-6.T12)          |

### Authoring and content

| ADR                                                             | Decision                                                              | Status                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| [0003](0003-vocabulary-authored-compiled-engine-data.md)        | Separate vocabulary, authored, compiled, persistence, and engine data | decision (SQL row ownership superseded by 0029)              |
| [0004](0004-backend-resolved-node-maps.md)                      | Authoring Schemas are backend-resolved structure                      | decision                                                     |
| [0024](0024-current-published-authored-content.md)              | Current published authored content and frozen occurrences             | decision                                                     |
| [0025](0025-game-system-catalogues-and-encounter-blueprints.md) | Game Systems, Rules Catalogues, Campaign binding, and Blueprints      | decision                                                     |
| [0036](0036-versioned-content-snapshots-and-browser-builder.md) | Versioned content snapshots and Builder evaluation in the browser     | decision (S1–S9/S11 local; S10 and integrated proof pending) |

### Characters

| ADR                                              | Decision                                                             | Status                        |
| ------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------- |
| [0006](0006-character-builder-sheet-boundary.md) | Character Builder/Sheet are distinct from Authoring Schema authoring | decision                      |
| [0041](0041-stored-character-sheet-sections.md)  | A Character write stores its derived Sheet per viewer and section    | decision (RELIABILITY-21.T16) |

### Campaign, play and VTT

| ADR                                                              | Decision                                                            | Status                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| [0009](0009-vtt-encounter-event-boundary.md)                     | VTT encounter events remain separate from character Sheet history   | decision (partially superseded by 0023, 0024, 0029, 0033) |
| [0013](0013-campaign-authority-and-collaboration.md)             | Campaign authority, custody, durable history, and private Realtime  | decision (Postgres/Supabase topology superseded by 0029)  |
| [0014](0014-social-projection-and-tokenless-admission.md)        | Separate Social projection and tokenless Campaign admission         | decision (Postgres/Supabase superseded by 0029)           |
| [0015](0015-campaign-format-copy-and-maturity-presentation.md)   | Campaign format, reusable copies, and maturity presentation         | decision                                                  |
| [0027](0027-campaign-scenes-and-encounter-bindings.md)           | Campaign-owned live Scenes and optional Encounter bindings          | decision (Session presentation superseded by 0033)        |
| [0028](0028-r2-vtt-map-storage.md)                               | Cloudflare R2 storage for VTT maps                                  | decision (Supabase metadata superseded by 0029)           |
| [0033](0033-campaign-owned-play-and-session-log.md)              | Campaign-owned play, implicit live table and Sessions as a log      | decision (implemented locally)                            |
| [0034](0034-player-control-rules-assistance-and-roll-prompts.md) | Player-controlled actors, rules assistance modes and roll prompts   | decision (implementation in progress)                     |
| [0035](0035-room-authoritative-live-encounters.md)               | The room is authoritative for live Encounters; Convex is the record | decision (groundwork local; authority switch pending)     |

### Accounts and privacy

| ADR                                                      | Decision                                                            | Status                        |
| -------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------- |
| [0030](0030-owner-deletion-and-retained-dependencies.md) | Owner deletion with dependency repair and retained shared history   | decision                      |
| [0031](0031-oversized-inventory-cleanup.md)              | Oversized inventory cleanup with localized pending state            | decision                      |
| [0032](0032-campaign-deletion-lifecycle.md)              | One fenced, resumable Campaign deletion lifecycle for every size    | decision                      |
| [0040](0040-staged-account-deletion.md)                  | Staged account deletion: durable job of bounded steps, account last | decision (RELIABILITY-21.T22) |

### Platform and infrastructure

| ADR                                                              | Decision                                                           | Status                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [0001](0001-package-boundaries.md)                               | Package dependency direction and the `apps/apis` product-data seam | decision (SQL/tRPC topology superseded by 0029)                     |
| [0010](0010-platform-neutral-design-system.md)                   | Portable semantics with platform-owned presentation adapters       | decision                                                            |
| [0012](0012-private-media-assets-and-domain-owned-references.md) | Private media assets with domain-owned references                  | decision (Supabase storage superseded by 0029)                      |
| [0029](0029-convex-backend-cutover.md)                           | Current Convex, Better Auth, and TypeScript Rules Kernel authority | decision (live persistence superseded by 0035; web hosting by 0037) |
| [0037](0037-web-app-on-cloudflare-workers.md)                    | Netlify → Cloudflare Workers web hosting                           | decision (local migration validated; managed cutover pending)       |

## Updating an ADR

Update the relevant record when an interface, invariant, ownership boundary, or data lifecycle changes. Add a new ADR when a decision cannot be explained as a revision of an existing one. Keep implementation notes short and link to the owning source and tests.
