import { describe, expect, it } from 'vitest'
import type { DBLike } from '#types'
import { createCreatureRepository } from '../domains/subjects/repositories/creature.js'
import { CREATURE_IDS } from '../source-data/srd/ids.js'
import { srdCreatures } from '../source-data/srd/creatures/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

type RowMap = Record<string, unknown[]>

function createFakeDb(rowsByTable: RowMap) {
  return {
    selectFrom(table: string) {
      const state = {
        filtered: [...(rowsByTable[table] ?? [])]
      }

      const builder = {
        select() {
          return builder
        },
        where(column: string, op: string, value: unknown) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
            if (op.toLowerCase() === 'in') {
              return Array.isArray(value) && value.includes(record[column])
            }

            return record[column] === value
          })
          return builder
        },
        orderBy(column: string) {
          state.filtered = [...state.filtered].sort((left, right) => {
            const leftValue = (left as Record<string, number | string>)[column]
            const rightValue = (right as Record<string, number | string>)[column]
            return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
          })
          return builder
        },
        async execute() {
          return state.filtered
        },
        async executeTakeFirst() {
          return state.filtered[0] ?? undefined
        }
      }

      return builder
    }
  }
}

const BASE_ABILITY_SCORES = {
  STRENGTH: 10,
  DEXTERITY: 10,
  CONSTITUTION: 10,
  INTELLIGENCE: 10,
  WISDOM: 10,
  CHARISMA: 10
}

function emptyGrantTables() {
  return {
    proficiency_grants: [],
    proficiency_grant_skills: [],
    proficiency_grant_save_abilities: [],
    proficiency_grant_languages: [],
    proficiency_grant_equipment: [],
    proficiency_grant_equipment_filters: [],
    proficiency_grant_equipment_filter_properties: [],
    proficiency_grant_equipment_properties: [],
    proficiency_grant_equipment_property_filters: []
  }
}

describe('createCreatureRepository', () => {
  it('persists and hydrates SRD dragon legendary action options from source data', async () => {
    const repository = createCreatureRepository(new InMemoryDb() as never)
    const sourceDragons = [CREATURE_IDS.ADULT_BLACK_DRAGON, CREATURE_IDS.ADULT_BRASS_DRAGON].map(
      (id) => {
        const creature = srdCreatures.find((candidate) => candidate.id === id)
        if (!creature) throw new Error(`Missing SRD creature ${id}`)
        return creature
      }
    )

    for (const creature of sourceDragons) {
      await repository.upsert(creature)
    }

    for (const creature of sourceDragons) {
      const hydrated = await repository.findById(creature.id)
      const legendaryActions = hydrated?.features?.find(
        (feature) => feature.label === 'Legendary Actions'
      )
      const legendaryResistance = hydrated?.features?.find((feature) =>
        feature.label.startsWith('Legendary Resistance')
      )

      expect(
        legendaryActions?.options?.map((option) => option.label),
        `${creature.label} legendary options`
      ).toEqual(['Detect', 'Tail Attack', 'Wing Attack (Costs 2 Actions)'])
      expect(legendaryActions?.section).toBe('LEGENDARY_ACTION')
      expect(
        legendaryActions?.options?.find((option) => option.label === 'Tail Attack')?.effects?.length
      ).toBeGreaterThan(0)
      expect(legendaryResistance, `${creature.label} legendary resistance`).toBeDefined()
    }
  })

  it('persists and hydrates creature damage type collections in authored order', async () => {
    const db = new InMemoryDb()
    const repository = createCreatureRepository(db as never)
    const source = srdCreatures.find(
      (candidate) => candidate.id === CREATURE_IDS.ADULT_BLACK_DRAGON
    )
    if (!source) throw new Error('Missing Adult Black Dragon source creature.')

    const creature = {
      ...source,
      id: 'creature-damage-order',
      label: 'Damage Order Creature',
      features: undefined,
      proficiencies: undefined,
      damageResistances: ['damage-cold', 'damage-lightning'],
      damageImmunities: ['damage-poison', 'damage-fire'],
      damageVulnerabilities: ['damage-radiant', 'damage-force']
    }

    await repository.upsert(creature)

    expect(db.snapshot('creature_damage_resistances')).toEqual([
      { creature_id: creature.id, damage_type_id: 'damage-cold', sort_order: 1 },
      { creature_id: creature.id, damage_type_id: 'damage-lightning', sort_order: 2 }
    ])
    expect(db.snapshot('creature_damage_immunities')).toEqual([
      { creature_id: creature.id, damage_type_id: 'damage-poison', sort_order: 1 },
      { creature_id: creature.id, damage_type_id: 'damage-fire', sort_order: 2 }
    ])
    expect(db.snapshot('creature_damage_vulnerabilities')).toEqual([
      { creature_id: creature.id, damage_type_id: 'damage-radiant', sort_order: 1 },
      { creature_id: creature.id, damage_type_id: 'damage-force', sort_order: 2 }
    ])

    await expect(repository.findById(creature.id)).resolves.toMatchObject({
      damageResistances: creature.damageResistances,
      damageImmunities: creature.damageImmunities,
      damageVulnerabilities: creature.damageVulnerabilities
    })
  })

  it('hydrates a minimal NPC creature with root language proficiency grants', async () => {
    const repo = createCreatureRepository(
      createFakeDb({
        creatures: [
          {
            id: 'creature-npc-1',
            system_id: 'system-1',
            user_id: 'user-1',
            label: 'Town Guard',
            quote: null,
            description: 'A stalwart defender.',
            category: 'NPC',
            creature_type_id: 'humanoid',
            size_code: 'MEDIUM',
            alignment_id: null,
            tags: null,
            ability_scores: BASE_ABILITY_SCORES,
            armor_class: 16,
            armor_class_note: 'Chain mail',
            hit_points: 11,
            hit_dice: '2d8+2',
            hit_dice_count: 2,
            hit_die: 8,
            hit_dice_modifier: 2,
            senses: null,
            passive_perception: 10,
            challenge_rating_id: 'cr-1-8',
            xp: 25,
            mount_profile: null,
            companion_profile: null,
            npc_profile: null
          }
        ],
        creature_proficiency_grants: [
          { creature_id: 'creature-npc-1', proficiency_grant_id: 'grant-lang-1', sort_order: 1 }
        ],
        creature_features: [],
        creature_details: [],
        creature_speeds: [
          { creature_id: 'creature-npc-1', speed_id: 'walk', amount: 30, unit_code: 'FEET' }
        ],
        features: [],
        feature_effects: [],
        feature_attributes: [],
        feature_feat_grants: [],
        feature_modifier_grants: [],
        feature_proficiency_grants: [],
        feature_sense_grants: [],
        feature_spell_grants: [],
        feature_options: [],
        feature_option_levels: [],
        ...emptyGrantTables(),
        proficiency_grants: [
          {
            id: 'grant-lang-1',
            sort_order: 1,
            proficiency_kind: 'LANGUAGE',
            selection_kind: 'GRANTED',
            authoring_mode_kind: 'SELECTED',
            count: null,
            level: 'FULL',
            rounding: null,
            restriction_id: null
          }
        ],
        proficiency_grant_languages: [
          { proficiency_grant_id: 'grant-lang-1', language_id: 'common' }
        ],
        details: []
      }) as never
    )

    await expect(repo.findById('creature-npc-1')).resolves.toMatchObject({
      id: 'creature-npc-1',
      label: 'Town Guard',
      quote: undefined,
      description: 'A stalwart defender.',
      status: 'DRAFT',
      details: undefined,
      features: undefined,
      proficiencies: [
        {
          id: 'grant-lang-1',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'LANGUAGE',
          order: 1,
          selectionKind: 'GRANTED',
          authoringModeKind: 'SELECTED',
          level: 'FULL',
          rounding: undefined,
          count: undefined,
          languageIds: ['common'],
          restrictions: undefined
        }
      ],
      userId: 'user-1',
      systemId: 'system-1',
      category: 'NPC',
      creatureTypeId: 'humanoid',
      size: 'MEDIUM',
      alignmentId: undefined,
      tags: undefined,
      abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 10,
        CONSTITUTION: 10,
        INTELLIGENCE: 10,
        WISDOM: 10,
        CHARISMA: 10
      },
      armorClass: 16,
      armorClassNote: 'Chain mail',
      hitPoints: 11,
      hitDice: { count: 2, die: 8, modifier: 2 },
      speeds: [{ speedId: 'walk', amount: 30, unit: 'FEET' }],
      senses: undefined,
      passivePerception: 10,
      challengeRatingId: 'cr-1-8',
      xp: 25,
      mountProfile: undefined,
      companionProfile: undefined,
      npcProfile: undefined
    })
  })

  it('hydrates a BEAST with mountProfile', async () => {
    const mountProfile = {
      mountType: 'CONTROLLED',
      capacity: 1,
      riderCount: 1,
      notes: 'War horse'
    }

    const repo = createCreatureRepository(
      createFakeDb({
        creatures: [
          {
            id: 'creature-beast-1',
            system_id: 'system-1',
            user_id: 'user-1',
            label: 'Warhorse',
            quote: null,
            description: null,
            category: 'BEAST',
            creature_type_id: 'beast',
            size_code: 'LARGE',
            alignment_id: null,
            tags: null,
            ability_scores: {
              STRENGTH: 18,
              DEXTERITY: 12,
              CONSTITUTION: 13,
              INTELLIGENCE: 2,
              WISDOM: 12,
              CHARISMA: 7
            },
            armor_class: 11,
            armor_class_note: null,
            hit_points: 19,
            hit_dice: '3d10+3',
            hit_dice_count: 3,
            hit_die: 10,
            hit_dice_modifier: 3,
            senses: null,
            passive_perception: 11,
            challenge_rating_id: 'cr-1-2',
            xp: 100,
            mount_profile: mountProfile,
            companion_profile: null,
            npc_profile: null
          }
        ],
        creature_proficiency_grants: [],
        creature_features: [],
        creature_details: [],
        creature_speeds: [
          { creature_id: 'creature-beast-1', speed_id: 'walk', amount: 60, unit_code: 'FEET' }
        ],
        features: [],
        feature_effects: [],
        feature_attributes: [],
        feature_feat_grants: [],
        feature_modifier_grants: [],
        feature_proficiency_grants: [],
        feature_sense_grants: [],
        feature_spell_grants: [],
        feature_options: [],
        feature_option_levels: [],
        ...emptyGrantTables(),
        details: []
      }) as never
    )

    const result = await repo.findById('creature-beast-1')
    expect(result).toMatchObject({
      id: 'creature-beast-1',
      category: 'BEAST',
      size: 'LARGE',
      proficiencies: undefined,
      mountProfile: {
        mountType: 'CONTROLLED',
        capacity: 1,
        riderCount: 1,
        notes: 'War horse'
      }
    })
    expect(result?.speeds).toEqual([{ speedId: 'walk', amount: 60, unit: 'FEET' }])
  })

  it('hydrates a MONSTER with root save, skill, and language proficiency grants', async () => {
    const repo = createCreatureRepository(
      createFakeDb({
        creatures: [
          {
            id: 'creature-monster-1',
            system_id: 'system-1',
            user_id: 'user-1',
            label: 'Ancient Red Dragon',
            quote: 'I am fire. I am death.',
            description: 'The apex of draconic might.',
            category: 'MONSTER',
            creature_type_id: 'dragon',
            size_code: 'GARGANTUAN',
            alignment_id: 'chaotic-evil',
            tags: ['dragon', 'legendary'],
            ability_scores: {
              STRENGTH: 30,
              DEXTERITY: 10,
              CONSTITUTION: 29,
              INTELLIGENCE: 18,
              WISDOM: 15,
              CHARISMA: 23
            },
            armor_class: 22,
            armor_class_note: 'Natural armor',
            hit_points: 546,
            hit_dice: '28d20+252',
            hit_dice_count: 28,
            hit_die: 20,
            hit_dice_modifier: 252,
            senses: ['blindsight-60', 'darkvision-120', 'tremorsense-60'],
            passive_perception: 26,
            challenge_rating_id: 'cr-24',
            xp: 62000,
            mount_profile: null,
            companion_profile: null,
            npc_profile: null
          }
        ],
        creature_proficiency_grants: [
          {
            creature_id: 'creature-monster-1',
            proficiency_grant_id: 'grant-save-1',
            sort_order: 1
          },
          {
            creature_id: 'creature-monster-1',
            proficiency_grant_id: 'grant-skill-1',
            sort_order: 2
          },
          { creature_id: 'creature-monster-1', proficiency_grant_id: 'grant-lang-1', sort_order: 3 }
        ],
        creature_features: [
          { creature_id: 'creature-monster-1', feature_id: 'feature-legendary', sort_order: 0 }
        ],
        creature_details: [],
        creature_speeds: [
          {
            creature_id: 'creature-monster-1',
            speed_id: 'fly',
            amount: 80,
            unit_code: 'FEET',
            sort_order: 2
          },
          {
            creature_id: 'creature-monster-1',
            speed_id: 'walk',
            amount: 40,
            unit_code: 'FEET',
            sort_order: 1
          }
        ],
        creature_damage_resistances: [
          { creature_id: 'creature-monster-1', damage_type_id: 'lightning', sort_order: 2 },
          { creature_id: 'creature-monster-1', damage_type_id: 'cold', sort_order: 1 }
        ],
        creature_damage_immunities: [
          { creature_id: 'creature-monster-1', damage_type_id: 'poison', sort_order: 2 },
          { creature_id: 'creature-monster-1', damage_type_id: 'fire', sort_order: 1 }
        ],
        creature_damage_vulnerabilities: [
          { creature_id: 'creature-monster-1', damage_type_id: 'force', sort_order: 2 },
          { creature_id: 'creature-monster-1', damage_type_id: 'radiant', sort_order: 1 }
        ],
        creature_condition_immunities: [],
        features: [
          {
            id: 'feature-legendary',
            label: 'Legendary Resistance',
            description: 'If the dragon fails a saving throw, it can choose to succeed instead.',
            section_code: 'TRAIT',
            charge_id: null,
            restriction_id: null,
            sort_order: 0,
            available_at_level: null
          }
        ],
        feature_effects: [],
        feature_attributes: [],
        feature_feat_grants: [],
        feature_modifier_grants: [],
        feature_proficiency_grants: [],
        feature_sense_grants: [],
        feature_spell_grants: [],
        feature_options: [],
        feature_option_levels: [],
        ...emptyGrantTables(),
        proficiency_grants: [
          {
            id: 'grant-save-1',
            sort_order: 1,
            proficiency_kind: 'SAVE_ABILITY',
            selection_kind: 'GRANTED',
            authoring_mode_kind: 'SELECTED',
            count: null,
            level: 'FULL',
            rounding: null,
            restriction_id: null
          },
          {
            id: 'grant-skill-1',
            sort_order: 2,
            proficiency_kind: 'SKILL',
            selection_kind: 'GRANTED',
            authoring_mode_kind: 'SELECTED',
            count: null,
            level: 'FULL',
            rounding: null,
            restriction_id: null
          },
          {
            id: 'grant-lang-1',
            sort_order: 3,
            proficiency_kind: 'LANGUAGE',
            selection_kind: 'GRANTED',
            authoring_mode_kind: 'SELECTED',
            count: null,
            level: 'FULL',
            rounding: null,
            restriction_id: null
          }
        ],
        proficiency_grant_skills: [
          { proficiency_grant_id: 'grant-skill-1', skill_id: 'perception' },
          { proficiency_grant_id: 'grant-skill-1', skill_id: 'stealth' }
        ],
        proficiency_grant_save_abilities: [
          { proficiency_grant_id: 'grant-save-1', ability_code: 'DEXTERITY' },
          { proficiency_grant_id: 'grant-save-1', ability_code: 'CONSTITUTION' },
          { proficiency_grant_id: 'grant-save-1', ability_code: 'WISDOM' },
          { proficiency_grant_id: 'grant-save-1', ability_code: 'CHARISMA' }
        ],
        proficiency_grant_languages: [
          { proficiency_grant_id: 'grant-lang-1', language_id: 'common' },
          { proficiency_grant_id: 'grant-lang-1', language_id: 'draconic' }
        ],
        details: []
      }) as never
    )

    const result = await repo.findById('creature-monster-1')

    expect(result).toMatchObject({
      id: 'creature-monster-1',
      label: 'Ancient Red Dragon',
      category: 'MONSTER',
      size: 'GARGANTUAN',
      tags: ['dragon', 'legendary'],
      proficiencies: [
        {
          id: 'grant-save-1',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'SAVE_ABILITY',
          abilities: ['DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA']
        },
        {
          id: 'grant-skill-1',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'SKILL',
          skillIds: ['perception', 'stealth']
        },
        {
          id: 'grant-lang-1',
          grantKind: 'PROFICIENCY_GRANT',
          proficiencyKind: 'LANGUAGE',
          languageIds: ['common', 'draconic']
        }
      ],
      challengeRatingId: 'cr-24',
      xp: 62000,
      damageResistances: ['cold', 'lightning'],
      damageImmunities: ['fire', 'poison'],
      damageVulnerabilities: ['radiant', 'force']
    })

    expect(result?.features).toHaveLength(1)
    expect(result?.features?.[0]).toMatchObject({
      id: 'feature-legendary',
      label: 'Legendary Resistance',
      section: 'TRAIT'
    })

    expect(result?.speeds).toEqual([
      { speedId: 'walk', amount: 40, unit: 'FEET' },
      { speedId: 'fly', amount: 80, unit: 'FEET' }
    ])
    expect(result?.mountProfile).toBeUndefined()
  })

  it('hydrates creature logistics fields without a competing record kind', async () => {
    const repo = createCreatureRepository(
      createFakeDb({
        creatures: [
          {
            id: 'creature-logistics-1',
            system_id: 'system-1',
            user_id: 'user-1',
            label: 'Riding Horse',
            quote: null,
            description: 'A dependable riding animal.',
            category: 'BEAST',
            creature_type_id: 'beast',
            size_code: null,
            alignment_id: null,
            tags: ['mount'],
            ability_scores: null,
            armor_class: null,
            armor_class_note: null,
            hit_points: null,
            hit_dice: null,
            hit_dice_count: null,
            hit_die: null,
            hit_dice_modifier: null,
            senses: null,
            passive_perception: null,
            challenge_rating_id: null,
            xp: null,
            mount_profile: {
              mountType: 'CONTROLLED',
              riderCount: 1,
              capacity: 1,
              notes: 'Common mount'
            },
            companion_profile: null,
            npc_profile: null,
            cost: { amount: 75, currencyId: 'gp' },
            carrying_capacity_amount: 480,
            carrying_capacity_unit: 'POUNDS',
            logistics_notes: ['Requires saddle for riding.']
          }
        ],
        creature_proficiency_grants: [],
        creature_features: [],
        creature_details: [],
        creature_speeds: [
          { creature_id: 'creature-logistics-1', speed_id: 'walk', amount: 60, unit_code: 'FEET' }
        ],
        creature_damage_resistances: [],
        creature_damage_immunities: [],
        creature_damage_vulnerabilities: [],
        creature_condition_immunities: [],
        features: [],
        feature_effects: [],
        feature_attributes: [],
        feature_feat_grants: [],
        feature_modifier_grants: [],
        feature_proficiency_grants: [],
        feature_sense_grants: [],
        feature_spell_grants: [],
        feature_options: [],
        feature_option_levels: [],
        ...emptyGrantTables(),
        details: []
      }) as never
    )

    await expect(repo.findById('creature-logistics-1')).resolves.toMatchObject({
      id: 'creature-logistics-1',
      label: 'Riding Horse',
      quote: undefined,
      description: 'A dependable riding animal.',
      status: 'DRAFT',
      details: undefined,
      features: undefined,
      proficiencies: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'BEAST',
      creatureTypeId: 'beast',
      size: 'MEDIUM',
      alignmentId: undefined,
      tags: ['mount'],
      speeds: [{ speedId: 'walk', amount: 60, unit: 'FEET' }],
      mountProfile: {
        mountType: 'CONTROLLED',
        riderCount: 1,
        capacity: 1,
        notes: 'Common mount'
      },
      companionProfile: undefined,
      cost: { amount: 75, currencyId: 'gp' },
      carryingCapacity: { amount: 480, unit: 'POUNDS' },
      logisticsNotes: ['Requires saddle for riding.']
    })
  })

  it('returns null for an unknown id', async () => {
    const repo = createCreatureRepository(createFakeDb({ creatures: [] }) as never)
    await expect(repo.findById('does-not-exist')).resolves.toBeNull()
  })

  it('rejects malformed JSON profiles instead of asserting them as authored data', async () => {
    const repo = createCreatureRepository(
      createFakeDb({
        creatures: [
          {
            id: 'creature-invalid-profile',
            system_id: 'system-1',
            user_id: 'user-1',
            label: 'Invalid Creature',
            category: 'MONSTER',
            creature_type_id: 'creature-type-1',
            size_code: 'MEDIUM',
            ability_scores: {
              STRENGTH: 10,
              DEXTERITY: 10,
              CONSTITUTION: 10,
              INTELLIGENCE: 10,
              WISDOM: 10,
              CHARISMA: 10
            },
            armor_class: 10,
            hit_points: 10,
            mount_profile: { mountType: 'CONTROLLED', riderCount: 'one' }
          }
        ],
        creature_proficiency_grants: [],
        creature_features: [],
        creature_details: [],
        creature_speeds: [],
        creature_damage_resistances: [],
        creature_damage_immunities: [],
        creature_damage_vulnerabilities: [],
        creature_condition_immunities: []
      }) as unknown as DBLike
    )

    await expect(repo.findById('creature-invalid-profile')).rejects.toThrow(
      'Creature "creature-invalid-profile" has invalid mount_profile.'
    )
  })

  it('throws when creature is missing user_id', async () => {
    const repo = createCreatureRepository(
      createFakeDb({
        creatures: [
          {
            id: 'creature-no-user',
            system_id: 'system-1',
            user_id: null,
            label: 'Ghost',
            quote: null,
            description: null,
            category: 'MONSTER',
            creature_type_id: null,
            size_code: 'MEDIUM',
            alignment_id: null,
            tags: null,
            ability_scores: BASE_ABILITY_SCORES,
            armor_class: 11,
            armor_class_note: null,
            hit_points: 45,
            hit_dice: null,
            hit_dice_count: null,
            hit_die: null,
            hit_dice_modifier: null,
            senses: null,
            passive_perception: 11,
            challenge_rating_id: null,
            xp: null,
            mount_profile: null,
            companion_profile: null,
            npc_profile: null
          }
        ],
        creature_proficiency_grants: [],
        creature_features: [],
        creature_details: [],
        creature_speeds: [],
        features: [],
        feature_effects: [],
        feature_attributes: [],
        feature_feat_grants: [],
        feature_modifier_grants: [],
        feature_proficiency_grants: [],
        feature_sense_grants: [],
        feature_spell_grants: [],
        feature_options: [],
        feature_option_levels: [],
        ...emptyGrantTables(),
        details: []
      }) as never
    )

    await expect(repo.findById('creature-no-user')).rejects.toThrow(
      'Creature "creature-no-user" is missing user ownership and cannot be hydrated.'
    )
  })
})
