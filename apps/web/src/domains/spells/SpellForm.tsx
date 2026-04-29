import { useState, type ReactNode } from 'react'
import { Alert, Button, Group } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import type { NodeRuntimePathDto, NodeRuntimeResolveResponseDto, SpellAuthoredDto, SpellResponseDto } from '@artificer-toolkit/schema'
import {
  AuthoredFormFooter,
  AuthoredFormHeader,
  AuthoredFormRoot,
  AuthoredFormSection,
  AuthoredFormSectionStack,
  AuthoredFormShell
} from '#components/Form/AuthoredFormLayout'
import { AuthoredFormStepNav } from '#components/Form/AuthoredFormStepNav'
import {
  clearRuntimeFormPaths,
  getFirstErroredStep,
  getRuntimeNodeOptions,
  getRuntimeNodeRequired,
  getRuntimeNodeVisible,
  getStepStatuses,
  integerMinimum,
  requiredArray,
  requiredSelect,
  requiredString,
  toRuntimeValues,
  useAppForm,
  useNodeRuntimeModel,
  validatorsFor,
  withForm
} from '#components/Form/runtime'
import { EffectEditorFieldGroup } from '#components/EffectEditor'
import type { SpellReferenceData } from '#app/data/spells/referenceData'
import {
  castingTimeUnitOptions,
  createEmptySpell,
  getSelectData,
  hasMaterialComponent,
  normalizeSpellForSubmit,
  spellAttributeOptions,
  spellComponentOptions
} from './spellAuthoring.utils'
import {
  fieldGrid,
  inputRow,
  wide
} from './spellAuthoring.css'

type SpellFormStep = 'info' | 'effects'

const spellSteps = [
  {
    id: 'info',
    label: 'Spell Info',
    description: 'Name, level, casting, and components'
  },
  {
    id: 'effects',
    label: 'Effects',
    description: 'What happens when the spell is used'
  }
] as const satisfies readonly {
  id: SpellFormStep
  label: string
  description: string
}[]

const emptySpellReferenceData: SpellReferenceData = {
  systemId: '',
  magicSchools: [],
  classes: [],
  damageTypes: [],
  conditionTypes: [],
  skills: [],
  speeds: [],
  creatures: []
}

const emptySpellRuntimeModel: NodeRuntimeResolveResponseDto = {
  mapId: 'spell',
  sections: [],
  clearPaths: []
}

const spellFormDefaults = createEmptySpell({ systemId: '', userId: '' })

const spellStepFields = {
  info: [
    'label',
    'level',
    'classIds',
    'magicSchoolId',
    'castingTime',
    'description',
    'components',
    'materialDescription',
    'attributes'
  ],
  effects: ['effects']
} satisfies Record<SpellFormStep, readonly string[]>

const SpellInfoStep = withForm({
  defaultValues: spellFormDefaults,
  props: {
    readOnly: false,
    references: emptySpellReferenceData,
    runtimeModel: emptySpellRuntimeModel
  },
  render: function SpellInfoStepRender({ form, readOnly, references, runtimeModel }) {
    const classOptions = getRuntimeNodeOptions(runtimeModel, 'classIds', getSelectData(references.classes))
    const magicSchoolOptions = getRuntimeNodeOptions(runtimeModel, 'magicSchoolId', getSelectData(references.magicSchools))
    const componentOptions = getRuntimeNodeOptions(runtimeModel, 'components', spellComponentOptions)
    const attributeOptions = getRuntimeNodeOptions(runtimeModel, 'attributes', spellAttributeOptions)

    return (
      <form.Subscribe selector={(state) => ({
        components: state.values.components,
        materialDescription: state.values.materialDescription
      })}
      >
        {({ components, materialDescription }) => {
          const showMaterialDescription = getRuntimeNodeVisible(runtimeModel, 'materialDescription', hasMaterialComponent({ components, materialDescription }))

          return (
            <>
              <AuthoredFormSection title='Basics' titleId='spell-basics-heading'>
                <div className={fieldGrid}>
                  <form.AppField
                    name='label'
                    validators={validatorsFor(requiredString('Spell name'))}
                  >
                    {(field) => (
                      <field.TextField
                        label='Spell Name'
                        readOnly={readOnly}
                        required={getRuntimeNodeRequired(runtimeModel, 'label')}
                      />
                    )}
                  </form.AppField>
                  <form.AppField
                    name='level'
                    validators={validatorsFor(integerMinimum('Level', 0))}
                  >
                    {(field) => (
                      <field.NumberField
                        label='Level'
                        readOnly={readOnly}
                        required={getRuntimeNodeRequired(runtimeModel, 'level')}
                      />
                    )}
                  </form.AppField>
                  <form.AppField
                    name='classIds'
                    validators={validatorsFor(requiredArray('Classes'))}
                  >
                    {(field) => (
                      <field.MultiSelectField
                        label='Classes'
                        readOnly={readOnly}
                        data={classOptions}
                        required={getRuntimeNodeRequired(runtimeModel, 'classIds')}
                      />
                    )}
                  </form.AppField>
                </div>
              </AuthoredFormSection>

              <AuthoredFormSection title='Details' titleId='spell-details-heading'>
                <div className={fieldGrid}>
                  <form.AppField
                    name='magicSchoolId'
                    validators={validatorsFor(requiredSelect('Magic school'))}
                  >
                    {(field) => (
                      <field.SelectField
                        label='Magic School'
                        readOnly={readOnly}
                        data={magicSchoolOptions}
                        required={getRuntimeNodeRequired(runtimeModel, 'magicSchoolId')}
                      />
                    )}
                  </form.AppField>
                  <form.AppField
                    name='castingTime.amount'
                    validators={validatorsFor(integerMinimum('Casting time', 1))}
                  >
                    {(field) => <field.NumberField label='Casting Time' readOnly={readOnly} />}
                  </form.AppField>
                  <form.AppField name='castingTime.unit'>
                    {(field) => (
                      <field.SelectField
                        label='Unit'
                        readOnly={readOnly}
                        data={castingTimeUnitOptions}
                      />
                    )}
                  </form.AppField>
                  <div className={wide}>
                    <form.AppField
                      name='description'
                      validators={validatorsFor(requiredString('Description'))}
                    >
                      {(field) => (
                        <field.TextareaField
                          label='Description'
                          readOnly={readOnly}
                          required={getRuntimeNodeRequired(runtimeModel, 'description')}
                        />
                      )}
                    </form.AppField>
                  </div>
                </div>
              </AuthoredFormSection>

              <AuthoredFormSection title='Components & Attributes' titleId='spell-components-heading'>
                <div className={inputRow}>
                  <form.AppField
                    name='components'
                    validators={validatorsFor(requiredArray('Components'))}
                  >
                    {(field) => (
                      <field.MultiSelectField
                        label='Components'
                        readOnly={readOnly}
                        data={componentOptions}
                        required={getRuntimeNodeRequired(runtimeModel, 'components')}
                      />
                    )}
                  </form.AppField>
                </div>
                {showMaterialDescription
                  ? (
                      <form.AppField
                        name='materialDescription'
                        validators={validatorsFor(requiredString('Material description'))}
                      >
                        {(field) => (
                          <field.TextField
                            label='Material Description'
                            readOnly={readOnly}
                            required={getRuntimeNodeRequired(runtimeModel, 'materialDescription')}
                          />
                        )}
                      </form.AppField>
                    )
                  : null}
                <div className={inputRow}>
                  <form.AppField name='attributes'>
                    {(field) => (
                      <field.MultiSelectField
                        label='Attributes'
                        readOnly={readOnly}
                        data={attributeOptions}
                        required={getRuntimeNodeRequired(runtimeModel, 'attributes')}
                      />
                    )}
                  </form.AppField>
                </div>
              </AuthoredFormSection>
            </>
          )
        }}
      </form.Subscribe>
    )
  }
})

export function SpellForm({
  mode,
  initialSpell,
  response,
  references,
  userId,
  resolveRuntime = true,
  onSubmit,
  onSaveDraft,
  onCopy
}: {
  mode: 'create' | 'view' | 'edit'
  initialSpell?: SpellAuthoredDto
  response?: SpellResponseDto
  references: SpellReferenceData
  userId: string
  resolveRuntime?: boolean
  onSubmit: (spell: SpellAuthoredDto) => Promise<void>
  onSaveDraft?: (spell: SpellAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState<SpellFormStep>('info')
  const readOnly = mode === 'view' || response?.permissions.canEdit === false
  const hasActiveDraft = mode === 'edit' && response != null && initialSpell != null
  const spell = initialSpell ?? response?.item ?? createEmptySpell({ systemId: references.systemId, userId })
  const form = useAppForm({
    defaultValues: spell,
    onSubmit: async ({ value }) => {
      if (readOnly) return
      await onSubmit(normalizeSpellForSubmit(value, references))
    }
  })
  const pageTitle = getSpellStepTitle(activeStep)

  async function handleFormSubmit() {
    await form.handleSubmit()
    const firstErroredStep = getFirstErroredStep(getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: spellStepFields }), spellSteps)
    if (firstErroredStep) setActiveStep(firstErroredStep)
  }

  async function handleSaveDraft() {
    if (readOnly || !onSaveDraft) return
    await onSaveDraft(normalizeSpellForSubmit(form.state.values, references))
  }

  async function handleNextStep() {
    await form.validate('submit')
    const statuses = getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: spellStepFields })
    if (statuses.info === 'error') return
    setActiveStep('effects')
  }

  return (
    <AuthoredFormRoot>
      <form.Subscribe selector={(state) => getStepStatuses({ fieldMeta: state.fieldMeta, stepFields: spellStepFields })}>
        {(stepStatuses) => (
          <AuthoredFormStepNav
            activeStep={activeStep}
            ariaLabel='Spell form sections'
            onStepChange={setActiveStep}
            stepStatuses={stepStatuses}
            steps={spellSteps}
          />
        )}
      </form.Subscribe>

      <AuthoredFormHeader
        action={readOnly && response?.permissions.canCopy
          ? (
              <Button onClick={onCopy}>Duplicate to edit</Button>
            )
          : null}
        eyebrow={mode !== 'create' ? spell.label || 'Untitled Spell' : undefined}
        title={pageTitle}
      />

      {readOnly
        ? (
            <Alert color='cyan'>
              This spell is locked for direct editing. Duplicate it to make your own draft.
            </Alert>
          )
        : null}

      {hasActiveDraft
        ? (
            <Alert color='blue'>
              You are editing a draft. The active spell stays unchanged until you activate these changes.
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
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <SpellRuntimeBridge
                enabled={resolveRuntime}
                references={references}
                values={values}
                onClearPaths={(paths) => {
                  clearRuntimeFormPaths(form, paths)
                }}
              >
                {(runtimeModel) => (
                  <AuthoredFormSectionStack>
                    {activeStep === 'info'
                      ? (
                          <SpellInfoStep
                            form={form}
                            readOnly={readOnly}
                            references={references}
                            runtimeModel={runtimeModel ?? emptySpellRuntimeModel}
                          />
                        )
                      : (
                          <form.Subscribe selector={(state) => state.values.label}>
                            {(label) => (
                              <EffectEditorFieldGroup
                                form={form}
                                fields={{ effects: 'effects' }}
                                references={references}
                                readOnly={readOnly}
                                sourceLabel={label || 'Spell'}
                              />
                            )}
                          </form.Subscribe>
                        )}
                  </AuthoredFormSectionStack>
                )}
              </SpellRuntimeBridge>
            )}
          </form.Subscribe>

          <AuthoredFormFooter>
            <Button variant='default' onClick={() => navigate({ to: '/spells' })}>
              Cancel
            </Button>
            <Group justify='flex-end'>
              <Button
                type='button'
                variant='default'
                disabled={activeStep === 'info'}
                onClick={() => setActiveStep('info')}
              >
                Back
              </Button>
              {activeStep === 'effects'
                ? (
                    <>
                      {!readOnly && onSaveDraft
                        ? (
                            <Button type='button' variant='default' onClick={() => void handleSaveDraft()}>
                              Save Draft
                            </Button>
                          )
                        : null}
                      <form.SubmitButton label='Activate Spell' disabled={readOnly} />
                    </>
                  )
                : (
                    <Button
                      type='button'
                      onClick={() => void handleNextStep()}
                    >
                      Next
                    </Button>
                  )}
            </Group>
          </AuthoredFormFooter>
        </AuthoredFormShell>
      </form.AppForm>
    </AuthoredFormRoot>
  )
}

function SpellRuntimeBridge({
  children,
  enabled,
  references,
  values,
  onClearPaths
}: {
  children: (runtimeModel: NodeRuntimeResolveResponseDto | undefined) => ReactNode
  enabled: boolean
  references: SpellReferenceData
  values: SpellAuthoredDto
  onClearPaths: (paths: readonly NodeRuntimePathDto[]) => void
}) {
  const runtimeModel = useNodeRuntimeModel({
    mapId: 'spell',
    values: toRuntimeValues(values),
    systemId: values.systemId || references.systemId,
    enabled,
    debounceMs: 50,
    onClearPaths
  })

  return <>{children(runtimeModel)}</>
}

function getSpellStepTitle(step: SpellFormStep) {
  if (step === 'effects') return 'Effects'
  return 'Spell Info'
}
