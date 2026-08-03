import type { DBLike, Json } from '#types'

export type CharacterSheetMechanicsOwnerKind =
  | 'SPELL'
  | 'FEATURE'
  | 'FEATURE_OPTION'
  | 'FEAT'
  | 'EQUIPMENT'

export interface CharacterSheetMechanicsQueryInput {
  spellIds: readonly string[]
  featureIds: readonly string[]
  featureOptionIds: readonly string[]
  featIds: readonly string[]
  equipmentIds: readonly string[]
}

export type CharacterSheetMechanicsOwnerRow =
  | {
      ownerKind: 'SPELL'
      ownerId: string
      label: string
      description: string | null
      level: number
      magicSchoolId: string
      magicSchoolCode: string
      magicSchoolLabel: string
      castingTimeUnit: string
      castingTimeAmount: number
      materialDescription: string | null
    }
  | {
      ownerKind: 'FEATURE'
      ownerId: string
      label: string
      description: string | null
      sectionCode: string | null
      availableAtLevel: number | null
      chargeId: string | null
    }
  | {
      ownerKind: 'FEATURE_OPTION'
      ownerId: string
      label: string
      description: string | null
      order: number
      chargeId: string | null
    }
  | {
      ownerKind: 'FEAT'
      ownerId: string
      label: string
      description: string | null
      chargeId: string | null
    }
  | {
      ownerKind: 'EQUIPMENT'
      ownerId: string
      label: string
      description: string | null
      category: string
      requiresAttunement: boolean
      chargeId: string | null
    }

export interface CharacterSheetMechanicsOwnerAttributeRow {
  ownerKind: CharacterSheetMechanicsOwnerKind
  ownerId: string
  attributeCode: string
  order: number
}

export interface CharacterSheetMechanicsOwnerEffectRow {
  ownerKind: CharacterSheetMechanicsOwnerKind
  ownerId: string
  effectId: string
  ownerEffectOrder: number
  effectOrder: number
}

export interface CharacterSheetMechanicsOwnerChargeRow {
  ownerKind: 'FEATURE' | 'FEATURE_OPTION' | 'FEAT' | 'EQUIPMENT'
  ownerId: string
  chargeId: string
}

export interface CharacterSheetMechanicsInvocationRow {
  effectId: string
  triggerCode: string
  activationType: string
  activationValue: number | null
  rangeCharacteristicId: string
  shapeCharacteristicId: string | null
  savingThrowId: string | null
  targetSelectionKind: string | null
  targetDispositionKind: string | null
  maxTargets: number | null
  maxTargetsScaling: Json | null
  resolutionCount: number | null
  resolutionCountScaling: Json | null
  allowRepeatedTargets: boolean | null
  excludedCreatureTypeIds: string[] | null
}

export interface CharacterSheetMechanicsPathRow {
  pathId: string
  effectId: string
  order: number
  pathCode: string
  groupType: string
  selectionKind: string
  originKind: string | null
  rangeOverrideCharacteristicId: string | null
  targetSelectionKind: string | null
  targetDispositionKind: string | null
  maxTargets: number | null
  maxTargetsScaling: Json | null
  resolutionCount: number | null
  resolutionCountScaling: Json | null
  allowRepeatedTargets: boolean | null
  excludedCreatureTypeIds: string[] | null
  resultBlockId: string | null
  rollTableKind: string | null
  die: string | null
}

export interface CharacterSheetMechanicsChoiceOptionRow {
  optionId: string
  pathId: string
  label: string | null
  description: string | null
  order: number
  resultBlockId: string
}

export interface CharacterSheetMechanicsRollTableRow {
  rowId: string
  pathId: string
  order: number
  rollValue: number | null
  rollMin: number | null
  rollMax: number | null
  resolutionKind: string
  resultBlockId: string | null
  repeatConfig: Json | null
}

export interface CharacterSheetMechanicsResultBlockRow {
  resultBlockId: string
  resultKind: string
  durationCharacteristicId: string | null
  lifecycleRecurringKind: string | null
  lifecycleConsumeOnFirstEvent: string | null
  lifecycleEndOnEvents: string[] | null
}

export interface CharacterSheetMechanicsOutcomeRow {
  resultBlockId: string
  outcomeId: string
  effectKind: string
  order: number
}

export interface CharacterSheetMechanicsCharacteristicRow {
  characteristicId: string
  code: string
  rangeKind: string | null
  rangeMin: number | null
  rangeMax: number | null
  rangeUnitCode: string | null
  rangeScaling: Json | null
  shapeKind: string | null
  durationKind: string | null
  durationAmount: number | null
  durationScaling: Json | null
}

export interface CharacterSheetMechanicsShapeDimensionRow {
  characteristicId: string
  dimension: string
  amount: number
  unitCode: string
  scaling: Json | null
}

export interface CharacterSheetMechanicsSavingThrowRow {
  savingThrowId: string
  dcMethod: string
  abilityCode: string
  baseDc: number | null
}

export interface CharacterSheetMechanicsSavingThrowBonusRow {
  bonusId: string
  savingThrowId: string
  order: number
  bonusKind: string
  abilityCode: string | null
  amount: number | null
}

export interface CharacterSheetMechanicsDamageRow {
  damageId: string
  damageTypeId: string
  damageTypeCode: string
  damageTypeLabel: string
  valueKind: string
  scalingKind: string
  amountKind: string | null
  amountMultiplier: number | null
  scalingSource: string | null
  classId: string | null
  order: number
  valueId: string | null
  amount: number | null
  dice: string | null
  valueMultiplier: number | null
  valueMin: number | null
  valueMax: number | null
}

export interface CharacterSheetMechanicsDamageScalingRow {
  scalingId: string
  damageId: string
  level: number
  order: number
  amount: number | null
  dice: string | null
}

export interface CharacterSheetMechanicsDamageBonusKindRow {
  damageId: string
  bonusKind: string
  order: number
}

export interface CharacterSheetMechanicsDamageBonusRow {
  bonusId: string
  damageId: string
  bonusKind: string
  abilityCode: string | null
  skillId: string | null
  skillLabel: string | null
  multiplier: number | null
  min: number | null
  max: number | null
  order: number
}

export interface CharacterSheetMechanicsConditionRow {
  conditionId: string
  conditionTypeId: string
  conditionTypeCode: string
  conditionTypeLabel: string
}

export interface CharacterSheetMechanicsGenericOutcomeRow {
  outcomeId: string
  effectKind: string
  payload: Json
}

export interface CharacterSheetMechanicsChargeRow {
  chargeId: string
  scalingKind: string
  resetKind: string | null
  limitKind: string | null
  classId: string | null
  abilityCode: string | null
  amount: number | null
  cost: number | null
  multiplier: number | null
  min: number | null
  max: number | null
}

export interface CharacterSheetMechanicsChargeScalingRow {
  scalingId: string
  chargeId: string
  level: number
  order: number
  amount: number
}

export interface CharacterSheetMechanicsChargeBonusRow {
  bonusId: string
  chargeId: string
  bonusKind: string
  abilityCode: string | null
  skillId: string | null
  skillLabel: string | null
  multiplier: number | null
  min: number | null
  max: number | null
  order: number
}

export interface CharacterSheetMechanicsQueryResult {
  owners: CharacterSheetMechanicsOwnerRow[]
  ownerAttributes: CharacterSheetMechanicsOwnerAttributeRow[]
  ownerEffects: CharacterSheetMechanicsOwnerEffectRow[]
  ownerCharges: CharacterSheetMechanicsOwnerChargeRow[]
  invocations: CharacterSheetMechanicsInvocationRow[]
  paths: CharacterSheetMechanicsPathRow[]
  choiceOptions: CharacterSheetMechanicsChoiceOptionRow[]
  rollTableRows: CharacterSheetMechanicsRollTableRow[]
  resultBlocks: CharacterSheetMechanicsResultBlockRow[]
  outcomes: CharacterSheetMechanicsOutcomeRow[]
  characteristics: CharacterSheetMechanicsCharacteristicRow[]
  shapeDimensions: CharacterSheetMechanicsShapeDimensionRow[]
  savingThrows: CharacterSheetMechanicsSavingThrowRow[]
  savingThrowBonuses: CharacterSheetMechanicsSavingThrowBonusRow[]
  damages: CharacterSheetMechanicsDamageRow[]
  damageScaling: CharacterSheetMechanicsDamageScalingRow[]
  damageBonusKinds: CharacterSheetMechanicsDamageBonusKindRow[]
  damageBonuses: CharacterSheetMechanicsDamageBonusRow[]
  conditions: CharacterSheetMechanicsConditionRow[]
  genericOutcomes: CharacterSheetMechanicsGenericOutcomeRow[]
  charges: CharacterSheetMechanicsChargeRow[]
  chargeScaling: CharacterSheetMechanicsChargeScalingRow[]
  chargeBonuses: CharacterSheetMechanicsChargeBonusRow[]
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

function emptyResult(): CharacterSheetMechanicsQueryResult {
  return {
    owners: [],
    ownerAttributes: [],
    ownerEffects: [],
    ownerCharges: [],
    invocations: [],
    paths: [],
    choiceOptions: [],
    rollTableRows: [],
    resultBlocks: [],
    outcomes: [],
    characteristics: [],
    shapeDimensions: [],
    savingThrows: [],
    savingThrowBonuses: [],
    damages: [],
    damageScaling: [],
    damageBonusKinds: [],
    damageBonuses: [],
    conditions: [],
    genericOutcomes: [],
    charges: [],
    chargeScaling: [],
    chargeBonuses: []
  }
}

/**
 * Reads only the mechanics needed to render the selected character-sheet sources.
 * Every database call is set-based; query count is bounded by the projection shape,
 * not by the number of selected roots, effects, paths, or outcomes.
 */
export async function getCharacterSheetMechanicsQuery(
  db: DBLike,
  input: CharacterSheetMechanicsQueryInput
): Promise<CharacterSheetMechanicsQueryResult> {
  const spellIds = uniqueIds(input.spellIds)
  const featureIds = uniqueIds(input.featureIds)
  const featureOptionIds = uniqueIds(input.featureOptionIds)
  const featIds = uniqueIds(input.featIds)
  const equipmentIds = uniqueIds(input.equipmentIds)

  if (
    spellIds.length === 0 &&
    featureIds.length === 0 &&
    featureOptionIds.length === 0 &&
    featIds.length === 0 &&
    equipmentIds.length === 0
  ) {
    return emptyResult()
  }

  const [
    spellRows,
    featureRows,
    featureOptionRows,
    featRows,
    equipmentRows,
    spellAttributeRows,
    featureAttributeRows,
    featureOptionAttributeRows,
    equipmentAttributeRows
  ] = await Promise.all([
    spellIds.length > 0
      ? db
          .selectFrom('spells')
          .innerJoin('magic_schools', 'magic_schools.id', 'spells.magic_school_id')
          .leftJoin('spell_effects', 'spell_effects.spell_id', 'spells.id')
          .leftJoin('effects', 'effects.id', 'spell_effects.effect_id')
          .select([
            'spells.id as ownerId',
            'spells.label as label',
            'spells.description as description',
            'spells.level as level',
            'spells.magic_school_id as magicSchoolId',
            'magic_schools.code as magicSchoolCode',
            'magic_schools.label as magicSchoolLabel',
            'spells.casting_time_unit as castingTimeUnit',
            'spells.casting_time_amount as castingTimeAmount',
            'spells.material_description as materialDescription',
            'spell_effects.effect_id as effectId',
            'spell_effects.sort_order as ownerEffectOrder',
            'effects.sort_order as effectOrder'
          ])
          .where('spells.id', 'in', spellIds)
          .orderBy('spells.id')
          .orderBy('spell_effects.sort_order')
          .execute()
      : Promise.resolve([]),
    featureIds.length > 0
      ? db
          .selectFrom('features')
          .leftJoin('feature_effects', 'feature_effects.feature_id', 'features.id')
          .leftJoin('effects', 'effects.id', 'feature_effects.effect_id')
          .select([
            'features.id as ownerId',
            'features.label as label',
            'features.description as description',
            'features.section_code as sectionCode',
            'features.available_at_level as availableAtLevel',
            'features.charge_id as chargeId',
            'feature_effects.effect_id as effectId',
            'feature_effects.sort_order as ownerEffectOrder',
            'effects.sort_order as effectOrder'
          ])
          .where('features.id', 'in', featureIds)
          .orderBy('features.id')
          .orderBy('feature_effects.sort_order')
          .execute()
      : Promise.resolve([]),
    featureOptionIds.length > 0
      ? db
          .selectFrom('options')
          .leftJoin('option_effects', 'option_effects.option_id', 'options.id')
          .leftJoin('effects', 'effects.id', 'option_effects.effect_id')
          .select([
            'options.id as ownerId',
            'options.label as label',
            'options.description as description',
            'options.sort_order as order',
            'options.charge_id as chargeId',
            'option_effects.effect_id as effectId',
            'option_effects.sort_order as ownerEffectOrder',
            'effects.sort_order as effectOrder'
          ])
          .where('options.id', 'in', featureOptionIds)
          .orderBy('options.id')
          .orderBy('option_effects.sort_order')
          .execute()
      : Promise.resolve([]),
    featIds.length > 0
      ? db
          .selectFrom('feats')
          .leftJoin('feat_effects', 'feat_effects.feat_id', 'feats.id')
          .leftJoin('effects', 'effects.id', 'feat_effects.effect_id')
          .select([
            'feats.id as ownerId',
            'feats.label as label',
            'feats.description as description',
            'feats.charge_id as chargeId',
            'feat_effects.effect_id as effectId',
            'feat_effects.sort_order as ownerEffectOrder',
            'effects.sort_order as effectOrder'
          ])
          .where('feats.id', 'in', featIds)
          .orderBy('feats.id')
          .orderBy('feat_effects.sort_order')
          .execute()
      : Promise.resolve([]),
    equipmentIds.length > 0
      ? db
          .selectFrom('equipment')
          .leftJoin('equipment_effects', 'equipment_effects.equipment_id', 'equipment.id')
          .leftJoin('effects', 'effects.id', 'equipment_effects.effect_id')
          .select([
            'equipment.id as ownerId',
            'equipment.label as label',
            'equipment.description as description',
            'equipment.category as category',
            'equipment.requires_attunement as requiresAttunement',
            'equipment.charge_id as chargeId',
            'equipment_effects.effect_id as effectId',
            'equipment_effects.sort_order as ownerEffectOrder',
            'effects.sort_order as effectOrder'
          ])
          .where('equipment.id', 'in', equipmentIds)
          .orderBy('equipment.id')
          .orderBy('equipment_effects.sort_order')
          .execute()
      : Promise.resolve([]),
    spellIds.length > 0
      ? db
          .selectFrom('spell_attributes')
          .select(['spell_id as ownerId', 'attribute_code as attributeCode', 'sort_order as order'])
          .where('spell_id', 'in', spellIds)
          .orderBy('spell_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    featureIds.length > 0
      ? db
          .selectFrom('feature_attributes')
          .select([
            'feature_id as ownerId',
            'attribute_code as attributeCode',
            'sort_order as order'
          ])
          .where('feature_id', 'in', featureIds)
          .orderBy('feature_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    featureOptionIds.length > 0
      ? db
          .selectFrom('option_attributes')
          .select([
            'option_id as ownerId',
            'attribute_code as attributeCode',
            'sort_order as order'
          ])
          .where('option_id', 'in', featureOptionIds)
          .orderBy('option_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    equipmentIds.length > 0
      ? db
          .selectFrom('equipment_attributes')
          .select([
            'equipment_id as ownerId',
            'attribute_code as attributeCode',
            'sort_order as order'
          ])
          .where('equipment_id', 'in', equipmentIds)
          .orderBy('equipment_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([])
  ])

  const spellById = new Map(spellRows.map((row) => [row.ownerId, row]))
  const featureById = new Map(featureRows.map((row) => [row.ownerId, row]))
  const featureOptionById = new Map(featureOptionRows.map((row) => [row.ownerId, row]))
  const featById = new Map(featRows.map((row) => [row.ownerId, row]))
  const equipmentById = new Map(equipmentRows.map((row) => [row.ownerId, row]))

  const owners: CharacterSheetMechanicsOwnerRow[] = [
    ...spellIds.flatMap((ownerId) => {
      const row = spellById.get(ownerId)
      return row
        ? [
            {
              ownerKind: 'SPELL' as const,
              ownerId,
              label: row.label,
              description: row.description,
              level: row.level,
              magicSchoolId: row.magicSchoolId,
              magicSchoolCode: row.magicSchoolCode,
              magicSchoolLabel: row.magicSchoolLabel,
              castingTimeUnit: row.castingTimeUnit,
              castingTimeAmount: row.castingTimeAmount,
              materialDescription: row.materialDescription
            }
          ]
        : []
    }),
    ...featureIds.flatMap((ownerId) => {
      const row = featureById.get(ownerId)
      return row
        ? [
            {
              ownerKind: 'FEATURE' as const,
              ownerId,
              label: row.label,
              description: row.description,
              sectionCode: row.sectionCode,
              availableAtLevel: row.availableAtLevel,
              chargeId: row.chargeId
            }
          ]
        : []
    }),
    ...featureOptionIds.flatMap((ownerId) => {
      const row = featureOptionById.get(ownerId)
      return row
        ? [
            {
              ownerKind: 'FEATURE_OPTION' as const,
              ownerId,
              label: row.label,
              description: row.description,
              order: row.order,
              chargeId: row.chargeId
            }
          ]
        : []
    }),
    ...featIds.flatMap((ownerId) => {
      const row = featById.get(ownerId)
      return row
        ? [
            {
              ownerKind: 'FEAT' as const,
              ownerId,
              label: row.label,
              description: row.description,
              chargeId: row.chargeId
            }
          ]
        : []
    }),
    ...equipmentIds.flatMap((ownerId) => {
      const row = equipmentById.get(ownerId)
      return row
        ? [
            {
              ownerKind: 'EQUIPMENT' as const,
              ownerId,
              label: row.label,
              description: row.description,
              category: row.category,
              requiresAttunement: row.requiresAttunement,
              chargeId: row.chargeId
            }
          ]
        : []
    })
  ]

  const ownerAttributes: CharacterSheetMechanicsOwnerAttributeRow[] = [
    ...spellAttributeRows.map((row) => ({ ownerKind: 'SPELL' as const, ...row })),
    ...featureAttributeRows.map((row) => ({ ownerKind: 'FEATURE' as const, ...row })),
    ...featureOptionAttributeRows.map((row) => ({
      ownerKind: 'FEATURE_OPTION' as const,
      ...row
    })),
    ...equipmentAttributeRows.map((row) => ({ ownerKind: 'EQUIPMENT' as const, ...row }))
  ]

  const ownerEffects: CharacterSheetMechanicsOwnerEffectRow[] = [
    ...spellRows.flatMap((row) =>
      row.effectId !== null && row.ownerEffectOrder !== null && row.effectOrder !== null
        ? [
            {
              ownerKind: 'SPELL' as const,
              ownerId: row.ownerId,
              effectId: row.effectId,
              ownerEffectOrder: row.ownerEffectOrder,
              effectOrder: row.effectOrder
            }
          ]
        : []
    ),
    ...featureRows.flatMap((row) =>
      row.effectId !== null && row.ownerEffectOrder !== null && row.effectOrder !== null
        ? [
            {
              ownerKind: 'FEATURE' as const,
              ownerId: row.ownerId,
              effectId: row.effectId,
              ownerEffectOrder: row.ownerEffectOrder,
              effectOrder: row.effectOrder
            }
          ]
        : []
    ),
    ...featureOptionRows.flatMap((row) =>
      row.effectId !== null && row.ownerEffectOrder !== null && row.effectOrder !== null
        ? [
            {
              ownerKind: 'FEATURE_OPTION' as const,
              ownerId: row.ownerId,
              effectId: row.effectId,
              ownerEffectOrder: row.ownerEffectOrder,
              effectOrder: row.effectOrder
            }
          ]
        : []
    ),
    ...featRows.flatMap((row) =>
      row.effectId !== null && row.ownerEffectOrder !== null && row.effectOrder !== null
        ? [
            {
              ownerKind: 'FEAT' as const,
              ownerId: row.ownerId,
              effectId: row.effectId,
              ownerEffectOrder: row.ownerEffectOrder,
              effectOrder: row.effectOrder
            }
          ]
        : []
    ),
    ...equipmentRows.flatMap((row) =>
      row.effectId !== null && row.ownerEffectOrder !== null && row.effectOrder !== null
        ? [
            {
              ownerKind: 'EQUIPMENT' as const,
              ownerId: row.ownerId,
              effectId: row.effectId,
              ownerEffectOrder: row.ownerEffectOrder,
              effectOrder: row.effectOrder
            }
          ]
        : []
    )
  ]

  const ownerCharges: CharacterSheetMechanicsOwnerChargeRow[] = owners.flatMap((owner) =>
    owner.ownerKind !== 'SPELL' && owner.chargeId !== null
      ? [{ ownerKind: owner.ownerKind, ownerId: owner.ownerId, chargeId: owner.chargeId }]
      : []
  )

  const effectIds = uniqueIds(ownerEffects.map((row) => row.effectId))
  const [invocations, paths] = await Promise.all([
    effectIds.length > 0
      ? db
          .selectFrom('effect_invocations')
          .select([
            'effect_id as effectId',
            'trigger_code as triggerCode',
            'activation_type as activationType',
            'activation_value as activationValue',
            'range_characteristic_id as rangeCharacteristicId',
            'shape_characteristic_id as shapeCharacteristicId',
            'saving_throw_id as savingThrowId',
            'target_selection_kind as targetSelectionKind',
            'target_disposition_kind as targetDispositionKind',
            'max_targets as maxTargets',
            'max_targets_scaling as maxTargetsScaling',
            'resolution_count as resolutionCount',
            'resolution_count_scaling as resolutionCountScaling',
            'allow_repeated_targets as allowRepeatedTargets',
            'excluded_creature_type_ids as excludedCreatureTypeIds'
          ])
          .where('effect_id', 'in', effectIds)
          .orderBy('effect_id')
          .execute()
      : Promise.resolve([]),
    effectIds.length > 0
      ? db
          .selectFrom('effect_paths')
          .select([
            'id as pathId',
            'effect_id as effectId',
            'sort_order as order',
            'path_code as pathCode',
            'group_type as groupType',
            'selection_kind as selectionKind',
            'origin_kind as originKind',
            'range_override_characteristic_id as rangeOverrideCharacteristicId',
            'target_selection_kind as targetSelectionKind',
            'target_disposition_kind as targetDispositionKind',
            'max_targets as maxTargets',
            'max_targets_scaling as maxTargetsScaling',
            'resolution_count as resolutionCount',
            'resolution_count_scaling as resolutionCountScaling',
            'allow_repeated_targets as allowRepeatedTargets',
            'excluded_creature_type_ids as excludedCreatureTypeIds',
            'result_block_id as resultBlockId',
            'roll_table_kind as rollTableKind',
            'die as die'
          ])
          .where('effect_id', 'in', effectIds)
          .orderBy('effect_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([])
  ])

  const pathIds = uniqueIds(paths.map((path) => path.pathId))
  const [choiceOptions, rollTableRows] = await Promise.all([
    pathIds.length > 0
      ? db
          .selectFrom('effect_path_choice_options')
          .select([
            'id as optionId',
            'path_id as pathId',
            'label as label',
            'description as description',
            'sort_order as order',
            'result_block_id as resultBlockId'
          ])
          .where('path_id', 'in', pathIds)
          .orderBy('path_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    pathIds.length > 0
      ? db
          .selectFrom('effect_path_roll_table_rows')
          .select([
            'id as rowId',
            'path_id as pathId',
            'sort_order as order',
            'roll_value as rollValue',
            'roll_min as rollMin',
            'roll_max as rollMax',
            'resolution_kind as resolutionKind',
            'result_block_id as resultBlockId',
            'repeat_config as repeatConfig'
          ])
          .where('path_id', 'in', pathIds)
          .orderBy('path_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([])
  ])

  const resultBlockIds = uniqueIds([
    ...paths.flatMap((path) => (path.resultBlockId === null ? [] : [path.resultBlockId])),
    ...choiceOptions.map((option) => option.resultBlockId),
    ...rollTableRows.flatMap((row) => (row.resultBlockId === null ? [] : [row.resultBlockId]))
  ])
  const [resultBlocks, outcomes] = await Promise.all([
    resultBlockIds.length > 0
      ? db
          .selectFrom('effect_result_blocks')
          .select([
            'id as resultBlockId',
            'result_kind as resultKind',
            'duration_id as durationCharacteristicId',
            'lifecycle_recurring_kind as lifecycleRecurringKind',
            'lifecycle_consume_on_first_event as lifecycleConsumeOnFirstEvent',
            'lifecycle_end_on_events as lifecycleEndOnEvents'
          ])
          .where('id', 'in', resultBlockIds)
          .orderBy('id')
          .execute()
      : Promise.resolve([]),
    resultBlockIds.length > 0
      ? db
          .selectFrom('effect_result_block_outcomes')
          .select([
            'result_block_id as resultBlockId',
            'outcome_id as outcomeId',
            'effect_kind as effectKind',
            'sort_order as order'
          ])
          .where('result_block_id', 'in', resultBlockIds)
          .orderBy('result_block_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([])
  ])

  const characteristicIds = uniqueIds([
    ...invocations.map((invocation) => invocation.rangeCharacteristicId),
    ...invocations.flatMap((invocation) =>
      invocation.shapeCharacteristicId === null ? [] : [invocation.shapeCharacteristicId]
    ),
    ...paths.flatMap((path) =>
      path.rangeOverrideCharacteristicId === null ? [] : [path.rangeOverrideCharacteristicId]
    ),
    ...resultBlocks.flatMap((block) =>
      block.durationCharacteristicId === null ? [] : [block.durationCharacteristicId]
    )
  ])
  const savingThrowIds = uniqueIds(
    invocations.flatMap((invocation) =>
      invocation.savingThrowId === null ? [] : [invocation.savingThrowId]
    )
  )
  const outcomeIds = uniqueIds(outcomes.map((outcome) => outcome.outcomeId))
  const chargeIds = uniqueIds(ownerCharges.map((ownerCharge) => ownerCharge.chargeId))

  const [
    characteristics,
    shapeDimensions,
    savingThrows,
    savingThrowBonuses,
    damages,
    damageScaling,
    damageBonusKinds,
    damageBonuses,
    conditions,
    genericOutcomes,
    charges,
    chargeScaling,
    chargeBonuses
  ] = await Promise.all([
    characteristicIds.length > 0
      ? db
          .selectFrom('characteristics')
          .leftJoin(
            'characteristic_ranges',
            'characteristic_ranges.characteristic_id',
            'characteristics.id'
          )
          .leftJoin(
            'characteristic_shapes',
            'characteristic_shapes.characteristic_id',
            'characteristics.id'
          )
          .leftJoin(
            'characteristic_durations',
            'characteristic_durations.characteristic_id',
            'characteristics.id'
          )
          .select([
            'characteristics.id as characteristicId',
            'characteristics.code as code',
            'characteristic_ranges.kind as rangeKind',
            'characteristic_ranges.min as rangeMin',
            'characteristic_ranges.max as rangeMax',
            'characteristic_ranges.unit_code as rangeUnitCode',
            'characteristic_ranges.scaling as rangeScaling',
            'characteristic_shapes.kind as shapeKind',
            'characteristic_durations.kind as durationKind',
            'characteristic_durations.amount as durationAmount',
            'characteristic_durations.scaling as durationScaling'
          ])
          .where('characteristics.id', 'in', characteristicIds)
          .orderBy('characteristics.id')
          .execute()
      : Promise.resolve([]),
    characteristicIds.length > 0
      ? db
          .selectFrom('characteristic_shape_dimensions')
          .select([
            'characteristic_id as characteristicId',
            'dimension as dimension',
            'amount as amount',
            'unit_code as unitCode',
            'scaling as scaling'
          ])
          .where('characteristic_id', 'in', characteristicIds)
          .orderBy('characteristic_id')
          .orderBy('dimension')
          .execute()
      : Promise.resolve([]),
    savingThrowIds.length > 0
      ? db
          .selectFrom('saving_throws')
          .select([
            'id as savingThrowId',
            'dc_method as dcMethod',
            'ability_code as abilityCode',
            'base_dc as baseDc'
          ])
          .where('id', 'in', savingThrowIds)
          .orderBy('id')
          .execute()
      : Promise.resolve([]),
    savingThrowIds.length > 0
      ? db
          .selectFrom('saving_throw_dc_bonuses')
          .select([
            'id as bonusId',
            'saving_throw_id as savingThrowId',
            'sort_order as order',
            'bonus_kind as bonusKind',
            'ability_code as abilityCode',
            'amount as amount'
          ])
          .where('saving_throw_id', 'in', savingThrowIds)
          .orderBy('saving_throw_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    outcomeIds.length > 0
      ? db
          .selectFrom('damages')
          .innerJoin('damage_types', 'damage_types.id', 'damages.damage_type_id')
          .leftJoin('damage_values', 'damage_values.damage_id', 'damages.id')
          .select([
            'damages.id as damageId',
            'damages.damage_type_id as damageTypeId',
            'damage_types.code as damageTypeCode',
            'damage_types.label as damageTypeLabel',
            'damages.value_kind as valueKind',
            'damages.scaling_kind as scalingKind',
            'damages.amount_kind as amountKind',
            'damages.amount_multiplier as amountMultiplier',
            'damages.scaling_source as scalingSource',
            'damages.class_id as classId',
            'damages.sort_order as order',
            'damage_values.id as valueId',
            'damage_values.amount as amount',
            'damage_values.dice as dice',
            'damage_values.multiplier as valueMultiplier',
            'damage_values.min as valueMin',
            'damage_values.max as valueMax'
          ])
          .where('damages.id', 'in', outcomeIds)
          .orderBy('damages.sort_order')
          .orderBy('damages.id')
          .execute()
      : Promise.resolve([]),
    outcomeIds.length > 0
      ? db
          .selectFrom('damage_scaling_levels')
          .select([
            'id as scalingId',
            'damage_id as damageId',
            'level as level',
            'sort_order as order',
            'amount as amount',
            'dice as dice'
          ])
          .where('damage_id', 'in', outcomeIds)
          .orderBy('damage_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    outcomeIds.length > 0
      ? db
          .selectFrom('damage_bonus_kinds')
          .select(['damage_id as damageId', 'bonus_kind as bonusKind', 'sort_order as order'])
          .where('damage_id', 'in', outcomeIds)
          .orderBy('damage_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    outcomeIds.length > 0
      ? db
          .selectFrom('damage_bonuses')
          .leftJoin('skills', 'skills.id', 'damage_bonuses.skill_id')
          .select([
            'damage_bonuses.id as bonusId',
            'damage_bonuses.damage_id as damageId',
            'damage_bonuses.bonus_kind as bonusKind',
            'damage_bonuses.ability_code as abilityCode',
            'damage_bonuses.skill_id as skillId',
            'skills.label as skillLabel',
            'damage_bonuses.multiplier as multiplier',
            'damage_bonuses.min as min',
            'damage_bonuses.max as max',
            'damage_bonuses.sort_order as order'
          ])
          .where('damage_bonuses.damage_id', 'in', outcomeIds)
          .orderBy('damage_bonuses.damage_id')
          .orderBy('damage_bonuses.sort_order')
          .execute()
      : Promise.resolve([]),
    outcomeIds.length > 0
      ? db
          .selectFrom('conditions')
          .innerJoin('condition_types', 'condition_types.id', 'conditions.condition_type_id')
          .select([
            'conditions.id as conditionId',
            'conditions.condition_type_id as conditionTypeId',
            'condition_types.code as conditionTypeCode',
            'condition_types.label as conditionTypeLabel'
          ])
          .where('conditions.id', 'in', outcomeIds)
          .orderBy('conditions.id')
          .execute()
      : Promise.resolve([]),
    outcomeIds.length > 0
      ? db
          .selectFrom('effect_generic_outcomes')
          .select(['id as outcomeId', 'effect_kind as effectKind', 'json_data as payload'])
          .where('id', 'in', outcomeIds)
          .orderBy('id')
          .execute()
      : Promise.resolve([]),
    chargeIds.length > 0
      ? db
          .selectFrom('charges')
          .leftJoin('charge_limits', 'charge_limits.charge_id', 'charges.id')
          .select([
            'charges.id as chargeId',
            'charges.scaling_kind as scalingKind',
            'charges.reset_kind as resetKind',
            'charge_limits.limit_kind as limitKind',
            'charge_limits.class_id as classId',
            'charge_limits.ability_code as abilityCode',
            'charge_limits.amount as amount',
            'charge_limits.cost as cost',
            'charge_limits.multiplier as multiplier',
            'charge_limits.min as min',
            'charge_limits.max as max'
          ])
          .where('charges.id', 'in', chargeIds)
          .orderBy('charges.id')
          .execute()
      : Promise.resolve([]),
    chargeIds.length > 0
      ? db
          .selectFrom('charge_scaling_levels')
          .select([
            'id as scalingId',
            'charge_id as chargeId',
            'level as level',
            'sort_order as order',
            'amount as amount'
          ])
          .where('charge_id', 'in', chargeIds)
          .orderBy('charge_id')
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    chargeIds.length > 0
      ? db
          .selectFrom('charge_bonuses')
          .leftJoin('skills', 'skills.id', 'charge_bonuses.skill_id')
          .select([
            'charge_bonuses.id as bonusId',
            'charge_bonuses.charge_id as chargeId',
            'charge_bonuses.bonus_kind as bonusKind',
            'charge_bonuses.ability_code as abilityCode',
            'charge_bonuses.skill_id as skillId',
            'skills.label as skillLabel',
            'charge_bonuses.multiplier as multiplier',
            'charge_bonuses.min as min',
            'charge_bonuses.max as max',
            'charge_bonuses.sort_order as order'
          ])
          .where('charge_bonuses.charge_id', 'in', chargeIds)
          .orderBy('charge_bonuses.charge_id')
          .orderBy('charge_bonuses.sort_order')
          .execute()
      : Promise.resolve([])
  ])

  return {
    owners,
    ownerAttributes,
    ownerEffects,
    ownerCharges,
    invocations,
    paths,
    choiceOptions,
    rollTableRows,
    resultBlocks,
    outcomes,
    characteristics,
    shapeDimensions,
    savingThrows,
    savingThrowBonuses,
    damages,
    damageScaling,
    damageBonusKinds,
    damageBonuses,
    conditions,
    genericOutcomes,
    charges,
    chargeScaling,
    chargeBonuses
  }
}
