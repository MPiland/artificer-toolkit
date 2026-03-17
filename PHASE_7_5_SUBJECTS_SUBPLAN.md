# Phase 7.5 — New Subject Types: Creature + Vehicle

## Status: Complete

## Context

Phase 7.6 delivers SRD master data for existing character-creation subjects. Phase 7.5 adds the two remaining first-class authored subject types: `creature` and `vehicle`.

These are DM-facing reference content, not character build subjects. They unlock monster stat blocks, NPC sheets, mounts, familiars, vehicles, and ships as authored content that can be associated with a game system.

Phase 7.5 must come after Phase 7.6 so the E2E test verifies the existing infrastructure before new subjects are added.

---

## Architectural Decisions (agreed with Codex)

### Two subjects, not four

`creature` and `vehicle` are the two subject types. `mount`, `monster`, and `npc` are not separate subjects.

### Mount = creature profile

A mount is mechanically a creature first. Horses, warhorses, griffons all use creature rules (HP, AC, saves, actions, initiative). `mountProfile` is an optional property on `CreatureAuthored`. A vehicle (cart, wagon, ship) uses object/vehicle rules — no ability scores, no creature turns.

### Monster = creature category

`monster` is not a separate subject. In 5e, monsters, NPCs, beasts, companions, and summons all share the same stat-block grammar. `CreatureCategory` discriminates presentation/content bucket: `NPC | MONSTER | BEAST | COMPANION | SUMMON`.

### Legendary/lair/companion = optional profiles

`LEGENDARY` is NOT a category — legendary status cuts across categories (any creature type can be legendary). Instead, specialized mechanics are optional profile objects on `CreatureAuthored`:

- `legendaryProfile` — legendary actions, legendary resistance
- `lairProfile` — lair actions, regional effects
- `mountProfile` — mount/rider rules (PHB p.198)
- `companionProfile` — familiar/animal companion rules
- `npcProfile` — bonds, flaws, ideals (narrative NPCs only)

Presence of a profile = that mechanics module applies.

---

## Implementation Decisions

- Reused existing `SizeCode`; no separate `creature_sizes` vocabulary/table was needed.
- Vehicle Step 3a source artifacts already existed, but the audit found follow-on fixes were required in the vehicle/creature node maps and creature Zod schema before downstream packages would build cleanly.
- `packages/functions`, `apps/apis`, and `packages/db` now include full creature + vehicle authoring/list/get stacks.
- Supabase migration landed as `20260317000100_phase75_subjects.sql` and also patches `apply_updated_at_triggers(...)` to handle PostgreSQL's 63-character identifier truncation safely.

---

## Step 1 — Vocabulary Additions (pre-step)

New vocabulary must be settled before authored types, schemas, or SQL are written.

### New vocabulary files (`packages/shared/src/domains/vocabulary/authored/`)

| File | Content |
|---|---|
| `creatureType.ts` | `ABERRATION`, `BEAST`, `CELESTIAL`, `CONSTRUCT`, `DRAGON`, `ELEMENTAL`, `FEY`, `FIEND`, `GIANT`, `HUMANOID`, `MONSTROSITY`, `OOZE`, `PLANT`, `UNDEAD` |
| `challengeRating.ts` | `CR_0`, `CR_1_8`, `CR_1_4`, `CR_1_2`, `CR_1` … `CR_30` with XP values |
| `creatureSize.ts` | Check if `SizeCode` already covers `TINY`/`SMALL`/`MEDIUM`/`LARGE`/`HUGE`/`GARGANTUAN` for races — reuse if so, else add new file |

### New DB vocabulary tables (`packages/db/src/domains/vocabulary/tables/`)

- `creature_types.sql`
- `challenge_ratings.sql`
- (size: reuse existing `sizes` table if present, else add `creature_sizes.sql`)

### Vocabulary seed

Extend `packages/db/src/source-data/srd/vocabulary.ts` with new terms.

### Barrel update

`packages/shared/src/domains/vocabulary/authored/index.ts`

---

## Step 2 — `creature` Subject (full artifact stack)

### Authored type shape (`packages/shared/src/domains/subjects/authored/creature.ts`)

```typescript
// Category = content/presentation bucket (what kind of creature this is)
// Legendary/lair/mount/companion mechanics are PROFILES, not categories,
// because they cut across categories (any creature can be legendary, any beast can be a mount, etc.)
type CreatureCategory = 'NPC' | 'MONSTER' | 'BEAST' | 'COMPANION' | 'SUMMON'

interface CreatureAuthored {
  id: string
  label: string
  quote?: string
  description?: string
  details?: DetailAuthored[]
  features?: FeatureAuthored[]     // traits, special abilities
  userId: string
  systemId: string
  // Identity
  category: CreatureCategory
  creatureTypeId: string           // vocabulary: ABERRATION, BEAST, HUMANOID, etc.
  size: SizeCode
  alignmentId?: string
  tags?: string[]
  // Core stats
  abilityScores: Record<AbilityCode, number>
  armorClass: number
  armorClassNote?: string
  hitPoints: number
  hitDice?: string                 // e.g. "5d8+10"
  // Movement
  speeds: SpeedAuthored[]
  senses?: string[]                // sense IDs from vocabulary
  passivePerception?: number
  // Defenses
  savingThrowProficiencies?: AbilityCode[]
  skillProficiencies?: string[]
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]
  // Social/rules
  languages?: string[]
  challengeRatingId?: string
  xp?: number
  // Standard actions
  actions?: CreatureActionAuthored[]
  bonusActions?: CreatureActionAuthored[]
  reactions?: CreatureActionAuthored[]
  // Optional rule profiles (presence = that mechanics module applies)
  legendaryProfile?: CreatureLegendaryProfile   // legendary actions, legendary resistance
  lairProfile?: CreatureLairProfile             // lair actions, regional effects
  mountProfile?: CreatureMountProfile           // mount/rider rules (PHB p.198)
  companionProfile?: CreatureCompanionProfile   // familiar/animal companion rules
  npcProfile?: CreatureNpcProfile               // bonds, flaws, ideals (narrative NPCs)
}

interface CreatureActionAuthored {
  id: string
  label: string
  description: string
  attackBonus?: number
  damage?: string
  recharge?: string
}

interface CreatureLegendaryProfile {
  legendaryResistanceCount?: number  // uses per day
  actionsCount: number               // legendary actions per round
  actions: CreatureActionAuthored[]
}

interface CreatureLairProfile {
  lairActions?: CreatureActionAuthored[]
  regionalEffects?: string[]
}

interface CreatureMountProfile {
  mountType: 'CONTROLLED' | 'INDEPENDENT'
  capacity?: number
  riderCount?: number
  notes?: string
}

interface CreatureCompanionProfile {
  bondType: 'FAMILIAR' | 'ANIMAL_COMPANION' | 'SUMMON'
  initiativeMode: 'USES_PC_INITIATIVE' | 'OWN_INITIATIVE'
  notes?: string
}

interface CreatureNpcProfile {
  bonds?: string[]
  flaws?: string[]
  ideals?: string[]
  personalityTraits?: string[]
}
```

Reuse from existing shared types: `FeatureAuthored`, `DetailAuthored`, `SpeedAuthored`.
Do NOT reuse character lifecycle/build-state types — creature stat blocks are reference content, not progression state.

### Full artifact set (follow race pattern exactly)

| Artifact | Path |
|---|---|
| Authored type | `packages/shared/src/domains/subjects/authored/creature.ts` |
| Core enums | `packages/shared/src/domains/subjects/core/creature.ts` |
| Node map | `packages/shared/src/domains/subjects/maps/creature.ts` |
| Compiler | `packages/shared/src/domains/subjects/compilers/creature.ts` |
| Zod schema | `packages/schema/src/subjects/creature.ts` |
| SQL tables | `packages/db/src/domains/subjects/tables/creatures.sql` |
| Kysely upsert | `packages/db/src/domains/subjects/upserts/creature.ts` |
| Repository | `packages/db/src/domains/subjects/repositories/creature.ts` |
| DB tests | `packages/db/src/__tests__/creature-repository.test.ts` |
| Authoring service | `packages/functions/src/services/subjects/creatureAuthoring.ts` |
| API routes | `apps/apis/src/routes/creatures.ts` |

### SQL tables (`packages/db/src/domains/subjects/tables/creatures.sql`)

- `creatures` — root table with all scalar fields + jsonb columns for optional profiles:
  - `legendary_profile jsonb` — `CreatureLegendaryProfile | null`
  - `lair_profile jsonb` — `CreatureLairProfile | null`
  - `mount_profile jsonb` — `CreatureMountProfile | null`
  - `companion_profile jsonb` — `CreatureCompanionProfile | null`
  - `npc_profile jsonb` — `CreatureNpcProfile | null`
  - Profiles stored as jsonb: optional, tightly owned, rarely queried independently
- `creature_details` — bridge table
- `creature_features` — bridge table (traits/special abilities)
- `creature_speeds` — bridge table
- `creature_actions` — standard actions/bonus actions/reactions, discriminated by `action_type` column
- `creature_damage_resistances` — bridge table
- `creature_damage_immunities` — bridge table
- `creature_damage_vulnerabilities` — bridge table
- `creature_condition_immunities` — bridge table

Triggers follow `cleanup_owned_rows` pattern same as `races.sql`.

### Test round-trips

- NPC creature (no profiles)
- BEAST with `mountProfile`
- MONSTER with `legendaryProfile` + `lairProfile`

---

## Step 3 — `vehicle` Subject (full artifact stack)

### Authored type shape (`packages/shared/src/domains/subjects/authored/vehicle.ts`)

```typescript
type VehicleCategory = 'LAND' | 'WATER' | 'AIR' | 'SPELLJAMMER'

interface VehicleAuthored {
  id: string
  label: string
  description?: string
  details?: DetailAuthored[]
  userId: string
  systemId: string
  category: VehicleCategory
  size: SizeCode
  armorClass: number
  hitPoints: number
  speed?: number
  speedNote?: string
  crewMin?: number
  crewMax?: number
  passengerCapacity?: number
  cargoCapacity?: string
  cost?: CostAuthored              // reuse from equipment domain
  properties?: string[]
  features?: FeatureAuthored[]
}
```

### Full artifact set (same pattern as creature)

| Artifact | Path |
|---|---|
| Authored type | `packages/shared/src/domains/subjects/authored/vehicle.ts` |
| Core enums | `packages/shared/src/domains/subjects/core/vehicle.ts` |
| Node map | `packages/shared/src/domains/subjects/maps/vehicle.ts` |
| Compiler | `packages/shared/src/domains/subjects/compilers/vehicle.ts` |
| Zod schema | `packages/schema/src/subjects/vehicle.ts` |
| SQL tables | `packages/db/src/domains/subjects/tables/vehicles.sql` |
| Kysely upsert | `packages/db/src/domains/subjects/upserts/vehicle.ts` |
| Repository | `packages/db/src/domains/subjects/repositories/vehicle.ts` |
| DB tests | `packages/db/src/__tests__/vehicle-repository.test.ts` |
| Authoring service | `packages/functions/src/services/subjects/vehicleAuthoring.ts` |
| API routes | `apps/apis/src/routes/vehicles.ts` |

---

## Step 4 — Barrel Updates (all packages)

| File | Change |
|---|---|
| `packages/shared/src/domains/subjects/authored/index.ts` | Add creature + vehicle exports |
| `packages/shared/src/domains/subjects/core/index.ts` | Same |
| `packages/shared/src/domains/subjects/maps/index.ts` | Same |
| `packages/shared/src/domains/subjects/compilers/index.ts` | Same |
| `packages/schema/src/subjects/index.ts` | Add creature + vehicle schemas |
| `packages/db/src/domains/subjects/repositories/index.ts` | Add creature + vehicle repositories |
| `packages/db/src/domains/subjects/upserts/index.ts` | Add creature + vehicle upserts (if barrel exists) |
| `packages/functions/src/services/subjects/index.ts` | Add creature + vehicle authoring services |
| `apps/apis/src/routes/index.ts` | Add creatures + vehicles routes |

---

## Step 5 — Supabase Migrations

Apply via MCP after SQL is written:

1. Vocabulary tables: `creature_types`, `challenge_ratings` (and `creature_sizes` if not already present)
2. `creatures` + all bridge/action tables
3. `vehicles` + bridge tables
4. Regenerate `packages/db/src/types/supabase.database.ts` after migrations

---

## Verification

1. `npx tsc -p packages/shared/tsconfig.build.json --noEmit` — clean
2. `npx tsc -p packages/schema/tsconfig.build.json --noEmit` — clean
3. `npx tsc -p packages/db/tsconfig.build.json --noEmit` — clean
4. `npx tsc -p packages/functions/tsconfig.build.json --noEmit` — clean
5. `npx tsc -p apps/apis/tsconfig.build.json --noEmit` — clean
6. `npx vitest run packages/db/src/__tests__/creature-repository.test.ts` — passes (NPC, BEAST/mount, MONSTER with legendary/lair round-trips)
7. `npx vitest run packages/db/src/__tests__/vehicle-repository.test.ts` — passes
8. Supabase MCP: confirm `creatures`, `vehicles`, `creature_types`, `challenge_ratings` visible in schema
9. `npx vitest run packages/db/src/__tests__` — all ≥160 existing tests still pass

Verification result:

- `yarn build:schema` — clean
- `yarn build:shared` — clean
- `yarn build:db` — clean
- `yarn build:functions` — clean
- `yarn build:apis` — clean
- `yarn build:all` — clean
- `yarn test:db` — 22 files, 168 tests passed
- Supabase schema confirmed for `challenge_ratings`, `creature_types`, `creatures`, and `vehicles`

---

## Out of Scope

- SRD monster stat-block population — belongs in a Phase 7.5 follow-on after `creature` subject exists
- Condition/play-state tracking — Phase 8
- Non-SRD creature/vehicle content

---

## Handoff Notes

- Phase 7.5 is complete and `REBUILD_PLAN.md` should reflect that state.
- Phase 8 (frontend rewrite + Condition/Play State) remains gated on the broader backend/API completion sequence in the rebuild plan.
