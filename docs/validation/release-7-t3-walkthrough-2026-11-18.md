# RELEASE-7.T3 walkthrough note (2026-11-18)

Guide: [alpha-play-guide.md](../guides/alpha-play-guide.md). Build identity checked: phase-branch commit `7082947b29de1a2b336ccd6b4c9ccb4857a92035` (code and tests only; no running build was available, see below).

## Status: partial

The app walk was blocked. The local stack (Convex container, Session Worker, web) was not running, Docker Desktop was off, and a worktree has neither the gitignored `apps/session-worker/.dev.vars` nor `local-validation/local-convex/local.application.env` that `scripts/seedReviewData.mjs` and the Session Worker need. Copying those files would copy secrets, so the walk stops here. Only the former "Still in progress" block was checked, by finding merged code and tests. Every other guide statement is **could not verify (no running build)** and needs a walk from a session whose checkout holds the local environment files.

## Statements checked

| Statement (old text)                                                   | Outcome                                                                                                                                      | Evidence                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sheet picker for ending one of two held Concentrations is not finished | Corrected: shipped                                                                                                                           | SPELLS-12.T4b (`c7525f85b`); `CharacterSheetOverviewStatusStrip.tsx:202` renders `End Concentration: <label>`; test "lists each held Concentration and ends the one the player picks" in `CharacterSheetStatus.test.tsx` |
| Subtle, Careful, Sculpt, Heightened available                          | Corrected: Sculpt is not Metamagic (Wizard Evocation "Sculpt Spells", unrelated); the SRD Sorcerer has eight options                         | `packages/source-data/src/srd/classes/sorcerer.ts:719-950`                                                                                                                                                               |
| Twinned not yet available                                              | Corrected: shipped as generic `EXTRA_TARGET` cast modifier                                                                                   | `06b7b52f7` (SPELLS-31.T5g3); offered only for one-creature spells at `characterSpellCastActions.ts:336`; `characterCastModifiers.test.ts:51`                                                                            |
| Distant not yet available                                              | Corrected: shipped as a `RANGE` cast-modifier parameter                                                                                      | `362fba89b` (SPELLS-31.T5h-1); `characterSpellCastActions.ts:323`                                                                                                                                                        |
| Extended not yet available                                             | Corrected: shipped as a `DURATION` parameter                                                                                                 | `characterSpellCastActions.ts:326`; `characterCastModifiers.test.ts:523`                                                                                                                                                 |
| Quickened not yet available                                            | Corrected: shipped as an `ACTIVATION` parameter (bonus action)                                                                               | `characterSpellCastActions.ts:324`; `characterCastModifiers.test.ts:185`                                                                                                                                                 |
| Empowered not yet available                                            | Corrected: shipped as a damage-reroll window                                                                                                 | `88cc557eb` (SPELLS-31.T5e2a, D208); `characterSpellCastActions.ts:301`                                                                                                                                                  |
| Overchannel not yet available                                          | Corrected: not a Sorcerer option; Wizard Evocation Overchannel is a GM-ruling effect                                                         | `school-of-evocation.ts:176-198`; `362fba89b` message                                                                                                                                                                    |
| Once-per-dawn uses not finished                                        | Corrected: shipped. The extra Concentration spends one use of the item's dawn charge; with no uses left a new Concentration replaces the old | `c9c7378dd` (SPELLS-12.T2b); `encounterActionMaintenance.ts:166-178`; `nativeRoomConcentrationGate.test.ts:155-170`. Inspector shows "Resets: Dawn" (`CharacterSheetInspector.test.tsx:1049`)                            |
| Some advantage rules on second Concentrations not finished             | Corrected: shipped                                                                                                                           | SPELLS-12.T3b (`98802a74a`); `concentrationSaveRing.test.ts` (ring advantage and disadvantage on the save)                                                                                                               |
| Replacing a held Haste can fail                                        | Corrected: covered and passing in tests                                                                                                      | `nativeRoomConcentrationGate.test.ts:128`; `encounterEffectOnEnd.test.ts` (lethargy)                                                                                                                                     |

Known gap carried in `docs/validation/uat/SPELLS/UAT-SPELLS-17.md` (S1) still says the Sheet picker and once-per-dawn counter display are unfinished; that scenario text is now stale (not edited here; UAT scenarios are owned separately).

## Counts (part 1)

Checked 11, matched 0, corrected 11, could not verify: all other statements in the guide (about 100; no running build).

## Part 2: walk against the running local build (2026-11-18)

Build walked: phase-branch commit `e36dc12674891a2815abf170ffe4eb9ef7722a0b` (detached HEAD, main checkout). Stack: local Docker Convex container, Session Worker on 8787, web on 3000, review data set 0 (Party in the Field). Walked as the seeded GM (`Review_Gm_Rowan`) in the built-in browser. Player accounts were not signed in; player-only statements were checked against code.

### Per-section outcome

| Guide section / statement                                                                          | Outcome                                                                                                                                   | Evidence                                                                                                    |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Joining: Open tabletop window in Live tabletop panel                                               | PASS                                                                                                                                      | Session page, walked                                                                                        |
| Joining: GM badge, "Live editing available", Auto-roll switch                                      | PASS                                                                                                                                      | Tabletop header, walked                                                                                     |
| Joining: players see "Play view"; "The GM has not presented a scene yet."; Main Character selector | PASS (code only)                                                                                                                          | `CampaignTabletopWindow.tsx:62`, `CampaignVttStage.tsx:1339`, `CampaignTabletopPlayerHeaderControls.tsx:34` |
| Auto-roll preference (Settings > Preferences "Roll my dice automatically", starts on)              | PASS                                                                                                                                      | Walked; default `autoRollDice: true` in `authTriggers.helper.ts:42` (review accounts are seeded off)        |
| Manual/Assisted setting under Campaign Table tab; ammunition off by default; cover on by default   | PASS                                                                                                                                      | Walked in Table settings                                                                                    |
| Automatic cover source                                                                             | CORRECTED: "walls on the Scene" -> "walls and creatures on the Scene, and total cover blocks the target"                                  | Table settings text                                                                                         |
| Reactions: "There is no timer"                                                                     | CORRECTED -> declines itself after "Reaction time (seconds)" (default 5, 3 to 15) and at once if the player is marked away                | Table settings; `pendingReads.ts:121-142`; countdown not exercised live                                     |
| Live maps: upload limits, units, calibrate                                                         | CORRECTED: added "64 megapixels", "Calibrate on map", unit labels Feet / Meters / Squares                                                 | Prepare view, `CampaignScenePreparation.tsx`                                                                |
| Present a scene, Show to players, Undo last token move                                             | PASS                                                                                                                                      | Walked                                                                                                      |
| GM turn controls                                                                                   | CORRECTED: Undo last action and Complete encounter are in the session page's Encounter actions menu, not the tabletop; Players away added | Walked                                                                                                      |
| Undo last action location                                                                          | CORRECTED to match                                                                                                                        | Walked                                                                                                      |
| Roll visibility label                                                                              | CORRECTED (minor): GM manual roller says "Roll to" (Public / Private)                                                                     | Walked                                                                                                      |

### Could not verify (no running exercise)

- Player views, roll prompts and the player roll destinations (Table / To GM / Just me): not signed in as a player; labels exist in code only.
- Token movement rules, opportunity attacks, Pending decision wording, doors: needs an active Encounter with live play.
- Assisted warnings and Do it anyway, initiative rules, saves, legendary actions: live Encounter needed.
- Spell statements, Concentration, Metamagic, items: covered by part 1 code checks, not exercised.
- Reaction countdown timing, reconnect behavior, five-minute room close, removal from room: time and multi-client dependent.
- Wall types, fog options, hidden tokens: not exercised.
- Undo refusal cases, public and private reveal buttons: labels "My rolls", "Enemy rolls", "Show roll", "Show that I rolled" exist in code only.
- All Known gaps statements: not exercised.

### Tooling bug found and fixed

`scripts/resetLocalConvex.ps1`: the `-Tables` parameter collided with a local `$tables` (PowerShell names are case-insensitive), so a reset planned 0 tables and reported success while leaving data. The local was renamed `$planned`. Local dev tooling only.

### Counts (part 2)

PASS 7 (2 of them by code only), CORRECTED 6, BUG 0, could not verify: the groups listed above.
