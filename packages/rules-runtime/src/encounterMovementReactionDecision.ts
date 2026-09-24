import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  movementReactionChoiceGroupDtoSchema,
  movementReactionChoiceOptionDtoSchema,
  movementReactionTimelineDtoSchema,
  type MovementReactionChoiceGroupDto,
  type MovementReactionChoiceOptionDto,
  type MovementReactionTimelineDto
} from '@artificer-toolkit/schema/shared/reaction'

import type {
  EvaluatedMovementReactionCandidate,
  MovementReactionEligibilitySource
} from './movementReactionEligibilityService.js'
import type {
  EncounterMovementReactionActionSource,
  EncounterMovementReactionEvaluationSource
} from './encounterMovementReactionSources.js'

type EvaluatedEncounterMovementReaction<
  TSource extends MovementReactionEligibilitySource = MovementReactionEligibilitySource
> = EvaluatedMovementReactionCandidate<TSource>

export interface EncounterMovementReactionChoiceOption<
  TSource extends MovementReactionEligibilitySource = MovementReactionEligibilitySource
> {
  kind: 'REACT'
  optionId: string
  evaluated: EvaluatedEncounterMovementReaction<TSource>
}

export interface EncounterMovementReactionChoiceGroup<
  TSource extends MovementReactionEligibilitySource = MovementReactionEligibilitySource
> {
  pathDistance: number
  reactorActorId: string
  reactorTokenId: string
  options: readonly EncounterMovementReactionChoiceOption<TSource>[]
}

type OrganizedEncounterMovementReactionDecisions = {
  automatic: readonly EvaluatedEncounterMovementReaction<EncounterMovementReactionEvaluationSource>[]
  choiceGroups: readonly EncounterMovementReactionChoiceGroup<EncounterMovementReactionEvaluationSource>[]
}

export const ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000f0'

function assistedChoiceOverride<TSource extends MovementReactionEligibilitySource>(
  entry: EvaluatedEncounterMovementReaction<TSource>
): EvaluatedEncounterMovementReaction<TSource> {
  return {
    ...entry,
    policy: {
      ...entry.policy,
      selectionPolicy: 'CHOICE',
      choiceDefinitionId: ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID
    }
  }
}

function compareEntry<TSource extends MovementReactionEligibilitySource>(
  left: EvaluatedEncounterMovementReaction<TSource>,
  right: EvaluatedEncounterMovementReaction<TSource>
): number {
  return (
    left.candidate.pathDistance - right.candidate.pathDistance ||
    left.candidate.reactorActorId.localeCompare(right.candidate.reactorActorId) ||
    left.candidate.reactorTokenId.localeCompare(right.candidate.reactorTokenId) ||
    left.source.capability.actionId.localeCompare(right.source.capability.actionId) ||
    left.candidate.sourceId.localeCompare(right.candidate.sourceId)
  )
}

function optionId<TSource extends MovementReactionEligibilitySource>(
  entry: EvaluatedEncounterMovementReaction<TSource>
): string {
  return checksumRuleDocument({
    schemaVersion: 1,
    actionId: entry.source.capability.actionId,
    contactSourceId: entry.candidate.sourceId,
    pathDistance: entry.candidate.pathDistance,
    reactorActorId: entry.candidate.reactorActorId,
    reactorTokenId: entry.candidate.reactorTokenId,
    stage: entry.candidate.stage
  })
}

export function organizeEncounterMovementReactionDecisions<
  TSource extends MovementReactionEligibilitySource
>(
  evaluated: readonly EvaluatedEncounterMovementReaction<TSource>[],
  automationMode: 'AUTOMATIC' | 'ASSISTED' = 'AUTOMATIC'
): {
  automatic: readonly EvaluatedEncounterMovementReaction<TSource>[]
  choiceGroups: readonly EncounterMovementReactionChoiceGroup<TSource>[]
} {
  const eligible = evaluated
    .filter((entry) => entry.policy.eligible)
    .map((entry) => (automationMode === 'ASSISTED' ? assistedChoiceOverride(entry) : entry))
    .sort(compareEntry)
  const automatic = eligible.filter((entry) => entry.policy.selectionPolicy === 'AUTOMATIC')
  const choiceEntries = eligible.filter((entry) => entry.policy.selectionPolicy === 'CHOICE')
  const groups: EncounterMovementReactionChoiceGroup<TSource>[] = []
  for (const entry of choiceEntries) {
    const prior = groups.at(-1)
    const sameGroup =
      prior &&
      prior.pathDistance === entry.candidate.pathDistance &&
      prior.reactorActorId === entry.candidate.reactorActorId &&
      prior.reactorTokenId === entry.candidate.reactorTokenId
    const option: EncounterMovementReactionChoiceOption<TSource> = {
      kind: 'REACT',
      optionId: optionId(entry),
      evaluated: entry
    }
    if (sameGroup) {
      if (prior.options.some((candidate) => candidate.optionId === option.optionId))
        throw new Error('Movement reaction choice option identity is duplicated.')
      groups[groups.length - 1] = { ...prior, options: [...prior.options, option] }
      continue
    }
    groups.push({
      pathDistance: entry.candidate.pathDistance,
      reactorActorId: entry.candidate.reactorActorId,
      reactorTokenId: entry.candidate.reactorTokenId,
      options: [option]
    })
  }
  return { automatic, choiceGroups: groups }
}

export function movementReactionActionSourceCurrentnessChecksum(
  source: EncounterMovementReactionActionSource
): string {
  if (source.kind === 'ENCOUNTER_FEATURE') {
    return checksumRuleDocument({
      schemaVersion: 1,
      kind: source.kind,
      actorId: source.actorId,
      actionId: source.capability.actionId,
      creatureSourceId: source.capability.creatureSourceId,
      ownerFeatureId: source.capability.ownerFeatureId,
      featureOptionId: source.capability.featureOptionId,
      ownerRuleDefinitionIds: source.capability.ownerRuleDefinitionIds,
      optionRuleDefinitionIds: source.capability.optionRuleDefinitionIds,
      effectId: source.capability.effectId,
      sourceRevision: source.capability.sourceRevision,
      sourceVersionId: source.capability.sourceVersionId,
      sourceChecksum: source.capability.sourceChecksum,
      authoredEffectChecksum: source.capability.authoredEffectChecksum,
      compiledEffectChecksum: source.capability.compiledEffectChecksum
    })
  }
  return checksumRuleDocument({
    schemaVersion: 1,
    kind: source.kind,
    actorId: source.actorId,
    characterId: source.characterId,
    characterStreamVersion: source.characterStreamVersion,
    actionId: source.candidate.actionId,
    effectId: source.candidate.effectId,
    sourceId: source.candidate.sourceId,
    mechanicFacts: source.candidate.mechanicFacts,
    compiledEntry: source.entry
  })
}

export function sealEncounterMovementReactionChoiceGroups(
  groups: readonly EncounterMovementReactionChoiceGroup<EncounterMovementReactionEvaluationSource>[]
): readonly MovementReactionChoiceGroupDto[] {
  return groups.map((group) =>
    movementReactionChoiceGroupDtoSchema.parse({
      pathDistance: group.pathDistance,
      reactorActorId: group.reactorActorId,
      reactorTokenId: group.reactorTokenId,
      options: group.options.map(sealOption)
    })
  )
}

function sealOption(
  input: EncounterMovementReactionChoiceOption<EncounterMovementReactionEvaluationSource>
): MovementReactionChoiceOptionDto {
  const { evaluated, optionId: exactOptionId } = input
  return movementReactionChoiceOptionDtoSchema.parse({
    optionId: exactOptionId,
    contactSourceId: evaluated.candidate.sourceId,
    actionId: evaluated.source.capability.actionId,
    actionSourceKind: evaluated.source.action.kind,
    actionSourceCurrentnessChecksum: movementReactionActionSourceCurrentnessChecksum(
      evaluated.source.action
    ),
    candidate: evaluated.candidate,
    binding: evaluated.source.binding,
    policy: evaluated.policy,
    eligibilityEvidenceChecksum: checksumRuleDocument(evaluated.evidence),
    authority:
      evaluated.source.action.kind === 'CHARACTER_ACTION'
        ? { kind: 'CHARACTER_CONTROLLER', characterId: evaluated.source.action.characterId }
        : { kind: 'GM' },
    visibility: evaluated.source.action.kind === 'CHARACTER_ACTION' ? 'CONTROLLER' : 'GM_ONLY'
  })
}

export function sealEncounterMovementReactionTimeline(
  organized: OrganizedEncounterMovementReactionDecisions
): MovementReactionTimelineDto {
  const automatic = organized.automatic.map((evaluated) =>
    sealOption({ kind: 'REACT', optionId: optionId(evaluated), evaluated })
  )
  const choices = sealEncounterMovementReactionChoiceGroups(organized.choiceGroups)
  return movementReactionTimelineDtoSchema.parse(
    [
      ...automatic.map((option) => ({ kind: 'AUTOMATIC_ACTION' as const, option })),
      ...choices.map((group) => ({ kind: 'CONTROLLER_CHOICE' as const, group }))
    ].sort((left, right) => {
      const leftOption = left.kind === 'AUTOMATIC_ACTION' ? left.option : left.group.options[0]!
      const rightOption = right.kind === 'AUTOMATIC_ACTION' ? right.option : right.group.options[0]!
      return (
        leftOption.candidate.pathDistance - rightOption.candidate.pathDistance ||
        leftOption.candidate.reactorActorId.localeCompare(rightOption.candidate.reactorActorId) ||
        leftOption.candidate.reactorTokenId.localeCompare(rightOption.candidate.reactorTokenId) ||
        (left.kind === 'AUTOMATIC_ACTION' ? 0 : 1) - (right.kind === 'AUTOMATIC_ACTION' ? 0 : 1) ||
        leftOption.actionId.localeCompare(rightOption.actionId) ||
        leftOption.optionId.localeCompare(rightOption.optionId)
      )
    })
  )
}
