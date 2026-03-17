import { describe, expect, it } from 'vitest'
import { createCreatureRepository } from '../domains/subjects/repositories/creature.js'

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
        where(column: string, _op: string, value: string) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
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

describe('createCreatureRepository', () => {
  it('hydrates a minimal NPC creature with no profiles', async () => {
    const repo = createCreatureRepository(createFakeDb({
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
          senses: null,
          passive_perception: 10,
          saving_throw_proficiencies: null,
          skill_proficiencies: null,
          languages: ['common'],
          challenge_rating_id: 'cr-1-8',
          xp: 25,
          legendary_profile: null,
          lair_profile: null,
          mount_profile: null,
          companion_profile: null,
          npc_profile: null,
        }
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
      details: [],
    }) as never)

    await expect(repo.findById('creature-npc-1')).resolves.toEqual({
      id: 'creature-npc-1',
      label: 'Town Guard',
      quote: undefined,
      description: 'A stalwart defender.',
      details: undefined,
      features: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'NPC',
      creatureTypeId: 'humanoid',
      size: 'MEDIUM',
      alignmentId: undefined,
      tags: undefined,
      abilityScores: BASE_ABILITY_SCORES,
      armorClass: 16,
      armorClassNote: 'Chain mail',
      hitPoints: 11,
      hitDice: '2d8+2',
      speeds: [{ speedId: 'walk', amount: 30, unit: 'FEET' }],
      senses: undefined,
      passivePerception: 10,
      savingThrowProficiencies: undefined,
      skillProficiencies: undefined,
      languages: ['common'],
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
      bonusActions: undefined,
      reactions: undefined,
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
          saving_throw_proficiencies: null,
          skill_proficiencies: null,
          languages: null,
          challenge_rating_id: 'cr-1-2',
          xp: 100,
          legendary_profile: null,
          lair_profile: null,
          mount_profile: mountProfile,
          companion_profile: null,
          npc_profile: null,
        }
      ],
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
      details: [],
    }) as never)

    const result = await repo.findById('creature-beast-1')
    expect(result).toMatchObject({
      id: 'creature-beast-1',
      category: 'BEAST',
      size: 'LARGE',
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

  it('hydrates a MONSTER with legendaryProfile, lairProfile, bonus actions and reactions', async () => {
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
          saving_throw_proficiencies: ['DEX', 'CON', 'WIS', 'CHA'],
          skill_proficiencies: ['perception', 'stealth'],
          languages: ['common', 'draconic'],
          challenge_rating_id: 'cr-24',
          xp: 62000,
          legendary_profile: legendaryProfile,
          lair_profile: lairProfile,
          mount_profile: null,
          companion_profile: null,
          npc_profile: null,
        }
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
          detail: null,
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
      details: [],
    }) as never)

    const result = await repo.findById('creature-monster-1')

    expect(result).toMatchObject({
      id: 'creature-monster-1',
      label: 'Ancient Red Dragon',
      category: 'MONSTER',
      size: 'GARGANTUAN',
      tags: ['dragon', 'legendary'],
      savingThrowProficiencies: ['DEX', 'CON', 'WIS', 'CHA'],
      skillProficiencies: ['perception', 'stealth'],
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

    expect(result?.legendaryProfile).toEqual({
      legendaryResistanceCount: 3,
      actionsCount: 3,
      actions: [
        { id: 'leg-1', label: 'Tail Attack', description: 'Whip its tail.', attackBonus: 7, damage: '2d6+4 bludgeoning', recharge: null }
      ],
    })

    expect(result?.lairProfile).toEqual({
      lairActions: [
        { id: 'lair-1', label: 'Tremor', description: 'The earth shakes.', attackBonus: null, damage: null, recharge: null }
      ],
      regionalEffects: ['Vegetation withers within 6 miles.'],
    })

    expect(result?.mountProfile).toBeUndefined()
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
          saving_throw_proficiencies: null,
          skill_proficiencies: null,
          languages: null,
          challenge_rating_id: null,
          xp: null,
          legendary_profile: null,
          lair_profile: null,
          mount_profile: null,
          companion_profile: null,
          npc_profile: null,
        }
      ],
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
      details: [],
    }) as never)

    await expect(repo.findById('creature-no-user')).rejects.toThrow(
      'Creature "creature-no-user" is missing user ownership and cannot be hydrated.'
    )
  })
})
