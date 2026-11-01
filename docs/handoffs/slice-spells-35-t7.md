# SPELLS-35.T7: multi-creature Conjure group token

Closes SPELLS-35 AC .6 (D200). Conjure Animals, Conjure Minor Elementals and Conjure Woodland Beings are `SUMMON`
manifests with one form per System Creature of challenge rating 2 or lower (83 beasts, 7 elementals, 5 fey), on the
SPELLS-34 form path. No spell is named in code.

- **Stored shape (reseed needed):** `owner.count` on the Run actor (`encounterActorOwnerDtoSchema`) and `form.count` on
  a Sheet summon (`characterState`). Both are optional; pre-launch data without them is valid, but a reseed is needed for
  the three Conjure spells' new authored forms.
- **Contract:** `count` in `summonPicksShape` (room cast target and Sheet `CAST_SPELL`), `maxCount` in
  `summonPickOptions`, `summonPlacement.forms[].maxTargets`, `UPDATE_ACTOR.groupCount` (1 to `MAX_GROUP_COUNT` = 32).
- **Attacks:** the multiplier is `owner.count` in `encounterAttackAction.ts` (`anyAttackSlots`), chunked into slots of at
  most `MAX_ATTACK_SLOT_COUNT`.
- **Undo:** undoing an attack returns its slot and leaves the count; the GM count edit is not undoable.
- **Token:** the web shows a `GROUP` status badge from `owner.count`.
- **Known limits (deferred edge cases):** no upcast multiplier (the GM raises the count after the cast); the Sheet's
  Extras list shows no count.
