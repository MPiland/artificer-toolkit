import type { DBLike } from '@artificer-toolkit/db'
import { AUTHORED_RECORD_STATUS, RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import {
  isSameCharacterProvenanceIdentity,
  type CharacterAuthored,
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
