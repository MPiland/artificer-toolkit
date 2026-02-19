import Accordion from '@components/Accordion'
import { sprinkles } from '@css/sprinkles.css'
import { Attributes, ProfCats, Sections } from '@enums'
import { useSystemData, useFieldUpdates, useFormField } from '@hooks'
import { Grid, Group, Button } from '@mantine/core'
import { ClassProficiencyInputSchema } from '@artificer-toolkit/shared/schemas'
import type { ClassInput, ClassProficiencyInput, SubtypeInput } from '@types'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import { useListEquipment } from '@apis'

const ProficienciesStep = () => {
  const store = useTypedFormStore<ClassInput>()

  const { AppField } = useFormField({ store })

  const { updateField, subtypes } = useOptimizedSelector(store, (state) => ({
    updateField: state.updateField,
    subtypes: state.current?.subtypes
  }))

  const { fieldValidators, fieldListeners } = useFieldUpdates()

  const {
    data: { equipment, metaData: equipmentMeta }
  } = useListEquipment()

  const {
    proficiencies: systemProficiencies,
    attributes,
    abilities,
    skills,
    equipment: { categories: equipmentCategories, properties }
  } = useSystemData()

  return (
    <AppField name="proficiencies" mode="array">
      {(proficiencies) => (
        <Grid>
          <Grid.Col>
            <Group>
              <Button
                variant="outline"
                onClick={() => {
                  const proficiencyObject = ClassProficiencyInputSchema.parse({})
                  updateField({
                    path: `proficiencies.${proficiencies.state.value?.length}`,
                    value: proficiencyObject
                  })
                  proficiencies.pushValue(proficiencyObject)
                }}
                className={sprinkles({ mb: 'space-2' })}
              >
                Add Proficiency
              </Button>
            </Group>
          </Grid.Col>
          {proficiencies.state.value?.length && (
            <Grid.Col>
              <Accordion
                dataArray={proficiencies.state.value}
                onChange={(dataArray) => proficiencies.handleChange(dataArray as ClassProficiencyInput[])}
              >
                {proficiencies.state.value?.map((proficiency, i) => {
                  const multipleOptions = proficiency.attributes?.some(
                    (attribute) => attribute === Attributes.PROVIDES_OPTIONS
                  )
                  const category = systemProficiencies.categories.find(
                    (category) => category.id === proficiency.category
                  )
                  const catValue = category?.id === ProfCats.EQUIPMENT ? 'equipment' : 'properties'
                  return (
                    <Accordion.Item key={`proficiencies-${i}`} itemId={String(i)} value={`proficiencies-${i}`}>
                      <Accordion.Trigger
                        removeFn={() => {
                          updateField({ path: `proficiencies.${i}`, value: undefined })
                          proficiencies.removeValue(i)
                        }}
                        title={`Proficiency ${i + 1}`}
                      />
                      <Accordion.Content>
                        <Grid>
                          <AppField name={`proficiencies[${i}].attributes`} listeners={fieldListeners}>
                            {({ DropdownField }) => (
                              <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                <DropdownField
                                  multiselect={true}
                                  options={attributes.filter(
                                    (attribute) => attribute?.sections?.length
                                      && (attribute?.sections?.includes(Sections.ALL)
                                        || attribute?.sections?.includes(Sections.SUBCLASS))
                                  )}
                                  label="Proficiency Attribute"
                                />
                              </Grid.Col>
                            )}
                          </AppField>
                          <AppField
                            name={`proficiencies[${i}].category`}
                            validators={fieldValidators({
                              onBlur: 'Please select a proficiency category'
                            })}
                            listeners={fieldListeners}
                          >
                            {({ DropdownField }) => (
                              <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                <DropdownField
                                  options={systemProficiencies.categories}
                                  label="Proficiency Category"
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
                                    onBlur: 'Please select one or more save abilities'
                                  })}
                                  listeners={fieldListeners}
                                >
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                      <DropdownField
                                        multiselect={true}
                                        options={abilities}
                                        label="Save Abilities"
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
                                      onBlur: 'Please select an equipment category'
                                    })}
                                    listeners={fieldListeners}
                                  >
                                    {({ DropdownField }) => (
                                      <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                        <DropdownField
                                          options={equipmentCategories}
                                          label="Equipment Category"
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
                                      condition: category.id !== ProfCats.EQUIPMENT
                                    })}
                                    listeners={fieldListeners}
                                  >
                                    {({ DropdownField }) => {
                                      return (
                                        <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                          <DropdownField
                                            multiselect={true}
                                            options={
                                              category.id === ProfCats.PROPERTIES
                                                ? properties.filterByCategory(proficiency.properties?.category)
                                                : properties
                                            }
                                            label="Equipment Properties"
                                            required={category.id === ProfCats.EQUIPMENT ? false : true}
                                          />
                                        </Grid.Col>
                                      )
                                    }}
                                  </AppField>
                                  {category.id === ProfCats.EQUIPMENT && (
                                    <>
                                      <AppField
                                        name={`proficiencies[${i}].equipment.ids`}
                                        validators={fieldValidators({
                                          onBlur: 'Please select one or more equipment'
                                        })}
                                        listeners={fieldListeners}
                                      >
                                        {({ DropdownField }) => (
                                          <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                            <DropdownField
                                              options={equipment
                                                .filter((equipment) => equipmentMeta?.categories
                                                  ?.find((c) => c.id === category.id)
                                                  ?.equipmentIds?.includes(equipment.id))
                                                .filter((equipment) => equipmentMeta?.properties?.find(
                                                  (p) => proficiency.equipment?.properties?.includes(p.id)
                                                    && p.equipmentIds?.includes(equipment.id)
                                                ))}
                                              label="Equipment"
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
                                    onBlur: 'Please select one or more skills'
                                  })}
                                  listeners={fieldListeners}
                                >
                                  {({ DropdownField }) => (
                                    <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                      <DropdownField
                                        options={skills}
                                        label="Skills"
                                        required={true}
                                        multiselect={true}
                                      />
                                    </Grid.Col>
                                  )}
                                </AppField>
                              )}
                            </>
                          )}
                          {proficiency.attributes?.some((attribute) => attribute === Attributes.SUBTYPE_SPECIFIC) && (
                            <AppField
                              name={`proficiencies[${i}].subtype`}
                              validators={fieldValidators({
                                onBlur: 'Please select a subtype'
                              })}
                              listeners={fieldListeners}
                            >
                              {({ DropdownField }) => (
                                <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                  <DropdownField options={subtypes as SubtypeInput[]} label="Subtype" required={true} />
                                </Grid.Col>
                              )}
                            </AppField>
                          )}
                          {multipleOptions && (
                            <AppField
                              name={`proficiencies[${i}].selectionCount`}
                              validators={fieldValidators({
                                onBlur: 'Please enter a number of selections allowed',
                                onChange: { type: 'integer', min: 1, name: 'Selection count' }
                              })}
                              listeners={fieldListeners}
                            >
                              {({ TextField }) => (
                                <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                  <TextField label="# of Selections" required={true} />
                                </Grid.Col>
                              )}
                            </AppField>
                          )}
                        </Grid>
                      </Accordion.Content>
                    </Accordion.Item>
                  )
                })}
              </Accordion>
            </Grid.Col>
          )}
        </Grid>
      )}
    </AppField>
  )
}

export default ProficienciesStep
