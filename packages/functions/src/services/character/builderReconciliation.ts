import { isDeepStrictEqual } from 'node:util'
import type { DBLike } from '@artificer-toolkit/db'
import type { AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'
import { AUTHORED_RECORD_STATUS, RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import {
  isSameCharacterProvenanceIdentity,
  type CharacterAcquisitionTiming,
  type CharacterAuthored,
  type CharacterFeatureSelectionValue,
  type CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'

import {
  getCharacterChosenGrantChoiceRegistry,
  loadCharacterBuilderContext,
  type CharacterBuilderContext
} from './builderService.js'
import {
  getCharacterChosenGrantOwners,
  getRequiredClassResourceGrants,
  isProvenanceStillValid,
  isSameRequiredResourceGrant,
  mergeRequiredResourceGrants,
  resolveFeatureOptionEligibility
} from './builderEligibility.js'
import {
  collectGrantedFeaturesForCharacter,
  isValidAncestrySource
} from './characterBuilderSelections.js'
import {
  applyCharacterHitpointProgression,
  prepareCharacterHitpointProgression,
  reconcileCharacterHitDice
} from './builderHitPoints.js'
import { evaluateCharacterRulePolicy } from './characterRuleEvaluation.js'
import {
  clearObsoleteStartingEquipmentSelections,
  compileStartingEquipmentEligibilityRuleFacts,
  reconcileStartingEquipmentDecision,
  resolveEligibleStartingEquipment
} from './builderStartingEquipment.js'
import { resolveCharacterChosenGrantChoices } from './chosenGrantChoiceResolver.js'

export async function reconcileCharacterBuilderCharacter(
  db: DBLike,
  character: CharacterAuthored,
  existingCharacter: CharacterAuthored | null = null,
  providedContext?: CharacterBuilderContext,
  existingRevisionId: string | null = null
): Promise<CharacterAuthored> {
  const context = providedContext ?? (await loadCharacterBuilderContext(db, character))
  const { catalog, registry } = context
  const nextCharacter = clearObsoleteStartingEquipmentSelections(character, existingCharacter)

  const ancestrySelections = (nextCharacter.intent.ancestrySelections ?? []).filter((selection) => {
    const race = nextCharacter.intent.race.subraceId
      ? registry.races.find((record) => record.id === nextCharacter.intent.race.subraceId)
      : registry.races.find(
          (record) =>
            record.category === RACE_CATEGORY_CODE.BASE &&
            record.id === nextCharacter.intent.race.raceId
        )

    if (!race?.ancestry) return false
    if (selection.ancestryId !== race.ancestry.id) return false
    if (!race.ancestry.options.some((option) => option.id === selection.optionId)) return false
    return isValidAncestrySource(nextCharacter, selection.source)
  })

  nextCharacter.intent.ancestrySelections =
    ancestrySelections.length > 0 ? ancestrySelections : undefined

  const { classSelections, grantedFeatures, selectedBackground } =
    collectGrantedFeaturesForCharacter(nextCharacter, registry)

  let featureAcquisitions = [...nextCharacter.intent.featureAcquisitions]
  while (true) {
    const previousCount = featureAcquisitions.length
    const candidateCharacter = {
      ...nextCharacter,
      intent: {
        ...nextCharacter.intent,
        featureAcquisitions
      }
    }

    featureAcquisitions = featureAcquisitions.filter((acquisition) =>
      isProvenanceStillValid(acquisition.source, candidateCharacter, registry, grantedFeatures)
    )

    if (featureAcquisitions.length === previousCount) {
      break
    }
  }

  nextCharacter.intent.featureAcquisitions = featureAcquisitions

  const featureOptionEligibility = await resolveFeatureOptionEligibility({
    db,
    character: nextCharacter,
    context,
    grantedFeatures,
    existingRevisionId
  })
  nextCharacter.intent.featureAcquisitions =
    featureOptionEligibility.character.intent.featureAcquisitions

  const filteredCharacter = {
    ...nextCharacter,
    intent: {
      ...nextCharacter.intent,
      featureAcquisitions
    }
  }

  const chosenGrantChoices = resolveCharacterChosenGrantChoices(
    filteredCharacter,
    getCharacterChosenGrantChoiceRegistry(context),
    getCharacterChosenGrantOwners(
      filteredCharacter,
      classSelections,
      collectGrantedFeaturesForCharacter(filteredCharacter, registry).selectedBackground,
      grantedFeatures
    )
  )
  const chosenGrantSelections = (nextCharacter.intent.chosenGrantSelections ?? []).filter(
    (selection) =>
      chosenGrantChoices.some(
        (choice) =>
          choice.grantId === selection.grantId &&
          choice.progressionLevel === selection.progressionLevel &&
          isSameCharacterProvenanceIdentity(choice.source, selection.source)
      )
  )
  nextCharacter.intent.chosenGrantSelections =
    chosenGrantSelections.length > 0 ? chosenGrantSelections : undefined
  const spellSelections = (nextCharacter.intent.spellSelections ?? []).filter((selection) =>
    isProvenanceStillValid(selection.source, filteredCharacter, registry, grantedFeatures)
  )
  nextCharacter.intent.spellSelections = spellSelections.length > 0 ? spellSelections : undefined

  const primaryClass = classSelections[0]?.baseClass
  const startingEquipmentEligibilityFacets = [
    ...compileStartingEquipmentEligibilityRuleFacts({
      source: 'CLASS',
      startingEquipment: primaryClass?.startingEquipment
    }),
    ...compileStartingEquipmentEligibilityRuleFacts({
      source: 'BACKGROUND',
      startingEquipment: selectedBackground?.startingEquipment
    })
  ]
  const finalRuleState = await resolveFeatureOptionEligibility({
    db,
    character: nextCharacter,
    context,
    grantedFeatures,
    existingRevisionId,
    additionalEligibilityFacets: startingEquipmentEligibilityFacets,
    requireEvaluation: true
  })
  nextCharacter.intent.featureAcquisitions = finalRuleState.character.intent.featureAcquisitions
  if (!finalRuleState.ruleEvaluation) {
    throw new Error('Character rules evaluation did not produce an effective Builder state.')
  }
  const hitPointProgression = prepareCharacterHitpointProgression(
    nextCharacter,
    registry.classes,
    existingCharacter,
    Object.keys(finalRuleState.ruleEvaluation.snapshot.abilities)
  )
  const hitPointRuleEvaluation = await evaluateCharacterRulePolicy({
    db,
    character: nextCharacter,
    context,
    existingRevisionId,
    expectedRevisionId: finalRuleState.ruleEvaluation.binding.revisionId,
    hitPointProgression: hitPointProgression.facts
  })
  nextCharacter.intent.hitpoints.levels = applyCharacterHitpointProgression(
    hitPointProgression,
    hitPointRuleEvaluation.output.hitPointProgression
  )
  nextCharacter.state.hitpoints.hitDice = reconcileCharacterHitDice(
    nextCharacter.intent.classes,
    registry.classes,
    nextCharacter.state.hitpoints.hitDice
  )
  if (existingCharacter?.status !== AUTHORED_RECORD_STATUS.ACTIVE) {
    const startingHitPoints = hitPointRuleEvaluation.output.derivedStats.maxHitPoints.base
    if (startingHitPoints > 0) {
      nextCharacter.state.hitpoints.current = startingHitPoints
    }
  }

  const requiredResourceGrants = getRequiredClassResourceGrants(classSelections)
  const validResourceGrants = (nextCharacter.intent.resourceGrants ?? [])
    .filter((grant) =>
      isProvenanceStillValid(grant.source, filteredCharacter, registry, grantedFeatures)
    )
    .filter((grant) =>
      isClassResourceGrantSource(grant.source)
        ? requiredResourceGrants.some((requiredGrant) =>
            isSameRequiredResourceGrant(grant, requiredGrant)
          )
        : true
    )
  const resourceGrants = mergeRequiredResourceGrants(validResourceGrants, requiredResourceGrants)
  nextCharacter.intent.resourceGrants = resourceGrants.length > 0 ? resourceGrants : undefined

  if (primaryClass || selectedBackground?.startingEquipment) {
    const eligibleStartingEquipment = resolveEligibleStartingEquipment({
      primaryClass,
      selectedBackground,
      eligibilityById: finalRuleState.eligibilityById
    })

    if (nextCharacter.intent.startingEquipment?.class) {
      nextCharacter.intent.startingEquipment.class = reconcileStartingEquipmentDecision(
        nextCharacter.intent.startingEquipment.class,
        eligibleStartingEquipment.classStartingEquipment,
        catalog
      )
    }
    if (nextCharacter.intent.startingEquipment?.background) {
      nextCharacter.intent.startingEquipment.background = reconcileStartingEquipmentDecision(
        nextCharacter.intent.startingEquipment.background,
        eligibleStartingEquipment.backgroundStartingEquipment,
        catalog
      )
    }
    if (
      nextCharacter.intent.startingEquipment &&
      !nextCharacter.intent.startingEquipment.class &&
      !nextCharacter.intent.startingEquipment.background
    ) {
      delete nextCharacter.intent.startingEquipment
    }
  }

  return nextCharacter
}

function isClassResourceGrantSource(source: CharacterProvenance): boolean {
  return source.kind === 'CLASS' || source.kind === 'SUBCLASS'
}

export interface CharacterSourceLossTarget {
  subjectKind: AuthoredSubjectKind
  subjectId: string
}

export function characterReferencesAuthoredRoot(
  character: CharacterAuthored,
  target: CharacterSourceLossTarget
): boolean {
  return !isDeepStrictEqual(reconcileCharacterAuthoredSourceLoss(character, target), character)
}

/** Removes current Character references to one authored root without mutating the input. */
export function reconcileCharacterAuthoredSourceLoss(
  character: CharacterAuthored,
  target: CharacterSourceLossTarget
): CharacterAuthored {
  const next = structuredClone(character)
  switch (target.subjectKind) {
    case 'SPELL':
      removeSpell(next, target.subjectId)
      break
    case 'EQUIPMENT':
      removeEquipment(next, target.subjectId)
      break
    case 'CREATURE':
      removeCreature(next, target.subjectId)
      break
    case 'VEHICLE':
      removeVehicle(next, target.subjectId)
      break
    case 'RACE':
      removeRace(next, target.subjectId)
      break
    case 'CLASS':
      removeClass(next, target.subjectId)
      break
    case 'BACKGROUND':
      removeBackground(next, target.subjectId)
      break
    case 'FEAT':
      removeProvenance(
        next,
        (source) => source.kind === 'FEAT' && source.featId === target.subjectId
      )
      removeSelectionTarget(next, target.subjectId)
      break
  }
  return next
}

function removeSpell(character: CharacterAuthored, spellId: string): void {
  character.intent.spellSelections = optionalArray(
    (character.intent.spellSelections ?? [])
      .map((selection) => ({
        ...selection,
        spells: selection.spells.filter((id) => id !== spellId)
      }))
      .filter((selection) => selection.spells.length > 0)
  )
  character.state.classes = optionalArray(
    (character.state.classes ?? []).map((entry) => {
      const learned = entry.spells?.learned?.filter((id) => id !== spellId)
      const prepared = entry.spells?.prepared?.filter((id) => id !== spellId)
      return learned?.length || prepared?.length
        ? {
            ...entry,
            spells: {
              ...(learned?.length ? { learned } : {}),
              ...(prepared?.length ? { prepared } : {})
            }
          }
        : omit(entry, 'spells')
    })
  )
  removeSelectionTarget(character, spellId)
}

function removeEquipment(character: CharacterAuthored, equipmentId: string): void {
  const removedItemIds = new Set(
    character.state.equipment.inventory
      .filter((item) => item.equipmentId === equipmentId)
      .map((item) => item.id)
  )
  character.state.equipment.inventory = character.state.equipment.inventory
    .filter((item) => item.equipmentId !== equipmentId)
    .map((item) =>
      item.containerId && removedItemIds.has(item.containerId) ? omit(item, 'containerId') : item
    )
  character.state.equipment.equipped = character.state.equipment.equipped.filter(
    (itemId) => !removedItemIds.has(itemId)
  )
  character.state.equipment.attuned = character.state.equipment.attuned.filter(
    (itemId) => !removedItemIds.has(itemId)
  )
  setEquipmentAssignments(character, 'creatureEquipment', removedItemIds)
  setEquipmentAssignments(character, 'vehicleEquipment', removedItemIds)
  for (const source of ['class', 'background'] as const) {
    const decision = character.intent.startingEquipment?.[source]
    if (!decision?.groups) continue
    decision.groups = decision.groups.map((group) => {
      const selections = group.selections?.filter((entry) => entry.equipmentId !== equipmentId)
      return selections?.length ? { ...group, selections } : omit(group, 'selections')
    })
  }
  removeSelectionTarget(character, equipmentId)
}

function setEquipmentAssignments(
  character: CharacterAuthored,
  key: 'creatureEquipment' | 'vehicleEquipment',
  removedItemIds: ReadonlySet<string>
): void {
  const assignments = character.state[key]
  if (!assignments) return
  const retained = Object.fromEntries(
    Object.entries(assignments).flatMap(([ownerId, values]) => {
      const next = values.filter((value) => !removedItemIds.has(value.equipmentItemId))
      return next.length > 0 ? [[ownerId, next]] : []
    })
  )
  if (Object.keys(retained).length > 0) character.state[key] = retained
  else delete character.state[key]
}

function removeCreature(character: CharacterAuthored, creatureId: string): void {
  const removedInstanceIds = new Set(
    (character.state.creatures ?? [])
      .filter((entry) => entry.creatureId === creatureId)
      .map((entry) => entry.id)
  )
  character.state.creatures = optionalArray(
    (character.state.creatures ?? []).filter((entry) => entry.creatureId !== creatureId)
  )
  removeRosterAssignments(character, 'creatureEquipment', removedInstanceIds)
}

function removeVehicle(character: CharacterAuthored, vehicleId: string): void {
  const removedInstanceIds = new Set(
    (character.state.vehicles ?? [])
      .filter((entry) => entry.vehicleId === vehicleId)
      .map((entry) => entry.id)
  )
  character.state.vehicles = optionalArray(
    (character.state.vehicles ?? []).filter((entry) => entry.vehicleId !== vehicleId)
  )
  removeRosterAssignments(character, 'vehicleEquipment', removedInstanceIds)
}

function removeRosterAssignments(
  character: CharacterAuthored,
  key: 'creatureEquipment' | 'vehicleEquipment',
  removedInstanceIds: ReadonlySet<string>
): void {
  const assignments = character.state[key]
  if (!assignments) return
  const retained = Object.fromEntries(
    Object.entries(assignments).filter(([instanceId]) => !removedInstanceIds.has(instanceId))
  )
  if (Object.keys(retained).length > 0) character.state[key] = retained
  else delete character.state[key]
}

function removeRace(character: CharacterAuthored, raceId: string): void {
  const removesBase = character.intent.race.raceId === raceId
  const removedSubraceId = removesBase ? character.intent.race.subraceId : undefined
  if (removesBase) {
    character.intent.race.raceId = ''
    delete character.intent.race.subraceId
  } else if (character.intent.race.subraceId === raceId) {
    delete character.intent.race.subraceId
  }
  character.intent.ancestrySelections = optionalArray(
    (character.intent.ancestrySelections ?? []).filter(
      (selection) =>
        !(
          (selection.source.kind === 'RACE' && selection.source.raceId === raceId) ||
          (selection.source.kind === 'SUBRACE' &&
            (selection.source.subraceId === raceId ||
              selection.source.subraceId === removedSubraceId))
        )
    )
  )
  removeProvenance(
    character,
    (source) =>
      (source.kind === 'RACE' && source.raceId === raceId) ||
      (source.kind === 'SUBRACE' &&
        (source.subraceId === raceId || source.subraceId === removedSubraceId))
  )
}

function removeClass(character: CharacterAuthored, classId: string): void {
  const removesPrimaryClass = character.intent.classes[0]?.classId === classId
  const removedSubclassIds = new Set(
    character.intent.classes
      .filter((entry) => entry.classId === classId)
      .flatMap((entry) => (entry.subclassId ? [entry.subclassId] : []))
  )
  character.intent.classes = character.intent.classes
    .filter((entry) => entry.classId !== classId)
    .map((entry) => (entry.subclassId === classId ? omit(entry, 'subclassId') : entry))
  character.intent.hitpoints.levels = character.intent.hitpoints.levels.filter(
    (entry) => entry.classId !== classId
  )
  character.state.classes = optionalArray(
    (character.state.classes ?? []).filter((entry) => entry.classId !== classId)
  )
  character.intent.ancestrySelections = optionalArray(
    (character.intent.ancestrySelections ?? []).filter(
      (selection) => !hasClassTiming(selection.timing, classId)
    )
  )
  if (removesPrimaryClass) {
    delete character.intent.startingEquipment?.class
    removeEmptyStartingEquipment(character)
  }
  removeProvenance(
    character,
    (source) =>
      (source.kind === 'CLASS' && source.classId === classId) ||
      (source.kind === 'SUBCLASS' &&
        (source.subclassId === classId || removedSubclassIds.has(source.subclassId))),
    (timing) => hasClassTiming(timing, classId)
  )
}

function removeBackground(character: CharacterAuthored, backgroundId: string): void {
  if (character.intent.background.backgroundId === backgroundId) {
    character.intent.background.backgroundId = ''
    delete character.intent.startingEquipment?.background
    removeEmptyStartingEquipment(character)
  }
  removeProvenance(
    character,
    (source) => source.kind === 'BACKGROUND' && source.backgroundId === backgroundId
  )
}

function removeProvenance(
  character: CharacterAuthored,
  matchesSource: (source: CharacterProvenance) => boolean,
  matchesTiming: (timing: CharacterAcquisitionTiming) => boolean = () => false
): void {
  const removedIds = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const acquisition of character.intent.featureAcquisitions) {
      if (
        matchesSource(acquisition.source) ||
        matchesTiming(acquisition.timing) ||
        (acquisition.source.kind === 'OPTION' &&
          removedIds.has(acquisition.source.acquiredParentId))
      ) {
        if (!removedIds.has(acquisition.id)) {
          removedIds.add(acquisition.id)
          changed = true
        }
      }
    }
  }
  character.intent.featureAcquisitions = character.intent.featureAcquisitions.filter(
    (entry) => !removedIds.has(entry.id)
  )
  const removedSource = (source: CharacterProvenance): boolean =>
    matchesSource(source) || (source.kind === 'OPTION' && removedIds.has(source.acquiredParentId))
  character.intent.chosenGrantSelections = optionalArray(
    (character.intent.chosenGrantSelections ?? []).filter(
      (entry) => !removedSource(entry.source) && !matchesTiming(entry.timing)
    )
  )
  character.intent.spellSelections = optionalArray(
    (character.intent.spellSelections ?? []).filter(
      (entry) => !removedSource(entry.source) && !matchesTiming(entry.timing)
    )
  )
  character.intent.resourceGrants = optionalArray(
    (character.intent.resourceGrants ?? []).filter(
      (entry) => !removedSource(entry.source) && !matchesTiming(entry.timing)
    )
  )
}

function removeSelectionTarget(character: CharacterAuthored, targetId: string): void {
  character.intent.chosenGrantSelections = optionalArray(
    (character.intent.chosenGrantSelections ?? [])
      .map((entry) => ({
        ...entry,
        targetIds: entry.targetIds.filter((id) => id !== targetId)
      }))
      .filter((entry) => entry.targetIds.length > 0)
  )
  character.intent.featureAcquisitions = character.intent.featureAcquisitions.map((acquisition) => {
    const selections = optionalArray(
      (acquisition.selections ?? [])
        .map((selection) => ({
          ...selection,
          values: selection.values.flatMap((value): CharacterFeatureSelectionValue[] => {
            if (value.kind === 'ID') return value.id === targetId ? [] : [value]
            if (value.kind !== 'IDS') return [value]
            const ids = value.ids.filter((id) => id !== targetId)
            return ids.length > 0 ? [{ ...value, ids }] : []
          })
        }))
        .filter((selection) => selection.values.length > 0)
    )
    return selections ? { ...acquisition, selections } : omit(acquisition, 'selections')
  })
}

function optionalArray<T>(values: T[]): T[] | undefined {
  return values.length > 0 ? values : undefined
}

function hasClassTiming(timing: CharacterAcquisitionTiming, classId: string): boolean {
  return timing.kind === 'CLASS_LEVEL' && timing.classId === classId
}

function removeEmptyStartingEquipment(character: CharacterAuthored): void {
  if (
    character.intent.startingEquipment &&
    !character.intent.startingEquipment.class &&
    !character.intent.startingEquipment.background
  ) {
    delete character.intent.startingEquipment
  }
}

function omit<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const next = { ...value }
  delete next[key]
  return next
}
