import { Attributes, Categories, Sections } from '@/enums'
import { useFieldUpdates, useSystemData, useEnumChecks } from '@/hooks'
import { Grid } from '@mantine/core'
import { useAppForm, Prerequisites } from '@/components/Form'
import { FeatureSenseInputSchema } from '@/schemas'
import { SubtypeInput } from '@/types'
import { useFormStore, useFeatureSenseStore } from '@/store'
import { useEffect } from 'react'

type SensesProps = {
  category?: string
  subtypes?: SubtypeInput[]
}

const Senses = ({ category, subtypes }: SensesProps) => {
  const current = useFeatureSenseStore((state) => state.current)
  const registerForm = useFeatureSenseStore((state) => state.registerForm)
  const formReset = useFeatureSenseStore((state) => state.formReset)
  const updateField = useFeatureSenseStore((state) => state.updateField)
  const removeField = useFeatureSenseStore((state) => state.removeField)
  const valid = useFeatureSenseStore((state) => state.valid)
  const upsertValid = useFeatureSenseStore((state) => state.upsertValid)
  const formAttributes = useFeatureSenseStore((state) => state.current?.attributes)

  const __kind = useFormStore((state) => state.current?.__kind)

  const form = useAppForm({
    defaultValues: FeatureSenseInputSchema.parse(current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'sense' })
  const { AppField } = form

  const { senses, attributes } = useSystemData()
  const { getAttributes } = useEnumChecks()

  useEffect(() => {
    if (!formReset) {
      registerForm(form.reset)
    }
  }, [form.reset, registerForm, formReset])

  useEffect(() => {
    return form.store.subscribe((state) => {
      const isValid = state.currentVal.isValid
      if (current?.id && valid.get(current.id) !== isValid) {
        upsertValid(current.id, isValid)
      }
    })
  }, [valid, upsertValid, current?.id, form.store])

  const { subtypeSpecific, providesOptions, hasPrerequisites } = getAttributes({
    attributes: formAttributes || [],
  })

  return (
    <Grid>
      <AppField name='attributes' listeners={fieldListeners}>
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField
              multiselect={true}
              options={attributes.filter(
                (attribute) =>
                  attribute.sections &&
                  (attribute.sections.includes(Sections.ALL) ||
                    (category === Categories.SUBCLASS && attribute.sections.includes(Sections.SUBCLASS)))
              )}
              label='Sense Attributes'
            />
          </Grid.Col>
        )}
      </AppField>
      <AppField
        name='ids'
        validators={fieldValidators({
          onBlur: 'Select at least one sense',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField multiselect={true} options={senses} required={true} label='Senses' />
          </Grid.Col>
        )}
      </AppField>
      {formAttributes?.some((attribute) => attribute === Attributes.SUBTYPE_SPECIFIC) &&
        __kind === 'ClassInput' &&
        subtypes?.length && (
          <AppField
            name='subtype'
            validators={fieldValidators({
              onBlur: 'Select a subtype',
            })}
            listeners={fieldListeners}
          >
            {({ DropdownField }) => (
              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                <DropdownField options={subtypes} required={true} label='Subtype' />
              </Grid.Col>
            )}
          </AppField>
        )}
      {formAttributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS) && (
        <AppField
          name='selectionCount'
          validators={fieldValidators({
            onBlur: 'Set an amount of selections allowed',
            onChange: { type: 'number', min: 1, name: 'Selection count' },
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <TextField required={true} label='# of Selections' />
            </Grid.Col>
          )}
        </AppField>
      )}
      {subtypeSpecific && __kind === 'ClassInput' && subtypes?.length && (
        <AppField
          name='subtype'
          validators={fieldValidators({
            onBlur: 'Select a subtype',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField options={subtypes} required={true} label='Subclass Subtype' />
            </Grid.Col>
          )}
        </AppField>
      )}
      {providesOptions && (
        <AppField
          name='selectionCount'
          validators={fieldValidators({
            onBlur: 'Enter a number of selections allowed',
            onChange: { type: 'integer', min: 1, name: 'Selection count' },
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <TextField required={true} label='# of Selections' />
            </Grid.Col>
          )}
        </AppField>
      )}
      {hasPrerequisites && (
        <Grid.Col>
          <Prerequisites
            form={form}
            fields='prerequisites'
            __kind='FeatureProficiencyInput'
            updateFn={updateField}
            removeFn={removeField}
          />
        </Grid.Col>
      )}
    </Grid>
  )
}
export default Senses
