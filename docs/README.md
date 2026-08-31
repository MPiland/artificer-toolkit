# Documentation index

This directory contains the repository's canonical architecture and decision documentation.

## Precedence

When documents disagree, use this order:

1. Current code and tests in the working tree for current behavior.
2. An explicitly labeled canonical target guide together with the ADRs that establish that target.
3. Other canonical architecture guides in `docs/architecture/` and the glossary in `CONTEXT.md`.
4. Product and design intent in `PRODUCT.md` and `DESIGN.md`.
5. Root planning, review, critique, and phase documents, which are historical or transitional unless explicitly marked otherwise.

The current documentation baseline is the working tree. Any unfinished or target behavior must be
labeled instead of being presented as current fact. For the rules runtime, authored-content
lifecycle, Campaign rules binding, and Encounter Blueprint/Run seams, ADRs 0023-0025 and
`architecture/rules-runtime.md` override transitional guides that document the version-pinned
implementation being replaced.

## Document status

Canonical documents should identify:

- `Status`: `canonical`, `decision`, `transitional`, or `historical`;
- `Scope`: the module or seam they explain;
- `Update when`: the code or contract changes that require review;
- `Verification`: the key files, tests, or flows checked against the document.

Keep intent at the interface it explains. Cross-module flows belong in architecture guides; load-bearing choices belong in ADRs; local non-obvious “why” belongs in concise code comments or JSDoc.

## Architecture guides

- [Overview](architecture/overview.md)
- [Data lifecycle](architecture/data-lifecycle.md)
- [Transport and tRPC](architecture/transport.md)
- [Persistence and Kysely](architecture/persistence.md)
- [Authoring Schema and runtime](architecture/authoring-schema.md)
- [Character Builder, Sheet, and engine flow](architecture/character.md)
- [Media lifecycle and delivery](architecture/media.md)
- [Engine](architecture/engine.md)
- [Shared rules runtime](architecture/rules-runtime.md) — canonical rebaseline target
- [D&D 2014 optional combat](architecture/dnd5e-optional-combat.md) — canonical optional-combat target boundary
- [Rules runtime domain ERDs](architecture/rules-runtime-erd.md)
- [Live-session host](architecture/live-sessions.md)
- [Versioned documents and correctness projections](architecture/versioned-projections.md) — transitional record; its rules/content pinning target is superseded by ADRs 0023-0025

## Audits

- [MVP readiness audit (2026-07-10)](audits/mvp-readiness-2026-07-10.md)

## Market research

- [Product and capability references](market-research.md) — transitional notes on products worth evaluating for Campaign preparation, management, maps, and VTT workflows

## Future roadmap

- [Future platform roadmap](roadmap/README.md) — transitional, phase-oriented planning for Character Sheet play depth and overrides, media/files, native clients, Campaigns, notifications, Encounters, commerce, Social Hub, Marketplace, and VTT
- [Phase 08 fixed acceptance ledger](roadmap/08-vtt-acceptance.md) — frozen 12/14/10/8/10 scenarios and gate governance

## Decisions

See [the ADR index](adr/README.md) for intentional architectural decisions and their current status.

## Workspace entrypoints

Each major module has a concise local README describing its interface and common flow:

- [Web](../apps/web/README.md)
- [APIs](../apps/apis/README.md)
- [Session host](../apps/session-host/README.md)
- [Schema](../packages/schema/README.md)
- [Shared](../packages/shared/README.md)
- [Functions](../packages/functions/README.md)
- [DB](../packages/db/README.md)
- [Supabase](../supabase/README.md)

## Historical material

Existing root-level phase plans, critiques, implementation briefs, and rule-gap notes remain useful as project history. They are not the current architecture source unless explicitly linked from a canonical guide or ADR. Their status banners point back here.
