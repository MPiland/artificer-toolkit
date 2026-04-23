# Phase 9.3 — Code: Spell Form

## Status: Not Started (blocked on PHASE_8_2_FIGMA_SPELL_SUBPLAN.md approval)

## Prerequisite

All 14 Figma screens in [PHASE_8_2_FIGMA_SPELL_SUBPLAN.md](PHASE_8_2_FIGMA_SPELL_SUBPLAN.md) must be reviewed and approved before coding begins.

## Figma reference

_Link to approved Figma file to be added here once Phase 8.2 is approved._

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

The existing form store (`useFormStore`, `useTypedFormStore`) manages `editing` meta with indices for features, options, ancestry options, etc. The following additions are needed:

```typescript
// apps/web/src/store/formStore.ts
// Add to editing meta:
editing: {
  featureIndex: number | null         // existing
  sectionIndex: number | null         // existing
  optionIndex: number | null          // existing
  ancestryOptionIndex: number | null  // existing
  capabilityIndex: number | null      // NEW — which capability is being edited in EffectEditor
  manifestCapabilityIndex: number | null  // NEW — nested capability within a Manifest outcome
}
```

The `<Header>` component already checks `steps.length > 1` to render `<Stepper>`. It must additionally check `capabilityIndex !== null` and hide the `<Stepper>` when the Effect Editor is active.

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

### Phase A — Foundation

- [ ] A1. Audit `SpellInput` / `SpellAuthored` alignment — confirm form store type uses `SpellAuthored` directly (no legacy fields: duration, range, shape, damage, upcast at spell level).
- [ ] A2. Confirm `capabilityAuthoredDtoSchema` exists in `packages/schema` and covers all 8 `OutcomeAuthored` types.
- [ ] A3. Add `capabilityIndex: number | null` and `manifestCapabilityIndex: number | null` to `editing` meta in `formStore.ts`.
- [ ] A4. Update `<Header>` to hide `<Stepper>` when `capabilityIndex !== null`.

### Phase B — Parent Spell Form

- [ ] B1. Archive legacy `steps/Attributes.tsx` (legacy step with incorrect spell-level fields).
- [ ] B2. Create `Basics.tsx` — Step 1: label, level, magicSchoolId, classIds, description.
- [ ] B3. Create `CastingAndTraits.tsx` — Step 2: castingTime (unit + amount), attributes multiselect, components multiselect, materialDescription conditional on MATERIAL.
- [ ] B4. Create `Effects.tsx` — Step 3: empty state + populated summary card list.
- [ ] B5. Update `SpellForm.tsx` to define 3 steps: basics / casting / effects, typed to `SpellAuthored`.

### Phase C — Capability Summary Card

- [ ] C1. Create `CapabilitySummaryCard.tsx`: trigger label, path summaries, outcome counts, Edit / Remove / drag-handle affordances.
- [ ] C2. Wire drag-and-drop reorder in `Effects.tsx` using `@dnd-kit`.
- [ ] C3. Wire "Add Effect" to set `capabilityIndex` to a new empty capability.

### Phase D — Effect Editor Shell

- [ ] D1. Create `EffectEditor.tsx`: renders when `capabilityIndex !== null`, breadcrumb, close button, rail, content area, sticky Save / Cancel footer.
- [ ] D2. Create `EffectEditorRail.tsx`: Setup item + Outcome Paths header + trigger-derived path items.

### Phase E — Setup Section

- [ ] E1. Create `EffectEditorSetup.tsx`: trigger, activation, range (with DISTANCE conditional), shape (with type-specific measurement pairs), targeting, saving throw conditional section.
- [ ] E2. Trigger change re-derives path items in rail.

### Phase F — Outcome Paths Section

- [ ] F1. Create `EffectEditorOutcomePaths.tsx`: per-path shared fields (groupType, originKind, rangeOverride, targetingOverride, resolutionKind toggle).
- [ ] F2. Create `DirectPath.tsx`: duration, lifecycle (collapsible), outcomes list.
- [ ] F3. Create `RollTablePath.tsx`: dieConfig, rollTableKind toggle, row list (Range/Exact).
- [ ] F4. SEQUENTIAL path: visible outcome ordering + reorder affordances.

### Phase G — Outcomes Editor

- [ ] G1. Create `OutcomeEditor.tsx`: type picker dropdown, delegates to type components.
- [ ] G2. Create `DamageOutcome.tsx`: damageTypeId, valueKind, value, multiplier, amountKind, bonuses.
- [ ] G3. Create `ScalingBreakpointTable.tsx` + `ScalingBreakpointRow.tsx`: explicit per-level breakpoint rows.
- [ ] G4. Wire scaling into `DamageOutcome.tsx` and `HealOutcome.tsx`.
- [ ] G5. Create `HealOutcome.tsx`: temporary, valueKind, value, bonuses, scaling.
- [ ] G6. Create `ConditionOutcome.tsx`: conditionId dropdown.
- [ ] G7. Create `ApplyGrantOutcome.tsx`: modifiers / proficiencies / senses / spells collapsible sub-sections.
- [ ] G8. Create `ForcedMovementOutcome.tsx`: direction, actionEconomy, distanceMode, conditional distance.
- [ ] G9. Create `TeleportOutcome.tsx`: targetKind, destinationKind, optional distance.
- [ ] G10. Create `ManifestOutcome.tsx`: manifestKind, shape, creatureId picker, nested capabilities mini-list ("Add Behavior" re-enters editor with `manifestCapabilityIndex`, breadcrumb deepened, MANIFEST excluded).
- [ ] G11. Create `RuleOutcome.tsx`: static informational message only.

### Phase H — Save / Load Wiring

- [ ] H1. "Save Effect" writes capability back to `capabilities[]` at `capabilityIndex` (or appends if new).
- [ ] H2. Validate capability before save (trigger + range required at minimum).
- [ ] H3. "Cancel" resets in-progress edits and clears `capabilityIndex`.
- [ ] H4. Parent form "Submit" includes full `capabilities[]` in payload.
- [ ] H5. Load existing spell: populate `capabilities[]` from API response into form store.

### Phase I — API Integration

- [ ] I1. Confirm `apps/apis` spell routes handle `capabilities[]` in create/update payload.
- [ ] I2. Wire spell list page to API.
- [ ] I3. Wire spell detail page to API.
- [ ] I4. Wire create to `POST /spells`, edit to `PUT /spells/:id`.
- [ ] I5. Invalidate React Query cache on create/update.

### Phase J — Polish

- [ ] J1. Dirty-check guard on Effect Editor close.
- [ ] J2. Empty path state: clean display when a path has no outcomes yet.
- [ ] J3. Capability reorder: write updated `order` values after drag.
- [ ] J4. Outcome reorder in SEQUENTIAL paths.
- [ ] J5. Mobile responsiveness at 375px.
- [ ] J6. Validation error display: field-level in Setup, path-level in Outcome Paths.

---

## Exit Criteria

- [ ] Can create a new spell with 0 capabilities and submit successfully
- [ ] Can add an Effect with trigger + range + at least one branch with one outcome and save it
- [ ] SAVING_THROW trigger: saving throw section appears, ON_SAVE_FAIL + ON_SAVE_SUCCESS in rail
- [ ] Attack trigger: ON_ATTACK + ON_HIT + ON_MISS + ON_CRIT in rail
- [ ] SEQUENTIAL outcomes: ordering and reorder affordances visible
- [ ] Roll table path: die config + rows (Range and Exact) author correctly
- [ ] Manifest outcome: nested behaviors re-enter the editor with deepened breadcrumb, MANIFEST excluded
- [ ] Damage + Heal: per-level scaling breakpoint rows save and load correctly
- [ ] Edit spell: loads existing capabilities from API, re-opens in Effect Editor correctly
- [ ] Mobile (375px) and desktop (1280px) layouts match Figma
