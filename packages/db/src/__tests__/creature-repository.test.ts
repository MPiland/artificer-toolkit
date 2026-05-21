import { describe, expect, it } from 'vitest'
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

const BASE_ABILITY_SCORES = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }

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
    proficiency_grant_equipment_property_filters: [],
  }
}

describe('createCreatureRepository', () => {
  it('persists and hydrates SRD dragon legendary action options from source data', async () => {
    const repository = createCreatureRepository(new InMemoryDb() as never)
    const sourceDragons = [
      CREATURE_IDS.ADULT_BLACK_DRAGON,
      CREATURE_IDS.ADULT_BRASS_DRAGON
    ].map((id) => {
      const creature = srdCreatures.find((candidate) => candidate.id === id)
      if (!creature) throw new Error(`Missing SRD creature ${id}`)
      return creature
    })

    for (const creature of sourceDragons) {
      await repository.upsert(creature)
    }

    for (const creature of sourceDragons) {
      const hydrated = await repository.findById(creature.id)
      const legendaryActions = hydrated?.features?.find((feature) => feature.label === 'Legendary Actions')
      const legendaryResistance = hydrated?.features?.find((feature) => feature.label.startsWith('Legendary Resistance'))

      expect(legendaryActions?.options?.map((option) => option.label), `${creature.label} legendary options`).toEqual([
        'Detect',
        'Tail Attack',
        'Wing Attack (Costs 2 Actions)'
      ])
      expect(legendaryActions?.options?.find((option) => option.label === 'Tail Attack')?.effects?.length).toBeGreaterThan(0)
      expect(legendaryResistance, `${creature.label} legendary resistance`).toBeDefined()
    }
  })

  it('hydrates a minimal NPC creature with root language proficiency grants', async () => {
    const repo = createCreatureRepository(createFakeDb({
      creatures: [
        {
          id: 'creature-npc-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Town Guard',
          quote: null,
          description: 'A stalwart defender.',
          record_kind: 'STAT_BLOCK',
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
          senses: null,
          passive_perception: 10,
          challenge_rating_id: 'cr-1-8',
          xp: 25,
          legendary_profile: null,
          lair_profile: null,
          mount_profile: null,
          companion_profile: null,
          npc_profile: null,
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
      creature_actions: [
        {
          id: 'action-1',
          creature_id: 'creature-npc-1',
          action_type: 'ACTION',
          sort_order: 0,
          label: 'Spear',
          description: 'Melee or Ranged Weapon Attack.',
          attack_bonus: 3,
          damage: '1d6+1 piercing',
          recharge: null,
        }
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
      details: [],
    }) as never)

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
      recordKind: 'STAT_BLOCK',
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
        CHARISMA: 10,
        SPELLCASTING: 0
      },
      armorClass: 16,
      armorClassNote: 'Chain mail',
      hitPoints: 11,
      hitDice: '2d8+2',
      speeds: [{ speedId: 'walk', amount: 30, unit: 'FEET' }],
      senses: undefined,
      passivePerception: 10,
      challengeRatingId: 'cr-1-8',
      xp: 25,
      actions: [
        {
          id: 'action-1',
          label: 'Spear',
          description: 'Melee or Ranged Weapon Attack.',
          attackBonus: 3,
          damage: '1d6+1 piercing',
          recharge: undefined,
        }
      ],
      bonusActions: [],
      reactions: [],
      damageVulnerabilities: [],
      damageResistances: [],
      damageImmunities: [],
      conditionImmunities: [],
      legendaryProfile: undefined,
      lairProfile: undefined,
      mountProfile: undefined,
      companionProfile: undefined,
      npcProfile: undefined,
    })
  })

  it('hydrates a BEAST with mountProfile', async () => {
    const mountProfile = {
      mountType: 'CONTROLLED',
      capacity: 1,
      riderCount: 1,
      notes: 'War horse',
    }

    const repo = createCreatureRepository(createFakeDb({
      creatures: [
        {
          id: 'creature-beast-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Warhorse',
          quote: null,
          description: null,
          record_kind: 'STAT_BLOCK',
          category: 'BEAST',
          creature_type_id: 'beast',
          size_code: 'LARGE',
          alignment_id: null,
          tags: null,
          ability_scores: { STR: 18, DEX: 12, CON: 13, INT: 2, WIS: 12, CHA: 7 },
          armor_class: 11,
          armor_class_note: null,
          hit_points: 19,
          hit_dice: '3d10+3',
          senses: null,
          passive_perception: 11,
          challenge_rating_id: 'cr-1-2',
          xp: 100,
          legendary_profile: null,
          lair_profile: null,
          mount_profile: mountProfile,
          companion_profile: null,
          npc_profile: null,
        }
      ],
      creature_proficiency_grants: [],
      creature_features: [],
      creature_details: [],
      creature_speeds: [
        { creature_id: 'creature-beast-1', speed_id: 'walk', amount: 60, unit_code: 'FEET' }
      ],
      creature_actions: [],
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
      details: [],
    }) as never)

    const result = await repo.findById('creature-beast-1')
    expect(result).toMatchObject({
      id: 'creature-beast-1',
      recordKind: 'STAT_BLOCK',
      category: 'BEAST',
      size: 'LARGE',
      proficiencies: undefined,
      mountProfile: {
        mountType: 'CONTROLLED',
        capacity: 1,
        riderCount: 1,
        notes: 'War horse',
      },
      legendaryProfile: undefined,
      lairProfile: undefined,
    })
    expect(result?.speeds).toEqual([{ speedId: 'walk', amount: 60, unit: 'FEET' }])
  })

  it('hydrates a MONSTER with root save, skill, and language proficiency grants', async () => {
    const legendaryProfile = {
      legendaryResistanceCount: 3,
      actionsCount: 3,
      actions: [
        { id: 'leg-1', label: 'Tail Attack', description: 'Whip its tail.', attackBonus: 7, damage: '2d6+4 bludgeoning', recharge: null }
      ],
    }
    const lairProfile = {
      lairActions: [
        { id: 'lair-1', label: 'Tremor', description: 'The earth shakes.', attackBonus: null, damage: null, recharge: null }
      ],
      regionalEffects: ['Vegetation withers within 6 miles.'],
    }

    const repo = createCreatureRepository(createFakeDb({
      creatures: [
        {
          id: 'creature-monster-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Ancient Red Dragon',
          quote: 'I am fire. I am death.',
          description: 'The apex of draconic might.',
          record_kind: 'STAT_BLOCK',
          category: 'MONSTER',
          creature_type_id: 'dragon',
          size_code: 'GARGANTUAN',
          alignment_id: 'chaotic-evil',
          tags: ['dragon', 'legendary'],
          ability_scores: { STR: 30, DEX: 10, CON: 29, INT: 18, WIS: 15, CHA: 23 },
          armor_class: 22,
          armor_class_note: 'Natural armor',
          hit_points: 546,
          hit_dice: '28d20+252',
          senses: ['blindsight-60', 'darkvision-120', 'tremorsense-60'],
          passive_perception: 26,
          challenge_rating_id: 'cr-24',
          xp: 62000,
          legendary_profile: legendaryProfile,
          lair_profile: lairProfile,
          mount_profile: null,
          companion_profile: null,
          npc_profile: null,
        }
      ],
      creature_proficiency_grants: [
        { creature_id: 'creature-monster-1', proficiency_grant_id: 'grant-save-1', sort_order: 1 },
        { creature_id: 'creature-monster-1', proficiency_grant_id: 'grant-skill-1', sort_order: 2 },
        { creature_id: 'creature-monster-1', proficiency_grant_id: 'grant-lang-1', sort_order: 3 }
      ],
      creature_features: [
        { creature_id: 'creature-monster-1', feature_id: 'feature-legendary', sort_order: 0 }
      ],
      creature_details: [],
      creature_speeds: [
        { creature_id: 'creature-monster-1', speed_id: 'walk', amount: 40, unit_code: 'FEET' },
        { creature_id: 'creature-monster-1', speed_id: 'fly', amount: 80, unit_code: 'FEET' },
      ],
      creature_actions: [
        {
          id: 'action-bite',
          creature_id: 'creature-monster-1',
          action_type: 'ACTION',
          sort_order: 0,
          label: 'Bite',
          description: 'Melee Weapon Attack.',
          attack_bonus: 17,
          damage: '2d10+10 piercing',
          recharge: null,
        },
        {
          id: 'action-fire-breath',
          creature_id: 'creature-monster-1',
          action_type: 'ACTION',
          sort_order: 1,
          label: 'Fire Breath',
          description: 'Exhale fire in a 90-foot cone.',
          attack_bonus: null,
          damage: '26d6 fire',
          recharge: '5-6',
        },
        {
          id: 'bonus-detect',
          creature_id: 'creature-monster-1',
          action_type: 'BONUS_ACTION',
          sort_order: 0,
          label: 'Detect',
          description: 'Make a Wisdom (Perception) check.',
          attack_bonus: null,
          damage: null,
          recharge: null,
        },
        {
          id: 'reaction-wing',
          creature_id: 'creature-monster-1',
          action_type: 'REACTION',
          sort_order: 0,
          label: 'Wing Attack',
          description: 'Beat its wings.',
          attack_bonus: null,
          damage: '2d6+10 bludgeoning',
          recharge: null,
        },
      ],
      features: [
        {
          id: 'feature-legendary',
          label: 'Legendary Resistance',
          description: 'If the dragon fails a saving throw, it can choose to succeed instead.',
          charge_id: null,
          restriction_id: null,
          sort_order: 0,
          available_at_level: null,
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
      details: [],
    }) as never)

    const result = await repo.findById('creature-monster-1')

    expect(result).toMatchObject({
      id: 'creature-monster-1',
      label: 'Ancient Red Dragon',
      recordKind: 'STAT_BLOCK',
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
    })

    expect(result?.features).toHaveLength(1)
    expect(result?.features?.[0]).toMatchObject({
      id: 'feature-legendary',
      label: 'Legendary Resistance',
    })

    expect(result?.speeds).toHaveLength(2)
    expect(result?.actions).toHaveLength(2)
    expect(result?.actions?.[0]).toMatchObject({ id: 'action-bite', attackBonus: 17 })
    expect(result?.actions?.[1]).toMatchObject({ id: 'action-fire-breath', recharge: '5-6', attackBonus: undefined })
    expect(result?.bonusActions).toHaveLength(1)
    expect(result?.bonusActions?.[0]).toMatchObject({ id: 'bonus-detect' })
    expect(result?.reactions).toHaveLength(1)
    expect(result?.reactions?.[0]).toMatchObject({ id: 'reaction-wing' })
    expect(result?.legendaryProfile).toEqual(legendaryProfile)
    expect(result?.lairProfile).toEqual(lairProfile)
    expect(result?.mountProfile).toBeUndefined()
  })

  it('hydrates a logistics-only creature record', async () => {
    const repo = createCreatureRepository(createFakeDb({
      creatures: [
        {
          id: 'creature-logistics-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Riding Horse',
          quote: null,
          description: 'A dependable riding animal.',
          record_kind: 'LOGISTICS',
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
          senses: null,
          passive_perception: null,
          challenge_rating_id: null,
          xp: null,
          legendary_profile: null,
          lair_profile: null,
          mount_profile: { mountType: 'CONTROLLED', riderCount: 1, capacity: 1, notes: 'Common mount' },
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
      creature_actions: [],
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
      details: [],
    }) as never)

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
      recordKind: 'LOGISTICS',
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

  it('throws when creature is missing user_id', async () => {
    const repo = createCreatureRepository(createFakeDb({
      creatures: [
        {
          id: 'creature-no-user',
          system_id: 'system-1',
          user_id: null,
          label: 'Ghost',
          quote: null,
          description: null,
          record_kind: 'STAT_BLOCK',
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
          senses: null,
          passive_perception: 11,
          challenge_rating_id: null,
          xp: null,
          legendary_profile: null,
          lair_profile: null,
          mount_profile: null,
          companion_profile: null,
          npc_profile: null,
        }
      ],
      creature_proficiency_grants: [],
      creature_features: [],
      creature_details: [],
      creature_speeds: [],
      creature_actions: [],
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
      details: [],
    }) as never)

    await expect(repo.findById('creature-no-user')).rejects.toThrow(
      'Creature "creature-no-user" is missing user ownership and cannot be hydrated.'
    )
  })
})
