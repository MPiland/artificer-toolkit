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
