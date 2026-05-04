import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Text } from '@mantine/core'
import { useStore } from '@tanstack/react-form'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import {
  AuthoringFormStepNav,
  useAuthoringForm,
  useAuthoringFormRegistration,
  withForm
} from '#forms'
import {
  characterBuilderSteps,
  createFallbackCharacterFormValues,
  type CharacterBuilderStepId,
  type CharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import { CharacterBasicsStep } from '../steps/CharacterBasicsStep'
import { CharacterRaceStep } from '../steps/CharacterRaceStep'
import { CharacterClassesStep } from '../steps/CharacterClassesStep'
import { CharacterBackgroundStep } from '../steps/CharacterBackgroundStep'
import { CharacterDetailsStep } from '../steps/CharacterDetailsStep'
import { CharacterNotesStep } from '../steps/CharacterNotesStep'
import { CharacterAbilitiesStep } from '../steps/CharacterAbilitiesStep'
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
  render: function RenderCharacterBuilder({
    form,
    onResolve,
    payload,
    resolveDebounceMs = 450
  }) {
    const authoring = useAuthoringForm()
    const values = useStore(form.store, (state) => state.values)
    const submitState = useStore(form.store, (state) => ({
      canSubmit: state.canSubmit,
      isSubmitting: state.isSubmitting
    }))
    const [activeStepId, setActiveStepId] = useState<CharacterBuilderStepId>(
      payload.resolution.recommendedSectionId
    )
    const activeStep = characterBuilderSteps.find((step) => step.id === activeStepId) ?? characterBuilderSteps[0]
    const activeIndex = characterBuilderSteps.findIndex((step) => step.id === activeStep.id)
    const isLastStep = activeIndex === characterBuilderSteps.length - 1

    useEffect(() => {
      if (authoring.readOnly) return

      const timeoutId = window.setTimeout(() => {
        void onResolve(values)
      }, resolveDebounceMs)

      return () => window.clearTimeout(timeoutId)
    }, [
      authoring.readOnly,
      onResolve,
      resolveDebounceMs,
      values
    ])

    const goToNextStep = useCallback(() => {
      setActiveStepId(characterBuilderSteps[Math.min(activeIndex + 1, characterBuilderSteps.length - 1)].id)
    }, [activeIndex])

    const goToPreviousStep = useCallback(() => {
      setActiveStepId(characterBuilderSteps[Math.max(activeIndex - 1, 0)].id)
    }, [activeIndex])

    const registration = useMemo(() => ({
      activeStepId: activeStep.id,
      activeStepLabel: activeStep.label,
      canGoBack: activeIndex > 0,
      canGoNext: !isLastStep,
      canSubmit: submitState.canSubmit && payload.view.review.ready,
      isLastStep,
      isSubmitting: submitState.isSubmitting
    }), [
      activeIndex,
      activeStep.id,
      activeStep.label,
      isLastStep,
      payload.view.review.ready,
      submitState.canSubmit,
      submitState.isSubmitting
    ])

    const actions = useMemo(() => ({
      onNextStep: goToNextStep,
      onPreviousStep: goToPreviousStep
    }), [
      goToNextStep,
      goToPreviousStep
    ])

    useAuthoringFormRegistration(registration, actions)

    return (
      <div className={styles.builderRoot}>
        <div className={styles.builderHeader}>
          <div>
            <Text className={styles.eyebrow}>{activeStep.description}</Text>
            <h2 className={styles.title}>{activeStep.label}</h2>
          </div>
        </div>
        <AuthoringFormStepNav
          activeStep={activeStep.id}
          onStepChange={(stepId) => setActiveStepId(stepId as CharacterBuilderStepId)}
          steps={characterBuilderSteps}
        />
        {payload.resolution.validations.length
          ? (
              <Alert color='yellow'>
                {payload.resolution.validations.map((validation) => validation.message).join(' ')}
              </Alert>
            )
          : null}
        {activeStep.id === 'BASICS'
          ? <CharacterBasicsStep form={form} payload={payload} readOnly={authoring.readOnly} />
          : null}
        {activeStep.id === 'RACE'
          ? <CharacterRaceStep form={form} payload={payload} readOnly={authoring.readOnly} />
          : null}
        {activeStep.id === 'CLASSES'
          ? <CharacterClassesStep form={form} payload={payload} readOnly={authoring.readOnly} />
          : null}
        {activeStep.id === 'BACKGROUND'
          ? <CharacterBackgroundStep form={form} payload={payload} readOnly={authoring.readOnly} />
          : null}
        {activeStep.id === 'DETAILS'
          ? <CharacterDetailsStep form={form} payload={payload} readOnly={authoring.readOnly} />
          : null}
        {activeStep.id === 'NOTES'
          ? <CharacterNotesStep form={form} payload={payload} readOnly={authoring.readOnly} />
          : null}
        {activeStep.id === 'ABILITIES'
          ? <CharacterAbilitiesStep form={form} payload={payload} readOnly={authoring.readOnly} />
          : null}
        {activeStep.id === 'EQUIPMENT'
          ? <CharacterEquipmentStep form={form} payload={payload} readOnly={authoring.readOnly} />
          : null}
        {activeStep.id === 'REVIEW'
          ? <CharacterReviewStep form={form} payload={payload} readOnly={authoring.readOnly} />
          : null}
      </div>
    )
  }
})
