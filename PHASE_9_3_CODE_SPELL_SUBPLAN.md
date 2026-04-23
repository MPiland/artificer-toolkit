# Phase 9.3 - Code: Spell Form

## Status: Not Started (blocked on PHASE_8_3_FIGMA_SPELL_SUBPLAN.md approval)

## Prerequisite

All approved spell screens in [PHASE_8_3_FIGMA_SPELL_SUBPLAN.md](PHASE_8_3_FIGMA_SPELL_SUBPLAN.md) must be treated as the frontend source of truth before coding begins.

## Figma Reference

- [App Design v2](https://www.figma.com/design/go78XTRyvTifjh2HsA14qv/App-Design-v2)

---

## File Structure

```
apps/web/src/domains/spells/
  form/
    SpellForm.tsx                           # parent form, 3-step definition
    steps/
      Basics.tsx                            # Step 1: name, level, school, classes, description
      CastingAndTraits.tsx                  # Step 2: castingTime, attributes, components
      Effects.tsx                           # Step 3: capability summary list + add/edit
    effects/
      EffectEditor.tsx                      # full-view editor shell (chrome + rail + section router)
      EffectEditorRail.tsx                  # sticky left navigation rail
      EffectEditorSetup.tsx                 # Setup section (invocation fields)
      EffectEditorOutcomePaths.tsx          # Outcome Paths section (branch fields)
      CapabilitySummaryCard.tsx             # compact card used in Effects step list
      paths/
        DirectPath.tsx                      # direct resolution: duration, lifecycle, outcomes list
        RollTablePath.tsx                   # roll table: die config, kind, rows
      outcomes/
        OutcomeEditor.tsx                   # container: type picker + delegates to type components
        DamageOutcome.tsx
        HealOutcome.tsx
        ConditionOutcome.tsx
        ApplyGrantOutcome.tsx
        ForcedMovementOutcome.tsx
        TeleportOutcome.tsx
        ManifestOutcome.tsx                 # includes nested capabilities mini-list
        RuleOutcome.tsx
        scaling/
          ScalingBreakpointRow.tsx          # shared: level + value row (reused by Damage + Heal)
          ScalingBreakpointTable.tsx        # collapsible list of ScalingBreakpointRow
```

---

## Store / State Changes Required

The existing form store (`useFormStore`, `useTypedFormStore`) manages `editing` meta with indices for features, options, ancestry options, and similar nested builders. The following additions are needed:

```typescript
// apps/web/src/store/formStore.ts
editing: {
  featureIndex: number | null
  sectionIndex: number | null
  optionIndex: number | null
  ancestryOptionIndex: number | null
  capabilityIndex: number | null
  manifestCapabilityIndex: number | null
}
```

The header should hide the stepper whenever the full effect editor is active.

---

## API Wiring

### Spell CRUD

| Operation | Method | Route | Schema |
|---|---|---|---|
| List spells | GET | `/spells` | `SpellListDto[]` |
| Get spell | GET | `/spells/:id` | `SpellDto` |
| Create spell | POST | `/spells` | `spellAuthoredDtoSchema` |
| Update spell | PUT | `/spells/:id` | `spellAuthoredDtoSchema` |

### Reference data needed in forms

| Data | Source | Used in |
|---|---|---|
| Magic schools | system data | Step 1: School dropdown |
| Classes | `GET /classes` | Step 1: Classes multiselect |
| Damage types | system data | Damage outcome |
| Conditions | system data | Condition outcome |
| Creatures | `GET /creatures` | Manifest outcome creature picker |
| Abilities | system data | Saving throw, damage bonuses |
| Skills | system data | Damage bonuses |
| Measurement units | system data | Range, shape measurements |

---

## Implementation Steps

### Phase A - Foundation

- [ ] Audit `SpellInput` / `SpellAuthored` alignment and remove legacy spell-form assumptions.
- [ ] Confirm capability DTO coverage for the full effect-editor surface.
- [ ] Add `capabilityIndex` and `manifestCapabilityIndex` to editing meta.
- [ ] Hide the stepper while the full effect editor is active.

### Phase B - Parent Spell Form

- [ ] Replace legacy spell steps with `Basics`, `CastingAndTraits`, and `Effects`.
- [ ] Align these steps to the approved Phase 8 spell screens.
- [ ] Keep the form typed directly to `SpellAuthored`.

### Phase C - Capability Summary

- [ ] Build the capability summary list used by the `Effects` step.
- [ ] Support add, edit, remove, and reorder.

### Phase D - Effect Editor Shell

- [ ] Build the full editor shell with rail, section navigation, and save/cancel controls.
- [ ] Support setup plus path-specific editing states.

### Phase E - Outcomes

- [ ] Implement all outcome editors required by the effect model.
- [ ] Keep scaling and nested manifest behaviors aligned to the approved effect-editor design.

### Phase F - Save / Load Wiring

- [ ] Save full capability arrays through spell create/update.
- [ ] Load existing spells back into the spell form and effect editor correctly.
- [ ] Invalidate caches after create/update.

### Phase G - Polish

- [ ] Mobile layout at 375px matches the approved Figma screens.
- [ ] Validation and empty states match the Figma behavior.
- [ ] Reorder and nested manifest editing flows are stable.

---

## Exit Criteria

- [ ] A spell can be created and edited using the approved three-step form.
- [ ] Effects can be added, edited, removed, and reordered.
- [ ] Saving-throw, attack, sequential, roll-table, and manifest flows all behave correctly.
- [ ] The spell form no longer depends on stale pre-checkpoint planning language.
