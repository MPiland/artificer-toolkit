import { Categories, ProfCats, ProfLevels, Sections } from '@/enums'
import { getKeyFromId, useAppForm, Prerequisites } from '@/components/Form'
import { useEnumChecks, useFieldUpdates } from '@/hooks'
import { useSystemData, useEquipmentData } from '@/hooks'
import type { SubtypeInput } from '@/types'
import { Grid } from '@mantine/core'
import { FeatureProficiencyInputSchema } from '@/schemas'
import { useFormStore, useProficiencyStore } from '@/store'

type ProficienciesProps = {
  category?: string
  subtypes?: SubtypeInput[]
}

const Proficiencies = ({ category, subtypes }: ProficienciesProps) => {
  const proficiencyStore = useProficiencyStore()

  const form = useAppForm({
    defaultValues: FeatureProficiencyInputSchema.parse(proficiencyStore.current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'proficiency' })

  const formStore = useFormStore()

  const __kind = formStore.current?.__kind as
    | 'ClassInput'
    | 'RaceInput'
    | 'EquipmentInput'
    | 'BackgroundInput'
    | 'FeatInput'

  const { AppField, Subscribe } = form

  const { abilities, proficiencies, attributes, skills, languages, equipment: systemEquipment, rules } = useSystemData()

  const { equipment } = useEquipmentData()

  const { getAttributes } = useEnumChecks()

  const systemOptions = {
    saveAbilities: abilities,
    skills: skills,
    languages: languages,
  } as const

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
        name='category'
        validators={fieldValidators({
          onBlur: 'Select a proficiency category',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField options={proficiencies.categories} required={true} label='Proficiency Category' />
          </Grid.Col>
        )}
      </AppField>
      <Subscribe selector={(state) => state.values.category}>
        {(formCategory) => {
          const path = getKeyFromId(formCategory ?? '', ProfCats)
          const sectionCategory = proficiencies.categories.findCategory(formCategory)
          return (
            <>
              {sectionCategory != null &&
                path !== 'initiative' &&
                (path !== 'equipment' && path !== 'properties' ?
                  <AppField
                    name={path}
                    validators={fieldValidators({
                      onBlur: 'Select at lease one type',
                    })}
                    listeners={fieldListeners}
                  >
                    {({ DropdownField }) => (
                      <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                        <DropdownField
                          multiselect={true}
                          options={systemOptions[path]}
                          required={true}
                          label={`${sectionCategory.label} Type`}
                        />
                      </Grid.Col>
                    )}
                  </AppField>
                : <>
                    <AppField
                      name={path}
                      validators={fieldValidators({
                        onBlur: 'Select an equipment category',
                      })}
                      listeners={fieldListeners}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                          <DropdownField
                            options={systemEquipment.categories}
                            required={true}
                            label='Equipment Category'
                          />
                        </Grid.Col>
                      )}
                    </AppField>
                    <Subscribe selector={(state) => state.values}>
                      {(values) => (
                        <>
                          <AppField
                            name={`${path as 'properties' | 'equipment'}.${
                              sectionCategory.id === ProfCats.EQUIPMENT ? 'properties' : 'ids'
                            }`}
                            validators={fieldValidators({
                              onBlur: 'Select at leaset one property',
                              condition: sectionCategory.id === ProfCats.EQUIPMENT,
                            })}
                            listeners={fieldListeners}
                          >
                            {({ DropdownField }) => (
                              <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                <DropdownField
                                  multiselect={true}
                                  options={systemEquipment.properties.filterByCategory(values[path]?.category)}
                                  required={sectionCategory.id === ProfCats.EQUIPMENT ? false : true}
                                  label='Equipment Properties'
                                />
                              </Grid.Col>
                            )}
                          </AppField>
                          {sectionCategory.id === ProfCats.EQUIPMENT && (
                            <AppField
                              name={`${path as 'equipment'}.ids`}
                              validators={fieldValidators({
                                onBlur: 'Select at leaset one equipment',
                              })}
                              listeners={fieldListeners}
                            >
                              {({ DropdownField }) => (
                                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                                  <DropdownField
                                    multiselect={true}
                                    options={equipment
                                      .filterByCategory(values[path]?.category)
                                      .filterByEveryProperty(values[path]?.properties)}
                                    required={true}
                                    label='Equipment'
                                  />
                                </Grid.Col>
                              )}
                            </AppField>
                          )}
                        </>
                      )}
                    </Subscribe>
                  </>)}
            </>
          )
        }}
      </Subscribe>
      <AppField
        name='level'
        validators={fieldValidators({
          onBlur: 'Select a proficiency level',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField options={proficiencies.levels} required={true} label='Proficiency Level' />
          </Grid.Col>
        )}
      </AppField>
      <Subscribe selector={(state) => state.values.level}>
        {(level) =>
          level === ProfLevels.HALF_PROFICIENCY && (
            <AppField
              name='rounding'
              validators={fieldValidators({
                onBlur: 'Select a rounding type',
              })}
              listeners={fieldListeners}
            >
              {({ DropdownField }) => (
                <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
                  <DropdownField options={rules.measurements.rounding} required={true} label='Rounding Type' />
                </Grid.Col>
              )}
            </AppField>
          )
        }
      </Subscribe>
      <Subscribe
        selector={(state) => ({ formAttributes: state.values.attributes, formCategory: state.values.category })}
      >
        {({ formAttributes, formCategory }) => {
          const { subtypeSpecific, providesOptions, hasPrerequisites } = getAttributes({ attributes: formAttributes })
          const sectionCategory = proficiencies.categories.findCategory(formCategory)
          return (
            subtypeSpecific &&
            __kind === 'ClassInput' &&
            sectionCategory != null &&
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
                    <DropdownField options={subtypes} required={true} label='Subclass Subtype' />
                  </Grid.Col>
                )}
              </AppField>
            ) &&
            providesOptions && (
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
            ) &&
            hasPrerequisites && (
              <Grid.Col>
                <Prerequisites
                  form={form}
                  fields='prerequisites'
                  __kind='FeatureProficiencyInput'
                  updateFn={proficiencyStore.updateField}
                  removeFn={proficiencyStore.removeField}
                />
              </Grid.Col>
            )
          )
        }}
      </Subscribe>
    </Grid>
  )
}

export default Proficiencies
