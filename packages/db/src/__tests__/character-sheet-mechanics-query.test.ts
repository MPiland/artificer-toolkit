import { describe, expect, it } from 'vitest'
import { getCharacterSheetMechanicsQuery } from '../domains/subjects/queries/getCharacterSheetMechanicsQuery.js'
import type { DBLike } from '../types/index.js'

type QueryRows = Record<string, unknown>[]

interface QueryTrace {
  table: string
  filters: Array<{ column: string; operation: string; value: unknown }>
  orderBy: string[]
}

function createProjectionDb(rowsByTable: Record<string, QueryRows>, traces: QueryTrace[]): DBLike {
  return {
    selectFrom(table: string) {
      const trace: QueryTrace = { table, filters: [], orderBy: [] }
      traces.push(trace)

      const builder = {
        innerJoin(..._arguments: unknown[]) {
          return builder
        },
        leftJoin(..._arguments: unknown[]) {
          return builder
        },
        select(..._arguments: unknown[]) {
          return builder
        },
        where(column: string, operation: string, value: unknown) {
          trace.filters.push({ column, operation, value })
          return builder
        },
        orderBy(column: string) {
          trace.orderBy.push(column)
          return builder
        },
        async execute(): Promise<QueryRows> {
          return rowsByTable[table] ?? []
        }
      }

      return builder
    }
  } as unknown as DBLike
}

const rowsByTable: Record<string, QueryRows> = {
  spells: [
    {
      ownerId: 'spell-1',
      label: 'Flame Lance',
      description: 'A focused lance of fire.',
      level: 2,
      magicSchoolId: 'school-evocation',
      magicSchoolCode: 'EVOCATION',
      magicSchoolLabel: 'Evocation',
      castingTimeUnit: 'ACTION',
      castingTimeAmount: 1,
      materialDescription: null,
      effectId: 'effect-spell-1',
      ownerEffectOrder: 1,
      effectOrder: 4
    }
  ],
  features: [
    {
      ownerId: 'feature-1',
      label: 'Arcane Burst',
      description: 'Discharge stored force.',
      sectionCode: 'ACTION',
      availableAtLevel: 3,
      chargeId: 'charge-feature-1',
      effectId: 'effect-feature-1',
      ownerEffectOrder: 2,
      effectOrder: 5
    }
  ],
  options: [
    {
      ownerId: 'feature-option-1',
      label: 'Force Ballista',
      description: 'A focused arcane cannon configuration.',
      order: 2,
      chargeId: 'charge-feature-option-1',
      effectId: 'effect-feature-option-1',
      ownerEffectOrder: 2,
      effectOrder: 7
    }
  ],
  feats: [
    {
      ownerId: 'feat-1',
      label: 'Elemental Adept',
      description: 'Harness fire with unusual intensity.',
      chargeId: 'charge-feat-1',
      effectId: 'effect-feat-1',
      ownerEffectOrder: 1,
      effectOrder: 8
    }
  ],
  equipment: [
    {
      ownerId: 'equipment-1',
      label: 'Ember Wand',
      description: 'A warm wand.',
      category: 'WEAPON',
      requiresAttunement: true,
      chargeId: 'charge-equipment-1',
      effectId: 'effect-equipment-1',
      ownerEffectOrder: 3,
      effectOrder: 6
    }
  ],
  spell_attributes: [{ ownerId: 'spell-1', attributeCode: 'VERBAL', order: 1 }],
  feature_attributes: [{ ownerId: 'feature-1', attributeCode: 'LIMITED_USE', order: 1 }],
  option_attributes: [{ ownerId: 'feature-option-1', attributeCode: 'LIMITED_USE', order: 1 }],
  equipment_attributes: [{ ownerId: 'equipment-1', attributeCode: 'MAGICAL', order: 1 }],
  effect_invocations: [
    {
      effectId: 'effect-spell-1',
      triggerCode: 'SAVING_THROW',
      activationType: 'ACTION',
      activationValue: 1,
      resourceChargeId: 'charge-feature-1',
      resourceCost: 2,
      rangeCharacteristicId: 'range-1',
      shapeCharacteristicId: 'shape-1',
      savingThrowId: 'save-1',
      targetSelectionKind: 'CHOSEN_CREATURES',
      targetDispositionKind: 'HOSTILE',
      maxTargets: 1,
      maxTargetsScaling: null,
      resolutionCount: null,
      resolutionCountScaling: null,
      allowRepeatedTargets: null,
      excludedCreatureTypeIds: null
    },
    {
      effectId: 'effect-feat-1',
      triggerCode: 'ATTACK_ROLL',
      activationType: 'ACTION',
      activationValue: 1,
      resourceChargeId: null,
      resourceCost: null,
      rangeCharacteristicId: 'range-1',
      shapeCharacteristicId: null,
      savingThrowId: null,
      targetSelectionKind: 'CHOSEN_CREATURES',
      targetDispositionKind: 'HOSTILE',
      maxTargets: 1,
      maxTargetsScaling: null,
      resolutionCount: null,
      resolutionCountScaling: null,
      allowRepeatedTargets: null,
      excludedCreatureTypeIds: null
    }
  ],
  effect_paths: [
    {
      pathId: 'path-1',
      effectId: 'effect-spell-1',
      order: 2,
      pathCode: 'ON_SAVE_FAIL',
      groupType: 'SINGLE',
      selectionKind: 'FIXED',
      originKind: null,
      rangeOverrideCharacteristicId: null,
      targetSelectionKind: null,
      targetDispositionKind: null,
      maxTargets: null,
      maxTargetsScaling: null,
      resolutionCount: null,
      resolutionCountScaling: null,
      allowRepeatedTargets: null,
      excludedCreatureTypeIds: null,
      resultBlockId: 'result-fixed',
      rollTableKind: null,
      die: null
    },
    {
      pathId: 'path-feat-1',
      effectId: 'effect-feat-1',
      order: 1,
      pathCode: 'ON_HIT',
      groupType: 'SINGLE',
      selectionKind: 'FIXED',
      originKind: null,
      rangeOverrideCharacteristicId: null,
      targetSelectionKind: null,
      targetDispositionKind: null,
      maxTargets: null,
      maxTargetsScaling: null,
      resolutionCount: null,
      resolutionCountScaling: null,
      allowRepeatedTargets: null,
      excludedCreatureTypeIds: null,
      resultBlockId: 'result-feat',
      rollTableKind: null,
      die: null
    }
  ],
  effect_path_choice_options: [
    {
      optionId: 'choice-1',
      pathId: 'path-1',
      label: 'Restore',
      description: null,
      order: 3,
      resultBlockId: 'result-choice'
    }
  ],
  effect_path_roll_table_rows: [
    {
      rowId: 'roll-1',
      pathId: 'path-1',
      order: 4,
      rollValue: 1,
      rollMin: null,
      rollMax: null,
      resultBlockId: 'result-roll'
    }
  ],
  effect_result_blocks: [
    {
      resultBlockId: 'result-fixed',
      resultKind: 'SINGLE',
      durationCharacteristicId: 'duration-1',
      lifecycleRecurringKind: null,
      lifecycleConsumeOnFirstEvent: null,
      lifecycleEndOnEvents: null
    },
    {
      resultBlockId: 'result-choice',
      resultKind: 'SINGLE',
      durationCharacteristicId: null,
      lifecycleRecurringKind: null,
      lifecycleConsumeOnFirstEvent: null,
      lifecycleEndOnEvents: null
    },
    {
      resultBlockId: 'result-roll',
      resultKind: 'SINGLE',
      durationCharacteristicId: null,
      lifecycleRecurringKind: null,
      lifecycleConsumeOnFirstEvent: null,
      lifecycleEndOnEvents: null
    },
    {
      resultBlockId: 'result-feat',
      resultKind: 'SINGLE',
      durationCharacteristicId: null,
      lifecycleRecurringKind: null,
      lifecycleConsumeOnFirstEvent: null,
      lifecycleEndOnEvents: null
    }
  ],
  effect_result_block_outcomes: [
    { resultBlockId: 'result-fixed', outcomeId: 'damage-1', effectKind: 'DAMAGE', order: 1 },
    { resultBlockId: 'result-choice', outcomeId: 'heal-1', effectKind: 'HEAL', order: 1 },
    {
      resultBlockId: 'result-roll',
      outcomeId: 'manual-1',
      effectKind: 'MANUAL_ADJUDICATION',
      order: 1
    },
    {
      resultBlockId: 'result-roll',
      outcomeId: 'condition-1',
      effectKind: 'CONDITION',
      order: 2
    },
    {
      resultBlockId: 'result-feat',
      outcomeId: 'damage-feat-1',
      effectKind: 'DAMAGE',
      order: 1
    }
  ],
  characteristics: [
    {
      characteristicId: 'range-1',
      code: 'RANGE',
      rangeKind: 'DISTANCE',
      rangeMin: 120,
      rangeMax: null,
      rangeUnitCode: 'FEET',
      rangeScaling: null,
      shapeKind: null,
      durationKind: null,
      durationAmount: null,
      durationScaling: null
    },
    {
      characteristicId: 'shape-1',
      code: 'SHAPE',
      rangeKind: null,
      rangeMin: null,
      rangeMax: null,
      rangeUnitCode: null,
      rangeScaling: null,
      shapeKind: 'LINE',
      durationKind: null,
      durationAmount: null,
      durationScaling: null
    },
    {
      characteristicId: 'duration-1',
      code: 'DURATION',
      rangeKind: null,
      rangeMin: null,
      rangeMax: null,
      rangeUnitCode: null,
      rangeScaling: null,
      shapeKind: null,
      durationKind: 'ROUND',
      durationAmount: 1,
      durationScaling: null
    }
  ],
  characteristic_shape_dimensions: [
    {
      characteristicId: 'shape-1',
      dimension: 'LENGTH',
      amount: 30,
      unitCode: 'FEET',
      scaling: null
    }
  ],
  saving_throws: [
    { savingThrowId: 'save-1', dcMethod: 'SOURCE_SAVE_DC', abilityCode: 'DEXTERITY', baseDc: null }
  ],
  saving_throw_dc_bonuses: [
    {
      bonusId: 'save-bonus-1',
      savingThrowId: 'save-1',
      order: 1,
      bonusKind: 'PROFICIENCY_BONUS',
      abilityCode: null,
      amount: null
    }
  ],
  damages: [
    {
      damageId: 'damage-1',
      damageTypeId: 'damage-type-fire',
      damageTypeCode: 'FIRE',
      damageTypeLabel: 'Fire',
      valueKind: 'DICE',
      scalingKind: 'PER_LEVEL',
      amountKind: null,
      amountMultiplier: null,
      scalingSource: 'SPELL_CAST_LEVEL',
      classId: null,
      order: 1,
      valueId: null,
      amount: null,
      dice: null,
      valueMultiplier: null,
      valueMin: null,
      valueMax: null
    },
    {
      damageId: 'damage-feat-1',
      damageTypeId: 'damage-type-fire',
      damageTypeCode: 'FIRE',
      damageTypeLabel: 'Fire',
      valueKind: 'DICE',
      scalingKind: 'NONE',
      amountKind: null,
      amountMultiplier: null,
      scalingSource: null,
      classId: null,
      order: 1,
      valueId: 'damage-feat-1-value',
      amount: null,
      dice: '1d8',
      valueMultiplier: null,
      valueMin: null,
      valueMax: null
    }
  ],
  damage_scaling_levels: [
    {
      scalingId: 'damage-scale-1',
      damageId: 'damage-1',
      level: 2,
      order: 1,
      amount: null,
      dice: '3d6'
    }
  ],
  damage_bonus_kinds: [{ damageId: 'damage-1', bonusKind: 'ABILITY_BONUS', order: 1 }],
  damage_bonuses: [
    {
      bonusId: 'damage-bonus-1',
      damageId: 'damage-1',
      bonusKind: 'ABILITY_BONUS',
      abilityCode: 'INTELLIGENCE',
      skillId: null,
      skillLabel: null,
      multiplier: 1,
      min: null,
      max: null,
      order: 1
    }
  ],
  conditions: [
    {
      conditionId: 'condition-1',
      conditionTypeId: 'condition-type-restrained',
      conditionTypeCode: 'RESTRAINED',
      conditionTypeLabel: 'Restrained'
    }
  ],
  effect_generic_outcomes: [
    {
      outcomeId: 'heal-1',
      effectKind: 'HEAL',
      payload: {
        id: 'heal-1',
        effectKind: 'HEAL',
        valueKind: 'DICE',
        scalingKind: 'NONE',
        diceConfig: '1d8'
      }
    },
    {
      outcomeId: 'manual-1',
      effectKind: 'MANUAL_ADJUDICATION',
      payload: {
        id: 'manual-1',
        effectKind: 'MANUAL_ADJUDICATION',
        description: 'The GM resolves the remaining effect.'
      }
    }
  ],
  charges: [
    {
      chargeId: 'charge-feature-1',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      classId: null,
      abilityCode: null,
      amount: 3,
      multiplier: null,
      min: null,
      max: null
    },
    {
      chargeId: 'charge-equipment-1',
      scalingKind: 'PER_LEVEL',
      resetKind: 'DAWN',
      limitKind: 'CHARACTER_LEVEL',
      classId: null,
      abilityCode: null,
      amount: null,
      multiplier: 1,
      min: 1,
      max: 5
    },
    {
      chargeId: 'charge-feature-option-1',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      classId: null,
      abilityCode: null,
      amount: 2,
      multiplier: null,
      min: null,
      max: null
    },
    {
      chargeId: 'charge-feat-1',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      classId: null,
      abilityCode: null,
      amount: 1,
      multiplier: null,
      min: null,
      max: null
    }
  ],
  charge_scaling_levels: [
    { scalingId: 'charge-scale-1', chargeId: 'charge-equipment-1', level: 5, order: 1, amount: 3 }
  ],
  charge_bonuses: [
    {
      bonusId: 'charge-bonus-1',
      chargeId: 'charge-feature-1',
      bonusKind: 'ABILITY_MODIFIER',
      abilityCode: 'INTELLIGENCE',
      skillId: null,
      skillLabel: null,
      multiplier: 1,
      min: 1,
      max: null,
      order: 1
    }
  ]
}

const selectedIds = {
  spellIds: ['spell-1'],
  featureIds: ['feature-1'],
  featureOptionIds: ['feature-option-1'],
  featIds: ['feat-1'],
  equipmentIds: ['equipment-1']
} as const

describe('getCharacterSheetMechanicsQuery', () => {
  it('returns no rows and executes no SQL for an empty character selection', async () => {
    const traces: QueryTrace[] = []
    const db = createProjectionDb(rowsByTable, traces)

    await expect(
      getCharacterSheetMechanicsQuery(db, {
        spellIds: [],
        featureIds: [],
        featureOptionIds: [],
        featIds: [],
        equipmentIds: []
      })
    ).resolves.toEqual(expect.objectContaining({ owners: [], ownerEffects: [], outcomes: [] }))
    expect(traces).toHaveLength(0)
  })

  it('preserves owner, effect, path, and outcome identity while returning display mechanics', async () => {
    const traces: QueryTrace[] = []
    const result = await getCharacterSheetMechanicsQuery(
      createProjectionDb(rowsByTable, traces),
      selectedIds
    )

    expect(result.owners.map((owner) => [owner.ownerKind, owner.ownerId])).toEqual([
      ['SPELL', 'spell-1'],
      ['FEATURE', 'feature-1'],
      ['FEATURE_OPTION', 'feature-option-1'],
      ['FEAT', 'feat-1'],
      ['EQUIPMENT', 'equipment-1']
    ])
    expect(result.ownerEffects).toEqual([
      {
        ownerKind: 'SPELL',
        ownerId: 'spell-1',
        effectId: 'effect-spell-1',
        ownerEffectOrder: 1,
        effectOrder: 4
      },
      {
        ownerKind: 'FEATURE',
        ownerId: 'feature-1',
        effectId: 'effect-feature-1',
        ownerEffectOrder: 2,
        effectOrder: 5
      },
      {
        ownerKind: 'FEATURE_OPTION',
        ownerId: 'feature-option-1',
        effectId: 'effect-feature-option-1',
        ownerEffectOrder: 2,
        effectOrder: 7
      },
      {
        ownerKind: 'FEAT',
        ownerId: 'feat-1',
        effectId: 'effect-feat-1',
        ownerEffectOrder: 1,
        effectOrder: 8
      },
      {
        ownerKind: 'EQUIPMENT',
        ownerId: 'equipment-1',
        effectId: 'effect-equipment-1',
        ownerEffectOrder: 3,
        effectOrder: 6
      }
    ])
    expect(result.paths).toEqual([
      expect.objectContaining({ pathId: 'path-1', effectId: 'effect-spell-1', order: 2 }),
      expect.objectContaining({ pathId: 'path-feat-1', effectId: 'effect-feat-1', order: 1 })
    ])
    expect(result.invocations).toEqual([
      expect.objectContaining({
        effectId: 'effect-spell-1',
        resourceChargeId: 'charge-feature-1',
        resourceCost: 2
      }),
      expect.objectContaining({
        effectId: 'effect-feat-1',
        resourceChargeId: null,
        resourceCost: null
      })
    ])
    expect(result.choiceOptions).toEqual([
      expect.objectContaining({ optionId: 'choice-1', resultBlockId: 'result-choice', order: 3 })
    ])
    expect(result.rollTableRows).toEqual([
      expect.objectContaining({ rowId: 'roll-1', resultBlockId: 'result-roll', order: 4 })
    ])
    expect(result.outcomes).toEqual([
      expect.objectContaining({ outcomeId: 'damage-1', effectKind: 'DAMAGE', order: 1 }),
      expect.objectContaining({ outcomeId: 'heal-1', effectKind: 'HEAL', order: 1 }),
      expect.objectContaining({
        outcomeId: 'manual-1',
        effectKind: 'MANUAL_ADJUDICATION',
        order: 1
      }),
      expect.objectContaining({ outcomeId: 'condition-1', effectKind: 'CONDITION', order: 2 }),
      expect.objectContaining({ outcomeId: 'damage-feat-1', effectKind: 'DAMAGE', order: 1 })
    ])
    expect(result.damages).toEqual([
      expect.objectContaining({
        damageId: 'damage-1',
        damageTypeCode: 'FIRE',
        scalingSource: 'SPELL_CAST_LEVEL'
      }),
      expect.objectContaining({
        damageId: 'damage-feat-1',
        damageTypeCode: 'FIRE',
        scalingKind: 'NONE',
        dice: '1d8'
      })
    ])
    expect(result.damageScaling).toEqual([
      expect.objectContaining({ damageId: 'damage-1', level: 2, dice: '3d6' })
    ])
    expect(result.genericOutcomes).toEqual([
      expect.objectContaining({ outcomeId: 'heal-1', effectKind: 'HEAL' }),
      expect.objectContaining({ outcomeId: 'manual-1', effectKind: 'MANUAL_ADJUDICATION' })
    ])
    expect(result.conditions).toEqual([
      expect.objectContaining({ conditionId: 'condition-1', conditionTypeCode: 'RESTRAINED' })
    ])
    expect(result.ownerCharges).toEqual([
      { ownerKind: 'FEATURE', ownerId: 'feature-1', chargeId: 'charge-feature-1' },
      {
        ownerKind: 'FEATURE_OPTION',
        ownerId: 'feature-option-1',
        chargeId: 'charge-feature-option-1'
      },
      { ownerKind: 'FEAT', ownerId: 'feat-1', chargeId: 'charge-feat-1' },
      { ownerKind: 'EQUIPMENT', ownerId: 'equipment-1', chargeId: 'charge-equipment-1' }
    ])
    expect(result.charges).toHaveLength(4)

    expect(traces.find((trace) => trace.table === 'effect_invocations')?.filters).toEqual([
      {
        column: 'effect_id',
        operation: 'in',
        value: [
          'effect-spell-1',
          'effect-feature-1',
          'effect-feature-option-1',
          'effect-feat-1',
          'effect-equipment-1'
        ]
      }
    ])
    expect(traces.find((trace) => trace.table === 'effect_paths')?.orderBy).toEqual([
      'effect_id',
      'sort_order'
    ])
    expect(traces.find((trace) => trace.table === 'damages')?.filters[0]?.value).toEqual([
      'damage-1',
      'heal-1',
      'manual-1',
      'condition-1',
      'damage-feat-1'
    ])
    expect(traces.find((trace) => trace.table === 'charges')?.filters[0]?.value).toEqual([
      'charge-feature-1',
      'charge-feature-option-1',
      'charge-feat-1',
      'charge-equipment-1'
    ])
  })

  it('keeps query count constant as the selected root count grows', async () => {
    const singleRootTraces: QueryTrace[] = []
    const manyRootTraces: QueryTrace[] = []

    await getCharacterSheetMechanicsQuery(
      createProjectionDb(rowsByTable, singleRootTraces),
      selectedIds
    )
    await getCharacterSheetMechanicsQuery(createProjectionDb(rowsByTable, manyRootTraces), {
      spellIds: ['spell-1', 'spell-2', 'spell-3'],
      featureIds: ['feature-1', 'feature-2', 'feature-3'],
      featureOptionIds: ['feature-option-1', 'feature-option-2', 'feature-option-3'],
      featIds: ['feat-1', 'feat-2', 'feat-3'],
      equipmentIds: ['equipment-1', 'equipment-2', 'equipment-3']
    })

    expect(singleRootTraces).toHaveLength(28)
    expect(manyRootTraces).toHaveLength(singleRootTraces.length)
  })
})
