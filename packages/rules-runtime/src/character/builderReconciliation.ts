import { RACE_CATEGORY_CODE, type CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type {
  CharacterAuthored,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'

import {
  getCharacterChosenGrantOwners,
  getRequiredClassResourceGrants,
  isProvenanceStillValid,
  isSameRequiredResourceGrant,
  mergeRequiredResourceGrants,
  resolveFeatureOptionEligibility,
  type FeatureOptionEligibility
} from './builderEligibility.js'
import {
  collectGrantedFeaturesForCharacter,
  collectCharacterBuilderFeatures,
  isCharacterFeatAcquisitionValid,
  isValidAncestrySource
} from './characterBuilderSelections.js'
import {
  applyCharacterHitpointProgression,
  prepareCharacterHitpointProgression,
  reconcileCharacterHitDice
} from './builderHitPoints.js'
import {
  clearObsoleteStartingEquipmentSelections,
  compileStartingEquipmentEligibilityRuleFacts,
  reconcileStartingEquipmentDecision,
  resolveEligibleStartingEquipment
} from './builderStartingEquipment.js'
import { getCharacterChosenGrantChoiceRegistry } from './builderResolution.js'
import type { CharacterBuilderContext } from './builderTypes.js'
import { resolveCharacterChosenGrantChoices } from './chosenGrantChoiceResolver.js'
import type { CharacterRulePolicyFactsInput } from './characterRulePolicyFacts.js'

export async function reconcileCharacterBuilderCharacter(params: {
  character: CharacterAuthored
  existingCharacter?: CharacterAuthored | null
  context: CharacterBuilderContext
  evaluate: (
    character: CharacterAuthored,
    options: Pick<CharacterRulePolicyFactsInput, 'eligibilityFacets' | 'hitPointProgression'>
  ) => Promise<{
    output: CharacterRulePolicyOutput
    snapshot: Pick<CharacterBuildSnapshot, 'abilities'>
  }>
}): Promise<CharacterAuthored> {
  const { character, existingCharacter = null, context } = params
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

  const {
    classSelections,
    grantedFeatures: structuralFeatures,
    selectedBackground
  } = collectGrantedFeaturesForCharacter(nextCharacter, registry)

  const primaryClass = classSelections[0]?.baseClass
  const requiredResourceGrants = getRequiredClassResourceGrants(classSelections)
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
  let finalRuleState: FeatureOptionEligibility<Awaited<ReturnType<typeof params.evaluate>>>
  // Each changing pass only removes selections; dependent options and grants must settle together.
  while (true) {
    let grantedFeatures = collectCharacterBuilderFeatures(
      nextCharacter,
      registry,
      structuralFeatures
    )
    const featureAcquisitions = nextCharacter.intent.featureAcquisitions.filter(
      (acquisition) =>
        isCharacterFeatAcquisitionValid(acquisition, registry) &&
        isProvenanceStillValid(acquisition.source, nextCharacter, registry, grantedFeatures)
    )
    let changed = featureAcquisitions.length !== nextCharacter.intent.featureAcquisitions.length
    nextCharacter.intent.featureAcquisitions = featureAcquisitions
    grantedFeatures = collectCharacterBuilderFeatures(nextCharacter, registry, structuralFeatures)
    finalRuleState = await resolveFeatureOptionEligibility({
      character: nextCharacter,
      grantedFeatures,
      evaluate: (candidate, eligibilityFacets) => params.evaluate(candidate, { eligibilityFacets }),
      additionalEligibilityFacets: startingEquipmentEligibilityFacets,
      requireEvaluation: true
    })
    changed ||= finalRuleState.character !== nextCharacter
    nextCharacter.intent.featureAcquisitions = finalRuleState.character.intent.featureAcquisitions

    const chosenGrantChoices = resolveCharacterChosenGrantChoices(
      nextCharacter,
      getCharacterChosenGrantChoiceRegistry(context),
      getCharacterChosenGrantOwners(
        nextCharacter,
        classSelections,
        selectedBackground,
        grantedFeatures,
        registry.feats ?? []
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
    changed ||=
      chosenGrantSelections.length !== (nextCharacter.intent.chosenGrantSelections?.length ?? 0)
    nextCharacter.intent.chosenGrantSelections = chosenGrantSelections.length
      ? chosenGrantSelections
      : undefined

    const spellSelections = (nextCharacter.intent.spellSelections ?? []).filter((selection) =>
      isProvenanceStillValid(selection.source, nextCharacter, registry, grantedFeatures)
    )
    changed ||= spellSelections.length !== (nextCharacter.intent.spellSelections?.length ?? 0)
    nextCharacter.intent.spellSelections = spellSelections.length ? spellSelections : undefined

    const resourceGrants = (nextCharacter.intent.resourceGrants ?? []).filter(
      (grant) =>
        isProvenanceStillValid(grant.source, nextCharacter, registry, grantedFeatures) &&
        (!isClassResourceGrantSource(grant.source) ||
          requiredResourceGrants.some((requiredGrant) =>
            isSameRequiredResourceGrant(grant, requiredGrant)
          ))
    )
    changed ||= resourceGrants.length !== (nextCharacter.intent.resourceGrants?.length ?? 0)
    nextCharacter.intent.resourceGrants = resourceGrants.length ? resourceGrants : undefined
    if (!changed) break
  }
  if (!finalRuleState.ruleEvaluation) {
    throw new Error('Character rules evaluation did not produce an effective Builder state.')
  }
  const hitPointProgression = prepareCharacterHitpointProgression(
    nextCharacter,
    registry.classes,
    existingCharacter
  )
  const hitPointRuleEvaluation = await params.evaluate(nextCharacter, {
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
  if (!existingCharacter) {
    const startingHitPoints = hitPointRuleEvaluation.output.derivedStats.maxHitPoints.base
    if (startingHitPoints > 0) nextCharacter.state.hitpoints.current = startingHitPoints
  }

  const resourceGrants = mergeRequiredResourceGrants(
    nextCharacter.intent.resourceGrants ?? [],
    requiredResourceGrants
  )
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
