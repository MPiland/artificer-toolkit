import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Text } from '@mantine/core'
import { useSelector } from '@tanstack/react-form'
import { withForm } from '#forms/app-form/AppForm'
import { useAuthoringForm } from '#forms/layout/AuthoringFormContext'
import { EMPTY_CHARACTER_FORM_VALUES, toCharacterFormValues } from '../shared/formNormalization'
import {
  getCharacterBuilderDeferredResolutionFingerprint,
  getCharacterBuilderImmediateResolutionFingerprint
} from '../state/resolutionFingerprints'
import type { CharacterBuilderRendererProps } from './CharacterBuilderRenderer.types'
import {
  getCharacterBuilderProgressState,
  getCharacterBuilderStep
} from '../state/characterBuilderAuthoringState'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  CHARACTER_BUILDER_TIMING_MEASURE,
  completeCharacterBuilderTiming,
  markCharacterBuilderTiming,
  startCharacterBuilderTiming
} from './characterBuilder.performance'
import * as styles from '../shared/builderShared.css'
import { CharacterBasicsStep } from '../steps/basics/CharacterBasicsStep'
import { CharacterRaceStep } from '../steps/race/CharacterRaceStep'
import { CharacterClassesStep } from '../steps/classes/CharacterClassesStep'
import { CharacterBackgroundStep } from '../steps/background/CharacterBackgroundStep'
import { CharacterDetailsStep } from '../steps/details/CharacterDetailsStep'
import { CharacterNotesStep } from '../steps/notes/CharacterNotesStep'
import { CharacterAbilitiesStep } from '../steps/abilities/CharacterAbilitiesStep'
import { CharacterEquipmentStep } from '../steps/equipment/CharacterEquipmentStep'
import { CharacterReviewStep } from '../steps/review/CharacterReviewStep'

export const CharacterBuilderRenderer = withForm({
  defaultValues: EMPTY_CHARACTER_FORM_VALUES,
  props: {} as CharacterBuilderRendererProps,
  render: function RenderCharacterBuilder({ form, onResolve, payload, resolveDebounceMs = 150 }) {
    const authoring = useAuthoringForm()
    const { updateAuthoringFormState } = authoring
    const values = useSelector(form.store, (state) => state.values)
    const immediateResolutionFingerprint = useSelector(form.store, (state) =>
      getCharacterBuilderImmediateResolutionFingerprint(state.values)
    )
    const deferredResolutionFingerprint = useSelector(form.store, (state) =>
      getCharacterBuilderDeferredResolutionFingerprint(state.values)
    )
    const activeStep = getCharacterBuilderStep(
      authoring.activeStepId ?? payload.resolution.recommendedSectionId
    )
    const payloadFormValues = useMemo(() => toCharacterFormValues(payload), [payload])
    const resolutionPending =
      immediateResolutionFingerprint !==
        getCharacterBuilderImmediateResolutionFingerprint(payloadFormValues) ||
      deferredResolutionFingerprint !==
        getCharacterBuilderDeferredResolutionFingerprint(payloadFormValues)
    const [isResolving, setIsResolving] = useState(false)
    const progressState = useMemo(
      () => getCharacterBuilderProgressState(payload, isResolving ? payloadFormValues : values),
      [isResolving, payload, payloadFormValues, values]
    )
    const latestValuesRef = useRef(values)
    useEffect(() => {
      latestValuesRef.current = values
    }, [values])
    const previousImmediateFingerprintRef = useRef(immediateResolutionFingerprint)
    const resolveRequestIdRef = useRef(0)
    const hasMarkedBuilderShellReadyRef = useRef(false)
    const hasCommittedInitialPanelRef = useRef(false)

    const markBuilderShellReady = useCallback((node: HTMLDivElement | null) => {
      if (!node || hasMarkedBuilderShellReadyRef.current) return

      markCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.BUILDER_SHELL_READY)
      hasMarkedBuilderShellReadyRef.current = true
    }, [])

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
      const timeoutId = window.setTimeout(
        () => {
          void Promise.resolve(onResolve(latestValuesRef.current)).finally(() => {
            if (resolveRequestIdRef.current === requestId) setIsResolving(false)
          })
        },
        resolvesImmediately ? 0 : resolveDebounceMs
      )

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

    useEffect(() => {
      if (!hasCommittedInitialPanelRef.current) {
        markCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.FIRST_ACTIVE_PANEL_COMMITTED)
        hasCommittedInitialPanelRef.current = true
        return
      }

      completeCharacterBuilderTiming({
        endMark: CHARACTER_BUILDER_TIMING_MARK.STEP_PANEL_COMMITTED,
        measure: CHARACTER_BUILDER_TIMING_MEASURE.STEP_NAVIGATION,
        startMark: CHARACTER_BUILDER_TIMING_MARK.STEP_NAVIGATION_INTENT
      })
    }, [activeStep.id])

    // Submit, finalize and saving flags have one writer, CharacterBuilderStateSync.
    useEffect(() => {
      updateAuthoringFormState(progressState)
    }, [progressState, updateAuthoringFormState])

    return (
      <div ref={markBuilderShellReady} className={styles.builderRoot}>
        <div className={styles.builderHeader}>
          <div>
            <h2 id='character-builder-active-step-title' className={styles.title}>
              {activeStep.label}
            </h2>
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
