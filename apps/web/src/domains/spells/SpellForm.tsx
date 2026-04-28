import { useState } from 'react'
import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import type { SpellAuthoredDto, SpellResponseDto } from '@artificer-toolkit/schema'
import { useAppForm } from '#components/Form/runtime'
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
  eyebrow,
  fieldGrid,
  footer,
  formRoot,
  formShell,
  header,
  inputRow,
  sectionPanel,
  sectionStack,
  title,
  wide
} from './spellAuthoring.css'

export function SpellForm({
  mode,
  initialSpell,
  response,
  references,
  userId,
  onSubmit,
  onCopy
}: {
  mode: 'create' | 'view' | 'edit'
  initialSpell?: SpellAuthoredDto
  response?: SpellResponseDto
  references: SpellReferenceData
  userId: string
  onSubmit: (spell: SpellAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState<'info' | 'effects'>('info')
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

  return (
    <div className={formRoot}>
      <div className={header}>
        <Stack gap={4}>
          <h1 className={title}>
            {activeStep === 'info' ? 'Spell Info' : 'Effects'}
          </h1>
          {mode !== 'create' ? <Text className={eyebrow}>{spell.label || 'Untitled Spell'}</Text> : null}
        </Stack>
        {readOnly && response?.permissions.canCopy ? (
          <Button onClick={onCopy}>Duplicate to edit</Button>
        ) : null}
      </div>

      {readOnly ? (
        <Alert color='cyan'>
          This spell is locked for direct editing. Duplicate it to make your own draft.
        </Alert>
      ) : null}

      <form.AppForm>
        <form
          className={formShell}
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
        >
          <Stack className={sectionStack}>
            {activeStep === 'info' ? (
              <>
                <section className={sectionPanel} aria-labelledby='spell-basics-heading'>
                  <Title id='spell-basics-heading' order={2}>Basics</Title>
                  <div className={fieldGrid}>
                    <form.AppField name='label'>
                      {(field) => <field.TextField label='Spell Name' readOnly={readOnly} />}
                    </form.AppField>
                    <form.AppField name='level'>
                      {(field) => <field.NumberField label='Level' readOnly={readOnly} />}
                    </form.AppField>
                    <form.AppField name='classIds'>
                      {(field) => (
                        <field.MultiSelectField
                          label='Classes'
                          readOnly={readOnly}
                          data={getSelectData(references.classes)}
                        />
                      )}
                    </form.AppField>
                  </div>
                </section>

                <section className={sectionPanel} aria-labelledby='spell-details-heading'>
                  <Title id='spell-details-heading' order={2}>Details</Title>
                  <div className={fieldGrid}>
                    <form.AppField name='magicSchoolId'>
                      {(field) => (
                        <field.SelectField
                          label='Magic School'
                          readOnly={readOnly}
                          data={getSelectData(references.magicSchools)}
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
                        {(field) => <field.TextareaField label='Description' readOnly={readOnly} />}
                      </form.AppField>
                    </div>
                  </div>
                </section>

                <section className={sectionPanel} aria-labelledby='spell-components-heading'>
                  <Title id='spell-components-heading' order={2}>Components & Attributes</Title>
                  <div className={inputRow}>
                    <form.AppField name='components'>
                      {(field) => (
                        <field.MultiSelectField
                          label='Components'
                          readOnly={readOnly}
                          data={spellComponentOptions}
                        />
                      )}
                    </form.AppField>
                  </div>
                  <form.Subscribe selector={(state) => hasMaterialComponent(state.values as SpellAuthoredDto)}>
                    {(showMaterial) => showMaterial ? (
                      <form.AppField name='materialDescription'>
                        {(field) => <field.TextField label='Material Description' readOnly={readOnly} />}
                      </form.AppField>
                    ) : null}
                  </form.Subscribe>
                  <div className={inputRow}>
                    <form.AppField name='attributes'>
                      {(field) => (
                        <field.MultiSelectField
                          label='Attributes'
                          readOnly={readOnly}
                          data={spellAttributeOptions}
                        />
                      )}
                    </form.AppField>
                  </div>
                </section>
              </>
            ) : (
                <form.Subscribe selector={(state) => state.values.effects ?? []}>
                  {(effects) => (
                    <EffectEditor
                      effects={effects}
                      form={effectEditorForm}
                      references={references}
                      readOnly={readOnly}
                      sourceLabel={spell.label || 'Spell'}
                    />
                  )}
                </form.Subscribe>
              )}
            </Stack>

          <div className={footer}>
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
          </div>
        </form>
      </form.AppForm>
    </div>
  )
}
