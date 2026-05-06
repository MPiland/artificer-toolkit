# Phase 9.16 - Supporting Surfaces And Final Architecture Cleanup

## Status: Complete

## Summary

Finish the remaining Phase 9 frontend rebuild work before deeper manual testing. This tranche stays on the existing `codex/refactor` branch and does not delete old branches. The priority is to remove the last active mixed frontend patterns, then add supporting Systems/Features surfaces only where the backend ownership model is safe.

## Prerequisites

- [PHASE_9_13_CODE_CLASS_SUBPLAN.md](PHASE_9_13_CODE_CLASS_SUBPLAN.md)
- [PHASE_9_15_CHARACTER_SHEET_SUBPLAN.md](PHASE_9_15_CHARACTER_SHEET_SUBPLAN.md)

## Current Inventory

- Equipment, Vehicle, Class, Spell, Background, Feat, Race, and Creature use the accepted route-loader-driven authoring pattern.
- The old Spell/Background/Feat/Race/Creature `*Form` wrappers, route user-id props, component-level authored read hooks, and pass-through form composition have been retired.
- `components/editors` and `legacy` are gone from the active frontend, but `apps/web/src/server/auth` remains valid auth infrastructure, not product-data legacy.
- Systems have read APIs, web query adapters, and active read-only list/detail routes.
- Features and feat grants have backend repositories/services and hardened node maps, but they are not yet modeled as safe user-owned authored subjects with draft sidecar parity.

## Key Decisions

- Continue on `codex/refactor`; branch deletion waits until the full rebuild is done and ready for deep manual testing.
- Do not expose standalone Feature or feat-grant create/edit routes until ownership, system scoping, permissions, and draft sidecar behavior are explicitly implemented.
- Treat feat grants as node-map-backed child records in this tranche, not a standalone user-facing authored domain.
- Treat Features as a support/reference surface first unless we add a real authored ownership model. The existing direct feature upsert path must not become a user-facing UI shortcut.
- Keep authored domain forms node-driven through `createAuthoringFormRenderer`; do not rebuild bespoke grant/feature editors.

## Implementation Tracks

### 1. Finish Active Authored Form Cleanup

- Migrate Spell, Background, Feat, Race, and Creature create/edit pages to the Equipment/Class pattern.
- Route loaders own reads for systems, active records, drafts, and optional active fallback.
- Remove route-passed `userId`; server auth/RLS owns identity.
- Remove old `*Form` pass-through wrappers once each domain page owns `useAppForm`, provider registration, mutations, invalid-draft recovery, and layout rendering.
- Move missing mutation hooks into each domain data folder for parity with Equipment/Vehicle/Class.
- Keep domain renderers as tiny adapters around `createAuthoringFormRenderer`.

### 2. Systems Surface

- Add `/systems` as a read-only supporting surface using the active shell and data runtime.
- Add `/systems/$systemId` if a simple reader view adds value; otherwise keep one list page with expandable summaries.
- Add Systems to active navigation only after the route is live.
- Do not add system authoring unless a separate product decision defines multi-system editing.

### 3. Feature Support Surface

- Do not add Feature browsing/detail in this tranche unless it can be backed by current APIs without pretending Features are user-owned authored records.
- If standalone Feature authoring is accepted later, first add schema/db/API parity: `FEATURE` draft kind, ownership/system scoping, provenance/permissions, list-with-drafts, detail response, route/body guards, and node-runtime normalization.
- `FEATURE_NODE_MAP` and `OPTION_NODE_MAP` now expose stable step metadata and rich text field types before any feature authoring UI is exposed.

### 4. Feat Grant Support

- Keep feat grants as child maps used by Features/Feats/Options.
- Add node-map/runtime tests for feat grant visibility, options, defaults, and nested parent/ancestor behavior.
- Do not add a public `/feat-grants` route in this tranche unless a clear admin-only use case is approved.

### 5. Final Cleanup

- Delete retired domain `*Form` wrappers and tests/stories that only exercise the removed wrapper path.
- Remove unused domain-local empty nested item helpers once shared node defaults cover the active renderer path.
- Tighten architecture tests to catch:
  - active route user-id props
  - component-level authored read hooks in create/edit pages
  - old `*Form` wrappers
  - product-data imports outside `apps/apis`
  - direct Feature/feat-grant upsert UI usage
- Update [PHASE_9_CODE_OVERVIEW.md](PHASE_9_CODE_OVERVIEW.md) and [AGENTS.md](AGENTS.md) after validation.

## Test Plan

- Route tests prove migrated Spell, Background, Feat, Race, and Creature create/edit pages still mount and tolerate draft-only IDs.
- Form tests prove migrated pages preserve invalid-draft recovery, locked/master read-only mode, duplicate-to-draft, save draft, and activation.
- Systems tests cover list loading, empty/error states, and navigation.
- Node-runtime tests cover feature/option/grant child maps, rich text fields, defaults, parent/ancestor conditions, and clear paths.
- Static checks prove no active authored create/edit route passes `userId`, imports removed `*Form` wrappers, or calls product read hooks where loader data should be used.
- Gates:
  - `yarn build:schema`
  - `yarn build:shared`
  - `yarn build:functions`
  - `yarn build:db`
  - `yarn build:apis`
  - focused migrated-domain tests
  - `yarn workspace @artificer-toolkit/web typecheck:app`
  - targeted ESLint with `--max-warnings 0`
  - `yarn workspace @artificer-toolkit/web test`
  - Storybook build/e2e where touched
  - `yarn build:web`

## Exit Criteria

- Active Phase 9 authored create/edit pages all use the same route-loader + provider registration + node-renderer pattern.
- Systems have an active rebuilt supporting surface if included in navigation.
- Feature/feat-grant authoring is either intentionally deferred or made safe with real authored ownership/draft parity before UI exposure.
- No old provisional frontend architecture remains on active route paths.
- The frontend rebuild is ready for the next accepted tranche and eventual deep manual testing.
