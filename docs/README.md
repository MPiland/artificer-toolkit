# Documentation index

This directory contains the repository's canonical architecture and decision documentation.

## Precedence

When documents disagree, use this order:

1. Current code and tests in the working tree for current behavior.
2. An explicitly labeled canonical target guide together with the ADRs that establish that target.
3. Other canonical architecture guides in `docs/architecture/` and the glossary in `CONTEXT.md`.
4. Product and design intent in `PRODUCT.md` and `DESIGN.md`.
5. Root planning, review, critique, and phase documents, which are historical or transitional unless explicitly marked otherwise.

The current Phase 8.2 product boundary is native Convex. Retired tRPC, Supabase, Kysely,
GoRules, local session-host, and Netlify executor material is authoritative only when a document
marks it as historical. Their runtime source has been removed from the current tree. Exact before copies remain under ignored
validation evidence, and explicitly historical documents remain architectural history.

## Document status

Canonical documents should identify:

- `Status`: `canonical`, `decision`, `transitional`, or `historical`;
- `Scope`: the module or seam they explain;
- `Update when`: the code or contract changes that require review;
- `Verification`: the key files, tests, or flows checked against the document.

Keep intent at the interface it explains. Cross-module flows belong in architecture guides,
load-bearing choices belong in ADRs, and local non-obvious reasoning belongs in concise code comments
or JSDoc.

## Architecture guides

- [Overview](architecture/overview.md)
- [Data lifecycle](architecture/data-lifecycle.md)
- [Transport boundary](architecture/transport.md)
- [Persistence](architecture/persistence.md)
- [Authoring Schema and resolution](architecture/authoring-schema.md)
- [Character Builder, Sheet, and engine flow](architecture/character.md)
- [Media lifecycle and delivery](architecture/media.md)
- [Engine](architecture/engine.md) — historical Character engine record superseded by the shared rules runtime
- [Shared rules runtime](architecture/rules-runtime.md)
- [D&D 2014 optional combat](architecture/dnd5e-optional-combat.md)
- [Rules runtime domain ERDs](architecture/rules-runtime-erd.md)
- [Live-session coordination](architecture/live-sessions.md)
- [Versioned documents and correctness projections](architecture/versioned-projections.md) — historical implementation record superseded by ADRs 0023–0025 and 0029

## Operator runbooks

- [Phase 8.2 release lifecycle](runbooks/phase-8-2-release.md)
- [Web Worker hosting](runbooks/web-worker-hosting.md)
- [Convex notification delivery](runbooks/convex-notification-delivery.md)
- [Social Hub retention](runbooks/social-retention.md)
- [VTT map R2](runbooks/vtt-map-r2.md)
- Historical only: [Novu notification delivery](runbooks/notification-delivery.md) and [Supabase notification delivery](runbooks/supabase-notification-delivery.md)

## Audits and research

- [MVP readiness audit (2026-07-10)](audits/mvp-readiness-2026-07-10.md) — historical (pre-Convex)
- [Authoring workspace audit (2026-07-12)](audits/authoring-workspace-2026-07-12.md) — historical
- [MVP acceptance ledger (2026-07-13)](audits/mvp-acceptance-ledger-2026-07-13.md) — historical (pre-Convex)
- [Product and capability references](market-research.md) — transitional research notes

## Roadmap and acceptance

- [Future platform roadmap](roadmap/README.md)
- [Phase 08 fixed acceptance ledger](roadmap/08-vtt-acceptance.md)
- [Phase 8.2 Convex cutover acceptance](roadmap/08-2-convex-cutover-acceptance.md)
- [Phase 8.2 living handoff](handoffs/phase-08-2-convex-cutover.md)
- [Phase 8.2 local validation record](validation/phase-08-2/README.md)

## Decisions

See [the ADR index](adr/README.md) for intentional architectural decisions and their current status.

## Current workspace entrypoints

- [Web](../apps/web/README.md)
- [Native Convex API](../apps/apis/README.md)
- [Transient session Worker](../apps/session-worker/README.md)
- [Schema](../packages/schema/README.md)
- [Shared](../packages/shared/README.md)
- [Authoring](../packages/authoring/README.md)
- [Rules Runtime](../packages/rules-runtime/README.md)
- [Source data](../packages/source-data/README.md)
- [Emails](../packages/emails/README.md)
- [Design system](../packages/design-system/README.md)
- [Web form platform](../apps/web/src/forms/README.md)

## Historical material

Root-level phase plans, critiques, implementation briefs, and rule-gap notes remain useful as project
history. They are not current architecture unless an active canonical guide or ADR explicitly says so.
