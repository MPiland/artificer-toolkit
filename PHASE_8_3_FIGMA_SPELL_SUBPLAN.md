# Phase 8.3 — Figma: Spell Form

## Status: Figma In Progress / Code Not Started

## Deliverable

**This plan is Figma only.** Do not write or modify any frontend code as part of this plan. Use `/frontend-design` to push screens into the shared design file. The Figma URL will be recorded below once created.

Frontend implementation is a separate plan that will be written after Figma screens are reviewed and approved.

### Figma file
_URL to be added once file is created._

### Effect Editor screens

Effect Editor screens (Setup, Outcome Paths, all 8 outcome types) are designed in [PHASE_8_1_FIGMA_EFFECT_EDITOR_FLOW.md](PHASE_8_1_FIGMA_EFFECT_EDITOR_FLOW.md). That doc must be complete before designing the Spell screens below.

### Screens to design (Figma)

| # | Screen | Status |
|---|---|---|
| 1 | Spell list page | ⬜ Not started |
| 2 | Spell Form — Step 1: Basics | ⬜ Not started |
| 3 | Spell Form — Step 2: Casting & Traits (with Material Description conditional) | ⬜ Not started |
| 4 | Spell Form — Step 3: Effects (empty state) | ⬜ Not started |
| 5 | Spell Form — Step 3: Effects (1–2 populated capability cards) | ⬜ Not started |

---

## Purpose of This Document

This is the **complete spec for the Spell authoring form** — every step, every screen, every input, and every navigation decision. It covers the full user journey from the spell list to saving a complete spell with capabilities, branches, and outcomes.

This document also establishes the **reusable pattern** for any domain that authors `CapabilityAuthored[]` (Feats, Equipment, Features in later subphases). Other domain plans follow this same structure — one plan per domain, Figma first then code.

Read this before designing Figma screens or writing any component code for spell authoring or the Effect Editor.

---

## Screen Navigation Flow

This map shows every screen in the spell authoring flow and what choices drive navigation between them.

```
Spell List (/spells)
  │
  ├─ [+ New Spell] ──────────────────────────────────────────────────────────┐
  │                                                                           │
  └─ [Edit spell card] ──────────────────────────────────────────────────────┤
                                                                              ▼
                                                              Spell Form — Step 1: Basics
                                                              (/spells/new or /spells/edit/:id)
                                                              Fields: Name, Level, School,
                                                                      Classes, Description
                                                                              │
                                                                          [Next]
                                                                              │
                                                                              ▼
                                                              Spell Form — Step 2: Casting & Traits
                                                              Fields: Cast Time (unit + amount),
                                                                      Spell Attributes,
                                                                      Components
                                                                              │
                                                              [MATERIAL in Components]
                                                              → Material Description field appears
                                                                              │
                                                                          [Next]
                                                                              │
                                                                              ▼
                                                              Spell Form — Step 3: Effects
                                                              Shows: Summary cards for each
                                                                     capability, empty state if none
                                                                              │
                                          ┌───────────────────────────────────┤
                                          │                                   │
                                   [Add Effect]                          [Edit card]
                                          │                                   │
                                          └───────────────┬───────────────────┘
                                                          │
                                                          ▼
                                            Effect Editor — Setup
                                            (overlay, parent stepper hidden)
                                            Breadcrumb: "{SpellName} / Effect {n}"
                                            Fields: Trigger, Activation, Range,
                                                    Shape, Targeting
                                                          │
                                       [Trigger = SAVING_THROW]
                                       → Saving Throw section appears
                                          (Kind, Target Ability, Source Ability or DC)
                                                          │
                                       [Trigger selected] → Rail populates with path sections
                                                          │
                                            ┌─────────────┴─────────────┐
                                            │                           │
                                    [rail: Setup]               [rail: path item]
                                     (stay here)                       │
                                                                        ▼
                                                          Effect Editor — Outcome Path
                                                          e.g. "On Hit", "On Save Failure"
                                                          Fields: Outcome Structure (Single/
                                                                  Choice/Sequential),
                                                                  Starts From, Range Override,
                                                                  Targeting Override,
                                                                  Outcome Source toggle
                                                                        │
                                                  ┌─────────────────────┴─────────────────────┐
                                                  │                                           │
                                            [Direct]                                   [Roll Table]
                                                  │                                           │
                                                  ▼                                           ▼
                                          Direct Path                               Roll Table Path
                                          Fields: Duration,                         Fields: Die Config,
                                                  Lifecycle (advanced),             Roll Table Kind,
                                                  Outcomes list                     Row list
                                                  │                                 (each row: roll
                                                  │                                 value + 1 outcome)
                                                  │                                           │
                                                  └─────────────────┬─────────────────────────┘
                                                                    │
                                                                    ▼
                                                          Outcome Editor (within path)
                                                          Compact row, type picker dropdown
                                                                    │
                                          ┌───────────┬─────────────┼──────────────┬────────────────┐
                                          │           │             │              │                │
                                       DAMAGE       HEAL      CONDITION      APPLY_GRANT    FORCED_MOVEMENT
                                          │           │             │              │                │
                                    (type+value  (same as    (condition      (grants         (direction+
                                    +scaling)    damage)      dropdown)     sub-sections)    distance)
                                          │
                                          └─ also: TELEPORT, RULE (simple)
                                                    │
                                               MANIFEST
                                                    │
                                          Fields: Kind, Shape,
                                                  Creature Template
                                                    │
                                       [Manifest Behaviors]
                                       → Re-enters same Effect Editor
                                          with deeper breadcrumb:
                                          "{SpellName} / Effect {n} / Manifest Behaviors"
                                          MANIFEST excluded from outcome options
                                                    │
                                   [Save Effect] ───┘
                                          │
                                          ▼
                                   Back to Step 3: Effects
                                   (capability added/updated in list)
                                          │
                                   [Submit] (Step 3 footer)
                                          │
                                          ▼
                                   POST /spells or PUT /spells/:id
                                          │
                                          ▼
                                   Spell List (redirect)
                                   or Spell Detail page
```

---

## Why This Design (Decision Record)

### Problem with the previous approach

The earlier earlier plan proposed a dual-mode wizard/inline toggle for all forms. During design review it became clear that the spell domain — specifically the `capabilities[] → branches[] → entries[]` tree — is architecturally incompatible with a flat wizard stepper:

- `CapabilityAuthored` is an array of arbitrary depth
- Each `BranchAuthored` can be `DIRECT` (flat entries) or `ROLL_TABLE` (roll-indexed entries)
- `SEQUENTIAL` branches require visible ordering within a single outcome set
- There is no "simple path" assumption — homebrew spells can have arbitrarily complex capability trees

Trying to map this to a wizard produces either a shallow wizard that only handles trivial spells, or an infinitely nested stepper that collapses under real spell complexity.

### Decision

**Drop the wizard/inline toggle for spells entirely.**

Use:
1. A lightweight **inline parent form** (3 steps: Basics → Casting & Traits → Effects) for spell-level fields
2. A **full-view Effect Editor** (Azure DevOps work-item style) for authoring each `CapabilityAuthored`

The Effect Editor opens when the user clicks Add Effect or Edit on a capability card. While open, the parent form's stepper is not visible. The editor has its own chrome (breadcrumb + close + footer).

### What this means for the existing 8.2 plan

- `useAuthoringForm` dual-mode hook is **not used for spells**
- The spell inline form uses the existing `Form` / `Header` / `Stepper` component stack directly
- The spell inline form sections (the old 9-section inline breakdown) are replaced by the 3-step structure below
- Background, Feat, and Features (the other domains (Background, Feat, Features)) are unaffected by this decision — their simpler structures can still use whatever form pattern works best

---

## Terminology

| Internal model term | User-facing label | Notes |
|---|---|---|
| `SpellAuthored.capabilities[]` | **Effects** | "Add Effect", "Edit Effect" |
| `CapabilityAuthored` | (not surfaced) | One Effect card in the list |
| `invocation` | **Setup** | Section 1 of the Effect Editor |
| `triggerCode` | **Trigger** | First field in Setup |
| `activation` | **Activation / Action Cost** | Second field in Setup. NOT the same as `castingTime`. |
| `branches[]` | **Outcome Paths** | Section 2 of the Effect Editor |
| `BranchAuthored.branch` | **On Hit, On Miss, On Save Failure**, etc. | Derived from `triggerCode` |
| `resolutionKind: DIRECT` | **(default — not labeled)** | Standard path within a branch |
| `resolutionKind: ROLL_TABLE` | **Roll Table** | Toggle within a branch section |
| `entries[]` | **Outcomes** | The effects within each path |
| `SpellAuthored.castingTime` | **Cast Time** | Spell-level field. Unit = ROUND / MINUTE / HOUR. |

### Cast Time vs Activation — critical distinction

These are two separate authored fields that serve different purposes. They must be visually and semantically distinct in the UI.

| Field | Location | Type | Values | Label |
|---|---|---|---|---|
| `SpellAuthored.castingTime` | Parent spell form, Step 2 | `{ unit: CastingTimeUnitCode, amount: number }` | Unit: ROUND / MINUTE / HOUR | **Cast Time** |
| `InvocationAuthored.activation` | Effect Editor, Setup section | `{ code: ActivationCode, amount? }` | Code: ACTION / BONUS_ACTION / REACTION / FREE | **Activation** or **Action Cost** |

Do not conflate these. A spell might have `castingTime: { unit: ROUND, amount: 1 }` (takes one round) while its invocation has `activation: { code: BONUS_ACTION }` (the specific action economy cost).

---

## Data Model (authoritative reference)

### SpellAuthored (spell-level fields)

```typescript
// packages/shared/src/domains/subjects/authored/spell.ts
type SpellAuthored = {
  kind: 'SPELL'
  id: string
  label: string                          // Step 1: Basics
  description: string                    // Step 1: Basics (rich text)
  level: number                          // Step 1: Basics (int)
  magicSchoolId: string                  // Step 1: Basics
  classIds: string[]                     // Step 1: Basics
  castingTime: CastingTimeAuthored       // Step 2: Casting & Traits
  attributes?: SpellAttribute[]          // Step 2: Casting & Traits
  components?: SpellComponent[]          // Step 2: Casting & Traits
  materialDescription?: string           // Step 2: Casting & Traits (conditional on MATERIAL)
  capabilities?: CapabilityAuthored[]    // Step 3: Effects (summary list)
  userId: string
  systemId: string
}

type CastingTimeAuthored = {
  unit: 'ROUND' | 'MINUTE' | 'HOUR'
  amount: number
}

type SpellAttribute = 'CONCENTRATION' | 'RITUAL' | 'ADDS_TO_WEAPON_ATTACK'
type SpellComponent = 'VERBAL' | 'SOMATIC' | 'MATERIAL'
```

### CapabilityAuthored (Effect Editor)

```typescript
// packages/shared/src/domains/effects/authored/capability.ts
type CapabilityAuthored<TTrigger, TOutcome> = {
  id: string
  order: number
  invocation: InvocationAuthored<TTrigger>   // Effect Editor: Setup section
  branches: BranchAuthored<TTrigger, TOutcome>[]  // Effect Editor: Outcome Paths section
}

type InvocationAuthored<TTrigger> =
  | {
      triggerCode: 'SAVING_THROW'
      savingThrow: SavingThrowAuthored
      activation: ActivationAuthored
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
    }
  | {
      triggerCode: Exclude<Trigger, 'SAVING_THROW'>
      activation: ActivationAuthored
      range: RangeAuthored
      shape?: ShapeAuthored
      targeting?: TargetingAuthored
    }

type ActivationAuthored =
  | { code: 'FREE' }
  | { code: 'ACTION' | 'BONUS_ACTION' | 'REACTION'; amount: number }
```

### BranchAuthored (Outcome Paths)

```typescript
// packages/shared/src/domains/effects/authored/branch.ts

// Valid branch codes per trigger
// ACTIVATED           → ON_USE
// *_ATTACK triggers   → ON_ATTACK | ON_HIT | ON_MISS | ON_CRIT
// SAVING_THROW        → ON_SAVE_FAIL | ON_SAVE_SUCCESS
// ENTER_AREA          → PASSIVE

type BranchAuthoredBase<TTrigger> = {
  id: string
  order: number
  branch: BranchesByTrigger<TTrigger>     // which branch event: ON_HIT, ON_MISS, etc.
  groupType: 'SINGLE' | 'CHOICE' | 'SEQUENTIAL'
  originKind?: 'SOURCE' | 'PRIMARY_TARGET' | 'PREVIOUS_ENTRY_TARGET'
  rangeOverride?: RangeAuthored
  targetingOverride?: TargetingAuthored
}

type BranchDirect<TOutcome> = {
  resolutionKind: 'DIRECT'
  duration?: DurationAuthored
  lifecycle?: BranchLifecycleAuthored
  entries: TOutcome[]
}

type BranchRollTable<TOutcome> = {
  resolutionKind: 'ROLL_TABLE'
  rollTableKind: 'RANGE' | 'EXACT'
  dieConfig: string  // e.g. "1d100"
  entries: (BranchRollTableEntry & TOutcome)[]
  // RANGE entry: { id, order, rollRange: [number, number], duration? } & TOutcome
  // EXACT entry: { id, order, rollValue: number, duration? } & TOutcome
}

type BranchLifecycleAuthored = {
  recurringKind?: 'NONE' | 'START_OF_TURN' | 'END_OF_TURN'
  consumeOnFirstEvent?: 'ON_ATTACK_ROLL' | 'ON_CAST_SPELL'
  endOnEvents?: ('ON_ATTACK_ROLL' | 'ON_CAST_SPELL')[]
}
```

### OutcomeAuthored (8 types — Outcomes within each path)

```typescript
// packages/shared/src/domains/effects/authored/outcome.ts
type OutcomeAuthored =
  | DamageAuthored
  | ConditionAuthored
  | HealAuthored
  | ApplyGrantAuthored
  | ForcedMovementAuthored
  | TeleportAuthored
  | ManifestAuthored
  | RuleAuthored

// DamageAuthored
type DamageAuthored = {
  id: string
  effectKind: 'DAMAGE'
  damageTypeId: string
  valueKind: 'FIXED' | 'DICE' | 'POOL'
  // FIXED: amount + optional per-level progression
  // DICE: diceConfig (e.g. "2d6") + optional per-level progression
  // POOL: amount + scalingSource + optional multiplier/min/max
  bonuses?: DamageBonusAuthored[]   // ABILITY_BONUS | SKILL_BONUS | PROFICIENCY_BONUS
  amountKind?: ScalingAmountKind
  multiplier?: number
}

// ConditionAuthored
type ConditionAuthored = {
  id: string
  effectKind: 'CONDITION'
  conditionId: string
}

// HealAuthored (same structure as DamageAuthored minus damageTypeId)
type HealAuthored = {
  id: string
  effectKind: 'HEAL'
  temporary?: boolean
  valueKind: 'FIXED' | 'DICE' | 'POOL'
  bonuses?: HealBonusAuthored[]
}

// ApplyGrantAuthored
type ApplyGrantAuthored = {
  id: string
  effectKind: 'APPLY_GRANT'
  grants: {
    modifiers?: ModifierGrantAuthored[]
    proficiencies?: ProficiencyGrantAuthored[]
    senses?: SenseGrantAuthored[]
    spells?: SpellGrantAuthored[]
  }
}

// ForcedMovementAuthored
type ForcedMovementAuthored = {
  id: string
  effectKind: 'FORCED_MOVEMENT'
  direction: 'AWAY_FROM_SOURCE' | 'TOWARD_SOURCE' | 'CHOICE'
  actionEconomy: 'NONE' | 'REACTION'
  distanceMode: 'UP_TO_SPEED' | 'FIXED_DISTANCE'
  // when FIXED_DISTANCE: amount + unit
}

// TeleportAuthored
type TeleportAuthored = {
  id: string
  effectKind: 'TELEPORT'
  targetKind: 'SELF' | 'TARGET' | 'CHOSEN_CREATURES'
  destinationKind: 'SELF' | 'VISIBLE' | 'SPECIFIED_POINT' | 'LINKED_LOCATION' | 'SPECIAL'
  distance?: RangeAuthored
}

// ManifestAuthored
type ManifestAuthored = {
  id: string
  effectKind: 'MANIFEST'
  manifestKind: 'CREATURE' | 'ZONE' | 'SENSOR' | 'WEAPON' | 'HAND' | 'OBJECT' | 'ILLUSION'
  shape?: ShapeAuthored
  creatureId?: string
  // Nested capabilities: same structure but MANIFEST excluded as an outcome
  capabilities?: ManifestNestedCapabilityAuthored[]
}
// ManifestNestedCapabilityAuthored = CapabilityAuthored<TTrigger, NonManifestOutcomeAuthored>
// MANIFEST is NOT a valid outcome inside a manifest's nested capabilities.

// RuleAuthored
type RuleAuthored = {
  id: string
  effectKind: 'RULE'
  // No configurable fields. Placeholder only.
}
```

### Shape measurements (shape-specific conditional fields)

```typescript
// packages/shared/src/domains/shared/core/shape.ts
// Each measurement is { amount: number, unit: MeasurementUnitCode } — not a single "size" field

// LINE   → length: { amount, unit }
// CONE   → length: { amount, unit }
// CUBE   → edgeLength: { amount, unit }
// CYLINDER → radius: { amount, unit }, height?: { amount, unit }
// SPHERE → radius: { amount, unit }
// CIRCLE → radius: { amount, unit }
// DOME   → radius: { amount, unit }
// WALL   → length: { amount, unit }, height: { amount, unit }, thickness?: { amount, unit }
```

### Range

```typescript
// packages/shared/src/domains/shared/core/range.ts
// RangeKind: SELF | TOUCH | SIGHT | SPECIAL | UNLIMITED | DISTANCE
// Only DISTANCE gets measurement fields: amount + unit
// There is no min/max on range — that was a legacy form assumption
```

---

## Parent Spell Form — 3 Steps

The parent spell form is a standard multi-step form using the existing `Form` / `Header` / `Stepper` component stack.

### Step 1 — Basics

**File:** `apps/web/src/domains/spells/form/steps/Basics.tsx`

Fields:
- `label` — Name (text, required)
- `level` — Level (integer, required, min: 0)
- `magicSchoolId` — School (dropdown, required)
- `classIds` — Class(es) (multiselect, required)
- `description` — Description (RichTextField)

### Step 2 — Casting & Traits

**File:** `apps/web/src/domains/spells/form/steps/CastingAndTraits.tsx`

Fields:
- `castingTime.unit` — Cast Time unit (dropdown: Round / Minute / Hour)
- `castingTime.amount` — Cast Time amount (number, always shown alongside unit)
- `attributes` — Spell Attributes (multiselect: Concentration / Ritual / Adds to Weapon Attack)
- `components` — Components (multiselect: Verbal / Somatic / Material)
- `materialDescription` — Material Description (text, conditional: only when Material is in `components`)

**Does NOT include:** duration, range, shape, targeting, saving throw, damage, upcast.
These fields are NOT on `SpellAuthored`. They belong inside `CapabilityAuthored`.

### Step 3 — Effects

**File:** `apps/web/src/domains/spells/form/steps/Effects.tsx`

**Empty state:**
- "No effects yet" message
- "Add Effect" button → opens EffectEditor with no initial data

**Populated state:**
- Sortable card list (drag-and-drop reorder, writes to `capabilities[].order`)
- One `CapabilitySummaryCard` per `CapabilityAuthored`
- Card content: trigger label + non-empty path labels + outcome type count
  - Example: `Saving Throw • On Fail: Damage, Condition • On Success: Half Damage`
  - Example: `On Hit (Melee Attack) • Damage`
- Each card: Edit button, Remove button, drag handle

**Opening the editor:**
- Add Effect → `EffectEditor` opens (full-view overlay) with empty capability data
- Edit → `EffectEditor` opens with the selected capability's data pre-loaded

---

## Effect Editor

The Effect Editor is a full-view overlay (Azure DevOps work-item style). It is not a standard dialog or drawer.

### Editor chrome

**Header:**
- Breadcrumb: `{spellLabel} / Effect {n}` (e.g. `Fireball / Effect 1`)
- For nested Manifest editing: `{spellLabel} / Effect {n} / Manifest Behaviors`
- Close (X) button — dismisses without saving, shows confirmation if dirty

**Footer (sticky):**
- `Save Effect` button — validates and writes back to `capabilities[]`
- `Cancel` button — dismisses without saving

**Parent stepper behavior:**
- The parent spell form's horizontal stepper (`<Stepper />`) is NOT rendered while the Effect Editor is open
- The Effect Editor replaces the stepper region entirely

### Implementation approach

Two implementation options are acceptable. Choose based on TanStack Router capabilities at the time of implementation:

**Option A — Route-based overlay (preferred)**
- URL pattern: `/spells/edit/:spellId/effect/:effectId`
- Parent form route stays mounted and renders normally
- Effect Editor route renders as an overlay layer on top
- Browser back → closes editor, returns to parent spell form
- Bookmarkable

**Option B — State-based overlay (fallback)**
- `capabilityIndex: number | null` added to form store `editing` meta
- When `capabilityIndex !== null`, Effect Editor renders over the parent form
- Parent spell form's `<Header>` detects `capabilityIndex !== null` and hides `<Stepper>`
- Uses `useDisclosure` or similar for the overlay

Either option must satisfy: parent stepper hidden, breadcrumb visible, browser back works as expected.

### Left rail navigation

Sticky left rail (section nav). Non-linear — users can jump freely.

```
Setup
Outcome Paths
  ├─ On Use            (ACTIVATED only)
  ├─ On Attack         (attack triggers only)
  ├─ On Hit            (attack triggers only)
  ├─ On Miss           (attack triggers only)
  ├─ On Critical Hit   (attack triggers only)
  ├─ On Save Failure   (SAVING_THROW only)
  └─ On Save Success   (SAVING_THROW only)
(Validation / completeness — optional, add if needed)
```

Path items in the rail are populated only after Trigger is selected in Setup.
Before Trigger is selected: rail shows Setup only, paths show placeholder.
Empty paths (no outcomes yet): show clean empty state, not an error.

Rail active item highlights on scroll and on direct click.

---

## Effect Editor — Setup Section

Maps to `InvocationAuthored`.

**File:** `apps/web/src/domains/spells/form/effects/EffectEditorSetup.tsx`

### Fields

**Trigger** (`triggerCode`)
- Label: "Trigger"
- Type: dropdown (required)
- Options:
  - Activated (ACTIVATED)
  - Melee Weapon Attack (MELEE_WEAPON_ATTACK)
  - Ranged Weapon Attack (RANGED_WEAPON_ATTACK)
  - Unarmed Attack (UNARMED_ATTACK)
  - Spell Attack (SPELL_ATTACK)
  - Saving Throw (SAVING_THROW)
  - Enter Area (ENTER_AREA)
- On change: updates which Outcome Path sections are shown in the rail

**Activation** (`activation.code`, `activation.amount`)
- Label: "Activation" or "Action Cost"
- Type: dropdown for code (Action / Bonus Action / Reaction / Free)
- Amount field (number, conditional: hidden when Free)
- Note: this is NOT the spell's Cast Time. Different field, different purpose.

**Range** (`range.rangeKind`, `range.amount`, `range.unit`)
- Label: "Range"
- Type: dropdown for rangeKind (required)
  - Options: Self / Touch / Sight / Special / Unlimited / Distance
- When Distance: show Amount (number) + Unit (measurement unit dropdown)
- No min/max — range is a single `amount + unit` for DISTANCE kind

**Shape** (`shape.shapeKind`, shape measurements)
- Label: "Shape" (optional)
- Type: dropdown for shapeKind
  - Options: None (clears shape), Line, Cone, Cube, Cylinder, Sphere, Wall, Circle, Dome
- Shape-specific measurement inputs (all measurements are `{ amount, unit }` pairs — never a single generic "size" number):
  - None: no measurement fields
  - Line, Cone: Length (amount + unit)
  - Cube: Edge Length (amount + unit)
  - Cylinder: Radius (amount + unit) + optional Height (amount + unit)
  - Sphere, Circle, Dome: Radius (amount + unit)
  - Wall: Length (amount + unit, required) + Height (amount + unit, required) + Thickness (amount + unit, optional)

**Targeting** (`targeting.selectionKind`, etc.)
- Label: "Targeting" (optional)
- Type: dropdown for selectionKind
  - Options: None (clears targeting), Self, Single Target, Chosen Creatures, Area Contents
- When not Self and not None:
  - Disposition (dropdown: Any / Willing / Hostile, optional)
  - Max Targets (number, optional)
  - Excluded Creature Types (multiselect, optional)

**Saving Throw** (`savingThrow`) — conditional section, only when Trigger = Saving Throw
- Saving Throw Kind: Source Save DC | Fixed Value
- Target's Ability: (what the target rolls against) — dropdown of abilities, required
- Source Ability (conditional: Source Save DC only) — dropdown of abilities, optional
- DC Value (conditional: Fixed Value only) — number, required

---

## Effect Editor — Outcome Paths Section

Maps to `BranchAuthored[]`. Path sections are derived from the selected Trigger — they are NOT user-created arbitrarily.

**File:** `apps/web/src/domains/spells/form/effects/EffectEditorOutcomePaths.tsx`

### Path sections by trigger

| Trigger | Path sections shown |
|---|---|
| ACTIVATED | On Use |
| MELEE_WEAPON_ATTACK, RANGED_WEAPON_ATTACK, UNARMED_ATTACK, SPELL_ATTACK | On Attack, On Hit, On Miss, On Critical Hit |
| SAVING_THROW | On Save Failure, On Save Success |
| ENTER_AREA | Passive |

Sections appear in the fixed order shown above. Users can leave a path empty.

### Per path section fields

**Outcome Structure** (`groupType`)
- Label: "Outcome Structure"
- Segmented control or dropdown: Single / Choice / Sequential
- SEQUENTIAL: outcomes in this path have explicit ordering with reorder affordances

**Starts From** (`originKind`)
- Label: "Starts From" (optional)
- Dropdown: Source / Primary Target / Previous Entry Target

**Range Override** (optional, same fields as Setup range)
**Targeting Override** (optional, same fields as Setup targeting)

**Outcome Source** (`resolutionKind`)
- Toggle: Direct | Roll Table
- Direct is default

---

### Direct path fields

**Duration** (`duration`) — optional
- Dropdown for duration kind + amount when applicable

**Lifecycle** (advanced, collapsible) — maps to `BranchLifecycleAuthored`
- Recurring Kind: None / Start of Turn / End of Turn
- Consume On First Event: On Attack Roll / On Cast Spell (optional)
- End On Events: multiselect (optional)

**Outcomes list** — repeatable, see Outcomes Editor section below

---

### Roll table path fields

**Die Config** (`dieConfig`)
- Text input, e.g. "1d100" (required)

**Roll Table Kind** (`rollTableKind`)
- Toggle: Range | Exact

**Rows** (repeatable)
- Same compact row pattern as scaling breakpoint rows
- RANGE row: Lower value + Upper value (both required) + optional Duration
- EXACT row: Exact value (required) + optional Duration
- Each row: exactly one Outcome editor (see Outcomes Editor below)
- Add row / Remove row affordances

---

## Outcomes Editor

Maps to `entries[]`. User-facing label: "Outcomes".

**File:** `apps/web/src/domains/spells/form/effects/outcomes/OutcomeEditor.tsx`

### Container rules

- Compact, form-first cards/rows
- One outcome expanded at a time by default
- Outcome type selected via a compact dropdown control; typed fields appear below on selection
- Do NOT use large visual selector cards with icons
- SEQUENTIAL paths show explicit ordering with reorder affordances (drag handle or up/down arrows)
- Each outcome row: expand/collapse toggle, remove button
- "Add Outcome" button at bottom of the list

### Outcome type: Damage

**File:** `apps/web/src/domains/spells/form/effects/outcomes/DamageOutcome.tsx`

Fields:
- Damage Type (`damageTypeId`) — dropdown, required
- Value Kind — segmented: Fixed / Dice / Pool
- **When Fixed:** Amount (number)
- **When Dice:** Dice Config (text, e.g. "2d6")
- **When Pool:** Amount + Scaling Source (Character Level / Class Level / Spell Cast Level / Parent Class Level) + optional multiplier, min, max; Class ID (conditional: Class Level)
- Multiplier (number, optional)
- Amount Kind (optional)
- Bonuses (collapsible list):
  - Ability Bonus: Ability + optional min/max/multiplier
  - Skill Bonus: Skill + optional min/max/multiplier
  - Proficiency Bonus: optional min/max/multiplier
  - Add/remove bonus rows
- **Scaling** (collapsible section titled "Per-Level Scaling"):
  - Explicit breakpoint rows. Each row: Level (int) + value (amount or diceConfig depending on Value Kind)
  - Add/remove level rows
  - Do NOT use "applies to every level" assumptions — the author specifies each breakpoint explicitly

### Outcome type: Heal

**File:** `apps/web/src/domains/spells/form/effects/outcomes/HealOutcome.tsx`

Fields:
- Temporary HP? (checkbox)
- Value Kind — segmented: Fixed / Dice / Pool (same sub-fields as Damage)
- Bonuses (same as Damage)
- Scaling (same explicit breakpoint row pattern)

### Outcome type: Condition

**File:** `apps/web/src/domains/spells/form/effects/outcomes/ConditionOutcome.tsx`

Fields:
- Condition (`conditionId`) — dropdown, required (query conditions from API)

### Outcome type: Apply Grant

**File:** `apps/web/src/domains/spells/form/effects/outcomes/ApplyGrantOutcome.tsx`

Sub-sections (each collapsible, each with add/remove item rows):
- **Modifiers** → `grants.modifiers[]`
- **Proficiencies** → `grants.proficiencies[]`
- **Senses** → `grants.senses[]`
- **Spells** → `grants.spells[]`

Each sub-section uses the same grant editor component used in the Feat and Feature forms.
(These grant editors are defined in a shared `@components/Form/Grants/` location.)

### Outcome type: Forced Movement

**File:** `apps/web/src/domains/spells/form/effects/outcomes/ForcedMovementOutcome.tsx`

Fields:
- Direction: Away from Source / Toward Source / Choice
- Action Economy: None / Reaction
- Distance Mode: Up to Speed / Fixed Distance
  - When Fixed Distance: Amount (number) + Unit (measurement unit dropdown)

### Outcome type: Teleport

**File:** `apps/web/src/domains/spells/form/effects/outcomes/TeleportOutcome.tsx`

Fields:
- Target Kind: Self / Target / Chosen Creatures
- Destination Kind: Self / Visible / Specified Point / Linked Location / Special
- Distance (optional RangeAuthored — same range fields as Setup)

### Outcome type: Manifest

**File:** `apps/web/src/domains/spells/form/effects/outcomes/ManifestOutcome.tsx`

Fields:
- Manifest Kind: Creature / Zone / Sensor / Weapon / Hand / Object / Illusion
- Shape (optional — same shape fields as Setup, including type-specific measurements)
- Linked Creature Template (`creatureId`, optional, conditional: Creature kind)
  - Search/picker for existing creature records

**Manifest Behaviors section** (`capabilities?: ManifestNestedCapabilityAuthored[]`)
- Section title: "Manifest Behaviors" or "What the Manifested Thing Can Do"
- Optional section, collapsible
- When expanded: shows a mini capability list (same `CapabilitySummaryCard` pattern)
- Add Behavior → opens the SAME Effect Editor surface with:
  - Breadcrumb deepened: `{spellLabel} / Effect {n} / Manifest Behaviors`
  - MANIFEST excluded from outcome options in the nested editor
  - All other outcome types available (DAMAGE, CONDITION, HEAL, APPLY_GRANT, FORCED_MOVEMENT, TELEPORT, RULE)
- Do NOT open a second full modal/overlay stacked on top. Reuse the same editor surface,
  replacing the current editor content with the nested editor and updating the breadcrumb.

### Outcome type: Rule

**File:** `apps/web/src/domains/spells/form/effects/outcomes/RuleOutcome.tsx`

Display only:
- "Rule placeholder — no configuration required. Use this when no other outcome type fits."
- No editable fields.

---

## Reuse Pattern for Other Domains

This pattern is designed to be reused. The following domains will use the same Effect Editor for their `capabilities[]`:

| Domain | capabilities[] user-facing label | Phase |
|---|---|---|
| Feat (`FeatAuthored.capabilities[]`) | Abilities | 8.5 |
| Equipment (`EquipmentBaseAuthored.capabilities[]`) | Abilities / Special Properties | 8.8 |
| Feature (`FeatureBaseAuthored.capabilities[]`) | Abilities | 8.6 |
| Class features (via Feature) | Abilities | 8.11 |

When adapting for another domain:
- The `EffectEditor` component accepts a `context` prop that controls:
  - Breadcrumb label (e.g. "Great Sword / Ability 1" for equipment)
  - Whether MANIFEST is a valid outcome type
  - Whether nested capabilities are allowed at all
- Everything else (Setup, Outcome Paths, all Outcome type editors) is shared exactly

---

## Figma Steps

- [ ] 1. Spell Form — Step 1: Basics
- [ ] 2. Spell Form — Step 2: Casting & Traits
- [ ] 3. Spell Form — Step 3: Effects (empty state)
- [ ] 4. Spell Form — Step 3: Effects (1–2 populated capability cards)
- [ ] 5. Effect Editor — Setup (attack trigger variant, with shape measurement examples)
- [ ] 6. Effect Editor — Setup (saving throw trigger variant)
- [ ] 7. Effect Editor — Outcome Paths: attack rail (On Attack / On Hit / On Miss / On Crit)
- [ ] 8. Effect Editor — Outcome Paths: saving throw rail (On Save Failure / On Save Success)
- [ ] 9. Effect Editor — Direct path with SEQUENTIAL outcomes (ordering visible)
- [ ] 10. Effect Editor — Roll Table path (Range rows + Exact rows)
- [ ] 11. Outcome editor: Damage with per-level scaling breakpoints
- [ ] 12. Outcome editor: Heal with per-level scaling breakpoints
- [ ] 13. Outcome editor: Apply Grant (sub-sections shown)
- [ ] 14. Outcome editor: Manifest with Manifest Behaviors (nested breadcrumb, no Manifest option)

---

## Exit Criteria (Figma)

- [ ] All 14 screens above are complete in Figma
- [ ] Figma URL is recorded in this plan
- [ ] Screens use the app's design tokens (teal accent, dark surfaces, SF Pro fonts)
- [ ] Both desktop (1280px) and mobile (375px) are shown for the parent spell form steps
- [ ] Effect Editor shows both the left rail and the main content area clearly
- [ ] Conditional states are shown: saving throw fields appear when trigger = SAVING_THROW, material description appears when MATERIAL selected

> **Frontend implementation is tracked in a separate plan. Do not write any code from this plan.**
- [ ] Roll Table path: die config + RANGE or EXACT rows + one outcome per row
- [ ] Damage outcome: valueKind (Fixed/Dice/Pool) + type + scaling breakpoint rows
- [ ] Manifest outcome: kind + optional creature + Manifest Behaviors mini-list opens nested editor with correct breadcrumb and no Manifest option in outcome picker
- [ ] Effect Editor close with dirty state: confirmation prompt shown
- [ ] Parent spell stepper NOT visible while Effect Editor is open
- [ ] Breadcrumb reads correct spell label and effect index
- [ ] Spell with capabilities round-trips through API (create → reload → edit → save)
- [ ] All screens render at 375px and 1280px
- [ ] `packages/schema` spellAuthoredDtoSchema validates capabilities including all 8 outcome types
- [ ] TypeScript: `apps/web` typechecks clean

---

## Critical Files

### New files (to create)

- `apps/web/src/domains/spells/form/steps/Basics.tsx`
- `apps/web/src/domains/spells/form/steps/CastingAndTraits.tsx`
- `apps/web/src/domains/spells/form/steps/Effects.tsx`
- `apps/web/src/domains/spells/form/effects/EffectEditor.tsx`
- `apps/web/src/domains/spells/form/effects/EffectEditorRail.tsx`
- `apps/web/src/domains/spells/form/effects/EffectEditorSetup.tsx`
- `apps/web/src/domains/spells/form/effects/EffectEditorOutcomePaths.tsx`
- `apps/web/src/domains/spells/form/effects/CapabilitySummaryCard.tsx`
- `apps/web/src/domains/spells/form/effects/paths/DirectPath.tsx`
- `apps/web/src/domains/spells/form/effects/paths/RollTablePath.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/OutcomeEditor.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/DamageOutcome.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/HealOutcome.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/ConditionOutcome.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/ApplyGrantOutcome.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/ForcedMovementOutcome.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/TeleportOutcome.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/ManifestOutcome.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/RuleOutcome.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/scaling/ScalingBreakpointRow.tsx`
- `apps/web/src/domains/spells/form/effects/outcomes/scaling/ScalingBreakpointTable.tsx`

### Modified files

- `apps/web/src/domains/spells/form/SpellForm.tsx` — 3 new steps
- `apps/web/src/domains/spells/form/steps/Details.tsx` → rename to `Basics.tsx`, update fields
- `apps/web/src/domains/spells/form/steps/Attributes.tsx` — archive / delete after migration
- `apps/web/src/components/Form/Header/Header.tsx` — hide Stepper when `capabilityIndex !== null`
- `apps/web/src/store/formStore.ts` — add `capabilityIndex`, `manifestCapabilityIndex` to editing meta
- `packages/schema/src/domains/subjects/spell.ts` — align `SpellInput` to actual `SpellAuthored`
- `apps/apis/src/routes/spells.ts` — confirm capabilities included in create/update

### Reference files (read but do not modify without reason)

- `packages/shared/src/domains/effects/authored/capability.ts`
- `packages/shared/src/domains/effects/authored/branch.ts`
- `packages/shared/src/domains/effects/authored/outcome.ts`
- `packages/shared/src/domains/effects/authored/manifest.ts`
- `packages/shared/src/domains/effects/authored/damage.ts`
- `packages/shared/src/domains/effects/authored/heal.ts`
- `packages/shared/src/domains/effects/authored/applyGrant.ts`
- `packages/shared/src/domains/effects/authored/forcedMovement.ts`
- `packages/shared/src/domains/effects/authored/teleport.ts`
- `packages/shared/src/domains/subjects/authored/spell.ts`
- `packages/shared/src/domains/subjects/core/spell.ts`
- `packages/shared/src/domains/shared/core/shape.ts`
- `packages/shared/src/domains/shared/core/range.ts`
- `apps/web/src/components/Accordion/` — reuse for capability list
- `apps/web/src/components/Collapse/Collapse.tsx` — reuse for advanced sections
- `apps/web/src/domains/features/form/Features.tsx` — reference for list ↔ detail pattern

---

## Deferred / Out of Scope

- Wizard mode for spells — dropped. Inline parent form + full-view editor only.
- `useAuthoringForm` dual-mode hook — not used for spells. Other simpler domains may still use it.
- Character sheet integration — Phase 8.13
- Play-state (conditions, exhaustion) — Phase 10
- tRPC transport — Phase 9
