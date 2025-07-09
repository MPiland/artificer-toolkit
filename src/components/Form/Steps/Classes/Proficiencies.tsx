import { useEffect } from 'react'
import Accordion from '@/components/Accordion'
import { sprinkles } from '@/css/sprinkles.css'
import { isEqual, set } from 'lodash'
import { Attributes, Measurements, ProfCats, Sections } from '@/enums'
import { useSystemData, useEquipmentData, useFieldUpdates } from '@/hooks'
import { Grid, Group, Button } from '@mantine/core'
import { useAppForm } from '@/components/Form'
import { ClassInputSchema, FeatureProficiencyInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'
import type { SubtypeInput } from '@/types'
import { useFormStore } from '@/store'

const ProficienciesStep = () => {
  const formStore = useFormStore()

  const form = useAppForm({
    defaultValues: ClassInputSchema.parse(formStore.current),
  })

  const { AppField, Subscribe } = form

  const { fieldValidators, fieldListeners } = useFieldUpdates({ data: 'form' })

  const {
    proficiencies,
    attributes,
    abilities,
    skills,
    equipment: { categories: equipmentCategories, properties },
  } = useSystemData()

  const { equipment } = useEquipmentData()

  const formProficiencies = useStore(form.store, (state) => state.values.proficiencies)

  useEffect(() => {
    formStore.registerForm(form.reset)
  }, [form.reset, formStore])

  useEffect(() => {
    if (formProficiencies?.length) {
      const cloneProficiencies = {
        ...formProficiencies,
      }
      cloneProficiencies?.forEach((proficiency, i) => {
        if (
          !proficiency?.level ||
          (proficiency?.level !== Measurements.FULL && proficiency?.level !== Measurements.HALF)
        ) {
          set(cloneProficiencies, `proficiencies.${i}.level`, Measurements.FULL)
        }
      })
      if (!isEqual(cloneProficiencies, formProficiencies)) {
        form.setFieldValue('proficiencies', cloneProficiencies)
        formStore.updateField({ path: 'proficiencies', value: cloneProficiencies })
      }
    }
  }, [form, formProficiencies, formStore])

  return (
    <AppField name='proficiencies' mode='array'>
      {({ state, pushValue, removeValue, AccordionField }) => (
        <Grid>
          <Grid.Col>
            <Group>
              <Button
                variant='outline'
                onClick={() => {
                  const proficiencyObject = FeatureProficiencyInputSchema.parse({})
                  formStore.updateField({ path: `proficiencies.${state.value?.length}`, value: proficiencyObject })
                  pushValue(proficiencyObject)
                }}
                className={sprinkles({ mb: 'space-2' })}
              >
                Add Proficiency
              </Button>
            </Group>
          </Grid.Col>
          {state.value?.length && (
            <Grid.Col>
              <AccordionField name='proficiencies'>
                {state.value?.map((proficiency, i) => {
                  const multipleOptions = proficiency.attributes?.some(
                    (attribute) => attribute === Attributes.PROVIDES_OPTIONS
                  )
                  const category = proficiencies.categories.find((category) => category.id === proficiency.category)
                  const catValue = category?.id === ProfCats.EQUIPMENT ? 'equipment' : 'properties'
                  return (
                    <Accordion.Item key={`${i}-proficiencies`} itemId={String(i)} value={`${i}-proficiencies`}>
                      <Accordion.Trigger
                        removeFn={() => {
                          formStore.removeField({ path: `proficiencies.${i}` })
                          removeValue(i)
                        }}
                      >{`Proficiency ${i + 1}`}</Accordion.Trigger>
                      <Accordion.Content>
                        <Grid>
                          <AppField name={`proficiencies[${i}].attributes`} listeners={fieldListeners}>
                            {({ DropdownField }) => (
                              <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                <DropdownField
                                  multiselect={true}
                                  options={attributes.filter(
                                    (attribute) =>
                                      attribute?.sections?.length &&
                                      (attribute?.sections?.includes(Sections.ALL) ||
                                        attribute?.sections?.includes(Sections.SUBCLASS))
                                  )}
                                  label='Proficiency Attribute'
                                />
                              </Grid.Col>
                            )}
                          </AppField>
                          <AppField
                            name={`proficiencies[${i}].category`}
                            validators={fieldValidators({
                              onBlur: 'Please select a proficiency category',
                            })}
                            listeners={fieldListeners}
                          >
                            {({ DropdownField }) => (
                              <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                <DropdownField
                                  options={proficiencies.categories}
                                  label='Proficiency Attribute'
                                  required={true}
                                />
                              </Grid.Col>
                            )}
                          </AppField>
                          {category && (
                            <>
                              {category.id === ProfCats.SAVE_ABILITIES && (
                                <AppField
                                  name={`proficiencies[${i}].saveAbilities`}
                                  validators={fieldValidators({
                                    onBlur: 'Please select one or more save abilities',
                                  })}
                                  listeners={fieldListeners}
                                >
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                      <DropdownField
                                        multiselect={true}
                                        options={abilities}
                                        label='Save Abilities'
                                        required={true}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                              )}
                              {(category.id === ProfCats.PROPERTIES || category.id === ProfCats.EQUIPMENT) && (
                                <>
                                  <AppField
                                    name={`proficiencies[${i}].${catValue}.category`}
                                    validators={fieldValidators({
                                      onBlur: 'Please select an equipment category',
                                    })}
                                    listeners={fieldListeners}
                                  >
                                    {({ DropdownField }) => (
                                      <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                        <DropdownField
                                          options={equipmentCategories}
                                          label='Equipment Category'
                                          required={true}
                                        />
                                      </Grid.Col>
                                    )}
                                  </AppField>
                                  <AppField
                                    name={`proficiencies[${i}].${catValue}.${
                                      category.id === ProfCats.EQUIPMENT ? 'properties' : 'ids'
                                    }`}
                                    validators={fieldValidators({
                                      onBlur: `Please select one or more equipment properties`,
                                      condition: category.id !== ProfCats.EQUIPMENT,
                                    })}
                                    listeners={fieldListeners}
                                  >
                                    {({ DropdownField }) => (
                                      <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                        <DropdownField
                                          multiselect={true}
                                          options={
                                            category.id === ProfCats.PROPERTIES ?
                                              properties.filterByCategory(category.id)
                                            : properties
                                          }
                                          label='Equipment Properties'
                                          required={category.id === ProfCats.EQUIPMENT ? false : true}
                                        />
                                      </Grid.Col>
                                    )}
                                  </AppField>
                                  {category.id === ProfCats.EQUIPMENT && (
                                    <>
                                      <AppField
                                        name={`proficiencies[${i}].equipment.ids`}
                                        validators={fieldValidators({
                                          onBlur: 'Please select one or more equipment',
                                        })}
                                        listeners={fieldListeners}
                                      >
                                        {({ DropdownField }) => (
                                          <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                            <DropdownField
                                              options={equipment
                                                .filterByCategory(category.id)
                                                .filterByProperties(proficiency.equipment?.properties)}
                                              label='Equipment'
                                              required={true}
                                            />
                                          </Grid.Col>
                                        )}
                                      </AppField>
                                    </>
                                  )}
                                </>
                              )}
                              {category.id === ProfCats.SKILLS && (
                                <AppField
                                  name={`proficiencies[${i}].skills`}
                                  validators={fieldValidators({
                                    onBlur: 'Please select one or more skills',
                                  })}
                                  listeners={fieldListeners}
                                >
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                      <DropdownField
                                        options={skills}
                                        label='Skills'
                                        required={true}
                                        multiselect={true}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                              )}
                            </>
                          )}
                          <Subscribe selector={(state) => state.values?.subtypes}>
                            {(subtypes) =>
                              subtypes?.length &&
                              proficiency.attributes?.some(
                                (attribute) => attribute === Attributes.SUBTYPE_SPECIFIC
                              ) && (
                                <AppField
                                  name={`proficiencies[${i}].subtype`}
                                  validators={fieldValidators({
                                    onBlur: 'Please select a subtype',
                                  })}
                                  listeners={fieldListeners}
                                >
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                      <DropdownField
                                        options={subtypes as SubtypeInput[]}
                                        label='Subtype'
                                        required={true}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                              )
                            }
                          </Subscribe>
                          {multipleOptions && (
                            <AppField
                              name={`proficiencies[${i}].selectionCount`}
                              validators={fieldValidators({
                                onBlur: 'Please enter a number of selections allowed',
                                onChange: { type: 'integer', min: 1, name: 'Selection count' },
                              })}
                              listeners={fieldListeners}
                            >
                              {({ TextField }) => (
                                <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                  <TextField label='# of Selections' required={true} />
                                </Grid.Col>
                              )}
                            </AppField>
                          )}
                        </Grid>
                      </Accordion.Content>
                    </Accordion.Item>
                  )
                })}
              </AccordionField>
            </Grid.Col>
          )}
        </Grid>
      )}
    </AppField>
  )
}

export default ProficienciesStep
