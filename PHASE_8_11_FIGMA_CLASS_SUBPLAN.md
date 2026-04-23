# Phase 8.9 — Figma: Class

## Objective

Ship the Class authoring form. Class gets its own subphase because it is the most structurally complex entity in the system: per-level feature tables, subclass management (each with their own feature tables), specialization paths, and optional spellcasting progression.

---

## Prerequisite

Phase 8.9 complete. The inline nested sub-entity pattern (established with subraces in 8.3) is reused here for subclasses.

---

## Design

Run `/frontend-design` skill for:

- **Per-level feature table** — the most complex UI in the entire authoring system. A 20-row grid where each row represents a class level and contains: level number, features assigned at that level (via `FeaturePicker`), any numeric progressions (spell slots, rage count, ki points, etc.). Must be scannable and editable without scrolling off-screen. Consider a compact table with expandable rows.
- **Subclass drawer/modal** — each subclass opens in a side drawer (desktop) or bottom sheet (mobile) showing its own inline detail layout with its own per-level feature table.
- **Spellcasting section** — spell slots per level table (14-column grid: level 1–9 slots per class level). Toggle: "This class has spellcasting" shows/hides the entire section.

Push both layouts to Figma before writing any component code.

---

## Class Form Sections

### 1. Details

- Name, description (RichTextField), hit die (d6/d8/d10/d12), primary ability, source attribution
- Multiclass prerequisites: minimum ability score requirements to multiclass into this class
- Multiclass proficiency grants: what proficiencies a character gains when multiclassing into this class (vs. starting proficiencies)

### 2. Proficiencies

- Armor proficiencies (none/light/medium/heavy/shields — checkboxes)
- Weapon proficiencies (simple/martial + specific weapon types)
- Tool proficiencies (with optional "choice of N from list" pattern)
- Saving throw proficiencies (2 of 6 ability scores — typically)

### 3. Features by Level

- 1–20 level table
- Each level row: features assigned via `FeaturePicker`
- Feature picker allows selecting existing features or creating new features inline
- Numeric progressions (e.g., Rage count, Ki points, Sneak Attack dice) are defined as part of the feature itself, not the level table — the level table is purely "which features unlock at this level"

### 4. Subclasses

- List of subclasses with add/remove/edit inline (same pattern as subraces in 8.3)
- Each subclass opens in a drawer with its own:
  - Name + description
  - Feature-by-level table (same `FeaturePicker`-backed table, but typically only covers a subset of levels — e.g., levels 3, 7, 11, 15)
- Subclass choice level: at which level does the player choose their subclass? (e.g., level 3 for Fighter)

### 5. Specializations (if applicable)

Some classes have further branching beyond subclasses (e.g., Fighter has Martial Archetype, but some homebrew classes might have multiple specialization axes). This section is optional.

- Toggle: "This class has specializations"
- If enabled: list of specialization categories, each with options
- Specializations are simpler than subclasses (no per-level feature table, just a name + description + grants)

### 6. Spellcasting (if applicable)

- Toggle: "This class has spellcasting"
- Spellcasting ability (INT/WIS/CHA)
- Spell list type: known (player picks N spells) vs. prepared (player prepares from full class list)
- Cantrips known per level (array of 20 values)
- Spells known per level (array of 20 values; only for "known" spell progression)
- Spell slots per level: 14-column table (levels 1–9 slots × 20 class levels)
- Ritual casting: boolean
- Spellcasting focus: arcane focus / holy symbol / druidic focus / none

**Pact Magic variant** (Warlock-style): separate slot progression (pact slot count + level) instead of standard spell slots.

---

## Subclass Drawer/Modal

The subclass editing experience:

- Opening a subclass: side drawer slides in from the right (desktop), bottom sheet on mobile
- Drawer contains: subclass name/description fields + its own features-by-level table
- Drawer has its own Save/Cancel — changes are staged until saved
- Saving the subclass updates the parent class form state (not a separate API call)
- Subclasses persist as nested data within the class on final class form submit

---

## API

`api.content.classes.{ list, get, upsert }`

**Payload schema:** `classAuthoredDtoSchema` from `packages/schema` (includes base class + subclass variant schemas)

---

## Route Structure

```
routes/_authed/
  classes/
    index.tsx
    $classId.tsx
    $action/$_classId.tsx
```

---

## Implementation Steps

1. Run `/frontend-design` for per-level feature table + subclass drawer — push to Figma
2. Build class form: Details + Proficiencies sections (simpler, no nested entities)
3. Build features-by-level table component (reuses `FeaturePicker`)
4. Build subclass drawer/modal with its own features-by-level table
5. Build spellcasting section (conditional toggle, slots-per-level table)
6. Build specializations section (conditional toggle, simpler)
7. Wire class list, detail, and form routes

---

## Exit Criteria

- Can create and edit a complete class including:
  - All 6 sections
  - Subclasses with their own per-level feature tables
  - Spellcasting progression (optional)
- The SRD Fighter (no spellcasting, 4 subclasses at level 3) is representable
- The SRD Wizard (INT spellcasting, 2 subclasses at level 2) is representable
- Subclass drawer opens/closes correctly on desktop and mobile
- Features-by-level table is scannable and editable at 375px and 1280px
- Both wizard mode (6 steps) and inline mode (accordion) work
