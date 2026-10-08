# Dead-code sweep, 2026-10

Branch `claude/dead-code-sweep-2026-10`, cut from `codex/phase-08-2-convex-cutover` at `af7ddb75a`.
This report covers removed code only. No behavior changes are intended.

## Method

1. **Find candidates.** knip ran from a disposable config under ignored `local-validation/dead-code/`, so no dependency was committed. It used:
   - every Convex module, script, test, story and route as an entry;
   - each package's `exports` remapped from `dist` to `src`.

   A second, production-mode pass ignored tests and stories, to find code that only tests use.
2. **Remove unused exports.** Each unused export lost its `export` keyword. oxlint `no-unused-vars` then drove deletion of declarations and imports that became unused (three rounds). The deletions used a TypeScript AST script, so a whole declaration was removed, never a partial text edit.
3. **Check Convex functions.** Every exported Convex function was searched across the repo for:
   - dotted `api.mod.fn` references;
   - `'mod:fn'` string references (`makeFunctionReference`);
   - same-file scheduler references;
   - scripts and runbooks.

   A function is deleted only when nothing references it, not even a test.
4. **Check test-only candidates by hand** (`rg -w` plus barrels, stories and scripts) before deleting the code and the test cases that only exercised it.

## Removed, by package

Line counts come from `git diff --shortstat af7ddb75a` and include the test cases that were removed.

| Package | Files touched | Files deleted | Lines removed (net) |
| --- | ---: | ---: | ---: |
| apps/web | 195 | 44 | 3,690 |
| packages/rules-runtime | 96 | 5 | 1,909 |
| packages/schema | 54 | 1 | 302 |
| packages/shared | 11 | 1 | 100 |
| packages/encounter-persistence | 15 | 0 | 67 |
| apps/apis (Convex) | 5 + codegen | 0 | 54 |
| packages/source-data | 11 | 0 | 31 |
| apps/session-worker | 8 | 0 | 0 (exports only) |
| packages/authoring | 3 | 0 | 0 (exports only) |

### Highlights

- **Web**
  - 19 unused icon components, plus the old `css/app`, `reset` and `typography` style sheets.
  - 7 orphaned domain `*Authoring.css.ts` files, and orphaned mutation and draft adapters (`data/characters/drafts`, `data/creatures/mutations`, `data/spells/mutations`).
  - The unused Sheet mobile Actions and Notes panels, `SectionRow`, the `Spinner` primitive, and the `forms/utils/nodeModel` helpers.
  - The `nodeOptions` and `nodeVisibility` resolvers (superseded by backend node runtime), and `initialAuthoringValues`.
  - Builder `readiness`, plus about 60 unused vanilla-extract classes.
- **Rules runtime.** Optional-combat resolvers and policy modules that were never wired: nothing called them, not even tests. They are:
  - Facing, Disarm, Mark and marked opportunity attack;
  - Climb onto a larger creature and Climb dislodge;
  - Overrun, Tumble, Shove Aside, Hitting Cover;
  - Massive Damage, Injury, Morale;
  - the Legendary Resistance choice and lifecycle definitions;
  - the `compileDnd5eEffectAction` compiler.

  Also removed: `characterSheetCommandResponsibility`, `encounterActionCapabilityDiscovery`, `encounterInitiativeTerminalSettlement` and `encounterMovementRuleTimeline`. If any optional rule is still planned, rebuild it against the current action and movement seams rather than restoring these files.
- **Schema.**
  - 69 unused lazy schemas.
  - 9 unused operational collection-record schemas.
  - `campaignInventoryPurge`.
  - The unused `accept`/`decline`/`revokeCampaignInviteInputSchema` aliases.
  - The test-only `mergeCharacterPlayState`: the live merges are `mergeCharacterStatePlay` and `mergeCharacterSheetStatePlay`. `docs/architecture/character.md` is updated to match.
- **Shared.** The authored `alignment` vocabulary module.
- **Convex.** Three functions with zero callers anywhere:
  - `scenes/liveReads:changes`, and its two schemas in `sceneLiveState.ts`;
  - `encounters/pendingReads:forPrepared`;
  - `characters/encounterInitiative:read`. The `loadCharacterEncounterInitiative` helper stays.

  `_generated/api.d.ts` is regenerated against the local Docker backend.

### Recoverable rule logic

An independent audit checked each rules deletion against the backlog. No deleted resolver was reachable: only Flanking, Alternating Diagonals, Disarm, Overrun, Shove Aside, Tumble and Cleaving can be enabled in Campaign settings (`isIntegratedOptionalCombatRule`). The live Disarm, Overrun and Tumble paths use the kept `prepareDnd5e*Contest` functions. The deleted code is a reference for these backlog items, recoverable from `437b2dd15`:

- **MOVE-2.3, 2.4 (Shove Aside).** `resolveDnd5eShoveAside` in `systems/dnd5e/optionalMovementPolicy.ts` holds the rule checks (size within one category, incapacitated target loses, exactly 5 ft, within reach). It was a post-roll resolver with no prepare half, so the PBI rebuilds it on the prepare → contest → execution path that Overrun and Tumble use.
- **SPELLS-8 (cast in an Encounter).** `compileCharacterSpellCastEntryPoints` in `encounterActionEntryPointCompiler.ts` covered single-effect, single-mechanic spells only.
- **VTT_UI-1.3, 2.1 (Facing, Mark, Climb, Hitting Cover, Injuries, Massive Damage, Morale).** These rules cannot be enabled, and the ledger items cover presentation only. The resolvers were in `facingPolicy.ts`, `optionalActionPolicy.ts` and `optionalResolutionPolicy.ts`; marks are to be rebuilt on the active-effect lifecycle (`docs/architecture/dnd5e-optional-combat.md`).
- **ENCOUNTER-4 (Speed Factor).** `encounterInitiativeTerminalSettlement.ts` was an unwired settlement guard.

The unexported `resolveDnd5eMorale` and its trigger-scope helper, which only referenced each other, are removed with the rest.

## Kept on purpose (tool false positives)

- **Convention entry points:**
  - `apps/web/src/client.tsx` and `instrument.client.ts` (which still reach `initializeClientSentry`);
  - `public/zod-csp-bootstrap.js`, `playwright.config.ts` and `deployedEnvironmentGuard.d.mts`;
  - `tests/mvp-audit/create-auth-state.mjs`, the react-email preview `authEmail.tsx`, and `packages/schema/generateZod.ts`.
- **`apps/web/src/css/layers.css.ts`.** The layer declarations set the cascade order.
- **Code used by stories.** Story usage counts as usage, for example `data/encounters/summaries.ts` and `auth/components/index.ts`.
- **Types re-exported for declaration emit** (TS4023/TS4058):
  - `Dnd5eOptionalCombatActionSelectionDescriptor`;
  - `EncounterFeatureActionDiscovery`;
  - `EvaluatedLegendaryActionCandidate`;
  - `EncounterSceneGridPolicyRegistry`.
- **`canUseGuidedSpellAuthoring`.** It is only called by tests, but those tests are the only coverage of the guided-spell accept/reject rules that `rehydrateGuidedSpell` uses live.
- **`hasAuthoringDefaultKind`.** The authoring default inventory guard test depends on it.

## Unproven suspects (not deleted; owner decision needed)

1. **Convex public functions called only by tests.** These back documented or planned surfaces, or are test oracles. They are listed in `local-validation/dead-code/convex-unref.tsv`; the main ones are:
   - `characters/sheet:get` (62 test uses), `campaigns/characterSheet:get` and `content/drafts:get`;
   - `campaigns/ownership:request`/`accept`, `campaigns/gmReads:*` and `campaigns/gmWrites:*`;
   - `scenes/liveReads:header`/`entities` and `scenes/transientFogReads:layers`/`chunks`;
   - `social/listingDrafts:*` and `imports/jobs:cancel`/`list`;
   - `campaigns/vehicles:update`/`remove`, `encounters/blueprints:update` and `scenes/definitions:remove`;
   - `campaigns/events:list`, `campaigns/sessions:latestOpen`, `content/catalogue:counts` and `campaigns/copy:copy`;
   - `liveSessions/authority:claim`/`commitActivation`/`advancePersisted`.
2. **Operator, CLI and lifecycle functions** with no code caller by design: `accountEntitlements:setTier`, `authAdmin:setRole`, `authInvitationsCli:invite`, the `auth:onCreate`/`onUpdate` triggers, the `*Backfill`/`backfill` functions, and every `development*` fixture function. Keep them.
3. **Shared VTT and rules functions used only by tests.** They may be test oracles or planned wiring:
   - `measureSceneMovementCost` and `unionScenePolygons`;
   - the `optionalCombatGeometry` facing, shove and cover helpers;
   - `deriveSceneCommandExplorationDeltas`;
   - `replaySceneEvents` and `sceneDeltaConflictKeys`;
   - `createDnd5eConcentrationCheckDefinition`.
4. **Development-only schema types used only by tests** (`DevelopmentCheckpoint*`, `DevelopmentReceiptLedger*`, `LiveRoomDefinition`). Kept as contract types.
5. **Unused dependencies.** Left in place so `yarn.lock` does not conflict with the active branch:
   - web: `@tiptap/extension-table-row`, `@vanilla-extract/recipes`, `@vanilla-extract/sprinkles`;
   - root: `@chromatic-com/storybook`, `@typescript/analyze-trace`;
   - emails: `@react-email/ui`;
   - schema: `ts-to-zod`;
   - shared: `zod`.

## Validation

All runs used the local machine only, under `local-validation/.validation.lock`.

- **`yarn format` and `yarn lint`** (oxlint `--deny-warnings` plus `lint:schemas`): pass.
- **Typecheck:** `turbo run typecheck --filter="...[codex/phase-08-2-convex-cutover]" --concurrency=1 --env-mode=loose` with `GOMAXPROCS=2`. All 10 affected packages pass. `session-worker` needs generated `src/worker-configuration.d.ts`. That file is gitignored and depends on local dev vars, so the worktree used the main checkout's generated copy. With it, both `tsc` projects pass.
- **Tests:**

| Package | Result |
| --- | --- |
| schema | 500/500 |
| shared | 279/279 |
| source-data | 25/25 |
| authoring | 15/15 |
| rules-runtime | 541/541 (after rebuild) |
| encounter-persistence | 68/68 |
| session-worker | 394/394 |
| apis `test:convex` | 2135/2137; the 2 failures are the same pre-existing stale snapshot (see below) |
| web | 1640/1640 |

- **Convex codegen** against `http://127.0.0.1:3210` (local Docker): pass. `api.d.ts` drops only the three deleted functions; most of the 4,441 removed lines are `encounterInitiative:read`'s return validator. `apis` and `web` typecheck again against the new bindings: pass.

### Pre-existing failure, not caused by this sweep

`encounterProjectionParity.test.ts` and `encounterStoreConformance.test.ts` both fail the case "applies an action mechanics batch to a Creature". The cause is a stale snapshot:

- The received projection now carries `saveProficiencyBonuses: {}` on the Creature's rule facts.
- That field was added in SPELLS-9 (`36cbc764a`), and neither `.snap` file contains it.
- This branch's diff never mentions `saveProficiencyBonuses`.

The SPELLS-9 owner should update the snapshot on `codex/phase-08-2-convex-cutover`. It was left untouched here.
