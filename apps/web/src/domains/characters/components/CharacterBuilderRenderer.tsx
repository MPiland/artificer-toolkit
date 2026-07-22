import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Text } from '@mantine/core'
import { useStore } from '@tanstack/react-form'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import { withForm } from '#forms/app-form/AppForm'
import { useAuthoringForm } from '#forms/layout/AuthoringFormContext'
import type { VisibleAuthoringSteps } from '#forms/hooks/useAuthoringResolvedModel'
import type {
  AuthoringProgressSummary,
  AuthoringStepProgressStatus,
  AuthoringStepStatusMap
} from '#forms/validation/authoringProgress'
import {
  characterBuilderSteps,
  createFallbackCharacterFormValues,
  getAssignedAbilityCodes,
  getCharacterBuilderDeferredResolutionFingerprint,
  getCharacterBuilderImmediateResolutionFingerprint,
  getCharacterBuilderIssueStepId,
  getCharacterBuilderValidationStepId,
  toCharacterFormValues,
  type CharacterBuilderStepId,
  type CharacterFormValues
} from '../characterBuilder.utils'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  CHARACTER_BUILDER_TIMING_MEASURE,
  completeCharacterBuilderTiming,
  startCharacterBuilderTiming
} from '../characterBuilder.performance'
import * as styles from '../characterBuilder.css'
import { CharacterBasicsStep } from '../steps/CharacterBasicsStep'
import { CharacterRaceStep } from '../steps/CharacterRaceStep'
import { CharacterClassesStep } from '../steps/CharacterClassesStep'
import { CharacterBackgroundStep } from '../steps/CharacterBackgroundStep'
import { CharacterDetailsStep } from '../steps/CharacterDetailsStep'
import { CharacterNotesStep } from '../steps/CharacterNotesStep'
import { CharacterAbilitiesStep } from '../steps/CharacterAbilitiesStep'
import { isHitpointProgressionComplete } from '../steps/CharacterAbilitiesStep.utils'
import { CharacterEquipmentStep } from '../steps/CharacterEquipmentStep'
import { CharacterReviewStep } from '../steps/CharacterReviewStep'

export type CharacterBuilderRendererProps = {
  payload: CharacterBuilderPayloadDto
  resolveDebounceMs?: number
  onResolve: (character: CharacterFormValues) => Promise<void> | void
}

export const CharacterBuilderRenderer = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderRendererProps,
  render: function RenderCharacterBuilder({ form, onResolve, payload, resolveDebounceMs = 150 }) {
    const authoring = useAuthoringForm()
    const {
      updateAuthoringFormActions,
      updateAuthoringFormState
    } = authoring
    const values = useStore(form.store, (state) => state.values)
    const immediateResolutionFingerprint = useStore(form.store, (state) =>
      getCharacterBuilderImmediateResolutionFingerprint(state.values)
    )
    const deferredResolutionFingerprint = useStore(form.store, (state) =>
      getCharacterBuilderDeferredResolutionFingerprint(state.values)
    )
    const submitState = useStore(form.store, (state) => ({
      canSubmit: state.canSubmit,
      isSubmitting: state.isSubmitting
    }))
    const [activeStepId, setActiveStepId] = useState<CharacterBuilderStepId>(
      payload.resolution.recommendedSectionId
    )
    const activeStep =
      characterBuilderSteps.find((step) => step.id === activeStepId) ?? characterBuilderSteps[0]
    const activeIndex = characterBuilderSteps.findIndex((step) => step.id === activeStep.id)
    const isLastStep = activeIndex === characterBuilderSteps.length - 1
    const visibleSteps = useMemo<VisibleAuthoringSteps>(
      () =>
        characterBuilderSteps.map((step, index) => ({
          ...step,
          order: index + 1,
          sections: []
        })),
      []
    )
    const payloadFormValues = useMemo(() => toCharacterFormValues(payload), [payload])
    const resolutionPending =
      immediateResolutionFingerprint !== getCharacterBuilderImmediateResolutionFingerprint(payloadFormValues)
      || deferredResolutionFingerprint !== getCharacterBuilderDeferredResolutionFingerprint(payloadFormValues)
    const [isResolving, setIsResolving] = useState(false)
    const progress = useMemo(
      () => getCharacterBuilderProgress(payload, isResolving ? payloadFormValues : values),
      [isResolving, payload, payloadFormValues, values]
    )
    const latestValuesRef = useRef(values)
    latestValuesRef.current = values
    const previousImmediateFingerprintRef = useRef(immediateResolutionFingerprint)
    const resolveRequestIdRef = useRef(0)

    useEffect(() => {
      if (authoring.readOnly || !resolutionPending) {
        setIsResolving(false)
        return
      }

      const resolvesImmediately =
        previousImmediateFingerprintRef.current !== immediateResolutionFingerprint
      previousImmediateFingerprintRef.current = immediateResolutionFingerprint
      const requestId = resolveRequestIdRef.current + 1
      resolveRequestIdRef.current = requestId
      setIsResolving(true)
      startCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.RESOLUTION_INTENT)
      const timeoutId = window.setTimeout(() => {
        void Promise.resolve(onResolve(latestValuesRef.current)).finally(() => {
          if (resolveRequestIdRef.current === requestId) setIsResolving(false)
        })
      }, resolvesImmediately ? 0 : resolveDebounceMs)

      return () => window.clearTimeout(timeoutId)
    }, [
      authoring.readOnly,
      deferredResolutionFingerprint,
      immediateResolutionFingerprint,
      onResolve,
      resolveDebounceMs,
      resolutionPending
    ])

    useEffect(() => {
      completeCharacterBuilderTiming({
        endMark: CHARACTER_BUILDER_TIMING_MARK.RESOLUTION_RECONCILED,
        measure: CHARACTER_BUILDER_TIMING_MEASURE.RESOLUTION,
        startMark: CHARACTER_BUILDER_TIMING_MARK.RESOLUTION_INTENT
      })
    }, [payload])

    const goToNextStep = useCallback(() => {
      setActiveStepId(
        characterBuilderSteps[Math.min(activeIndex + 1, characterBuilderSteps.length - 1)].id
      )
    }, [activeIndex])

    const goToPreviousStep = useCallback(() => {
      setActiveStepId(characterBuilderSteps[Math.max(activeIndex - 1, 0)].id)
    }, [activeIndex])
    const goToStep = useCallback((stepId: string) => {
      if (characterBuilderSteps.some((step) => step.id === stepId)) {
        setActiveStepId(stepId as CharacterBuilderStepId)
      }
    }, [])

    const statePatch = useMemo(
      () => ({
        activeStepId: activeStep.id,
        activeStepLabel: activeStep.label,
        canFinalize: submitState.canSubmit && payload.view.review.ready,
        canSubmit: submitState.canSubmit && payload.view.review.ready,
        firstBlockingStatus: progress.firstBlockingStatus,
        firstBlockingStepId: progress.firstBlockingStepId,
        isFirstStep: activeIndex === 0,
        isLastStep,
        isSubmitting: submitState.isSubmitting,
        progressSummary: progress.progressSummary,
        stepStatuses: progress.stepStatuses,
        visibleSteps
      }),
      [
        activeIndex,
        activeStep.id,
        activeStep.label,
        isLastStep,
        payload.view.review.ready,
        progress.firstBlockingStatus,
        progress.firstBlockingStepId,
        progress.progressSummary,
        progress.stepStatuses,
        submitState.canSubmit,
        submitState.isSubmitting,
        visibleSteps
      ]
    )

    const actions = useMemo(
      () => ({
        onNextStep: goToNextStep,
        onPreviousStep: goToPreviousStep,
        onStepChange: goToStep
      }),
      [goToNextStep, goToPreviousStep, goToStep]
    )

    useEffect(() => {
      updateAuthoringFormState(statePatch)
    }, [statePatch, updateAuthoringFormState])

    useEffect(() => {
      updateAuthoringFormActions(actions)
    }, [actions, updateAuthoringFormActions])

    return (
      <div className={styles.builderRoot}>
        <div className={styles.builderHeader}>
          <div>
            <h2 id='character-builder-active-step-title' className={styles.title}>{activeStep.label}</h2>
            <Text className={styles.stepDescription}>{activeStep.description}</Text>
          </div>
        </div>
        {payload.resolution.validations.length ? (
          <Alert color='yellow'>
            {payload.resolution.validations.map((validation) => validation.message).join(' ')}
          </Alert>
        ) : null}
        <div
          className={styles.resolverContent}
          aria-busy={isResolving}
          aria-labelledby='character-builder-active-step-title'
        >
          {activeStep.id === 'BASICS' ? (
            <CharacterBasicsStep form={form} payload={payload} readOnly={authoring.readOnly} />
          ) : null}
          {activeStep.id === 'RACE' ? (
            <CharacterRaceStep form={form} payload={payload} readOnly={authoring.readOnly} />
          ) : null}
          {activeStep.id === 'CLASSES' ? (
            <CharacterClassesStep form={form} payload={payload} readOnly={authoring.readOnly} />
          ) : null}
          {activeStep.id === 'BACKGROUND' ? (
            <CharacterBackgroundStep form={form} payload={payload} readOnly={authoring.readOnly} />
          ) : null}
          {activeStep.id === 'DETAILS' ? (
            <CharacterDetailsStep form={form} payload={payload} readOnly={authoring.readOnly} />
          ) : null}
          {activeStep.id === 'NOTES' ? (
            <CharacterNotesStep form={form} payload={payload} readOnly={authoring.readOnly} />
          ) : null}
          {activeStep.id === 'ABILITIES' ? (
            <CharacterAbilitiesStep form={form} payload={payload} readOnly={authoring.readOnly} />
          ) : null}
          {activeStep.id === 'EQUIPMENT' ? (
            <CharacterEquipmentStep form={form} payload={payload} readOnly={authoring.readOnly} />
          ) : null}
          {activeStep.id === 'REVIEW' ? (
            <CharacterReviewStep form={form} payload={payload} readOnly={authoring.readOnly} />
          ) : null}
        </div>
      </div>
    )
  }
})

type CharacterBuilderProgress = {
  firstBlockingStatus?: Exclude<AuthoringStepProgressStatus, 'complete'>
  firstBlockingStepId?: CharacterBuilderStepId
  progressSummary: AuthoringProgressSummary
  stepStatuses: AuthoringStepStatusMap
}

const statusRank: Record<AuthoringStepProgressStatus, number> = {
  complete: 0,
  warning: 1,
  incomplete: 2,
  error: 3
}

function getCharacterBuilderProgress(
  payload: CharacterBuilderPayloadDto,
  values: CharacterFormValues
): CharacterBuilderProgress {
  const stepStatuses: Record<CharacterBuilderStepId, AuthoringStepProgressStatus> = {
    BASICS: isBasicsComplete(values) ? 'complete' : 'incomplete',
    RACE: values.intent.race?.raceId ? 'complete' : 'incomplete',
    CLASSES: values.intent.classes.length > 0 ? 'complete' : 'incomplete',
    BACKGROUND: values.intent.background?.backgroundId ? 'complete' : 'incomplete',
    ABILITIES: areAbilitiesAndHitpointsComplete(payload, values) ? 'complete' : 'incomplete',
    EQUIPMENT: areStartingEquipmentChoicesComplete(payload) ? 'complete' : 'incomplete',
    DETAILS: 'complete',
    NOTES: 'complete',
    REVIEW: payload.view.review.ready ? 'complete' : 'incomplete'
  }

  for (const issue of payload.resolution.outstandingChoices) {
    setStepStatus(stepStatuses, getCharacterBuilderIssueStepId(issue), 'incomplete')
  }

  for (const validation of payload.resolution.validations) {
    setStepStatus(
      stepStatuses,
      getCharacterBuilderValidationStepId(validation),
      validation.severity === 'blocking' ? 'error' : 'warning'
    )
  }

  return summarizeStepStatuses(stepStatuses)
}

function isBasicsComplete(values: CharacterFormValues): boolean {
  return Boolean(values.label.trim() && values.intent.advancement?.method)
}

function areAbilitiesAndHitpointsComplete(
  payload: CharacterBuilderPayloadDto,
  values: CharacterFormValues
): boolean {
  const assignedAbilities = new Set(getAssignedAbilityCodes(values.intent.abilities))
  const hitpointLevels = values.intent.hitpoints.levels ?? []

  return assignedAbilities.size === 6
    && isHitpointProgressionComplete(values.intent.classes, hitpointLevels)
}

function areStartingEquipmentChoicesComplete(payload: CharacterBuilderPayloadDto): boolean {
  return !payload.view.equipment.classStartingEquipmentRequired
    && !payload.view.equipment.backgroundStartingEquipmentRequired
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
): CharacterBuilderProgress {
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
