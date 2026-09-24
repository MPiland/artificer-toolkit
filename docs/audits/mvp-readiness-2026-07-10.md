# MVP readiness audit — 2026-07-10

> Superseded as the current release decision by [`mvp-acceptance-ledger-2026-07-13.md`](mvp-acceptance-ledger-2026-07-13.md). This file remains a historical audit snapshot; its `packages/functions`, `packages/db`, and Supabase paths are retired.

## Decision

The character Builder and Sheet are not ready to call complete. The existing test surface is healthy, but the audit found four implementation seams that can explain slow Sheet updates and incomplete character data. Browser timing evidence is not yet available because the authenticated Builder route fails before the authoring canvas mounts.

This report is an audit snapshot. It intentionally does not change product behavior.

## Scope and method

- Character Builder create/edit and character Sheet play-state usage.
- Eight authored root domains: background, class, creature, equipment, feat, race, spell, and vehicle.
- Persistence round-trips, resolver/orchestrator seams, API/query invalidation, and future campaign/encounter compatibility.
- Disposable local runtime only; no remote data was used.

The audit added isolated, repeatable checks rather than broad production instrumentation:

- `packages/db/src/__tests__/mvp-authored-domain-roundtrip.test.ts`
- `packages/functions/src/services/character/mvp-character-completeness.test.ts`
- `packages/functions/src/services/character/mvp-sheet-command-audit.test.ts`
- `apps/web/tests/mvp-audit/`
- `apps/web/playwright.mvp-audit.config.ts`

The Playwright project is deliberately outside the default end-to-end directory. It accepts `MVP_AUDIT_STORAGE_STATE`, `MVP_AUDIT_BUILDER_PATH`, and `MVP_AUDIT_CHARACTER_PATH`, and captures request durations for later baseline budgets.

## Evidence

| Check                                      | Result                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Focused character web tests                | 71/71 passed across 5 files                                                                  |
| Authoring test task                        | 58/58 passed across 5 files                                                                  |
| Existing character service/API/DB seam set | 105 passed, 1 existing Sheet execution test timed out at its 5s limit                        |
| New authored-domain audit                  | 4/4 passed                                                                                   |
| New character audit                        | 5 passed, 3 expected failures                                                                |
| Functions service typecheck                | Passed                                                                                       |
| Web config typecheck                       | Passed                                                                                       |
| Playwright discovery                       | 4 tests discovered in 2 files and 2 projects                                                 |
| Browser runtime                            | Chromium installed; authenticated Builder run reached the app but failed on route validation |
| Local data runtime                         | Docker/Supabase ready; database, auth, REST, realtime, and storage containers healthy        |

The runtime audit reached the authenticated app with the seeded local owner. Navigating to /characters/new produced Validation failed and a route-match warning for /\_authed/characters/new/characters/new; the authoring canvas never mounted. This is a real Builder route/loader defect, not an environment skip. No latency target is marked as passed. The Sheet flow still needs a finalized character path.

## Findings

### P0 — Sheet commands rebuild the entire character aggregate

`executeCharacterSheetCommand` in `packages/functions/src/services/character/sheetService.ts:1941-1993` hydrates the character, resolves the full Builder model, builds a full Sheet response, applies one command, performs replacement `upsertAuthored`, rehydrates, resolves again, and builds the Sheet again. Character hydration currently fans out across roughly forty child queries in `packages/db/src/domains/subjects/repositories/character.ts:350-471`.

This is the strongest explanation for a simple HP or notes command taking tens of seconds under a cold or busy local database. The future-safe shape is a focused, atomic play-state write with stream-version checking and a small response patch; Builder replacement writes can remain separate.

### P0 — Engine input drops resolved character data

`createCharacterEngineInput` currently sends empty `feats`, `races`, and `spells` registries and `snapshot.hitpoints: []` (`sheetService.ts:542-588`) even when the Builder resolution contains those values. At the time of this superseded audit, the completeness test recorded this as an expected failure. A Sheet can therefore be structurally responsive while displaying incomplete derived data.

### P0 — Creature node-map values do not match authored DTO values

Creature primitive arrays are represented by the node map as `{ value: string }[]` rows while the authored DTO and form values remain `string[]`. The audit test records the mismatch. Affected fields include tags, senses, logistics notes, lair regional effects, and NPC bonds/flaws/ideals/personality traits. Vehicle has the adapter pattern that Creature is missing.

### P1 — Builder resolution is broad and repeated

`loadCharacterBuilderResolutionRegistry` loads broad catalogs through repository `findAll` calls (`builderService.ts:967-1055`), then can reload spells/features after the first registry load. The repositories hydrate records individually, creating an N+1 risk. The Builder renderer watches the entire form value and invokes `onResolve` after a 450ms debounce (`CharacterBuilderRenderer.tsx:39-81`), including changes that do not affect structural resolution. Requests are not cancelled; stale responses are only ignored.

### P1 — Sheet commands are not retry-idempotent and notes ownership is wrong

The command audit shows optimistic stream-version rejection works for concurrent commands, but a retry with a refreshed version applies the same command twice because there is no durable `commandId` deduplication. `UPDATE_NOTES` currently mutates Builder-owned description/profile/backstory/notes (`sheetService.ts:1823-1834`). The intended boundary is Builder-owned profile content plus a separate Sheet play-notes stream.

### P1 — Cache and authorization seams need explicit contracts

The frontend waits for the Sheet mutation before updating its cache, then invalidates detail/list queries. The character public-id/subject-id aliases create a risk that one cache key is updated while another remains stale. Authorization is currently owner-only in the character path. Campaign sharing and DM/player roles should be introduced at the API/orchestration policy seam, not embedded in persistence or Sheet mutation code.

## Authored-domain status

The eight root domains have the expected structural slices (schema, authored model/compiler, node map, repository/upsert, list/detail/edit surfaces, and API CRUD/draft/activate flows). Nested features, grants, effects, facets, charges, and starting-equipment groups remain parent-owned and should not become separate Library domains.

- **Ready for deeper proof:** background, equipment, feat, race, spell, vehicle.
- **Needs round-trip breadth:** class subclass attributes/specializations; the audit now covers the persistence seam but not every UI path.
- **Blocked:** creature primitive-array adapter mismatch.
- **Explicitly future-facing:** creature combat semantics and encounter behavior.

## Remediation order

1. Complete engine-input assembly and add a non-regression test that asserts race, feat, spell, and hitpoint data reach the engine.
2. Add the Creature row/string adapter and real draft-save/activate round-trip coverage for nested primitive arrays.
3. Split Sheet play-state commands from Builder aggregate writes; make HP/resources/notes atomic and stream-versioned.
4. Persist and enforce `commandId` idempotency before adding optimistic client retries.
5. Batch or cache Builder registries, avoid duplicate catalog loads, and cancel/coalesce superseded structural resolves.
6. Separate Sheet play notes from Builder profile content and normalize public-id/subject-id query keys.
7. After the MVP is stable, add campaign membership/sharing policy and then encounter state (initiative, rounds, HP/resources) on the same actor/command/event seam.

## Runtime follow-up after route fix

Install the repository’s pinned Playwright browser and bring the local Supabase/Docker stack to a ready state, then run:

```text
yarn workspace @artificer-toolkit/web test:e2e:mvp-audit --project=mvp-audit
```

Chromium and the local Docker/Supabase stack are now ready. After fixing the Builder route validation failure and supplying a finalized character path, rerun the audit and record p50/p95 route load, Builder resolve, Sheet command, and mutation-to-visible-update timings before changing performance code.

The authenticated Builder run is intentionally retained as a failing audit signal until that route/loader defect is fixed.
