# Slice SPELLS-7: area actions (T1: half damage on a made save)

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Resume here

- T1 (closes AC SPELLS-7.2's data gap) is built on `ci/spells-7-t1`. CI SHA and run ids go to the orchestrator.

## T1: save-for-half SRD spells

Bug (found by ATTACK-2.T2): SRD spells whose text gives half damage on a successful save encoded only `ON_SAVE_FAIL` damage, so a made save took none.

- Regression test: `packages/source-data/src/srd/saveForHalfDamage.test.ts` walks every SRD spell whose text says save-for-half. Every `paths` group, at any depth (zone interactions included), that carries failed-save damage must carry an `ON_SAVE_SUCCESS` damage outcome for each one, halved (`amountKind: HALF`, or `multiplier: 0.5` as Sunburst authors it) and rolling the same dice, damage type and scaling rows. Spells whose damage is not authored at all sit in an exact `DAMAGE_NOT_AUTHORED` list and must carry no failed-save damage, so a spell leaves the list the moment its damage is authored. Before the fix it failed on Chain Lightning, Ice Storm and Thunderwave.
- Data fixed (authored like Fireball and Flame Strike, `amountKind: HALF` on the failure's dice):
  - Thunderwave: `ON_SAVE_SUCCESS` half of the cast-level 2d8–10d8 rows.
  - Ice Storm: two `ON_SAVE_SUCCESS` paths, half 2d8 bludgeoning and half 4d6 cold.
  - Chain Lightning (not in the ledger's 19; the walker found it): its success path rolled a separate 5d8 instead of halving the 10d8 that was rolled. Now half of the same 10d8. The Chain Lightning room test (`apps/session-worker/test/nativeRoomChosenActorsSpell.test.ts`) keeps its numbers (all-6 dice: 60 and 30); only its comment changed.
- Resolution proof: `packages/rules-runtime/src/__tests__/encounterAreaActionExecution.test.ts` "gives a creature that makes its Thunderwave save half the thunder damage" runs SRD Thunderwave through the real area preparation, saves and settlement: one 2d8 roll of 10, the failing foe takes 10, the saving ally 5. The Fireball fixture builder became `srdSaveSpell(label, baseLevel)` so both spells use the same SRD-to-Creature-Feature conversion.
- `semantic-ledger.json` `authoredSha256` is not verified by any code, so it was not regenerated (as in SPELLS-20).

### Not fixed: damage not authored (17 of the ledger's 19, plus Control Water)

None of these carries a damage effect to halve, so the half path cannot be added without authoring the whole damage mechanic first. Each is in `DAMAGE_NOT_AUTHORED` with its reason.

| Spell                                                                                                                                                                  | Reason                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Delayed Blast Fireball, Earthquake, Glyph of Warding, Guardian of Faith, Incendiary Cloud, Moonbeam, Storm of Vengeance, Sunbeam, Symbol, Wall of Fire, Wall of Thorns | `CLOSED_RULE`                                                                                               |
| Cloudkill, Insect Plague, Wall of Ice, Wind Wall                                                                                                                       | `ZONE` manifest with no interactions (zone damage authoring, through SPELLS-20.T4a's zone half-damage path) |
| Call Lightning, Flaming Sphere, Control Water                                                                                                                          | `MANUAL_ADJUDICATION`                                                                                       |

### Findings for the orchestrator

- Ice Storm's "bludgeoning damage increases by 1d8 for each slot level above 4th" is not authored (fixed 2d8 on both paths). Not in T1's scope.
- Ice Storm's second failure path reuses the save's id (`spellChildId(ICE_STORM, 0x214, 1)` for both `savingThrow.id` and the cold path). The new success paths use scope `0x215`. Not changed here.
