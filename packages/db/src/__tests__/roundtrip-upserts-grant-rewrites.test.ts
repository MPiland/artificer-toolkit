import { describe, expect, it } from 'vitest'
import type { DBLike } from '#types'
import { createFeatGrantRepository } from '../repositories/index.js'
import { createModifierGrantRepository } from '../repositories/index.js'
import { createProficiencyGrantRepository } from '../repositories/index.js'
import { createSenseGrantRepository } from '../repositories/index.js'
import { createSpellGrantRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'
describe('round-trip upsert correctness', () => {
  it('rewrites modifier grant payloads idempotently without leaving stale child rows behind', async () => {
    const db = new InMemoryDb()
    const repository = createModifierGrantRepository(db as never, 'system-1')
    await repository.upsert({
      id: 'modifier-1',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL',
      domain: {
        attackDomain: 'MELEE'
      },
      modifierKind: 'ABILITY_MODIFIER_BONUS',
      scope: 'SOURCE',
      payload: {
        ability: 'STRENGTH',
        multiplier: 1
      }
    })
    await repository.upsert({
      id: 'modifier-1',
      grantKind: 'MODIFIER_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      valueDomainCode: 'CHARGE_LIMIT',
      domain: {},
      modifierKind: 'MODIFY_CHARGE_LIMIT',
      scope: 'GLOBAL',
      payload: {
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'PER_LEVEL',
        levels: [{ id: 'modifier-level-1', level: 3, amount: 2 }]
      }
    })
    await expect(repository.findById('modifier-1')).resolves.toEqual({
      id: 'modifier-1',
      grantKind: 'MODIFIER_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      valueDomainCode: 'CHARGE_LIMIT',
      domain: {},
      modifierKind: 'MODIFY_CHARGE_LIMIT',
      scope: 'GLOBAL',
      payload: {
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'PER_LEVEL',
        levels: [{ id: 'modifier-level-1', level: 3, amount: 2 }]
      }
    })
    expect(db.snapshot('modifier_grant_domain_params')).toEqual([])
    expect(db.snapshot('modifier_grant_payloads')).toEqual([
      {
        modifier_grant_id: 'modifier-1',
        modifier_kind: 'MODIFY_CHARGE_LIMIT',
        value_domain_code: 'CHARGE_LIMIT',
        numeric_value_kind: null,
        numeric_amount: null,
        numeric_multiplier: null,
        numeric_ability_code: null,
        numeric_skill_id: null,
        numeric_class_id: null,
        numeric_max: null,
        numeric_min: null,
        set_amount: null,
        charge_limit_kind: 'FIXED_AMOUNT',
        charge_scaling_kind: 'PER_LEVEL',
        charge_amount: null,
        charge_multiplier: null,
        charge_min: null,
        charge_max: null,
        dice: null,
        damage_type_id: null,
        condition_type_id: null,
        movement_mode_id: null,
        attribute_id: null,
        range_kind: null,
        duration_kind: null,
        shape_kind: null,
        reset_kind: null
      }
    ])
    expect(db.snapshot('modifier_grant_charge_levels')).toEqual([
      {
        id: 'modifier-level-1',
        modifier_grant_id: 'modifier-1',
        level: 3,
        amount: 2,
        sort_order: 1
      }
    ])
    await repository.upsert({
      id: 'modifier-1',
      grantKind: 'MODIFIER_GRANT',
      order: 3,
      selectionKind: 'GRANTED',
      valueDomainCode: 'CHARGE_LIMIT',
      domain: {},
      modifierKind: 'MODIFY_CHARGE_LIMIT',
      scope: 'GLOBAL',
      payload: {
        ability: 'CHARISMA',
        limitKind: 'ABILITY_MODIFIER',
        max: 5,
        min: 1,
        multiplier: 2,
        scalingKind: 'NONE'
      }
    })
    await expect(repository.findById('modifier-1')).resolves.toEqual({
      id: 'modifier-1',
      grantKind: 'MODIFIER_GRANT',
      order: 3,
      selectionKind: 'GRANTED',
      valueDomainCode: 'CHARGE_LIMIT',
      domain: {},
      modifierKind: 'MODIFY_CHARGE_LIMIT',
      scope: 'GLOBAL',
      payload: {
        ability: 'CHARISMA',
        limitKind: 'ABILITY_MODIFIER',
        max: 5,
        min: 1,
        multiplier: 2,
        scalingKind: 'NONE'
      }
    })
    expect(db.snapshot('modifier_grant_payloads')).toEqual([
      {
        modifier_grant_id: 'modifier-1',
        modifier_kind: 'MODIFY_CHARGE_LIMIT',
        value_domain_code: 'CHARGE_LIMIT',
        numeric_value_kind: null,
        numeric_amount: null,
        numeric_multiplier: null,
        numeric_ability_code: 'CHARISMA',
        numeric_skill_id: null,
        numeric_class_id: null,
        numeric_max: null,
        numeric_min: null,
        set_amount: null,
        charge_limit_kind: 'ABILITY_MODIFIER',
        charge_scaling_kind: 'NONE',
        charge_amount: null,
        charge_multiplier: 2,
        charge_min: 1,
        charge_max: 5,
        dice: null,
        damage_type_id: null,
        condition_type_id: null,
        movement_mode_id: null,
        attribute_id: null,
        range_kind: null,
        duration_kind: null,
        shape_kind: null,
        reset_kind: null
      }
    ])
    expect(db.snapshot('modifier_grant_charge_levels')).toEqual([])
  })
  it('rewrites feat grant payload shape without leaving stale root or per-level rows behind', async () => {
    const db = new InMemoryDb()
    const repository = createFeatGrantRepository(db as never)
    await repository.upsert({
      id: 'feat-grant-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 2,
      selectionDuplicatePolicy: 'UNIQUE',
      featIds: ['feat-a', 'feat-b']
    })
    await expect(repository.findById('feat-grant-1')).resolves.toEqual({
      id: 'feat-grant-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 2,
      selectionDuplicatePolicy: 'UNIQUE',
      featIds: ['feat-a', 'feat-b'],
      charges: undefined
    })
    await repository.upsert({
      id: 'feat-grant-1',
      grantKind: 'FEAT_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        levels: [
          {
            id: 'feat-level-1',
            level: 3,
            order: 1,
            authoringModeKind: 'SELECTED',
            featIds: ['feat-c']
          }
        ]
      }
    })
    await expect(repository.findById('feat-grant-1')).resolves.toEqual({
      id: 'feat-grant-1',
      grantKind: 'FEAT_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        classId: undefined,
        levels: [
          {
            id: 'feat-level-1',
            level: 3,
            order: 1,
            authoringModeKind: 'SELECTED',
            count: undefined,
            featIds: ['feat-c']
          }
        ]
      },
      charges: undefined
    })
    expect(db.snapshot('feat_grant_feats')).toEqual([])
    expect(db.snapshot('feat_grant_scaling_levels')).toEqual([
      {
        id: 'feat-level-1',
        feat_grant_id: 'feat-grant-1',
        level: 3,
        sort_order: 1,
        authoring_mode_kind: 'SELECTED',
        selection_count: null,
        selection_duplicate_policy: null
      }
    ])
    expect(db.snapshot('feat_grant_scaling_level_feats')).toEqual([
      {
        scaling_level_id: 'feat-level-1',
        feat_id: 'feat-c'
      }
    ])
  })
  it('round-trips chosen spell and sense grant duplicate policies', async () => {
    const db = new InMemoryDb()
    const dbLike = db as unknown as DBLike
    const spellRepository = createSpellGrantRepository(dbLike)
    const senseRepository = createSenseGrantRepository(dbLike)
    await spellRepository.upsert({
      id: 'spell-grant-policy',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 2,
      selectionDuplicatePolicy: 'REPEATABLE',
      spellIds: ['spell-b', 'spell-a']
    })
    await senseRepository.upsert({
      id: 'sense-grant-policy',
      grantKind: 'SENSE_GRANT',
      order: 2,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 1,
      selectionDuplicatePolicy: 'REPEATABLE',
      senseIds: ['darkvision'],
      range: {
        id: 'darkvision-range',
        rangeKind: 'DISTANCE',
        amount: 60,
        unit: 'FEET',
        scaling: {
          scalingKind: 'BREAKPOINTS',
          scalingSource: 'CHARACTER_LEVEL',
          breakpoints: [
            {
              id: 'darkvision-range-level-5',
              level: 5,
              order: 1,
              value: { amount: 90, unit: 'FEET' }
            }
          ]
        }
      }
    })
    await spellRepository.upsert({
      id: 'spell-grant-scaling-policy',
      grantKind: 'SPELL_GRANT',
      order: 3,
      selectionKind: 'CHOSEN',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        levels: [
          {
            id: 'spell-grant-scaling-policy-level-1',
            level: 5,
            order: 1,
            authoringModeKind: 'SELECTED',
            count: 1,
            selectionDuplicatePolicy: 'UNIQUE',
            spellIds: ['spell-d', 'spell-c']
          }
        ]
      }
    })
    await expect(spellRepository.findById('spell-grant-policy')).resolves.toEqual({
      id: 'spell-grant-policy',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 2,
      selectionDuplicatePolicy: 'REPEATABLE',
      spellIds: ['spell-b', 'spell-a'],
      attributes: undefined,
      castAtLevel: undefined,
      charges: undefined,
      filters: undefined,
      restrictions: undefined
    })
    await expect(senseRepository.findById('sense-grant-policy')).resolves.toEqual({
      id: 'sense-grant-policy',
      grantKind: 'SENSE_GRANT',
      order: 2,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 1,
      selectionDuplicatePolicy: 'REPEATABLE',
      senseIds: ['darkvision'],
      charges: undefined,
      range: {
        id: 'darkvision-range',
        rangeKind: 'DISTANCE',
        amount: 60,
        unit: 'FEET',
        scaling: {
          scalingKind: 'BREAKPOINTS',
          scalingSource: 'CHARACTER_LEVEL',
          breakpoints: [
            {
              id: 'darkvision-range-level-5',
              level: 5,
              order: 1,
              value: { amount: 90, unit: 'FEET' }
            }
          ]
        }
      },
      restrictions: undefined
    })
    await expect(spellRepository.findById('spell-grant-scaling-policy')).resolves.toEqual({
      id: 'spell-grant-scaling-policy',
      grantKind: 'SPELL_GRANT',
      order: 3,
      selectionKind: 'CHOSEN',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        classId: undefined,
        levels: [
          {
            id: 'spell-grant-scaling-policy-level-1',
            level: 5,
            order: 1,
            authoringModeKind: 'SELECTED',
            count: 1,
            selectionDuplicatePolicy: 'UNIQUE',
            spellIds: ['spell-d', 'spell-c']
          }
        ]
      },
      attributes: undefined,
      castAtLevel: undefined,
      charges: undefined,
      filters: undefined,
      restrictions: undefined
    })
    expect(db.snapshot('spell_grant_scaling_levels')).toEqual([
      {
        id: 'spell-grant-scaling-policy-level-1',
        spell_grant_id: 'spell-grant-scaling-policy',
        level: 5,
        sort_order: 1,
        authoring_mode_kind: 'SELECTED',
        selection_count: 1,
        selection_duplicate_policy: 'UNIQUE'
      }
    ])
    expect(db.snapshot('spell_grant_spells')).toEqual([
      { spell_grant_id: 'spell-grant-policy', spell_id: 'spell-b', sort_order: 0 },
      { spell_grant_id: 'spell-grant-policy', spell_id: 'spell-a', sort_order: 1 }
    ])
    expect(db.snapshot('spell_grant_scaling_level_spells')).toEqual([
      {
        scaling_level_id: 'spell-grant-scaling-policy-level-1',
        spell_id: 'spell-d',
        sort_order: 0
      },
      {
        scaling_level_id: 'spell-grant-scaling-policy-level-1',
        spell_id: 'spell-c',
        sort_order: 1
      }
    ])
  })
  it('replaces and clears inline sense grant range payloads', async () => {
    const db = new InMemoryDb()
    const repository = createSenseGrantRepository(db as never)
    const baseGrant = {
      id: 'sense-grant-range-rewrite',
      grantKind: 'SENSE_GRANT' as const,
      order: 1,
      selectionKind: 'GRANTED' as const,
      scalingKind: 'NONE' as const,
      authoringModeKind: 'SELECTED' as const,
      senseIds: ['darkvision']
    }

    await repository.upsert({
      ...baseGrant,
      range: {
        id: 'sense-grant-range-special',
        rangeKind: 'SPECIAL'
      }
    })
    await expect(repository.findById(baseGrant.id)).resolves.toMatchObject({
      range: {
        id: 'sense-grant-range-special',
        rangeKind: 'SPECIAL'
      }
    })

    await repository.upsert(baseGrant)
    const hydrated = await repository.findById(baseGrant.id)
    expect(hydrated).not.toHaveProperty('range')
    expect(db.snapshot('sense_grants')).toEqual([
      expect.objectContaining({
        range_id: null,
        range_kind: null,
        range_amount: null,
        range_unit: null,
        range_scaling: null
      })
    ])
  })
  it('preserves multiple same-kind charge bonuses and rewrites stale charge children idempotently', async () => {
    const db = new InMemoryDb()
    const repository = createFeatGrantRepository(db as never)
    await repository.upsert({
      id: 'feat-grant-charge-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 3,
        bonuses: [
          {
            id: 'charge-bonus-1',
            bonusKind: 'SKILL_BONUS',
            skillId: 'skill-1',
            order: 1
          },
          {
            id: 'charge-bonus-2',
            bonusKind: 'SKILL_BONUS',
            skillId: 'skill-2',
            order: 2
          }
        ]
      }
    })
    await expect(repository.findById('feat-grant-charge-1')).resolves.toEqual({
      id: 'feat-grant-charge-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      featIds: undefined,
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 3,
        bonuses: [
          {
            id: 'charge-bonus-1',
            bonusKind: 'SKILL_BONUS',
            skillId: 'skill-1',
            multiplier: undefined,
            min: undefined,
            max: undefined,
            order: 1
          },
          {
            id: 'charge-bonus-2',
            bonusKind: 'SKILL_BONUS',
            skillId: 'skill-2',
            multiplier: undefined,
            min: undefined,
            max: undefined,
            order: 2
          }
        ]
      }
    })
    await repository.upsert({
      id: 'feat-grant-charge-1',
      grantKind: 'FEAT_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 5,
        bonuses: [
          {
            id: 'charge-bonus-3',
            bonusKind: 'PROFICIENCY_BONUS',
            order: 1
          }
        ]
      }
    })
    await expect(repository.findById('feat-grant-charge-1')).resolves.toEqual({
      id: 'feat-grant-charge-1',
      grantKind: 'FEAT_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      featIds: undefined,
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 5,
        bonuses: [
          {
            id: 'charge-bonus-3',
            bonusKind: 'PROFICIENCY_BONUS',
            multiplier: undefined,
            min: undefined,
            max: undefined,
            order: 1
          }
        ]
      }
    })
    expect(db.snapshot('charge_limits')).toEqual([
      {
        charge_id: 'charge-1',
        limit_kind: 'FIXED_AMOUNT',
        ability_code: null,
        class_id: null,
        amount: 5,
        cost: null,
        multiplier: null,
        min: null,
        max: null
      }
    ])
    expect(db.snapshot('charge_bonuses')).toEqual([
      {
        id: 'charge-bonus-3',
        charge_id: 'charge-1',
        bonus_kind: 'PROFICIENCY_BONUS',
        ability_code: null,
        skill_id: null,
        multiplier: null,
        min: null,
        max: null,
        sort_order: 1
      }
    ])
  })
  it('switches proficiency grant kinds idempotently and clears stale child rows', async () => {
    const db = new InMemoryDb()
    const repository = createProficiencyGrantRepository(db as never)
    await repository.upsert({
      id: 'proficiency-1',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      skillIds: ['skill-1'],
      level: 'FULL'
    })
    await repository.upsert({
      id: 'proficiency-1',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      order: 2,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 1,
      selectionDuplicatePolicy: 'UNIQUE',
      properties: ['LIGHT'],
      category: 'WEAPON',
      level: 'HALF',
      rounding: 'UP'
    })
    await expect(repository.findById('proficiency-1')).resolves.toEqual({
      id: 'proficiency-1',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      order: 2,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      level: 'HALF',
      rounding: 'UP',
      count: 1,
      selectionDuplicatePolicy: 'UNIQUE',
      properties: ['LIGHT'],
      category: 'WEAPON',
      restrictions: undefined
    })
    expect(db.snapshot('proficiency_grant_skills')).toEqual([])
    expect(db.snapshot('proficiency_grant_equipment_properties')).toEqual([
      {
        proficiency_grant_id: 'proficiency-1',
        property_code: 'LIGHT'
      }
    ])
    expect(db.snapshot('proficiency_grant_equipment_property_filters')).toEqual([
      {
        proficiency_grant_id: 'proficiency-1',
        category_code: 'WEAPON'
      }
    ])
  })
})
