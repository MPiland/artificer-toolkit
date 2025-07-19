import { Categories, ProfCats, Sections } from '@/enums'
import { useSystemData, useEquipmentData, useEnumChecks, useFieldUpdates } from '@/hooks'
import type { SubtypeInput } from '@/types'
import { Grid } from '@mantine/core'
import { FeatureExpertiseInputSchema } from '@/schemas'
import { getKeyFromId, useAppForm, Prerequisites } from '@/components/Form'
import { useFeatureExpertiseStore, useFormStore } from '@/store'
import { useEffect } from 'react'

type ExpertiseProps = {
  category?: string
  subtypes?: SubtypeInput[]
}

const Expertise = ({ category, subtypes }: ExpertiseProps) => {
  const expertiseStore = useFeatureExpertiseStore()

  const form = useAppForm({
    defaultValues: FeatureExpertiseInputSchema.parse(expertiseStore.current),
  })

  const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'expertise' })

  const formStore = useFormStore()

  const __kind = formStore.current?.__kind as
    | 'ClassInput'
    | 'RaceInput'
    | 'EquipmentInput'
    | 'BackgroundInput'
    | 'FeatInput'

  const { AppField, Subscribe } = form

  useEffect(() => {
    if (!expertiseStore.formReset) {
      expertiseStore.registerFormReset(form.reset)
    }
  }, [form.reset, expertiseStore])

  useEffect(() => {
    return form.store.subscribe((state) => {
      const isValid = state.currentVal.isValid
      if (expertiseStore.current?.id && expertiseStore.valid.get(expertiseStore.current.id) !== isValid) {
        expertiseStore.upsertValid(expertiseStore.current.id, isValid)
      }
    })
  }, [expertiseStore, form.store])

  const { proficiencies, attributes, abilities, skills, equipment: systemEquipment, languages } = useSystemData()

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
          onBlur: 'Select a expertise category',
        })}
        listeners={fieldListeners}
      >
        {({ DropdownField }) => (
          <Grid.Col span={{ base: 6, md: 4, lg: 2 }}>
            <DropdownField options={proficiencies.categories} required={true} label='Expertise Category' />
          </Grid.Col>
        )}
      </AppField>
      <Subscribe selector={(state) => state.values.category}>
        {(formCategory) => {
          const sectionCategory = proficiencies.categories.find((category) => category.id === formCategory)
          const path = getKeyFromId(formCategory ?? '', ProfCats)
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
      <Subscribe
        selector={(state) => ({ formAttributes: state.values.attributes, formCategory: state.values.category })}
      >
        {({ formAttributes, formCategory }) => {
          const { subtypeSpecific, providesOptions, hasPrerequisites } = getAttributes({
            attributes: formAttributes || [],
          })
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
                  onChange: { type: 'number', min: 1, name: 'selectionCount' },
                })}
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
                  __kind='FeatureExpertiseInput'
                  updateFn={expertiseStore.updateField}
                  removeFn={expertiseStore.removeField}
                />
              </Grid.Col>
            )
          )
        }}
      </Subscribe>
    </Grid>
  )
}

export default Expertise
