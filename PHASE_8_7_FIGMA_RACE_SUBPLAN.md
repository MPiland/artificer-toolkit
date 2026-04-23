# Phase 8.7 — Figma: Race

## Objective

Ship Race and Equipment authoring forms (complex multi-section entities with nested sub-entities), plus read-only Creature and Vehicle browser pages for the SRD statblock data.

---

## Prerequisite

Phase 8.2 complete. `useAuthoringForm`, `FeaturePicker`, and the authoring form layout patterns are established.

---

## Design

Run `/frontend-design` skill for:

- **Creature/Vehicle statblock page** — distinctive TTRPG aesthetic (not a plain table). Should feel like a digital D&D Monster Manual entry. Show: name, type/size/alignment header, AC/HP/Speed, ability scores with modifiers, saves, skills, senses, languages, CR, then actions/reactions/legendary actions as expandable sections.
- **Subrace inline editing** — subraces are nested sub-entities within the race form. Design the add/edit/remove UX for inline nested entities (this pattern recurs in 8.4 for subclasses).
- **Equipment variants** — similar inline nested entity pattern for equipment variants.

---

## Race Form

### Sections

1. **Details** — name, description (RichTextField), size categories, speed (walk, swim, fly, climb, burrow), source attribution
2. **Ancestry** — ability score grants (e.g., +2 STR, +1 CHA), languages granted, additional senses (Darkvision range, Truesight, etc.)
3. **Subraces** — inline list of subraces; each subrace can be added/edited/removed inline
   - Each subrace: name, description, ability score grant overrides, additional features, additional senses
   - Opens in an inline expansion panel (not a separate route)
4. **Features** — race-level features via `FeaturePicker` from 8.2

### Nested Sub-entity Pattern (established here, reused in 8.4)

Subraces are sub-entities managed inline. The UX:

- List of existing subraces as expandable rows
- "Add subrace" button appends a new empty subrace row
- Each row expands to show its fields inline (name, description, grants)
- "Remove" button with confirmation
- Sub-entity state lives within the parent form state (not a separate API call)
- Sub-entities are persisted as part of the parent entity on final submit

### API

`api.content.races.{ list, get, upsert }`

**Payload schema:** `raceAuthoredDtoSchema` from `packages/schema`

---

## Equipment Form

### Sections

1. **Details** — name, category (weapon/armor/gear/tool/mount/vehicle/etc.), description (RichTextField), source attribution
2. **Properties** — weight, cost (value + currency), quantity per pack
   - If weapon: damage dice, damage type, weapon properties (finesse, thrown, etc.), range
   - If armor: AC base, max DEX bonus, strength requirement, stealth disadvantage
3. **Variants** — inline list of variants (e.g., longsword variants by material, quality, or enchantment baseline)
   - Each variant: name, property overrides (weight, cost, damage)
4. **Starting Package** — can this item appear in a starting equipment package? Starting quantity, default currency cost

### API

`api.content.equipment.{ list, get, upsert }`

**Payload schema:** `equipmentAuthoredDtoSchema` from `packages/schema`

---

## Creature Browser (Read-Only)

No authoring form — list + detail pages only. Browsers over SRD seed data.

### List Page

- Filter by creature type (Beast, Undead, Dragon, etc.), CR range, size
- Card or table row: name, type, CR, size
- Links to detail page

### Detail Page — Statblock Layout

```
[Name]                    CR X (X XP)
[Size] [Type], [Alignment]

Armor Class: X (source)
Hit Points: XdY + Z
Speed: Xft, swim Xft, fly Xft

STR  DEX  CON  INT  WIS  CHA
 X    X    X    X    X    X
(+X) (+X) (+X) (+X) (+X) (+X)

Saving Throws: STR +X, CON +X
Skills: Perception +X, Stealth +X
Damage Immunities: fire, poison
Condition Immunities: charmed, frightened
Senses: darkvision 120ft, passive Perception X
Languages: —
Challenge: X (X XP)

[Traits]
[Actions]
[Reactions]
[Legendary Actions]
```

**API:** `api.content.creatures.{ list, get }`

---

## Vehicle Browser (Read-Only)

Same pattern as creatures — list + detail pages. Detail shows vehicle stats (size, capacity, speed, AC, HP, crew requirements, cargo).

**API:** `api.content.vehicles.{ list, get }`

---

## Route Structure

```
routes/_authed/
  races/
    index.tsx
    $raceId.tsx
    $action/$_raceId.tsx
  equipment/
    index.tsx
    $equipmentId.tsx
    $action/$_equipmentId.tsx
  creatures/
    index.tsx
    $creatureId.tsx       ← detail only, no form route
  vehicles/
    index.tsx
    $vehicleId.tsx        ← detail only, no form route
```

---

## Implementation Steps

1. Run `/frontend-design` for statblock layout and subrace inline UX
2. Build Race form (Details + Ancestry sections first, then Subraces inline entity pattern, then Features via `FeaturePicker`)
3. Build Equipment form (Details + Properties with conditional weapon/armor fields, then Variants inline)
4. Build Creature list + detail pages (statblock layout)
5. Build Vehicle list + detail pages
6. Wire all routes

---

## Exit Criteria

- Can create, edit, and view races (including subraces) in both wizard and inline modes
- Can create, edit, and view equipment items (including variants) in both modes
- `FeaturePicker` works within the race form
- Creature list page shows SRD creatures with filter/search
- Creature detail page renders full statblock
- Vehicle list and detail pages render correctly
- All screens render at 375px and 1280px
