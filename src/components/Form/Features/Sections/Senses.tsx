import { Attributes, Categories, Sections } from '@/enums'
import { useFieldUpdates, useSystemData } from '@/hooks'
import { Grid } from '@mantine/core'
import { useAppForm } from '@/components/Form'
import { FeatureSenseInputSchema } from '@/schemas'
import { SubtypeInput } from '@/types'
import { useFormStore, useFeatureSenseStore } from '@/store'
import { useEffect } from 'react'

type SensesProps = {
  category?: string
  subtypes?: SubtypeInput[]
}

const Senses = ({ category, subtypes }: SensesProps) => {
  const senseStore = useFeatureSenseStore()

  const form = useAppForm({
    defaultValues: FeatureSenseInputSchema.parse(senseStore.current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'sense' })

  const formStore = useFormStore()

  const __kind = formStore.current?.__kind as
    | 'ClassInput'
    | 'RaceInput'
    | 'EquipmentInput'
    | 'BackgroundInput'
    | 'FeatInput'

  const { AppField, Subscribe } = form

  const { senses, attributes } = useSystemData()

  useEffect(() => {
    if (!senseStore.formReset) {
      senseStore.registerFormReset(form.reset)
    }
  }, [form.reset, senseStore])

  useEffect(() => {
    return form.store.subscribe((state) => {
      const isValid = state.currentVal.isValid
      if (senseStore.current?.id && senseStore.valid.get(senseStore.current.id) !== isValid) {
        senseStore.upsertValid(senseStore.current.id, isValid)
      }
    })
  }, [senseStore, form.store])

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
      <Subscribe selector={(state) => state.values.attributes}>
        {(formAttributes) =>
          formAttributes?.some((attribute) => attribute === Attributes.SUBTYPE_SPECIFIC) &&
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
          ) &&
          formAttributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS) && (
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
          )
        }
      </Subscribe>
    </Grid>
  )
}
export default Senses
