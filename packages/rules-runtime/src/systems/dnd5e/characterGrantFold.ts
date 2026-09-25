import {
  characterGrantFoldInputSchema,
  characterGrantFoldOutputSchema,
  type CharacterGrantFoldInput,
  type CharacterGrantFoldOutput,
  type CharacterGrantFoldRestriction,
  type CharacterGrantFoldSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'

import { characterPolicyRecord } from './characterPolicyValues.js'

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
  'MANUAL'
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

function domainEntries(
  domain: CharacterGrantFoldSource['modifiers'][number]['domain']
): [string, unknown][] {
  if (domain === null) throw new TypeError('Cannot convert undefined or null to object')
  if (typeof domain === 'object' || typeof domain === 'string') return Object.entries(domain)
  return []
}

function buildDomainKey(modifier: CharacterGrantFoldSource['modifiers'][number]): string {
  const entries = domainEntries(modifier.domain)
    .filter(([, value]) => {
      return value != null && value !== ''
    })
    .sort(([left], [right]) => left.localeCompare(right))
  if (entries.length === 0) return `${modifier.valueDomainCode}:${modifier.modifierKind}`
  return `${modifier.valueDomainCode}:${modifier.modifierKind}|${entries
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('|')}`
}

/**
 * Drawn weapons (rules-runtime.md): attacking with a carried item draws it, so the item's own
 * source-scoped attack and damage bonuses see it as equipped. Roll-mode grants keep the real
 * state because Character-wide attack evidence is not yet filtered by source, and every other
 * gate (attunement, armor class, Global scope) is unchanged.
 */
function drawnSourceState(
  modifier: CharacterGrantFoldSource['modifiers'][number],
  sourceState: SourceState | undefined
): SourceState | undefined {
  if (!sourceState?.carried || sourceState.equipped) return sourceState
  return characterPolicyRecord(modifier.grant).scope === 'SOURCE' &&
    (modifier.valueDomainCode === 'ATTACK_ROLL' || modifier.valueDomainCode === 'DAMAGE') &&
    modifier.modifierKind !== 'ADVANTAGE' &&
    modifier.modifierKind !== 'DISADVANTAGE'
    ? { ...sourceState, equipped: true }
    : sourceState
}

export function evaluateDnd5e2014CharacterGrantFold(
  input: CharacterGrantFoldInput
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

  const abilityValue = (abilityId: string | null): number => {
    const aliases: Record<string, readonly string[]> = {
      STRENGTH: ['STRENGTH', 'STR'],
      DEXTERITY: ['DEXTERITY', 'DEX'],
      CONSTITUTION: ['CONSTITUTION', 'CON'],
      INTELLIGENCE: ['INTELLIGENCE', 'INT'],
      WISDOM: ['WISDOM', 'WIS'],
      CHARISMA: ['CHARISMA', 'CHA']
    }
    for (const key of aliases[String(abilityId)] ?? [String(abilityId)]) {
      const value = parsedInput.base.abilities[key]
      if (value !== undefined) return value
    }
    return 0
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
        (condition.mode === 'ALL' || condition.requiredIds.includes(item.equipmentId)) &&
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
      case 'UNAVAILABLE':
      case 'UNSUPPORTED':
        return false
    }
  }

  const conditionPasses = (
    condition: RestrictionCondition,
    sourceState: SourceState | undefined
  ): boolean =>
    condition.kind !== 'UNSUPPORTED' &&
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
    sourceState: SourceState | undefined
  ): void => {
    for (const modifier of modifiers) {
      if (!facetPasses(modifier.restrictions, drawnSourceState(modifier, sourceState))) continue
      const domainKey = buildDomainKey(modifier)
      const accepted: Modifier = {
        domainKey,
        modifierKind: modifier.modifierKind,
        grant: modifier.grant,
        source: mechanicSource,
        ...(modifier.scopeSpellIds.length > 0 ? { scopeSpellIds: modifier.scopeSpellIds } : {})
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
        grantId: modifier.grantId,
        grant: modifier.grant
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
          ...(operation.range != null ? { range: operation.range } : {})
        }
        acc.senses.push(sense)
      }
    }
    applyModifiers(source.modifiers, source.sourceId, source.mechanicSource, undefined)
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
  scheduled.sort((left, right) => left.rank - right.rank || left.position - right.position)
  for (const source of scheduled) source.apply()
  return characterGrantFoldOutputSchema.parse(acc)
}
