# Architecture Decision Records

This directory records load-bearing architectural decisions for Artificer Toolkit. ADRs explain _why_ a boundary or model exists; the current implementation and tests remain the source of truth for what is actually shipped.

## Status and precedence

- `Status: decision` means the decision is accepted and should guide new work.
- `Status: transitional` means the decision is the intended direction while the implementation is still converging.
- `Status: historical` means the record explains a superseded choice and must not be used to justify new code.
- A parenthetical in the index names the ADRs that supersede all or part of a record; the record's own `Status` line is authoritative.

When an ADR and code disagree, verify the code and tests first, then update the ADR or mark it transitional. Product intent lives in [PRODUCT.md](../../PRODUCT.md) and [DESIGN.md](../../DESIGN.md). Cross-module behavior is described in [the architecture guides](../architecture/overview.md); the glossary is [CONTEXT.md](../../CONTEXT.md).

## Index

| ADR                                                                    | Decision                                                              | Status                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [0001](0001-package-boundaries.md)                                     | Package dependency direction and the `apps/apis` product-data seam    | decision (SQL/tRPC topology superseded by 0029)                     |
| [0002](0002-kysely-writes-authored-hydration.md)                       | Kysely-owned application writes and authored-shaped hydration         | historical (superseded by 0029)                                     |
| [0003](0003-vocabulary-authored-compiled-engine-data.md)               | Separate vocabulary, authored, compiled, persistence, and engine data | decision (SQL row ownership superseded by 0029)                     |
| [0004](0004-backend-resolved-node-maps.md)                             | Authoring Schemas are backend-resolved structure                      | decision                                                            |
| [0005](0005-pure-rules-system-engine.md)                               | Former pure D&D 5e-family TypeScript engine                           | historical (superseded by 0023, 0029)                               |
| [0006](0006-character-builder-sheet-boundary.md)                       | Character Builder/Sheet are distinct from Authoring Schema authoring  | decision                                                            |
| [0007](0007-authored-revisions-and-active-projections.md)              | Immutable root revisions and normalized active projections            | historical                                                          |
| [0008](0008-ruleset-identity-and-content-binding.md)                   | Former ruleset identity and immutable binding model                   | historical (superseded by 0023–0025)                                |
| [0009](0009-vtt-encounter-event-boundary.md)                           | VTT encounter events remain separate from character Sheet history     | decision (partially superseded by 0023, 0024, 0029, 0033)           |
| [0010](0010-platform-neutral-design-system.md)                         | Portable semantics with platform-owned presentation adapters          | decision                                                            |
| [0011](0011-active-authored-content-and-json-drafts.md)                | Canonical active authored content with JSON drafts                    | historical (superseded by 0022)                                     |
| [0012](0012-private-media-assets-and-domain-owned-references.md)       | Private media assets with domain-owned references                     | decision (Supabase storage superseded by 0029)                      |
| [0013](0013-campaign-authority-and-collaboration.md)                   | Campaign authority, custody, durable history, and private Realtime    | decision (Postgres/Supabase topology superseded by 0029)            |
| [0014](0014-social-projection-and-tokenless-admission.md)              | Separate Social projection and tokenless Campaign admission           | decision (Postgres/Supabase superseded by 0029)                     |
| [0015](0015-campaign-format-copy-and-maturity-presentation.md)         | Campaign format, reusable copies, and maturity presentation           | decision                                                            |
| [0016](0016-novu-notification-delivery.md)                             | Former Novu delivery implementation                                   | historical (superseded by 0017)                                     |
| [0017](0017-supabase-notification-delivery.md)                         | Former Supabase feed, preferences, Edge delivery, and destinations    | historical (superseded by 0029)                                     |
| [0018](0018-embedded-rule-packs-and-encounter-resolution.md)           | Former immutable embedded rule-pack model                             | historical (superseded by 0023, 0029)                               |
| [0019](0019-versioned-cross-domain-rules-runtime.md)                   | Former versioned cross-domain evaluator model                         | historical (superseded by 0023, 0024, 0029)                         |
| [0020](0020-local-and-remote-live-session-host.md)                     | Former Durable Object and native Node local live-session coordination | historical (superseded by 0029, 0033)                               |
| [0021](0021-command-scoped-rules-responsibilities.md)                  | Historical Postgres/Zen command-scoped application ownership          | historical (superseded by 0029)                                     |
| [0022](0022-versioned-domain-documents-and-correctness-projections.md) | Former versioned document/projection model                            | historical (superseded by 0024, 0029)                               |
| [0023](0023-shared-rules-kernel-and-system-capabilities.md)            | Shared Rules Kernel and platform-owned Game System capabilities       | decision                                                            |
| [0024](0024-current-published-authored-content.md)                     | Current published authored content and frozen occurrences             | decision                                                            |
| [0025](0025-game-system-catalogues-and-encounter-blueprints.md)        | Game Systems, Rules Catalogues, Campaign binding, and Blueprints      | decision                                                            |
| [0026](0026-bounded-action-phase-specialization.md)                    | Bounded action test/outcome specialization                            | decision                                                            |
| [0027](0027-campaign-scenes-and-encounter-bindings.md)                 | Campaign-owned live Scenes and optional Encounter bindings            | decision (Session presentation superseded by 0033)                  |
| [0028](0028-r2-vtt-map-storage.md)                                     | Cloudflare R2 storage for VTT maps                                    | decision (Supabase metadata superseded by 0029)                     |
| [0029](0029-convex-backend-cutover.md)                                 | Current Convex, Better Auth, and TypeScript Rules Kernel authority    | decision (live persistence superseded by 0035; web hosting by 0037) |
| [0030](0030-owner-deletion-and-retained-dependencies.md)               | Owner deletion with dependency repair and retained shared history     | decision                                                            |
| [0031](0031-oversized-inventory-cleanup.md)                            | Oversized inventory cleanup with localized pending state              | decision                                                            |
| [0032](0032-campaign-deletion-lifecycle.md)                            | One fenced, resumable Campaign deletion lifecycle for every size      | decision                                                            |
| [0033](0033-campaign-owned-play-and-session-log.md)                    | Campaign-owned play, implicit live table and Sessions as a log        | decision (implemented locally)                                      |
| [0034](0034-player-control-rules-assistance-and-roll-prompts.md)       | Player-controlled actors, rules assistance modes and roll prompts     | decision (implementation in progress)                               |
| [0035](0035-room-authoritative-live-encounters.md)                     | The room is authoritative for live Encounters; Convex is the record   | decision (groundwork local; authority switch pending)               |
| [0036](0036-versioned-content-snapshots-and-browser-builder.md)        | Versioned content snapshots and Builder evaluation in the browser     | decision (S1–S9/S11 local; S10 and integrated proof pending)        |
| [0037](0037-web-app-on-cloudflare-workers.md)                          | Netlify → Cloudflare Workers web hosting                              | decision (local migration validated; managed cutover pending)       |
| [0038](0038-rules-authored-from-core-options.md)                       | Rules mechanics are authored from core options; `CLOSED_RULE` retired | transitional (SPELLS-4 conversions pending)                         |
| [0039](0039-composable-system-neutral-rules-engine.md)                 | Composable, System-neutral rules engine; size and import ratchets     | decision (RULES-2 in progress)                                      |
| [0040](0040-stored-character-sheet-sections.md)                        | A Character write stores its derived Sheet per viewer and section     | decision (RELIABILITY-21.T16)                                       |

## Updating an ADR

Update the relevant record when an interface, invariant, ownership boundary, or data lifecycle changes. Add a new ADR when a decision cannot be explained as a revision of an existing one. Keep implementation notes short and link to the owning source and tests.
