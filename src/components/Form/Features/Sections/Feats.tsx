import { Categories, Sections } from '@/enums'
import { useSystemData, useFeatData, useEnumChecks, useFieldUpdates } from '@/hooks'
import type { SubtypeInput } from '@/types'
import { Grid } from '@mantine/core'
import { FeatureFeatInputSchema } from '@/schemas'
import { useAppForm, Prerequisites } from '@/components/Form'
import { useFeatStore } from '@/store'

type FeatsProps = {
  category?: string
  __kind?: 'ClassInput' | 'RaceInput' | 'EquipmentInput' | 'BackgroundInput' | 'FeatInput'
  subtypes?: SubtypeInput[]
}

const Feats = ({ category, __kind, subtypes }: FeatsProps) => {
  const featStore = useFeatStore()

  const form = useAppForm({
    defaultValues: FeatureFeatInputSchema.parse(featStore.current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'feat' })

  const { AppField, Subscribe } = form
  const { attributes } = useSystemData()
  const { feats } = useFeatData()

  const { getAttributes } = useEnumChecks()

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
      <Subscribe selector={(store) => store.values.attributes}>
        {(formAttributes) => {
          const { subtypeSpecific, providesOptions, hasPrerequisites } = getAttributes({ attributes: formAttributes })
          return (
            <>
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
                    updateFn={featStore.updateField}
                    removeFn={featStore.removeField}
                  />
                </Grid.Col>
              )}
            </>
          )
        }}
      </Subscribe>
    </Grid>
  )
}

export default Feats
