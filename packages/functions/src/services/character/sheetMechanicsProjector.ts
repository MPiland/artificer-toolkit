import type {
  CharacterSheetMechanicsDamageRow,
  CharacterSheetMechanicsDamageScalingRow,
  CharacterSheetMechanicsOwnerKind,
  CharacterSheetMechanicsOwnerRow,
  CharacterSheetMechanicsPathRow,
  CharacterSheetMechanicsQueryResult
} from '@artificer-toolkit/db'
import { healDtoSchema, type HealDto } from '@artificer-toolkit/schema/effects/heal'
import {
  ABILITY_CODE,
  type AbilityCode,
  type EngineCharacterOutput
} from '@artificer-toolkit/shared/core'

export type CharacterSheetProjectedOutcome =
  | {
      kind: 'DAMAGE'
      pathCode: string
      expression: string
      damageTypeId: string
      damageTypeLabel: string
      scaling?: CharacterSheetProjectedOutcomeScaling[]
    }
  | {
      kind: 'HEAL'
      pathCode: string
      expression: string
      temporary: boolean
      scaling?: CharacterSheetProjectedOutcomeScaling[]
    }
  | {
      kind: 'CONDITION'
      pathCode: string
      conditionId: string
      label: string
    }
  | {
      kind: 'EFFECT'
      pathCode: string
      effectKind: string
      label?: string
    }

export interface CharacterSheetProjectedOutcomeScaling {
  level: number
  expression: string
}

export interface CharacterSheetProjectedMechanic {
  effectId: string
  trigger: string
  activation?: {
    kind: string
    amount: number
  }
  rangeLabel?: string
  attackBonus?: number
  attackRollMode?: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  save?: {
    ability: AbilityCode
    dc?: number
  }
  outcomes: CharacterSheetProjectedOutcome[]
}

export type CharacterSheetMechanicsByOwner = Record<
  CharacterSheetMechanicsOwnerKind,
  ReadonlyMap<string, readonly CharacterSheetProjectedMechanic[]>
>

export interface ProjectCharacterSheetMechanicsInput {
  queryResult: CharacterSheetMechanicsQueryResult
  engine: EngineCharacterOutput
  totalCharacterLevel: number
  classLevels: ReadonlyMap<string, number>
  equippedEquipmentIds?: ReadonlySet<string>
  attunedEquipmentIds?: ReadonlySet<string>
}

type MutableMechanicsByOwner = Record<
  CharacterSheetMechanicsOwnerKind,
  Map<string, CharacterSheetProjectedMechanic[]>
>

type ProjectionContext = ProjectCharacterSheetMechanicsInput & {
  owner: CharacterSheetMechanicsOwnerRow
  characteristicsById: ReadonlyMap<
    string,
    CharacterSheetMechanicsQueryResult['characteristics'][number]
  >
  savingThrowsById: ReadonlyMap<string, CharacterSheetMechanicsQueryResult['savingThrows'][number]>
  savingThrowBonusesById: ReadonlyMap<
    string,
    readonly CharacterSheetMechanicsQueryResult['savingThrowBonuses'][number][]
  >
  outcomesByResultBlockId: ReadonlyMap<
    string,
    readonly CharacterSheetMechanicsQueryResult['outcomes'][number][]
  >
  choiceOptionsByPathId: ReadonlyMap<
    string,
    readonly CharacterSheetMechanicsQueryResult['choiceOptions'][number][]
  >
  rollTableRowsByPathId: ReadonlyMap<
    string,
    readonly CharacterSheetMechanicsQueryResult['rollTableRows'][number][]
  >
  damagesById: ReadonlyMap<string, CharacterSheetMechanicsDamageRow>
  damageScalingById: ReadonlyMap<string, readonly CharacterSheetMechanicsDamageScalingRow[]>
  damageBonusesById: ReadonlyMap<
    string,
    readonly CharacterSheetMechanicsQueryResult['damageBonuses'][number][]
  >
  conditionsById: ReadonlyMap<string, CharacterSheetMechanicsQueryResult['conditions'][number]>
  genericOutcomesById: ReadonlyMap<
    string,
    CharacterSheetMechanicsQueryResult['genericOutcomes'][number]
  >
}

type ResultBlockReference = {
  resultBlockId: string
  label?: string
}

type ExpressionValue = string | number

const abilityCodes = new Set<string>(Object.values(ABILITY_CODE))

export function projectCharacterSheetMechanics(
  input: ProjectCharacterSheetMechanicsInput
): CharacterSheetMechanicsByOwner {
  const result: MutableMechanicsByOwner = {
    SPELL: new Map(),
    FEATURE: new Map(),
    FEATURE_OPTION: new Map(),
    FEAT: new Map(),
    EQUIPMENT: new Map()
  }
  const query = input.queryResult
  const ownersByKey = new Map(
    query.owners.map((owner) => [ownerKey(owner.ownerKind, owner.ownerId), owner])
  )
  const invocationsByEffectId = new Map(
    query.invocations.map((invocation) => [invocation.effectId, invocation])
  )
  const pathsByEffectId = groupBy(query.paths, (path) => path.effectId)
  const characteristicsById = new Map(
    query.characteristics.map((characteristic) => [characteristic.characteristicId, characteristic])
  )
  const savingThrowsById = new Map(
    query.savingThrows.map((savingThrow) => [savingThrow.savingThrowId, savingThrow])
  )
  const savingThrowBonusesById = groupBy(query.savingThrowBonuses, (bonus) => bonus.savingThrowId)
  const outcomesByResultBlockId = groupBy(query.outcomes, (outcome) => outcome.resultBlockId)
  const choiceOptionsByPathId = groupBy(query.choiceOptions, (option) => option.pathId)
  const rollTableRowsByPathId = groupBy(query.rollTableRows, (row) => row.pathId)
  const damagesById = new Map(query.damages.map((damage) => [damage.damageId, damage]))
  const damageScalingById = groupBy(query.damageScaling, (scaling) => scaling.damageId)
  const damageBonusesById = groupBy(query.damageBonuses, (bonus) => bonus.damageId)
  const conditionsById = new Map(
    query.conditions.map((condition) => [condition.conditionId, condition])
  )
  const genericOutcomesById = new Map(
    query.genericOutcomes.map((outcome) => [outcome.outcomeId, outcome])
  )

  const ownerEffects = [...query.ownerEffects].sort(
    (left, right) =>
      left.ownerEffectOrder - right.ownerEffectOrder || left.effectOrder - right.effectOrder
  )

  for (const ownerEffect of ownerEffects) {
    const owner = ownersByKey.get(ownerKey(ownerEffect.ownerKind, ownerEffect.ownerId))
    const invocation = invocationsByEffectId.get(ownerEffect.effectId)
    if (!owner || !invocation || !isActiveOwner(owner, input)) continue

    const context: ProjectionContext = {
      ...input,
      owner,
      characteristicsById,
      savingThrowsById,
      savingThrowBonusesById,
      outcomesByResultBlockId,
      choiceOptionsByPathId,
      rollTableRowsByPathId,
      damagesById,
      damageScalingById,
      damageBonusesById,
      conditionsById,
      genericOutcomesById
    }
    const paths = [...(pathsByEffectId.get(ownerEffect.effectId) ?? [])].sort(
      (left, right) => left.order - right.order
    )
    const mechanic = projectMechanic(ownerEffect.effectId, invocation, paths, context)
    const ownerMechanics = result[owner.ownerKind].get(owner.ownerId) ?? []
    ownerMechanics.push(mechanic)
    result[owner.ownerKind].set(owner.ownerId, ownerMechanics)
  }

  return result
}

function projectMechanic(
  effectId: string,
  invocation: CharacterSheetMechanicsQueryResult['invocations'][number],
  paths: readonly CharacterSheetMechanicsPathRow[],
  context: ProjectionContext
): CharacterSheetProjectedMechanic {
  const activation =
    invocation.activationValue !== null &&
    Number.isInteger(invocation.activationValue) &&
    invocation.activationValue > 0
      ? { kind: invocation.activationType, amount: invocation.activationValue }
      : undefined
  const range = context.characteristicsById.get(invocation.rangeCharacteristicId)
  const rangeLabel = range ? formatRangeLabel(range) : undefined
  const save = invocation.savingThrowId ? projectSave(invocation.savingThrowId, context) : undefined
  const attackBonus =
    context.owner.ownerKind === 'SPELL' && invocation.triggerCode === 'SPELL_ATTACK'
      ? context.engine.derivedStats.spellAttackBonus
      : undefined
  const attackDomain =
    invocation.triggerCode === 'MELEE_WEAPON_ATTACK'
      ? 'MELEE'
      : invocation.triggerCode === 'RANGED_WEAPON_ATTACK'
        ? 'RANGED'
        : invocation.triggerCode === 'UNARMED_ATTACK'
          ? 'UNARMED'
          : invocation.triggerCode === 'SPELL_ATTACK'
            ? 'SPELL'
            : undefined
  const outcomes = paths.flatMap((path) => projectPathOutcomes(path, context))

  return {
    effectId,
    trigger: invocation.triggerCode,
    ...(activation ? { activation } : {}),
    ...(rangeLabel ? { rangeLabel } : {}),
    ...(attackBonus !== undefined ? { attackBonus } : {}),
    ...(attackDomain ? { attackRollMode: context.engine.rollModes.attacks[attackDomain] } : {}),
    ...(save ? { save } : {}),
    outcomes
  }
}

function projectSave(
  savingThrowId: string,
  context: ProjectionContext
): CharacterSheetProjectedMechanic['save'] | undefined {
  const savingThrow = context.savingThrowsById.get(savingThrowId)
  if (!savingThrow || !isAbilityCode(savingThrow.abilityCode)) return undefined

  let dc: number | undefined
  switch (savingThrow.dcMethod) {
    case 'SOURCE_SAVE_DC':
      dc = context.engine.derivedStats.spellSaveDC
      break
    case 'FIXED_DC':
      dc = savingThrow.baseDc ?? undefined
      break
    case 'DERIVED_DC': {
      if (savingThrow.baseDc === null) break
      const bonuses = context.savingThrowBonusesById.get(savingThrowId) ?? []
      const resolvedBonuses = bonuses.map((bonus) => resolveSavingThrowBonus(bonus, context.engine))
      if (resolvedBonuses.every((bonus): bonus is number => bonus !== undefined)) {
        dc = savingThrow.baseDc + resolvedBonuses.reduce((sum, bonus) => sum + bonus, 0)
      }
      break
    }
  }

  return {
    ability: savingThrow.abilityCode,
    ...(dc !== undefined ? { dc } : {})
  }
}

function resolveSavingThrowBonus(
  bonus: CharacterSheetMechanicsQueryResult['savingThrowBonuses'][number],
  engine: EngineCharacterOutput
): number | undefined {
  switch (bonus.bonusKind) {
    case 'ABILITY_MODIFIER':
      return bonus.abilityCode ? resolveAbilityModifier(bonus.abilityCode, engine) : undefined
    case 'PROFICIENCY_BONUS':
      return engine.derivedStats.proficiencyBonus
    case 'STATIC_BONUS':
      return bonus.amount ?? undefined
    default:
      return undefined
  }
}

function projectPathOutcomes(
  path: CharacterSheetMechanicsPathRow,
  context: ProjectionContext
): CharacterSheetProjectedOutcome[] {
  return getResultBlockReferences(path, context).flatMap((reference) =>
    [...(context.outcomesByResultBlockId.get(reference.resultBlockId) ?? [])]
      .sort((left, right) => left.order - right.order)
      .map((outcome) => projectOutcome(outcome, path.pathCode, reference.label, context))
  )
}

function getResultBlockReferences(
  path: CharacterSheetMechanicsPathRow,
  context: ProjectionContext
): ResultBlockReference[] {
  if (path.selectionKind === 'FIXED') {
    return path.resultBlockId ? [{ resultBlockId: path.resultBlockId }] : []
  }

  if (path.selectionKind === 'CHOICE') {
    return [...(context.choiceOptionsByPathId.get(path.pathId) ?? [])]
      .sort((left, right) => left.order - right.order)
      .map((option) => ({
        resultBlockId: option.resultBlockId,
        ...(option.label ? { label: option.label } : {})
      }))
  }

  if (path.selectionKind === 'ROLL_TABLE') {
    return [...(context.rollTableRowsByPathId.get(path.pathId) ?? [])]
      .sort((left, right) => left.order - right.order)
      .flatMap((row) => (row.resultBlockId ? [{ resultBlockId: row.resultBlockId }] : []))
  }

  return []
}

function projectOutcome(
  outcome: CharacterSheetMechanicsQueryResult['outcomes'][number],
  pathCode: string,
  entryLabel: string | undefined,
  context: ProjectionContext
): CharacterSheetProjectedOutcome {
  if (outcome.effectKind === 'DAMAGE') {
    return projectDamage(outcome.outcomeId, pathCode, context)
  }

  if (outcome.effectKind === 'CONDITION') {
    const condition = context.conditionsById.get(outcome.outcomeId)
    if (condition) {
      return {
        kind: 'CONDITION',
        pathCode,
        conditionId: condition.conditionTypeId,
        label: condition.conditionTypeLabel
      }
    }
  }

  const genericOutcome = context.genericOutcomesById.get(outcome.outcomeId)
  if (outcome.effectKind === 'HEAL' && genericOutcome) {
    const parsed = healDtoSchema.safeParse(genericOutcome.payload)
    if (parsed.success) return projectHeal(parsed.data, pathCode, context)
  }

  const payloadLabel = genericOutcome ? readPayloadLabel(genericOutcome.payload) : undefined
  return {
    kind: 'EFFECT',
    pathCode,
    effectKind: outcome.effectKind,
    ...(entryLabel || payloadLabel ? { label: entryLabel ?? payloadLabel } : {})
  }
}

function projectDamage(
  damageId: string,
  pathCode: string,
  context: ProjectionContext
): CharacterSheetProjectedOutcome {
  const damage = context.damagesById.get(damageId)
  if (!damage) return { kind: 'EFFECT', pathCode, effectKind: 'DAMAGE' }

  const scalingRows = [...(context.damageScalingById.get(damageId) ?? [])].sort(
    (left, right) => left.level - right.level || left.order - right.order
  )
  const targetLevel = getScalingLevel(damage.scalingSource, damage.classId, context)
  const currentValue = resolveDamageValue(damage, scalingRows, targetLevel)
  if (currentValue === undefined) {
    return {
      kind: 'EFFECT',
      pathCode,
      effectKind: 'DAMAGE',
      label: damage.damageTypeLabel
    }
  }

  const bonus = resolveDamageBonusTotal(damageId, context)
  const expression = applyDamageAmountMetadata(
    formatExpression(currentValue, bonus),
    damage.amountKind,
    damage.amountMultiplier
  )
  const scaling =
    damage.scalingSource === 'SPELL_CAST_LEVEL'
      ? scalingRows.flatMap((row) => {
          const value = valueFromDamageScalingRow(damage, row)
          return value === undefined
            ? []
            : [
                {
                  level: row.level,
                  expression: applyDamageAmountMetadata(
                    formatExpression(value, bonus),
                    damage.amountKind,
                    damage.amountMultiplier
                  )
                }
              ]
        })
      : []

  return {
    kind: 'DAMAGE',
    pathCode,
    expression,
    damageTypeId: damage.damageTypeId,
    damageTypeLabel: damage.damageTypeLabel,
    ...(scaling.length > 0 ? { scaling } : {})
  }
}

function resolveDamageValue(
  damage: CharacterSheetMechanicsDamageRow,
  scalingRows: readonly CharacterSheetMechanicsDamageScalingRow[],
  targetLevel: number | undefined
): ExpressionValue | undefined {
  if (damage.scalingKind === 'NONE') return valueFromDamageRow(damage)

  if (damage.valueKind === 'POOL') {
    if (targetLevel === undefined) return damage.amount ?? undefined
    const value = (damage.amount ?? 0) + targetLevel * (damage.valueMultiplier ?? 1)
    return clamp(value, damage.valueMin, damage.valueMax)
  }

  const row = selectScalingRow(scalingRows, targetLevel)
  return row ? valueFromDamageScalingRow(damage, row) : valueFromDamageRow(damage)
}

function valueFromDamageRow(damage: CharacterSheetMechanicsDamageRow): ExpressionValue | undefined {
  switch (damage.valueKind) {
    case 'DICE':
      return damage.dice ?? undefined
    case 'FIXED':
    case 'POOL':
      return damage.amount ?? undefined
    default:
      return undefined
  }
}

function valueFromDamageScalingRow(
  damage: CharacterSheetMechanicsDamageRow,
  row: CharacterSheetMechanicsDamageScalingRow
): ExpressionValue | undefined {
  switch (damage.valueKind) {
    case 'DICE':
      return row.dice ?? undefined
    case 'FIXED':
      return row.amount ?? undefined
    default:
      return undefined
  }
}

function resolveDamageBonusTotal(damageId: string, context: ProjectionContext): number {
  return [...(context.damageBonusesById.get(damageId) ?? [])]
    .sort((left, right) => left.order - right.order)
    .reduce((total, bonus) => total + (resolveDamageBonus(bonus, context.engine) ?? 0), 0)
}

function resolveDamageBonus(
  bonus: CharacterSheetMechanicsQueryResult['damageBonuses'][number],
  engine: EngineCharacterOutput
): number | undefined {
  let value: number | undefined
  switch (bonus.bonusKind) {
    case 'ABILITY_BONUS':
      value = bonus.abilityCode ? resolveAbilityModifier(bonus.abilityCode, engine) : undefined
      break
    case 'SKILL_BONUS':
      value = bonus.skillId ? engine.derivedStats.skillBonuses[bonus.skillId] : undefined
      break
    case 'PROFICIENCY_BONUS':
      value = engine.derivedStats.proficiencyBonus
      break
    default:
      return undefined
  }

  return value === undefined
    ? undefined
    : clamp(value * (bonus.multiplier ?? 1), bonus.min, bonus.max)
}

function projectHeal(
  heal: HealDto,
  pathCode: string,
  context: ProjectionContext
): CharacterSheetProjectedOutcome {
  const targetLevel =
    heal.scalingKind === 'NONE'
      ? undefined
      : getScalingLevel(heal.scalingSource, 'classId' in heal ? heal.classId : undefined, context)
  const bonus = resolveHealBonusTotal(heal, context)
  const currentValue = resolveHealValue(heal, targetLevel)
  if (currentValue === undefined) {
    return { kind: 'EFFECT', pathCode, effectKind: 'HEAL', label: 'Healing effect' }
  }

  const scaling =
    heal.scalingKind !== 'NONE' && heal.scalingSource === 'SPELL_CAST_LEVEL'
      ? getHealScaling(heal, bonus, context.owner)
      : []

  return {
    kind: 'HEAL',
    pathCode,
    expression: formatExpression(currentValue, bonus),
    temporary: heal.temporary ?? false,
    ...(scaling.length > 0 ? { scaling } : {})
  }
}

function resolveHealValue(
  heal: HealDto,
  targetLevel: number | undefined
): ExpressionValue | undefined {
  if (heal.scalingKind === 'NONE') {
    return heal.valueKind === 'DICE' ? heal.diceConfig : heal.amount
  }

  if (heal.valueKind === 'POOL') {
    if (targetLevel === undefined) return heal.amount
    return clamp((heal.amount ?? 0) + targetLevel * (heal.multiplier ?? 1), heal.min, heal.max)
  }

  const entries =
    heal.scalingKind === 'BREAKPOINTS'
      ? heal.breakpoints.map((entry) => ({
          level: entry.level,
          value: readHealEntryValue(entry.value, heal.valueKind)
        }))
      : heal.levels.map((entry) => ({
          level: entry.level,
          value: readHealEntryValue(entry, heal.valueKind)
        }))
  return selectScalingEntry(entries, targetLevel)?.value
}

function getHealScaling(
  heal: Exclude<HealDto, { scalingKind: 'NONE' }>,
  bonus: number,
  owner: CharacterSheetMechanicsOwnerRow
): CharacterSheetProjectedOutcomeScaling[] {
  if (heal.valueKind === 'POOL') {
    if (owner.ownerKind !== 'SPELL') return []
    return Array.from({ length: 10 - Math.max(owner.level, 1) }, (_, index) => {
      const level = Math.max(owner.level, 1) + index
      const value = clamp((heal.amount ?? 0) + level * (heal.multiplier ?? 1), heal.min, heal.max)
      return { level, expression: formatExpression(value, bonus) }
    })
  }

  const entries =
    heal.scalingKind === 'BREAKPOINTS'
      ? heal.breakpoints.map((entry) => ({
          level: entry.level,
          value: readHealEntryValue(entry.value, heal.valueKind)
        }))
      : heal.levels.map((entry) => ({
          level: entry.level,
          value: readHealEntryValue(entry, heal.valueKind)
        }))

  return entries
    .sort((left, right) => left.level - right.level)
    .flatMap((entry) =>
      entry.value === undefined
        ? []
        : [{ level: entry.level, expression: formatExpression(entry.value, bonus) }]
    )
}

function readHealEntryValue(
  entry: { amount?: number; diceConfig?: string },
  valueKind: string
): ExpressionValue | undefined {
  return valueKind === 'DICE' ? entry.diceConfig : entry.amount
}

function resolveHealBonusTotal(heal: HealDto, context: ProjectionContext): number {
  return [...(heal.bonuses ?? [])]
    .sort((left, right) => left.order - right.order)
    .reduce((total, bonus) => {
      let value: number | undefined
      switch (bonus.bonusKind) {
        case 'ABILITY_BONUS':
          value = resolveAbilityModifier(bonus.ability, context.engine)
          break
        case 'PROFICIENCY_BONUS':
          value = context.engine.derivedStats.proficiencyBonus
          break
        case 'CLASS_LEVEL':
          value = context.classLevels.get(bonus.classId)
          break
      }

      return (
        total +
        (value === undefined ? 0 : clamp(value * (bonus.multiplier ?? 1), bonus.min, bonus.max))
      )
    }, 0)
}

function getScalingLevel(
  source: string | null,
  classId: string | undefined | null,
  context: ProjectionContext
): number | undefined {
  switch (source) {
    case 'CHARACTER_LEVEL':
      return context.totalCharacterLevel
    case 'CLASS_LEVEL':
      return classId ? context.classLevels.get(classId) : undefined
    case 'PARENT_CLASS_LEVEL':
      return undefined
    case 'SPELL_CAST_LEVEL':
      return context.owner.ownerKind === 'SPELL' ? context.owner.level : undefined
    default:
      return undefined
  }
}

function resolveAbilityModifier(
  ability: string,
  engine: EngineCharacterOutput
): number | undefined {
  if (ability === 'SPELLCASTING') {
    if (engine.derivedStats.spellAttackBonus !== undefined) {
      return engine.derivedStats.spellAttackBonus - engine.derivedStats.proficiencyBonus
    }
    if (engine.derivedStats.spellSaveDC !== undefined) {
      return engine.derivedStats.spellSaveDC - 8 - engine.derivedStats.proficiencyBonus
    }
    return undefined
  }

  return engine.derivedStats.abilityModifiers[ability]
}

function formatRangeLabel(
  characteristic: CharacterSheetMechanicsQueryResult['characteristics'][number]
): string | undefined {
  if (!characteristic.rangeKind) return undefined
  if (characteristic.rangeKind !== 'DISTANCE') return titleCase(characteristic.rangeKind)
  if (characteristic.rangeMin === null) return undefined

  const amount =
    characteristic.rangeMax !== null && characteristic.rangeMax !== characteristic.rangeMin
      ? `${formatNumber(characteristic.rangeMin)}–${formatNumber(characteristic.rangeMax)}`
      : formatNumber(characteristic.rangeMin)
  const unit = formatMeasurementUnit(characteristic.rangeUnitCode)
  return unit ? `${amount} ${unit}` : amount
}

function formatMeasurementUnit(unit: string | null): string | undefined {
  switch (unit) {
    case 'FEET':
    case 'FOOT':
      return 'ft'
    case 'MILES':
    case 'MILE':
      return 'mi'
    case 'METERS':
    case 'METER':
      return 'm'
    case null:
      return undefined
    default:
      return titleCase(unit)
  }
}

function formatExpression(value: ExpressionValue, bonus: number): string {
  const base = typeof value === 'number' ? formatNumber(value) : value
  if (bonus === 0) return base
  return bonus > 0 ? `${base} + ${formatNumber(bonus)}` : `${base} - ${formatNumber(-bonus)}`
}

function applyDamageAmountMetadata(
  expression: string,
  amountKind: string | null,
  multiplier: number | null
): string {
  const multiplied =
    multiplier !== null && multiplier !== 1
      ? `${formatNumber(multiplier)} × ${expression}`
      : expression

  switch (amountKind) {
    case 'HALF':
      return `half of ${multiplied}`
    case 'DOUBLE':
      return `double ${multiplied}`
    default:
      return multiplied
  }
}

function selectScalingRow<T extends { level: number }>(
  rows: readonly T[],
  targetLevel: number | undefined
): T | undefined {
  if (rows.length === 0) return undefined
  if (targetLevel === undefined) return rows[0]

  return (
    [...rows]
      .sort((left, right) => left.level - right.level)
      .reduce<T | undefined>(
        (selected, row) => (row.level <= targetLevel ? row : selected),
        undefined
      ) ?? rows[0]
  )
}

function selectScalingEntry<T extends { level: number }>(
  entries: readonly T[],
  targetLevel: number | undefined
): T | undefined {
  return selectScalingRow(entries, targetLevel)
}

function clamp(value: number, min: number | undefined | null, max: number | undefined | null) {
  return Math.min(Math.max(value, min ?? Number.NEGATIVE_INFINITY), max ?? Number.POSITIVE_INFINITY)
}

function isActiveOwner(
  owner: CharacterSheetMechanicsOwnerRow,
  input: ProjectCharacterSheetMechanicsInput
): boolean {
  if (owner.ownerKind !== 'EQUIPMENT') return true
  if (input.equippedEquipmentIds && !input.equippedEquipmentIds.has(owner.ownerId)) return false
  if (
    owner.requiresAttunement &&
    input.attunedEquipmentIds &&
    !input.attunedEquipmentIds.has(owner.ownerId)
  ) {
    return false
  }
  return true
}

function readPayloadLabel(
  payload: CharacterSheetMechanicsQueryResult['genericOutcomes'][number]['payload']
) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  const label = payload.label
  return typeof label === 'string' && label.length > 0 ? label : undefined
}

function ownerKey(kind: CharacterSheetMechanicsOwnerKind, id: string) {
  return `${kind}:${id}`
}

function groupBy<T>(values: readonly T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const value of values) {
    const groupKey = key(value)
    const group = groups.get(groupKey) ?? []
    group.push(value)
    groups.set(groupKey, group)
  }
  return groups
}

function isAbilityCode(value: string): value is AbilityCode {
  return abilityCodes.has(value)
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
