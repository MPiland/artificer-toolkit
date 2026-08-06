# Documentation index

This directory contains the repository's canonical architecture and decision documentation.

## Precedence

When documents disagree, use this order:

1. Current code and tests in the working tree.
2. Canonical architecture guides in `docs/architecture/` and the glossary in `CONTEXT.md`.
3. ADRs in `docs/adr/` for intentional load-bearing decisions.
4. Product and design intent in `PRODUCT.md` and `DESIGN.md`.
5. Root planning, review, critique, and phase documents, which are historical or transitional unless explicitly marked otherwise.

The current documentation baseline is the working tree. Any unfinished or target behavior must be labeled instead of being presented as current fact.

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

## Audits

- [MVP readiness audit (2026-07-10)](audits/mvp-readiness-2026-07-10.md)

## Future roadmap

- [Future platform roadmap](roadmap/README.md) — transitional, phase-oriented planning for Character Sheet play depth and overrides, media/files, native clients, Campaigns, Encounters, commerce, Social Hub, Marketplace, and VTT

## Decisions

See [the ADR index](adr/README.md) for intentional architectural decisions and their current status.

## Workspace entrypoints

Each major module has a concise local README describing its interface and common flow:

- [Web](../apps/web/README.md)
- [APIs](../apps/apis/README.md)
- [Schema](../packages/schema/README.md)
- [Shared](../packages/shared/README.md)
- [Functions](../packages/functions/README.md)
- [DB](../packages/db/README.md)
- [Supabase](../supabase/README.md)

## Historical material

Existing root-level phase plans, critiques, implementation briefs, and rule-gap notes remain useful as project history. They are not the current architecture source unless explicitly linked from a canonical guide or ADR. Their status banners point back here.
