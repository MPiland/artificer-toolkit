# Architecture Decision Records

This directory records load-bearing architectural decisions for Artificer Toolkit. ADRs explain _why_ a boundary or model exists; the current implementation and tests remain the source of truth for what is actually shipped.

## Status and precedence

- `Status: decision` means the decision is accepted and should guide new work.
- `Status: transitional` means the decision is the intended direction while the implementation is still converging.
- `Status: historical` means the record explains a superseded choice and must not be used to justify new code.

When an ADR and code disagree, verify the code and tests first, then update the ADR or mark it transitional. Product intent lives in [PRODUCT.md](../../PRODUCT.md) and [DESIGN.md](../../DESIGN.md). Cross-module behavior is described in [the architecture guides](../architecture/overview.md); the glossary is [CONTEXT.md](../../CONTEXT.md).

## Index

| ADR                                                              | Decision                                                              | Status     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| [0001](0001-package-boundaries.md)                               | Package dependency direction and the `apps/apis` product-data seam    | decision   |
| [0002](0002-kysely-writes-authored-hydration.md)                 | Kysely-owned application writes and authored-shaped hydration         | decision   |
| [0003](0003-vocabulary-authored-compiled-engine-data.md)         | Separate vocabulary, authored, compiled, persistence, and engine data | decision   |
| [0004](0004-backend-resolved-node-maps.md)                       | Authoring Schemas are backend-resolved structure                      | decision   |
| [0005](0005-pure-rules-system-engine.md)                         | Pure, deterministic D&D 5e-family engine with injected rules policy   | decision   |
| [0006](0006-character-builder-sheet-boundary.md)                 | Character Builder/Sheet are distinct from Authoring Schema authoring  | decision   |
| [0007](0007-authored-revisions-and-active-projections.md)        | Immutable root revisions and normalized active projections            | historical |
| [0008](0008-ruleset-identity-and-content-binding.md)             | Explicit ruleset identity and active content binding                  | decision   |
| [0009](0009-vtt-encounter-event-boundary.md)                     | VTT encounter events remain separate from character Sheet history     | decision   |
| [0010](0010-platform-neutral-design-system.md)                   | Portable semantics with platform-owned presentation adapters          | decision   |
| [0011](0011-active-authored-content-and-json-drafts.md)          | Canonical active authored content with JSON drafts                    | decision   |
| [0012](0012-private-media-assets-and-domain-owned-references.md) | Private media assets with domain-owned references                     | decision   |
| [0013](0013-campaign-authority-and-collaboration.md)             | Campaign authority, custody, durable history, and private Realtime    | decision   |
| [0014](0014-social-projection-and-tokenless-admission.md)        | Separate Social projection and tokenless Campaign admission           | decision   |
| [0015](0015-campaign-format-copy-and-maturity-presentation.md)   | Campaign format, reusable copies, and maturity presentation           | decision   |
| [0016](0016-novu-notification-delivery.md)                       | Former Novu delivery implementation                                  | historical |
| [0017](0017-supabase-notification-delivery.md)                   | Supabase feed, preferences, Edge delivery, and authorized destinations | decision   |

## Updating an ADR

Update the relevant record when an interface, invariant, ownership boundary, or data lifecycle changes. Add a new ADR when a decision cannot be explained as a revision of an existing one. Keep implementation notes short and link to the owning source and tests.
