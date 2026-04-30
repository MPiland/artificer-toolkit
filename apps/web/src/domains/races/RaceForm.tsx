import { useState } from 'react'
import { Alert, Button, Group } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import type {
  NodeRuntimeResolveResponseDto,
  RaceAuthoredDto,
  RaceResponseDto
} from '@artificer-toolkit/schema'
import { RACE_CATEGORY_CODE } from '@artificer-toolkit/shared'
import {
  AuthoredFormFooter,
  AuthoredFormHeader,
  AuthoredFormRoot,
  AuthoredFormSectionStack,
  AuthoredFormShell
} from '#components/Form/AuthoredFormLayout'
import { AuthoredFormStepNav } from '#components/Form/AuthoredFormStepNav'
import {
  clearRuntimeFormPaths,
  getFirstErroredStep,
  getStepStatuses,
  toRuntimeValues,
  useAppForm,
  useNodeRuntimeModel,
  type ClearableRuntimeForm,
} from '#components/Form/runtime'
import {
  AncestryStep,
  BasicsStep,
  ContentStep,
  DetailsStep,
  FeaturesStep,
  raceStepFields,
  raceSteps
} from './RaceFormSteps'
import {
  createEmptyRace,
  normalizeRaceForSubmit,
  toRaceFormValues,
  type RaceFormStep,
  type RaceFormValues
} from './raceAuthoring.utils'

type RaceStepForm = Parameters<typeof BasicsStep>[0]['form']

export function RaceForm({
  mode,
  initialRace,
  response,
  systemId,
  userId,
  resolveRuntime = true,
  runtimeModel,
  onSubmit,
  onSaveDraft,
  onCopy
}: {
  mode: 'create' | 'view' | 'edit'
  initialRace?: RaceAuthoredDto | RaceFormValues
  response?: RaceResponseDto
  systemId: string
  userId: string
  resolveRuntime?: boolean
  runtimeModel?: NodeRuntimeResolveResponseDto
  onSubmit: (race: RaceAuthoredDto) => Promise<void>
  onSaveDraft?: (race: RaceAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState<RaceFormStep>('basics')
  const readOnly = mode === 'view' || response?.permissions.canEdit === false
  const hasActiveDraft = mode === 'edit' && response != null && initialRace != null
  const race = toRaceFormValues(initialRace ?? response?.item ?? createEmptyRace({ systemId, userId }))
  const form = useAppForm({
    defaultValues: race,
    onSubmit: async ({ value }) => {
      if (readOnly) return
      await onSubmit(normalizeRaceForSubmit(value))
    }
  })

  async function handleFormSubmit() {
    await form.handleSubmit()
    const statuses = getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: raceStepFields })
    const firstErroredStep = getFirstErroredStep(statuses, getVisibleRaceSteps(form.state.values.category))
    if (firstErroredStep) setActiveStep(firstErroredStep)
  }

  async function handleSaveDraft() {
    if (readOnly || !onSaveDraft) return
    await onSaveDraft(normalizeRaceForSubmit(form.state.values))
  }

  async function handleNextStep(currentStep: RaceFormStep, category: RaceFormValues['category']) {
    await form.validate('submit')
    const statuses = getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: raceStepFields })
    if (statuses[currentStep] === 'error') return
    setActiveStep(getNextStep(currentStep, category))
  }

  return (
    <AuthoredFormRoot>
      <form.Subscribe selector={(state) => ({
        stepStatuses: getStepStatuses({ fieldMeta: state.fieldMeta, stepFields: raceStepFields }),
        values: state.values
      })}
      >
        {({ stepStatuses, values }) => {
          const visibleSteps = getVisibleRaceSteps(values.category)
          const currentStep = visibleSteps.some((step) => step.id === activeStep)
            ? activeStep
            : visibleSteps[0].id

          return (
            <>
              <AuthoredFormStepNav
                activeStep={currentStep}
                ariaLabel='Race form sections'
                onStepChange={setActiveStep}
                stepStatuses={stepStatuses}
                steps={visibleSteps}
              />

              <AuthoredFormHeader
                action={readOnly && response?.permissions.canCopy
                  ? (
                      <Button onClick={onCopy}>Duplicate to edit</Button>
                    )
                  : null}
                eyebrow={mode !== 'create' ? race.label || 'Untitled Race' : undefined}
                title={getRaceStepTitle(currentStep, values.category)}
              />

              {readOnly
                ? (
                    <Alert color='cyan'>
                      This race is locked for direct editing. Duplicate it to make your own draft.
                    </Alert>
                  )
                : null}

              {hasActiveDraft
                ? (
                    <Alert color='blue'>
                      You are editing a draft. The active race stays unchanged until you activate these changes.
                    </Alert>
                  )
                : null}

              <form.AppForm>
                <AuthoredFormShell
                  onSubmit={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void handleFormSubmit()
                  }}
                >
                  <RaceFormBody
                    activeStep={currentStep}
                    form={form}
                    readOnly={readOnly}
                    resolveRuntime={resolveRuntime}
                    runtimeModelOverride={runtimeModel}
                    values={values}
                  />

                  <AuthoredFormFooter>
                    <Button variant='default' onClick={() => navigate({ to: '/races' })}>
                      Cancel
                    </Button>
                    <Group justify='flex-end'>
                      <Button
                        type='button'
                        variant='default'
                        disabled={currentStep === visibleSteps[0].id}
                        onClick={() => setActiveStep(getPreviousStep(currentStep, values.category))}
                      >
                        Back
                      </Button>
                      {currentStep === visibleSteps[visibleSteps.length - 1].id
                        ? (
                            readOnly
                              ? null
                              : (
                                  <>
                                    {onSaveDraft
                                      ? (
                                          <Button type='button' variant='default' onClick={() => void handleSaveDraft()}>
                                            Save Draft
                                          </Button>
                                        )
                                      : null}
                                    <form.SubmitButton label='Activate Race' />
                                  </>
                                )
                          )
                        : (
                            <Button type='button' onClick={() => void handleNextStep(currentStep, values.category)}>
                              Next
                            </Button>
                          )}
                    </Group>
                  </AuthoredFormFooter>
                </AuthoredFormShell>
              </form.AppForm>
            </>
          )
        }}
      </form.Subscribe>
    </AuthoredFormRoot>
  )
}

function RaceFormBody({
  form,
  values,
  activeStep,
  readOnly,
  resolveRuntime,
  runtimeModelOverride
}: {
  form: RaceStepForm & ClearableRuntimeForm<RaceFormValues>
  values: RaceFormValues
  activeStep: RaceFormStep
  readOnly: boolean
  resolveRuntime: boolean
  runtimeModelOverride?: NodeRuntimeResolveResponseDto
}) {
  const runtimeModel = useNodeRuntimeModel({
    mapId: 'race',
    values: toRuntimeValues(values),
    systemId: values.systemId,
    enabled: resolveRuntime && !runtimeModelOverride,
    debounceMs: 150,
    onClearPaths: (paths) => clearRuntimeFormPaths(form, paths)
  })
  const resolvedRuntimeModel = runtimeModelOverride ?? runtimeModel

  return (
    <AuthoredFormSectionStack>
      {activeStep === 'basics'
        ? <BasicsStep form={form} readOnly={readOnly} runtimeModel={resolvedRuntimeModel} />
        : null}
      {activeStep === 'content'
        ? (
            <ContentStep
              form={form}
              readOnly={readOnly}
              resolveRuntime={resolveRuntime}
              runtimeModel={resolvedRuntimeModel}
            />
          )
        : null}
      {activeStep === 'ancestry' ? <AncestryStep form={form} readOnly={readOnly} /> : null}
      {activeStep === 'details' ? <DetailsStep form={form} readOnly={readOnly} /> : null}
      {activeStep === 'features' ? <FeaturesStep form={form} readOnly={readOnly} /> : null}
    </AuthoredFormSectionStack>
  )
}

function getVisibleRaceSteps(category: RaceFormValues['category']) {
  if (category === RACE_CATEGORY_CODE.SUBRACE) {
    return raceSteps.filter((step) => step.id !== 'ancestry')
  }

  return raceSteps
}

function getRaceStepTitle(step: RaceFormStep, category: RaceFormValues['category']) {
  const prefix = category === RACE_CATEGORY_CODE.SUBRACE ? 'Subrace' : 'Base Race'
  if (step === 'basics') return `${prefix} Basics`
  if (step === 'content') return `${prefix} Content`
  if (step === 'ancestry') return `${prefix} Ancestry`
  if (step === 'details') return `${prefix} Details`
  return `${prefix} Features`
}

function getNextStep(step: RaceFormStep, category: RaceFormValues['category']): RaceFormStep {
  return getRelativeStep(step, category, 1)
}

function getPreviousStep(step: RaceFormStep, category: RaceFormValues['category']): RaceFormStep {
  return getRelativeStep(step, category, -1)
}

function getRelativeStep(
  step: RaceFormStep,
  category: RaceFormValues['category'],
  offset: 1 | -1
): RaceFormStep {
  const steps = getVisibleRaceSteps(category)
  const currentIndex = Math.max(0, steps.findIndex((current) => current.id === step))
  const nextIndex = Math.min(Math.max(currentIndex + offset, 0), steps.length - 1)

  return steps[nextIndex].id
}
