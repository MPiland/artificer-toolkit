import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import type { VisibleAuthoringSteps } from '#forms/hooks/useAuthoringResolvedModel'
import type {
  AuthoringProgressSummary,
  AuthoringStepProgressStatus,
  AuthoringStepStatusMap
} from '#forms/validation/authoringProgress'
import { characterBuilderSteps, type CharacterBuilderStepId } from '../core/stepNavigation'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import { getAssignedAbilityCodes } from '../steps/abilities/abilityGeneration'
import { isHitpointProgressionComplete } from '../steps/abilities/characterAbilities'

type CharacterBuilderProgressState = {
  firstBlockingStatus?: Exclude<AuthoringStepProgressStatus, 'complete'>
  firstBlockingStepId?: CharacterBuilderStepId
  progressSummary: AuthoringProgressSummary
  stepStatuses: AuthoringStepStatusMap
}

export const characterBuilderVisibleSteps: VisibleAuthoringSteps = characterBuilderSteps.map(
  (step, index) => ({
    ...step,
    order: index + 1,
    sections: []
  })
)

const statusRank: Record<AuthoringStepProgressStatus, number> = {
  complete: 0,
  warning: 1,
  incomplete: 2,
  error: 3
}

export function getCharacterBuilderStep(stepId?: string) {
  return characterBuilderSteps.find((step) => step.id === stepId) ?? characterBuilderSteps[0]
}

export function getCharacterBuilderProgressState(
  payload: CharacterBuilderPayloadDto,
  values: CharacterFormValues
): CharacterBuilderProgressState {
  const stepStatuses: Record<CharacterBuilderStepId, AuthoringStepProgressStatus> = {
    BASICS: values.label.trim() && values.intent.advancement?.method ? 'complete' : 'incomplete',
    RACE: values.intent.race?.raceId ? 'complete' : 'incomplete',
    CLASSES: values.intent.classes.length > 0 ? 'complete' : 'incomplete',
    BACKGROUND: values.intent.background?.backgroundId ? 'complete' : 'incomplete',
    ABILITIES: isAbilitiesAndHitpointsComplete(values) ? 'complete' : 'incomplete',
    EQUIPMENT: isStartingEquipmentChoicesComplete(payload) ? 'complete' : 'incomplete',
    DETAILS: 'complete',
    NOTES: 'complete',
    REVIEW: payload.view.review.ready ? 'complete' : 'incomplete'
  }

  for (const issue of payload.resolution.outstandingChoices) {
    setStepStatus(stepStatuses, issue.sectionId, 'incomplete')
  }

  for (const validation of payload.resolution.validations) {
    setStepStatus(
      stepStatuses,
      validation.sectionId,
      validation.severity === 'blocking' ? 'error' : 'warning'
    )
  }

  return summarizeStepStatuses(stepStatuses)
}

function isAbilitiesAndHitpointsComplete(values: CharacterFormValues): boolean {
  const assignedAbilities = new Set(getAssignedAbilityCodes(values.intent.abilities))
  const hitpointLevels = values.intent.hitpoints.levels ?? []

  return (
    assignedAbilities.size === 6 &&
    isHitpointProgressionComplete(values.intent.classes, hitpointLevels)
  )
}

function isStartingEquipmentChoicesComplete(payload: CharacterBuilderPayloadDto): boolean {
  return (
    !payload.view.equipment.classStartingEquipmentRequired &&
    !payload.view.equipment.backgroundStartingEquipmentRequired
  )
}

function setStepStatus(
  stepStatuses: Record<CharacterBuilderStepId, AuthoringStepProgressStatus>,
  stepId: CharacterBuilderStepId,
  status: AuthoringStepProgressStatus
) {
  if (statusRank[status] > statusRank[stepStatuses[stepId]]) {
    stepStatuses[stepId] = status
  }
}

function summarizeStepStatuses(
  stepStatuses: Record<CharacterBuilderStepId, AuthoringStepProgressStatus>
): CharacterBuilderProgressState {
  let completeCount = 0
  let errorCount = 0
  let incompleteCount = 0
  let warningCount = 0
  let firstBlockingStepId: CharacterBuilderStepId | undefined
  let firstBlockingStatus: Exclude<AuthoringStepProgressStatus, 'complete'> | undefined

  for (const step of characterBuilderSteps) {
    const status = stepStatuses[step.id]
    if (status === 'complete') completeCount += 1
    if (status === 'error') errorCount += 1
    if (status === 'incomplete') incompleteCount += 1
    if (status === 'warning') warningCount += 1
    if (status !== 'complete' && !firstBlockingStepId) {
      firstBlockingStepId = step.id
      firstBlockingStatus = status
    }
  }

  return {
    firstBlockingStatus,
    firstBlockingStepId,
    progressSummary: {
      completeCount,
      errorCount,
      incompleteCount,
      stepCount: characterBuilderSteps.length,
      warningCount
    },
    stepStatuses
  }
}
