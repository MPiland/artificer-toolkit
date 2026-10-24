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
