# Slice SPELLS-8.T3 and T4: Spare the Dying and the APPLY_GRANT spells in an Encounter

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T3 closes AC SPELLS-8.2. Spare the Dying is castable in an Encounter. It stabilizes a dying target through the existing STABILIZE executor, and the spell's undead and construct exclusion applies to targets through the shared excluded-creature-type warning.
- T4 closes AC SPELLS-8.3. Every SRD APPLY_GRANT spell (Aid, Darkvision, Fly, Heroism, Longstrider, Protection from Energy, Ray of Frost, Shield, Shield of Faith, Shocking Grasp, Vicious Mockery) applies its grant through casting. Prove it with a corpus test that derives the list from the real compiler, not from an allowlist, plus one journey.

Reuse the Encounter cast path SPELLS-8.T1 built. Author anything that's missing from core options; nothing spell-specific.

## Log

### T3 (AC SPELLS-8.2)

- Spare the Dying's cast already compiles to the STABILIZE executor, so the proof is new tests and no production change. The dying-Character test passed on its first run against unchanged production (no red to show); the proof is `nativeRoomStabilizeAction.test.ts` > "Spare the Dying cast by a Character".
- The cast stabilizes a dying Character through the executor and spends no slot (a cantrip).
- An Undead target warns in the shared order `TARGET_NOT_DYING`, `TARGET_CREATURE_TYPE_EXCLUDED`, then the touch range warning; the table can override all three and the cast then applies nothing (`STABILIZE applied: false`).
- Known limit: a Character target's creature type is not readable, so the type exclusion warns for Creatures only.
- Validation: `nativeRoomStabilizeAction.test.ts` green in the heavy lane (`local-validation/spells-8-t3/green-worker.log`).
- Reviewer (opus, independent): no blockers. Fixed: the Undead test now also asserts the target is unchanged (`after` equals `before`), and the Undead type id is read with a throwing guard instead of `!`. Skipped as low: a Construct example (the exclusion is data, one type proves the gate) and a non-excluded negative case (the shared warning has its own unit tests).
