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
  getRuntimeNodeOptions,
  getRuntimeNodeRequired,
  getRuntimeNodeVisible,
  toRuntimeValues,
  useAppForm,
  useNodeRuntimeModel,
  type ClearableRuntimeForm
} from '#components/Form/runtime'
import { EffectEditor, type EffectEditorFormApi } from '#components/EffectEditor'
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

export function SpellForm({
  mode,
  initialSpell,
  response,
  references,
  userId,
  resolveRuntime = true,
  onSubmit,
  onCopy
}: {
  mode: 'create' | 'view' | 'edit'
  initialSpell?: SpellAuthoredDto
  response?: SpellResponseDto
  references: SpellReferenceData
  userId: string
  resolveRuntime?: boolean
  onSubmit: (spell: SpellAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState<SpellFormStep>('info')
  const readOnly = mode === 'view' || response?.permissions.canEdit === false
  const spell = initialSpell ?? response?.item ?? createEmptySpell({ systemId: references.systemId, userId })
  const form = useAppForm({
    defaultValues: spell,
    onSubmit: async ({ value }) => {
      if (readOnly) return
      await onSubmit(normalizeSpellForSubmit(value as SpellAuthoredDto, references))
    }
  })
  const effectEditorForm: EffectEditorFormApi = {
    setFieldValue: (_field, value) => form.setFieldValue('effects', value)
  }
  const pageTitle = getSpellStepTitle(activeStep)

  function renderSpellInfoStep(
    runtimeModel: NodeRuntimeResolveResponseDto | undefined,
    values: SpellAuthoredDto
  ) {
    const classOptions = getRuntimeNodeOptions(runtimeModel, 'classIds', getSelectData(references.classes))
    const magicSchoolOptions = getRuntimeNodeOptions(runtimeModel, 'magicSchoolId', getSelectData(references.magicSchools))
    const componentOptions = getRuntimeNodeOptions(runtimeModel, 'components', spellComponentOptions)
    const attributeOptions = getRuntimeNodeOptions(runtimeModel, 'attributes', spellAttributeOptions)
    const showMaterialDescription = getRuntimeNodeVisible(
      runtimeModel,
      'materialDescription',
      hasMaterialComponent(values)
    )

    return (
      <>
        <AuthoredFormSection title='Basics' titleId='spell-basics-heading'>
          <div className={fieldGrid}>
            <form.AppField name='label'>
              {(field) => (
                <field.TextField
                  label='Spell Name'
                  readOnly={readOnly}
                  required={getRuntimeNodeRequired(runtimeModel, 'label')}
                />
              )}
            </form.AppField>
            <form.AppField name='level'>
              {(field) => (
                <field.NumberField
                  label='Level'
                  readOnly={readOnly}
                  required={getRuntimeNodeRequired(runtimeModel, 'level')}
                />
              )}
            </form.AppField>
            <form.AppField name='classIds'>
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
            <form.AppField name='magicSchoolId'>
              {(field) => (
                <field.SelectField
                  label='Magic School'
                  readOnly={readOnly}
                  data={magicSchoolOptions}
                  required={getRuntimeNodeRequired(runtimeModel, 'magicSchoolId')}
                />
              )}
            </form.AppField>
            <form.AppField name='castingTime.amount'>
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
              <form.AppField name='description'>
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
            <form.AppField name='components'>
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
          {showMaterialDescription ? (
            <form.AppField name='materialDescription'>
              {(field) => (
                <field.TextField
                  label='Material Description'
                  readOnly={readOnly}
                  required={getRuntimeNodeRequired(runtimeModel, 'materialDescription')}
                />
              )}
            </form.AppField>
          ) : null}
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
  }

  return (
    <AuthoredFormRoot>
      <AuthoredFormStepNav
        activeStep={activeStep}
        ariaLabel='Spell form sections'
        onStepChange={setActiveStep}
        steps={spellSteps}
      />

      <AuthoredFormHeader
        action={readOnly && response?.permissions.canCopy ? (
          <Button onClick={onCopy}>Duplicate to edit</Button>
        ) : null}
        eyebrow={mode !== 'create' ? spell.label || 'Untitled Spell' : undefined}
        title={pageTitle}
      />

      {readOnly ? (
        <Alert color='cyan'>
          This spell is locked for direct editing. Duplicate it to make your own draft.
        </Alert>
      ) : null}

      <form.AppForm>
        <AuthoredFormShell
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
        >
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <SpellRuntimeBridge
                enabled={resolveRuntime}
                references={references}
                values={values as SpellAuthoredDto}
                onClearPaths={(paths) => {
                  clearRuntimeFormPaths(form as unknown as ClearableRuntimeForm<SpellAuthoredDto>, paths)
                }}
              >
                {(runtimeModel) => (
                  <AuthoredFormSectionStack>
                    {activeStep === 'info' ? renderSpellInfoStep(runtimeModel, values as SpellAuthoredDto) : (
                      <EffectEditor
                        effects={(values as SpellAuthoredDto).effects ?? []}
                        form={effectEditorForm}
                        references={references}
                        readOnly={readOnly}
                        sourceLabel={(values as SpellAuthoredDto).label || 'Spell'}
                      />
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
              {activeStep === 'effects' ? (
                <form.SubmitButton label={mode === 'create' ? 'Create Spell' : 'Save Spell'} disabled={readOnly} />
              ) : (
                <Button
                  type='button'
                  onClick={() => setActiveStep('effects')}
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
