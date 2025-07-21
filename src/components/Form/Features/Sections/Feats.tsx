import { Categories, Sections } from '@/enums'
import { useSystemData, useFeatData, useEnumChecks, useFieldUpdates } from '@/hooks'
import type { SubtypeInput } from '@/types'
import { Grid } from '@mantine/core'
import { FeatureFeatInputSchema } from '@/schemas'
import { useAppForm, Prerequisites } from '@/components/Form'
import { useFeatureFeatStore, useFormStore } from '@/store'
import { useEffect } from 'react'

type FeatsProps = {
  category?: string
  subtypes?: SubtypeInput[]
}

const Feats = ({ category, subtypes }: FeatsProps) => {
  const current = useFeatureFeatStore((state) => state.current)
  const registerForm = useFeatureFeatStore((state) => state.registerForm)
  const formReset = useFeatureFeatStore((state) => state.formReset)
  const updateField = useFeatureFeatStore((state) => state.updateField)
  const removeField = useFeatureFeatStore((state) => state.removeField)
  const valid = useFeatureFeatStore((state) => state.valid)
  const upsertValid = useFeatureFeatStore((state) => state.upsertValid)
  const formAttributes = useFeatureFeatStore((state) => state.current?.attributes)

  const __kind = useFormStore((state) => state.current?.__kind)

  const form = useAppForm({
    defaultValues: FeatureFeatInputSchema.parse(current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'feat' })

  const { AppField } = form

  const { attributes } = useSystemData()
  const { feats } = useFeatData()
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
                  attribute?.sections?.length &&
                  (attribute.sections.includes(Sections.SPELL) ||
                    attribute.sections.includes(Sections.ALL) ||
                    (category === Categories.SUBCLASS && attribute.sections.includes(Sections.SUBCLASS)))
              )}
              label='Attributes'
            />
          </Grid.Col>
        )}
      </AppField>
      <AppField
        name='feats'
        validators={fieldValidators({
          onBlur: 'Select at least one feat',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField multiselect={true} options={feats} label='Feats' required={true} />
          </Grid.Col>
        )}
      </AppField>
      {subtypeSpecific && __kind === 'ClassInput' && category === Categories.SUBCLASS && subtypes?.length && (
        <AppField
          name='subtype'
          validators={fieldValidators({
            onBlur: 'Select a subtype',
          })}
          listeners={fieldListeners}
        >
          {({ DropdownField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <DropdownField options={feats} label='Subtype' required={true} />
            </Grid.Col>
          )}
        </AppField>
      )}
      {providesOptions && (
        <AppField
          name='selectionCount'
          validators={fieldValidators({
            onBlur: 'Enter a selection amount allowed',
            onChange: { type: 'integer', name: 'Selection amount', min: 1 },
          })}
          listeners={fieldListeners}
        >
          {({ TextField }) => (
            <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
              <TextField label='# of Selections' required={true} />
            </Grid.Col>
          )}
        </AppField>
      )}
      {hasPrerequisites && (
        <Grid.Col>
          <Prerequisites
            form={form}
            fields='prerequisites'
            __kind='FeatureFeatInput'
            updateFn={updateField}
            removeFn={removeField}
          />
        </Grid.Col>
      )}
    </Grid>
  )
}

export default Feats
