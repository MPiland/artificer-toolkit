# Phase 9.11 - Code: Creature

## Status: Implemented - Ready for PR Review

## Objective

Rebuild creature authoring on the accepted Phase 9 stack: REST through `apps/apis`, draft sidecar persistence, SSR-aware TanStack Query loaders, shared authored list/form components, TanStack Form composition, and node-runtime-backed visibility/options.

Creature is category-driven. The user-facing flows are `Monster`, `Beast`, `NPC`, `Companion`, and `Summon`; `recordKind` remains internal persistence compatibility only and must not appear as `Stat Block` or `Logistics` in the UI.

## Source Of Truth

Figma's `Creatures` page is canonical. Older prose is useful only where it agrees with the locked screens.

Frame inventory:

- `MF1` through `MF6`: Monster Basics, Stats, Defenses, Content, Actions, Legendary & Lair.
- `BF1` through `BF7`: Beast Basics, Stats, Defenses, Content, Actions, Travel & Cost, Mount Profile.
- `NF1` through `NF6`: NPC Basics, Stats, Defenses, Content, Actions, Personality.
- `CF1` through `CF6`: Companion Basics, Stats, Defenses, Content, Actions, Companion Profile.
- `SF1` through `SF6`: Summon Basics, Stats, Defenses, Content, Actions, Summon Profile.

## Implemented Scope

- Active routes:
  - `/creatures`
  - `/creatures/new`
  - `/creatures/$creatureId`
  - `/creatures/$creatureId/edit`
- The detail parent route renders an `Outlet` so edit content mounts correctly.
- `Creatures` is present in authenticated navigation after the list route is live.
- Creature list uses the shared `AuthoredListPage` with category/source/status filtering, draft-aware rows, locked-master duplicate-only behavior, and all five user-facing categories represented in fixtures/stories.
- Creature forms use the shared authored form frame, TanStack Form runtime, node-runtime resolver, and focused nested editor modal.
- Locked master Creatures render read-only, hide edit/save/delete actions, and expose duplicate-to-draft when `permissions.canCopy` is true.

## Backend And Contract Work

- `CreatureAuthored` / `CreatureAuthoredDto` now support one category-driven authored shape where stats, actions, travel/cost, mount, NPC, companion, summon, legendary, and lair data can coexist as applicable.
- Creature repository and upsert paths round-trip category-specific fields without dropping Beast travel/cost, mount profile, NPC personality, companion profile, summon profile, actions, legendary profile, or lair data.
- Creature list queries expose category metadata for active and draft-aware frontend filtering.
- Creature REST routes now match the accepted authored-domain pattern:
  - list merges owned drafts
  - detail returns provenance and permissions
  - drafts use `authored_subject_drafts`
  - activation uses the route id as source of truth
  - activation runs `normalizeNodeRuntimeValues({ mapId: 'creature' })`
  - malformed bodies use schema validation responses
  - active writes are guarded from master/foreign-owned overwrites
- Creature node maps are category-driven and include `CLEAR` hidden behavior for category-specific fields.
- Creature defense fields now resolve from DB-backed node-runtime options instead of free-text local lists.

## UI And Runtime Decisions

- Step flow follows Figma category flows:
  - Monster: Basics, Stats, Defenses, Content, Actions, Legendary & Lair.
  - Beast: Basics, Stats, Defenses, Content, Actions, Travel & Cost, Mount Profile.
  - NPC: Basics, Stats, Defenses, Content, Actions, NPC Personality.
  - Companion: Basics, Stats, Defenses, Content, Actions, Companion Profile.
  - Summon: Basics, Stats, Defenses, Content, Actions, Summon Profile.
- Longform creature fields use textarea treatment.
- Selects and multiselects use shared app primitives fed by node-runtime options.
- Creature action authoring stays on the existing creature action model for 9.11.
- Full feature/effect expansion beyond the current reusable basics/effect patterns remains deferred to supporting surfaces.
- Delete remains omitted from real Creature UI because a safe backend delete path is not part of this tranche.

## Impeccable Review Notes

Focused audit/critique was run against Creature list and form stories.

Resolved findings:

- Removed public `recordKind` / `Stat Block` / `Logistics` concepts from the UI-facing flow.
- Added category coverage in list fixtures/stories so Monster, Beast, NPC, Companion, and Summon are all visible.
- Corrected locked-master write protection so Creature upserts cannot overwrite seeded/master records.
- Replaced free-text defense reference fields with runtime-backed option fields.
- Fixed duplicate nested collection row keys by editing/removing by index.
- Tightened category-specific profile labels and empty-state copy.

Deferred non-blocker:

- Cross-domain active-edit concurrency hardening remains a later draft sidecar enhancement. Current 9.11 behavior matches the accepted Phase 9.8.1 draft model.

## Validation

Passed:

- `yarn build:schema`
- `yarn build:shared`
- `yarn build:db`
- `yarn build:functions`
- `yarn build:apis`
- `yarn test:schema`
- `yarn test:shared`
- `yarn vitest run apps/apis/src/routes/authoredContent.test.ts`
- `yarn workspace @artificer-toolkit/web test src/domains/creatures/creatureAuthoring.test.ts src/data/creatures/creatureListMapper.test.ts`
- `yarn workspace @artificer-toolkit/web test`
- `yarn workspace @artificer-toolkit/web build-storybook`
- Static Storybook Playwright full suite via the generated `storybook-static`
- `yarn workspace @artificer-toolkit/web exec playwright test --project=storybook -g creature`
- `yarn workspace @artificer-toolkit/web test:e2e:app`

Accepted non-blockers:

- `yarn build:web` remains blocked only by documented legacy `src/utils` alias/type failures outside the Creature/runtime path.
- The dev Storybook server can exit during the full Storybook Playwright suite on this machine; the same suite passed against the static Storybook build.
- Storybook build still emits existing bundle-size warnings.
- App Playwright smoke still emits the existing TanStack Start/Mantine dev-style collection warning but passes.

## Exit Criteria

- Creature authoring is category-driven and explicit.
- Mount, companion, summon, NPC, legendary, lair, travel, and action surfaces are visible where applicable.
- Locked-master copy matches the established domain pattern.
- Creature routes, data helpers, API routes, DTOs, node maps, stories, and tests are implemented on the Phase 9 stack.
- 9.11 is ready for PR review before starting 9.12 Vehicle.
