# Slice RULES-2.T9d, T9e, T9g: System vocabulary leaves the neutral pipeline

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md). ADR 0039 governs this slice. The ledger text of each task is its scope. Run the tasks in this order:

- **RULES-2.T9d:** the illumination codes stay. The System supplies rank, `suppressesLight` and render class, and `sceneCombatPerception` and `vttSceneRenderer` read those properties. The lighting setup stays System-neutral; light-dependent mechanics such as darkvision are System data (user, 2026-10-24).
- **RULES-2.T9e:**
  - Delete the unused SRD enum copy in `shared/vocabulary/authored`.
  - The challenge rating order comes from the System in `encounterFormChoice`.
  - Move the DEXTERITY, CONSTITUTION and WALK literals behind adapters.
  - Web defaults come from the System.
- **RULES-2.T9g:** Pact Magic leaves the neutral character pipeline. The `PACT` slot-key literals become System slot-pool capabilities.

Each task extends the RULES-2.T9o vocabulary boundary guard, so the moved literals cannot come back. The SPELLS sessions edit the same files (`characterSpellCastActions.ts`, `encounterFormChoice.ts`), so merge the phase tip before each push.

## Log

- 2026-10-24, T9d implemented:
  - **Levels:** the combat-perception adapter gained `illuminationLevels`, brightest first, each with code, label, render class (`LIT`/`DIM`/`DARK`) and `suppressesLight`. D&D 5e defines its four levels in `systems/dnd5e/combatPerception.ts`.
  - **Shared resolvers:** `resolveSceneIlluminationAt`, `resolveSceneDaylightAt` and `resolveSceneCombatPerceptionEnvironment` take the levels. `requireSceneIlluminationLevel` fails closed on a code the System lacks.
  - **Worker:** `measureHolderLight` reads the Campaign's System levels.
  - **Web:** the renderer and model read the levels for overlays, outlines, concealment, sense effects and labels; renderer creators pass `gameSystemId`.
  - **Guard:** the T9o guard rejects illumination code comparisons outside `rules-runtime/src/systems/`.
  - **Docs:** `docs/architecture/rules-runtime.md` gained the "Illumination levels" section.
  - **Proof:** `packages/shared/src/__tests__/vtt-scene-combat-perception.test.ts`, `apps/web/src/domains/campaigns/vtt/vttSceneRenderer.model.test.ts` and `packages/rules-runtime/src/__tests__/systemVocabularyBoundary.test.ts`, each using a non-D&D level set.
  - **Left for later (not T9d scope):**
    - `actorSenses.ts` `ILLUMINATION_ACCESS_RANK` and the `SenseDefinitionEditor` access options: illumination access, not levels.
    - The Scene darkness-zone schema's DIM-or-darker enum: a contract, no reseed per the ruling.
- 2026-10-24, T9d review (independent opus): no D&D regression and no weakened assertion. Fixed in a follow-up commit:
  - **Light bands:** a light's radii shed the `BRIGHT` and `DIM` codes they are named for, not "the first level of a render class"; a System lacking one now fails closed. The renderer draws each band at its level's class alpha.
  - **Sight:** a sense's reach carries its access level. Sight reveals a token in darkness only when the System ranks that darkness at or below the access, as the rules engine's access rank does; truesight means access to the darkest level. My own two T9d assertions that pinned the old reading (strict `ORDINARY_DARKNESS` access giving truesight, and not revealing its own level) were replaced with the rank reading; the D&D assertions are unchanged.
  - **dnd5e:** the rank cast became `illuminationValues.indexOf`.
  - **Escalated (D-pending-rules-2-t9-1):** what "bright light" means for Sunlight Sensitivity and daylight. Render class `LIT` today; rank 0 or an explicit level property are the alternatives. `measureHolderLight` keeps its two resolutions until that ruling.
  - **Recorded, not fixed (applies only to Systems other than D&D):** the renderer's darkvision and truesight drawing still composes by `suppressesLight`; the diagnostics keep the `ordinary` and `magical` key names; a Scene code the System lacks throws in the renderer; the level table is not validated (empty, duplicate or out-of-order).
- 2026-10-24, T9e implemented:
  - **Already done before T9e:** T9j deleted the SRD enum copy and moved the challenge rating order to the System. The WALK literal and the web defaults (WALK, EXHAUSTION, FIRE, POISONED) had no production literals left.
  - **Adapter:** `AbilityScoreCapabilityAdapter.derivedStatisticAbilityCodes` names the ability whose modifier armor class, initiative and hit points add. D&D 5e sets DEXTERITY, DEXTERITY and CONSTITUTION.
  - **Readers:** `characterArmorClassRuleFacts`, `characterDerivedRuleFacts` (initiative), `characterHitPointRuleFacts` and `sheetRoll` (the hit die check) read the adapter by the Character's System. The `dexterityAbilityIndex` and `constitutionAbilityIndex` policy-input field names stay; renaming them is a contract change for the T9f ability-record work.
  - **Guard:** the T9o guard rejects comparing any value to an ability or speed code outside `rules-runtime/src/systems/`, whatever the variable is named.
  - **Proof:** `packages/rules-runtime/src/character/derivedStatisticAbilities.test.ts` (real fact builders, plus a second System whose statistics add other abilities) and `packages/rules-runtime/src/__tests__/systemVocabularyBoundary.test.ts`. The `sheetRoll` hit die path keeps its end-to-end proof in `apps/apis/convex/rolls.test.ts`; the guard stops its literal from coming back.
