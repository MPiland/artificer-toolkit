# ADR 0010: Portable semantics, platform-owned presentation

- **Status:** decision
- **Date:** 2026-07-17
- **Scope:** `@artificer-toolkit/design-system`, Authoring Schema presentation, web adapters, future native adapters
- **Update when:** portable foundation values, semantic vocabularies, or platform adapter ownership changes
- **Verification:** `packages/design-system`; `packages/shared/src/utils/authoringSchema.ts`; `packages/schema/src/api/nodeRuntime.ts`; `apps/web/src/forms/rendering/authoringPresentationAdapter.ts`

## Context

Web and future native clients need consistent product intent without sharing CSS, Mantine props, React components, browser breakpoints, or native layout code. Authoring Schemas also need occasional responsive differences such as quiet text in a wide workspace and a full-width primary action in compact space.

## Decision

`@artificer-toolkit/design-system` owns dependency-free numeric foundations, color values, and closed semantic vocabularies. Responsive recipes use `default` plus optional complete `compact` and `wide` overrides; those names describe available space rather than a device.

Authoring Schemas may select only documented semantic recipes applicable to their node kind. They cannot contain raw colors, font weights, CSS classes, token paths, component-library props, platform names, executable callbacks, or arbitrary style IDs.

Each client owns an exhaustive adapter. Web converts foundations to CSS units and maps action, text, and surface semantics to Mantine and Vanilla Extract tokens. A future native client must map the same vocabulary to native components and values. Adding a semantic must fail active adapter typechecks until every mapping is provided.

## Consequences

Schema changes can alter intent for every client, while platform adapters retain accessibility, geometry, and interaction ownership. A new visual need becomes a shared semantic only when it represents stable product intent; one-off implementation styling stays local to the owning component.
