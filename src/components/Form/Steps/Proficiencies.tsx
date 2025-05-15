import { useEffect } from 'react'
import Accordion from '@/components/Accordion'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import Button from '@/components/Button'
import { sprinkles } from '@/css/sprinkles.css'
import { isEqual, set } from 'lodash'
import { Attributes, Measurements, ProfCats, Sections } from '@/enums'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { useSystemData, useEquipmentData } from '@/hooks'
import type { OnChange, Class } from '@/types'
import { Grid, Group } from '@mantine/core'

const ProficienciesStep = () => {
  const {
    formStore: { data, updateField, removeField, addField },
  } = use(FormContext) as {
    formStore: {
      data: Class
      updateField: OnChange<Class>['updateField']
      removeField: OnChange<Class>['removeField']
      addField: OnChange<Class>['addField']
    }
  }

  const {
    proficiencies,
    attributes,
    abilities,
    skills,
    equipment: { categories: equipmentCategories, properties },
  } = useSystemData()
  const { equipment } = useEquipmentData()

  useEffect(() => {
    if (data?.proficiencies?.length) {
      const formClone = {
        ...data,
      }
      formClone?.proficiencies?.forEach((proficiency, index) => {
        if (
          !proficiency?.level ||
          (proficiency?.level !== Measurements.FULL && proficiency?.level !== Measurements.HALF)
        ) {
          set(formClone, `proficiencies.${index}.level`, Measurements.FULL)
        }
      })
      if (!isEqual(formClone.proficiencies, data.proficiencies)) {
        updateField({
          path: 'proficiencies',
          value: formClone.proficiencies,
        })
      }
    }
  }, [data, updateField])

  return (
    <Grid>
      <Grid.Col>
        <Group>
          <Button
            color='primary'
            style='outline'
            onClick={() => {
              addField({ path: 'proficiencies' })
            }}
            className={sprinkles({ mb: 'space-2' })}
          >
            Add Proficiency
          </Button>
        </Group>
      </Grid.Col>
      {data.proficiencies && (
        <Grid.Col>
          <Accordion dataArray={data.proficiencies} name='proficiencies' updateFn={{ updateField }}>
            {data.proficiencies?.map((proficiency, index) => {
              const multipleOptions = proficiency.attributes?.some(
                (attribute) => attribute === Attributes.PROVIDES_OPTIONS
              )
              const category = proficiencies.categories.find((category) => category.id === proficiency.category)
              return (
                <Accordion.Item key={index} itemId={String(index)} value={proficiency.id}>
                  <Accordion.Trigger removeFn={() => removeField({ path: `proficiencies.${index}` })}>
                    {`Proficiency ${index + 1}`}
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <Grid>
                      <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                        <Dropdown
                          multiSelect={true}
                          name={`proficiencies.${index}.attributes`}
                          options={attributes.filter(
                            (attribute) =>
                              attribute?.sections?.length &&
                              (attribute?.sections?.includes(Sections.ALL) ||
                                attribute?.sections?.includes(Sections.SUBCLASS))
                          )}
                          label='Proficiency Attribute'
                          value={proficiency.attributes}
                          onChange={{ updateField, removeField }}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                        <Dropdown
                          name={`proficiencies.${index}.category`}
                          label='Proficiency Category'
                          value={proficiency.category}
                          options={proficiencies.categories}
                          required={true}
                          onChange={{ updateField, removeField }}
                        />
                      </Grid.Col>
                      {category && (
                        <>
                          {category.id === ProfCats.SAVE_ABILITIES && (
                            <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                              <Dropdown
                                name={`proficiencies.${index}.saveAbilities`}
                                multiSelect={true}
                                label={`${category.label} Type`}
                                value={proficiency.saveAbilities}
                                options={abilities}
                                required={true}
                                onChange={{ updateField, removeField }}
                              />
                            </Grid.Col>
                          )}
                          {(category.id === ProfCats.PROPERTIES || category.id === ProfCats.EQUIPMENT) && (
                            <>
                              <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                <Dropdown
                                  name={`proficiencies.${index}.${category.value as 'properties' | 'equipment'}.category`}
                                  label='Item Category'
                                  value={proficiency[category.value as 'properties' | 'equipment']?.category}
                                  options={equipmentCategories}
                                  required={true}
                                  onChange={{ updateField, removeField }}
                                />
                              </Grid.Col>
                              <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                <Dropdown
                                  name={`proficiencies.${index}.${category.value as 'properties' | 'equipment'}.${
                                    category.id === ProfCats.EQUIPMENT ? 'properties' : 'ids'
                                  }`}
                                  multiSelect={true}
                                  label='Equipment Properties'
                                  value={
                                    category.id === ProfCats.EQUIPMENT ?
                                      proficiency.equipment?.properties
                                    : proficiency.properties?.ids
                                  }
                                  options={
                                    category.id === ProfCats.PROPERTIES ?
                                      properties.filterByCategory(category.id)
                                    : properties
                                  }
                                  onChange={{ updateField, removeField }}
                                  required={category.id === ProfCats.EQUIPMENT ? false : true}
                                />
                              </Grid.Col>
                              {category.id === ProfCats.EQUIPMENT && (
                                <>
                                  <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                                    <Dropdown
                                      name={`proficiencies.${index}.equipment.ids`}
                                      multiSelect={true}
                                      label='Equipment'
                                      value={proficiency?.equipment?.ids}
                                      options={equipment

                                        .filterByCategory(category.id)
                                        .filterByProperties(proficiency.equipment?.properties)}
                                      onChange={{ updateField, removeField }}
                                      required={true}
                                    />
                                  </Grid.Col>
                                </>
                              )}
                            </>
                          )}
                          {category.id === ProfCats.SKILLS && (
                            <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                              <Dropdown
                                name={`proficiencies.${index}.skills`}
                                multiSelect={true}
                                label={`${category.label} Type`}
                                value={proficiency.skills}
                                options={skills}
                                required={true}
                                onChange={{ updateField, removeField }}
                              />
                            </Grid.Col>
                          )}
                        </>
                      )}
                      {data.subtypes?.length &&
                        proficiency.attributes?.some((attribute) => attribute === Attributes.SUBTYPE_SPECIFIC) && (
                          <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                            <Dropdown
                              name={`proficiencies.${index}.subtype`}
                              label='Subtype'
                              value={proficiency?.subtype}
                              options={data.subtypes}
                              required={true}
                              onChange={{ updateField, removeField }}
                            />
                          </Grid.Col>
                        )}
                      {multipleOptions && (
                        <Grid.Col span={{ sm: 6, md: 4, lg: 'auto' }}>
                          <Input
                            validation='num'
                            name={`proficiencies.${index}.selectionCount`}
                            label='# of Selections'
                            autoComplete='off'
                            value={proficiency.selectionCount}
                            errorMsg='Must contain only numbers'
                            required={true}
                            onChange={{ updateField }}
                          />
                        </Grid.Col>
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
  )
}

export default ProficienciesStep
