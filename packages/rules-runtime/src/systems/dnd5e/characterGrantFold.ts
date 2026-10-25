import {
  characterGrantFoldInputSchema,
  characterGrantFoldOutputSchema,
  type CharacterGrantFoldInput,
  type CharacterGrantFoldOutput,
  type CharacterGrantFoldRestriction,
  type CharacterGrantFoldSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { buildModifierDomainKey } from '@artificer-toolkit/shared/character'

import {
  DND5E_CHARACTER_WIDE_TARGET,
  DND5E_ITEM_CONDITION_KINDS,
  dnd5eAcceptedModifierApplicability,
  dnd5eModifierApplies
} from './modifierApplicability.js'

type Proficiency = CharacterGrantFoldOutput['proficiencies'][number]
type Sense = CharacterGrantFoldOutput['senses'][number]
type Modifier = CharacterGrantFoldOutput['modifiers'][number]
type ModifierGroup = CharacterGrantFoldOutput['modifierGroups'][number]
type SourceState = NonNullable<CharacterGrantFoldSource['sourceState']>
type ProficiencyOperation = CharacterGrantFoldSource['proficiencies'][number]
type ScalingOperation = CharacterGrantFoldSource['senses'][number]
type RestrictionCondition = CharacterGrantFoldRestriction[number]['conditions'][number]

const sourceOrder = [
  'RACE',
  'SUBRACE',
  'ANCESTRY',
  'BACKGROUND',
  'CLASS',
  'SUBCLASS',
  'FEAT',
  'FEATURE',
  'OPTION',
  'EQUIPMENT',
  'MANUAL',
  'ACTIVE_EFFECT'
] as const

const proficiencyRank = { HALF: 0, FULL: 1, DOUBLE: 2 } as const

function someSelected(required: string[], actual: string[]): boolean {
  return required.length === 0 || required.some((value) => actual.includes(value))
}

function inRange(value: number, minimum: number | null, maximum: number | null): boolean {
  return (minimum == null || value >= minimum) && (maximum == null || value <= maximum)
}

function totalClassLevel(input: CharacterGrantFoldInput): number {
  return input.base.classes.reduce((sum, entry) => sum + entry.level, 0)
}

/** The conditions only a modifier's consumer can decide: the attacking item and the holder's state. */
const DEFERRED_CONDITION_KINDS: ReadonlySet<RestrictionCondition['kind']> = new Set([
  ...DND5E_ITEM_CONDITION_KINDS,
  'CAN_ACT',
  'SPEED_ABOVE_ZERO',
  'FREE_HAND',
  'TURN_MOVEMENT',
  'ATTACK_ACTION_OTHER_WEAPON',
  'ENEMY_NEAR_TARGET',
  'TARGET_HAS_NOT_TAKEN_TURN',
  'HOLDER_IN_BRIGHT_LIGHT',
  'SOURCE_CREATURE_TYPE',
  'SOURCE_TRAIT'
])

/**
 * Drawn weapons (rules-runtime.md): attacking with a carried item draws it, so the item's own
 * source-scoped attack and damage modifiers (roll modes included) see it as equipped. Consumers
 * apply those modifiers only while that item is the attacking source. Every other gate
 * (attunement, armor class, Global scope) keeps the real state.
 */
function drawnSourceState(
  modifier: CharacterGrantFoldSource['modifiers'][number],
  sourceState: SourceState | undefined
): SourceState | undefined {
  if (!sourceState?.carried || sourceState.equipped) return sourceState
  return modifier.scope === 'SOURCE' &&
    (modifier.valueDomainCode === 'ATTACK_ROLL' || modifier.valueDomainCode === 'DAMAGE')
    ? { ...sourceState, equipped: true }
    : sourceState
}

/**
 * Folds a holder's grant sources. Creatures fold their feature grants through the same option as
 * Characters, so `holderKind` only answers `HOLDER_KIND` restrictions.
 */
export function evaluateDnd5e2014CharacterGrantFold(
  input: CharacterGrantFoldInput,
  holderKind: 'CHARACTER' | 'CREATURE' = 'CHARACTER'
): CharacterGrantFoldOutput {
  const parsedInput = characterGrantFoldInputSchema.parse(input)
  const acc: CharacterGrantFoldOutput = {
    proficiencies: [],
    senses: [],
    modifiers: [],
    unlockedFeatIds: [],
    unlockedSpellIds: [],
    activeSourceIds: [],
    activeEquipmentInstanceIds: [],
    equipmentFeatureChargeUses: [],
    modifierGroups: []
  }
  const modifierGroups = new Map<string, ModifierGroup>()
  const activeSourceIds = new Set<string>()
  const scheduled: Array<{
    rank: number
    position: number
    apply: () => void
  }> = []
  let position = 0

  /**
   * An ability score as granted so far: the base score with the fixed Character-wide score
   * modifiers already accepted from earlier sources (race before class, feat and equipment).
   */
  const abilityValue = (abilityId: string | null): number => {
    const base =
      Object.entries(parsedInput.base.abilities).find(([key]) => key === abilityId)?.[1] ?? 0
    let score = base
    let set: number | null = null
    for (const modifier of acc.modifiers) {
      const { payload } = modifier
      if (
        modifier.valueDomainCode !== 'ABILITY_SCORE' ||
        (modifier.domain.ability ?? null) !== abilityId ||
        payload === undefined ||
        !('amount' in payload) ||
        ('valueKind' in payload && payload.valueKind !== 'FIXED') ||
        !dnd5eModifierApplies(
          dnd5eAcceptedModifierApplicability(modifier),
          DND5E_CHARACTER_WIDE_TARGET
        )
      )
        continue
      if (modifier.modifierKind === 'BONUS') score += payload.amount
      else if (modifier.modifierKind === 'PENALTY') score -= payload.amount
      else if (modifier.modifierKind === 'SET_VALUE') set = payload.amount
    }
    return set === null ? score : set + score - base
  }

  const meetsProficiency = (condition: RestrictionCondition): boolean => {
    const candidates = acc.proficiencies.filter(
      (proficiency) =>
        proficiency.kind === condition.proficiencyKind &&
        (condition.category == null || proficiency.category === condition.category) &&
        (condition.minimumRank == null ||
          proficiencyRank[proficiency.scaling] >= proficiencyRank[condition.minimumRank])
    )
    if (condition.mode === 'ALL') return candidates.length > 0
    return condition.requiredIds.some((requiredId) =>
      candidates.some(
        (proficiency) =>
          proficiency.subjectId === requiredId ||
          proficiency.matchId === requiredId ||
          proficiency.subjectId === '*'
      )
    )
  }

  const equipmentMatches = (condition: RestrictionCondition): boolean =>
    parsedInput.base.equipment.some(
      (item) =>
        item.equipped &&
        (condition.mode === 'ALL' ||
          [item.equipmentId, ...item.parentEquipmentIds].some((id) =>
            condition.requiredIds.includes(id)
          )) &&
        (condition.category == null || item.category === condition.category) &&
        condition.requiredProperties.every((property) => item.properties.includes(property))
    )

  const conditionMatches = (
    condition: RestrictionCondition,
    sourceState: SourceState | undefined
  ): boolean => {
    switch (condition.kind) {
      case 'ABILITY_SCORE':
        return inRange(abilityValue(condition.abilityId), condition.min, condition.max)
      case 'HERITAGE':
        return (
          condition.mode === 'ALL' ||
          someSelected(condition.requiredIds, parsedInput.base.heritageIds)
        )
      case 'CHARACTER_LEVEL':
        return inRange(totalClassLevel(parsedInput), condition.min, condition.max)
      case 'CLASS_LEVEL':
        return parsedInput.base.classes.some(
          (entry) =>
            condition.classIds.includes(entry.classId) &&
            inRange(entry.level, condition.min, condition.max)
        )
      case 'FEAT_OBTAINED':
        return someSelected(condition.requiredIds, [
          ...parsedInput.base.featIds,
          ...acc.unlockedFeatIds
        ])
      case 'FEATURE_OBTAINED':
        return someSelected(condition.requiredIds, parsedInput.base.featureIds)
      case 'OPTION_OBTAINED':
        return (
          someSelected(condition.requiredIds, parsedInput.base.featureIds) &&
          someSelected(condition.secondaryRequiredIds, parsedInput.base.optionIds)
        )
      case 'SPELL_OBTAINED':
        return someSelected(condition.requiredIds, [
          ...parsedInput.upstreamSpellIds,
          ...acc.unlockedSpellIds
        ])
      case 'CAN_CAST_SPELL':
        return (
          parsedInput.base.classes.some((entry) => entry.spellcasting) ||
          parsedInput.upstreamSpellIds.length > 0 ||
          acc.unlockedSpellIds.length > 0
        )
      case 'PROFICIENCY':
        return meetsProficiency(condition)
      case 'EQUIPMENT_EQUIPPED':
        return equipmentMatches(condition)
      case 'SOURCE_STATE':
        return condition.sourceState === 'CARRIED'
          ? sourceState?.carried === true
          : condition.sourceState === 'EQUIPPED'
            ? sourceState?.equipped === true
            : sourceState?.attuned === true
      case 'HOLDER_KIND':
        return condition.requiredIds.includes(holderKind)
      case 'SIZE':
        return (
          condition.mode === 'ALL' ||
          (parsedInput.base.size !== null && condition.requiredIds.includes(parsedInput.base.size))
        )
      case 'ITEM_IDENTITY':
      case 'ITEM_CATEGORY':
      case 'ITEM_PROPERTY':
      case 'ITEM_SOLE_WEAPON':
      case 'ITEM_ATTACK_ABILITY':
      case 'ITEM_ACTIVATION':
      case 'CAN_ACT':
      case 'SPEED_ABOVE_ZERO':
      case 'FREE_HAND':
      case 'TURN_MOVEMENT':
      case 'ATTACK_ACTION_OTHER_WEAPON':
      case 'ENEMY_NEAR_TARGET':
      case 'TARGET_HAS_NOT_TAKEN_TURN':
      case 'HOLDER_IN_BRIGHT_LIGHT':
      case 'CREATURE_TYPE':
      case 'SOURCE_CREATURE_TYPE':
      case 'SOURCE_TRAIT':
      case 'UNAVAILABLE':
      case 'UNSUPPORTED':
        return false
    }
  }

  /** Conditions this fold cannot evaluate fail closed whatever their constraint. */
  const conditionPasses = (
    condition: RestrictionCondition,
    sourceState: SourceState | undefined
  ): boolean =>
    condition.kind !== 'UNSUPPORTED' &&
    condition.kind !== 'UNAVAILABLE' &&
    !DEFERRED_CONDITION_KINDS.has(condition.kind) &&
    (condition.constraint === 'INCLUDE'
      ? conditionMatches(condition, sourceState)
      : !conditionMatches(condition, sourceState))

  const facetPasses = (
    groups: CharacterGrantFoldRestriction,
    sourceState: SourceState | undefined
  ): boolean =>
    groups.length === 0 ||
    groups.some((group) =>
      group.conditions.every((condition) => conditionPasses(condition, sourceState))
    )

  /**
   * A modifier's attacking-item and holder-state conditions cannot be decided here, so they are
   * returned for its consumer: [] when some group passes outright, the residual groups when only
   * those conditions remain, and null when no group can pass.
   */
  const modifierDeferredRequirements = (
    groups: CharacterGrantFoldRestriction,
    sourceState: SourceState | undefined
  ): CharacterGrantFoldRestriction | null => {
    if (groups.length === 0) return []
    const residual: CharacterGrantFoldRestriction = []
    for (const group of groups) {
      const deferredConditions = group.conditions.filter((condition) =>
        DEFERRED_CONDITION_KINDS.has(condition.kind)
      )
      const characterConditionsPass = group.conditions
        .filter((condition) => !DEFERRED_CONDITION_KINDS.has(condition.kind))
        .every((condition) => conditionPasses(condition, sourceState))
      if (!characterConditionsPass) continue
      if (deferredConditions.length === 0) return []
      residual.push({ conditions: deferredConditions })
    }
    return residual.length === 0 ? null : residual
  }

  const applyScalingTargets = (
    operation: ScalingOperation | CharacterGrantFoldSource['feats'][number],
    activeLevel: number,
    output: string[]
  ): void => {
    if (operation.scalingKind === 'PER_LEVEL') {
      for (const level of operation.levels) {
        if (level.level <= activeLevel) output.push(...level.targetIds)
      }
      return
    }
    output.push(...operation.targetIds)
  }

  const applyModifiers = (
    modifiers: CharacterGrantFoldSource['modifiers'],
    sourceId: string,
    mechanicSource: CharacterGrantFoldSource['mechanicSource'],
    sourceState: SourceState | undefined,
    boundSourceId?: string
  ): void => {
    for (const modifier of modifiers) {
      const deferredRequirements = modifierDeferredRequirements(
        modifier.restrictions,
        drawnSourceState(modifier, sourceState)
      )
      if (deferredRequirements === null) continue
      // A roll influence's code is part of its group, so advantage and disadvantage never merge.
      const influence =
        modifier.payload !== undefined && 'influence' in modifier.payload
          ? modifier.payload.influence
          : undefined
      const domainKey = buildModifierDomainKey(modifier.valueDomainCode, modifier.modifierKind, {
        ...modifier.domain,
        influence
      })
      const accepted: Modifier = {
        domainKey,
        grantId: modifier.grantId,
        valueDomainCode: modifier.valueDomainCode,
        modifierKind: modifier.modifierKind,
        scope: modifier.scope,
        domain: modifier.domain,
        ...(modifier.payload === undefined ? {} : { payload: modifier.payload }),
        sourceId,
        ...(boundSourceId !== undefined && { boundSourceId }),
        source: mechanicSource,
        ...(modifier.scopeSpellIds.length > 0 ? { scopeSpellIds: modifier.scopeSpellIds } : {}),
        ...(modifier.scopeResourceIds.length > 0
          ? { scopeResourceIds: modifier.scopeResourceIds }
          : {}),
        deferredRequirements
      }
      const acceptedModifierIndex = acc.modifiers.length
      acc.modifiers.push(accepted)
      let group = modifierGroups.get(domainKey)
      if (group === undefined) {
        group = {
          domainKey,
          valueDomainCode: modifier.valueDomainCode,
          modifierKind: modifier.modifierKind,
          contributions: []
        }
        modifierGroups.set(domainKey, group)
        acc.modifierGroups.push(group)
      }
      group.contributions.push({
        acceptedModifierIndex,
        sourceId,
        grantId: modifier.grantId
      })
    }
  }

  const applySource = (
    source: CharacterGrantFoldSource,
    proficiencyOverride: readonly ProficiencyOperation[] | undefined,
    activeLevel: number | undefined
  ): boolean => {
    if (!facetPasses(source.restrictions, source.sourceState ?? undefined)) return false
    if (!activeSourceIds.has(source.sourceId)) {
      activeSourceIds.add(source.sourceId)
      acc.activeSourceIds.push(source.sourceId)
    }
    for (const operation of proficiencyOverride ?? source.proficiencies) {
      for (const [targetIndex, subjectId] of operation.targetIds.entries()) {
        const matchId = operation.matchIds[targetIndex]
        if (matchId === undefined)
          throw new Error('Proficiency targets and match identities must align.')
        const proficiency: Proficiency = {
          acceptedProficiencyIndex: acc.proficiencies.length,
          kind: operation.proficiencyKind,
          subjectId,
          matchId,
          scaling: operation.scaling,
          source: source.mechanicSource,
          grantId: operation.grantId,
          ...(operation.category != null ? { category: operation.category } : {})
        }
        acc.proficiencies.push(proficiency)
      }
    }
    const senseLevel = activeLevel ?? totalClassLevel(parsedInput)
    for (const operation of source.senses) {
      const senseIds: string[] = []
      applyScalingTargets(operation, senseLevel, senseIds)
      for (const senseDefinitionId of senseIds) {
        const sense: Sense = {
          acceptedSenseIndex: acc.senses.length,
          senseDefinitionId,
          grantId: operation.grantId,
          source: source.mechanicSource,
          range: operation.range
        }
        acc.senses.push(sense)
      }
    }
    applyModifiers(
      source.modifiers,
      source.sourceId,
      source.mechanicSource,
      undefined,
      source.boundSourceId
    )
    const grantLevel = activeLevel ?? 0
    for (const operation of source.feats)
      applyScalingTargets(operation, grantLevel, acc.unlockedFeatIds)
    for (const operation of source.spells)
      applyScalingTargets(operation, grantLevel, acc.unlockedSpellIds)
    return true
  }

  const schedule = (sourceKind: (typeof sourceOrder)[number], apply: () => void): void => {
    const rank = sourceOrder.indexOf(sourceKind)
    scheduled.push({ rank, position: position++, apply })
  }

  parsedInput.classes.forEach((record, classIndex) => {
    schedule('CLASS', () => {
      if (record.base != null) {
        applySource(
          record.base.source,
          classIndex > 0 && record.base.category === 'BASE'
            ? record.base.multiclassProficiencies
            : record.base.source.proficiencies,
          record.level
        )
      }
      if (
        record.subclass != null &&
        record.subclass.category === 'SUBCLASS' &&
        record.subclass.parentClassId === record.classId
      ) {
        applySource(record.subclass.source, undefined, record.level)
      }
    })
  })
  const background = parsedInput.background
  if (background !== null)
    schedule('BACKGROUND', () => applySource(background, undefined, undefined))
  for (const feature of parsedInput.features) {
    schedule(feature.sourceKind, () => {
      const activeLevel =
        feature.sourceKind === 'FEAT'
          ? Math.max(totalClassLevel(parsedInput), 1)
          : (feature.sourceClassLevel ??
            feature.timingLevel ??
            Math.max(totalClassLevel(parsedInput), 1))
      if (feature.definition != null) applySource(feature.definition, undefined, activeLevel)
      for (const option of feature.selectedOptions) applySource(option, undefined, activeLevel)
      if (feature.sourceKind === 'FEAT' && feature.featDefinition != null) {
        applySource(feature.featDefinition, undefined, activeLevel)
      }
    })
  }
  if (parsedInput.equipmentItems.length > 0) {
    schedule('EQUIPMENT', () => {
      const activeLevel = Math.max(parsedInput.base.totalLevel, 1)
      const activeItems: Array<{
        item: CharacterGrantFoldInput['equipmentItems'][number]
        sourceState: SourceState
      }> = []
      for (const item of parsedInput.equipmentItems) {
        if (item.requiresAttunement && !item.attuned) continue
        const sourceState = {
          carried: true,
          equipped: item.equipped,
          attuned: item.attuned
        }
        if (!facetPasses(item.restrictions, sourceState)) continue
        acc.activeEquipmentInstanceIds.push(item.instanceId)
        activeItems.push({ item, sourceState })
        for (const feature of item.features) {
          const eligible = applySource(feature.source, undefined, activeLevel)
          if (
            eligible &&
            feature.sourceChargeUse?.limitKind === 'SOURCE_CHARGES' &&
            item.chargeId != null &&
            feature.sourceChargeUse.cost > 0
          ) {
            acc.equipmentFeatureChargeUses.push({
              featureId: feature.sourceChargeUse.featureId,
              equipmentId: item.equipmentId,
              itemInstanceId: item.instanceId,
              chargeId: item.chargeId,
              cost: feature.sourceChargeUse.cost
            })
          }
        }
      }
      for (const { item, sourceState } of activeItems) {
        applyModifiers(
          item.rootModifiers,
          item.rootSourceId,
          {
            kind: 'EQUIPMENT_INSTANCE',
            equipmentId: item.equipmentId,
            itemInstanceId: item.instanceId
          },
          sourceState
        )
      }
    })
  }
  for (const source of parsedInput.activeEffects)
    schedule('ACTIVE_EFFECT', () => applySource(source, undefined, undefined))
  scheduled.sort((left, right) => left.rank - right.rank || left.position - right.position)
  for (const source of scheduled) source.apply()
  return characterGrantFoldOutputSchema.parse(acc)
}
