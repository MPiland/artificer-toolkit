import { useState } from 'react'
import { Alert, Button, Group } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import type {
  EquipmentAuthoredDto,
  EquipmentResponseDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema'
import { EQUIPMENT_CATEGORY_CODE } from '@artificer-toolkit/shared'
import {
  AuthoredFormFooter,
  AuthoredFormHeader,
  AuthoredFormRoot,
  AuthoredFormSectionStack,
  AuthoredFormShell
} from '#components/Form/AuthoredFormLayout'
import { AuthoredFormStepNav } from '#components/Form/AuthoredFormStepNav'
import type { EffectEditorReferenceData } from '#components/EffectEditor'
import {
  clearRuntimeFormPaths,
  getFirstErroredStep,
  getStepStatuses,
  toRuntimeValues,
  useAppForm,
  useNodeRuntimeModel,
  type ClearableRuntimeForm
} from '#components/Form/runtime'
import {
  BasicsStep,
  ChargesStep,
  ContentStep,
  ContentsStep,
  InventoryStep,
  RulesStep,
  equipmentStepFields,
  equipmentSteps
} from './EquipmentFormSteps'
import {
  createEmptyEquipment,
  normalizeEquipmentForSubmit,
  toEquipmentFormValues,
  type EquipmentFormStep,
  type EquipmentFormValues
} from './equipmentAuthoring.utils'

type EquipmentStepForm = Parameters<typeof BasicsStep>[0]['form']

export function EquipmentForm({
  mode,
  initialEquipment,
  response,
  systemId,
  userId,
  references,
  resolveRuntime = true,
  runtimeModel,
  onSubmit,
  onSaveDraft,
  onCopy
}: {
  mode: 'create' | 'view' | 'edit'
  initialEquipment?: EquipmentAuthoredDto | EquipmentFormValues
  response?: EquipmentResponseDto
  systemId: string
  userId: string
  references: EffectEditorReferenceData
  resolveRuntime?: boolean
  runtimeModel?: NodeRuntimeResolveResponseDto
  onSubmit: (equipment: EquipmentAuthoredDto) => Promise<void>
  onSaveDraft?: (equipment: EquipmentAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState<EquipmentFormStep>('basics')
  const readOnly = mode === 'view' || response?.permissions.canEdit === false
  const hasActiveDraft = mode === 'edit' && response != null && initialEquipment != null
  const equipment = toEquipmentFormValues(initialEquipment ?? response?.item ?? createEmptyEquipment({ systemId, userId }))
  const form = useAppForm({
    defaultValues: equipment,
    onSubmit: async ({ value }) => {
      if (readOnly) return
      await onSubmit(normalizeEquipmentForSubmit(value))
    }
  })

  async function handleFormSubmit() {
    await form.handleSubmit()
    const statuses = getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: equipmentStepFields })
    const firstErroredStep = getFirstErroredStep(statuses, getVisibleEquipmentSteps(form.state.values))
    if (firstErroredStep) setActiveStep(firstErroredStep)
  }

  async function handleSaveDraft() {
    if (readOnly || !onSaveDraft) return
    await onSaveDraft(normalizeEquipmentForSubmit(form.state.values))
  }

  async function handleNextStep(currentStep: EquipmentFormStep, values: EquipmentFormValues) {
    await form.validate('submit')
    const statuses = getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: equipmentStepFields })
    if (statuses[currentStep] === 'error') return
    setActiveStep(getNextStep(currentStep, values))
  }

  return (
    <AuthoredFormRoot>
      <form.Subscribe selector={(state) => ({
        stepStatuses: getStepStatuses({ fieldMeta: state.fieldMeta, stepFields: equipmentStepFields }),
        values: state.values
      })}
      >
        {({ stepStatuses, values }) => {
          const visibleSteps = getVisibleEquipmentSteps(values)
          const currentStep = visibleSteps.some((step) => step.id === activeStep)
            ? activeStep
            : visibleSteps[0].id

          return (
            <>
              <AuthoredFormStepNav
                activeStep={currentStep}
                ariaLabel='Equipment form sections'
                onStepChange={setActiveStep}
                stepStatuses={stepStatuses}
                steps={visibleSteps}
              />

              <AuthoredFormHeader
                action={readOnly && response?.permissions.canCopy
                  ? <Button onClick={onCopy}>Duplicate to edit</Button>
                  : null}
                eyebrow={mode !== 'create' ? equipment.label || 'Untitled Equipment' : undefined}
                title={getEquipmentStepTitle(currentStep, values.category)}
              />

              {readOnly
                ? (
                    <Alert color='cyan'>
                      This equipment is locked for direct editing. Duplicate it to make your own draft.
                    </Alert>
                  )
                : null}

              {hasActiveDraft
                ? (
                    <Alert color='blue'>
                      You are editing a draft. The active item stays unchanged until you activate these changes.
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
                  <EquipmentFormBody
                    activeStep={currentStep}
                    form={form}
                    readOnly={readOnly}
                    references={references}
                    resolveRuntime={resolveRuntime}
                    runtimeModelOverride={runtimeModel}
                    values={values}
                  />

                  <AuthoredFormFooter>
                    <Button variant='default' onClick={() => navigate({ to: '/equipment' })}>
                      Cancel
                    </Button>
                    <Group justify='flex-end'>
                      <Button
                        type='button'
                        variant='default'
                        disabled={currentStep === visibleSteps[0].id}
                        onClick={() => setActiveStep(getPreviousStep(currentStep, values))}
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
                                    <form.SubmitButton label='Activate Equipment' />
                                  </>
                                )
                          )
                        : (
                            <Button type='button' onClick={() => void handleNextStep(currentStep, values)}>
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

function EquipmentFormBody({
  form,
  values,
  activeStep,
  readOnly,
  references,
  resolveRuntime,
  runtimeModelOverride
}: {
  form: EquipmentStepForm & ClearableRuntimeForm<EquipmentFormValues>
  values: EquipmentFormValues
  activeStep: EquipmentFormStep
  readOnly: boolean
  references: EffectEditorReferenceData
  resolveRuntime: boolean
  runtimeModelOverride?: NodeRuntimeResolveResponseDto
}) {
  const runtimeModel = useNodeRuntimeModel({
    mapId: 'equipment',
    values: toRuntimeValues(values),
    systemId: values.systemId,
    enabled: resolveRuntime && !runtimeModelOverride,
    debounceMs: 150,
    onClearPaths: (paths) => clearRuntimeFormPaths(form, paths)
  })
  const resolvedRuntimeModel = runtimeModelOverride ?? runtimeModel

  return (
    <AuthoredFormSectionStack>
      {activeStep === 'basics' ? <BasicsStep form={form} readOnly={readOnly} runtimeModel={resolvedRuntimeModel} /> : null}
      {activeStep === 'inventory' ? <InventoryStep form={form} readOnly={readOnly} runtimeModel={resolvedRuntimeModel} /> : null}
      {activeStep === 'rules' ? <RulesStep form={form} readOnly={readOnly} resolveRuntime={resolveRuntime} runtimeModel={resolvedRuntimeModel} /> : null}
      {activeStep === 'content' ? <ContentStep form={form} readOnly={readOnly} references={references} resolveRuntime={resolveRuntime} /> : null}
      {activeStep === 'charges' ? <ChargesStep form={form} readOnly={readOnly} resolveRuntime={resolveRuntime} runtimeModel={resolvedRuntimeModel} /> : null}
      {activeStep === 'contents' ? <ContentsStep form={form} readOnly={readOnly} runtimeModel={resolvedRuntimeModel} /> : null}
    </AuthoredFormSectionStack>
  )
}

function getVisibleEquipmentSteps(values: EquipmentFormValues) {
  if (values.category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
    return equipmentSteps.filter((step) => step.id !== 'inventory' && step.id !== 'contents')
  }

  return equipmentSteps
}

function getEquipmentStepTitle(step: EquipmentFormStep, category: EquipmentFormValues['category']) {
  const prefix = category === EQUIPMENT_CATEGORY_CODE.VARIANT ? 'Variant Equipment' : 'Base Equipment'
  if (step === 'basics') return `${prefix} Basics`
  if (step === 'inventory') return `${prefix} Inventory`
  if (step === 'rules') return `${prefix} Rules`
  if (step === 'content') return `${prefix} Content`
  if (step === 'charges') return `${prefix} Charges`
  return `${prefix} Contents`
}

function getNextStep(step: EquipmentFormStep, values: EquipmentFormValues): EquipmentFormStep {
  return getRelativeStep(step, values, 1)
}

function getPreviousStep(step: EquipmentFormStep, values: EquipmentFormValues): EquipmentFormStep {
  return getRelativeStep(step, values, -1)
}

function getRelativeStep(
  step: EquipmentFormStep,
  values: EquipmentFormValues,
  offset: 1 | -1
): EquipmentFormStep {
  const steps = getVisibleEquipmentSteps(values)
  const currentIndex = Math.max(0, steps.findIndex((current) => current.id === step))
  const nextIndex = Math.min(Math.max(currentIndex + offset, 0), steps.length - 1)

  return steps[nextIndex].id
}
