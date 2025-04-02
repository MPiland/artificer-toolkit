import { useEffect } from 'react'
import Accordion from '../../Accordion/Accordion'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Button from '../../Button/Button'
import { sprinkles } from '../../../css/sprinkles.css'
import Group from '../../Group/Group'
import { isEqual, set } from 'lodash'
import { useGetSystemQuery } from '../../../apis/systemsApi'
import { useListEquipmentQuery } from '../../../apis/equipmentApi'
import { Class, SectionEnum } from '../../../../amplify/gql/types'
import { Attributes, Measurement, ProficiencyCategories } from '../../../types/enums'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Grid from '../../Grid/Grid'

const Proficiencies = () => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Class
    updateFormData: (state: UpdateState<Class>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: equipment } = useListEquipmentQuery()

  useEffect(() => {
    if (formData?.proficiencies?.length) {
      const formClone = {
        ...formData,
      }
      formClone?.proficiencies?.forEach((proficiency, index) => {
        if (
          !proficiency?.level ||
          (proficiency?.level !== Measurement.full && proficiency?.level !== Measurement.half)
        ) {
          set(formClone, `proficiencies.${index}.level`, Measurement.full)
        }
      })
      if (!isEqual(formClone.proficiencies, formData.proficiencies)) {
        updateFormData({
          type: 'update',
          path: 'proficiencies',
          value: formClone.proficiencies,
        })
      }
    }
  }, [formData, updateFormData])

  return (
    <Grid>
      <Grid.Item>
        <Group>
          <Button
            color='primary'
            style='outline'
            onClick={() => {
              updateFormData({ type: 'add', path: 'proficiencies' })
            }}
            className={sprinkles({ mb: 'space-2' })}
          >
            Add Proficiency
          </Button>
        </Group>
      </Grid.Item>
      {formData.proficiencies && (
        <Grid.Item>
          <Accordion dataArray={formData.proficiencies} name='proficiencies' onChange={updateFormData}>
            {formData.proficiencies?.map((proficiency, index) => {
              const multipleOptions = proficiency.attributes?.some(
                (attribute) => attribute === Attributes.providesOptions
              )
              const category = system.proficiencies.categories.find((category) => category.id === proficiency.category)
              return (
                <Accordion.Wrapper key={index} itemId={String(index)}>
                  <Accordion.Header
                    handleRemove={() =>
                      updateFormData({
                        type: 'remove',
                        path: `proficiencies.${index}`,
                      })
                    }
                  >
                    {`Proficiency ${index + 1}`}
                  </Accordion.Header>
                  <Accordion.Content>
                    <Grid>
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                        <Dropdown
                          multiSelect={true}
                          name={`proficiencies.${index}.attributes`}
                          options={system.attributes.filter(
                            (attribute) =>
                              attribute?.sections?.length &&
                              (attribute?.sections?.includes(SectionEnum.all) ||
                                attribute?.sections?.includes(SectionEnum.subclasses))
                          )}
                          label='Proficiency Attribute'
                          value={proficiency.attributes}
                          onChange={updateFormData}
                        />
                      </Grid.Item>
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                        <Dropdown
                          name={`proficiencies.${index}.category`}
                          label='Proficiency Category'
                          value={proficiency.category}
                          options={system.proficiencies.categories}
                          required={true}
                          onChange={updateFormData}
                        />
                      </Grid.Item>
                      {category.id === ProficiencyCategories.saveAbilities && (
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                          <Dropdown
                            name={`proficiencies.${index}.saveAbilities`}
                            multiSelect={true}
                            label={`${category.label} Type`}
                            value={proficiency.saveAbilities}
                            options={system.abilities}
                            required={true}
                            onChange={updateFormData}
                          />
                        </Grid.Item>
                      )}
                      {(category.id === ProficiencyCategories.properties ||
                        category.id === ProficiencyCategories.equipment) && (
                        <>
                          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                            <Dropdown
                              name={`proficiencies.${index}.${category.value as 'properties' | 'equipment'}.category`}
                              label='Item Category'
                              value={proficiency[category.value as 'properties' | 'equipment']?.category}
                              options={system.equipment.categories}
                              required={true}
                              onChange={updateFormData}
                            />
                          </Grid.Item>
                          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                            <Dropdown
                              name={`proficiencies.${index}.${category.value as 'properties' | 'equipment'}.${
                                category.id === ProficiencyCategories.equipment ? 'properties' : 'ids'
                              }`}
                              multiSelect={true}
                              label='Equipment Properties'
                              value={
                                category.id === ProficiencyCategories.equipment ?
                                  proficiency.equipment?.properties
                                : proficiency.properties?.ids
                              }
                              options={system.equipment.properties.filter((property) => {
                                if (category.id === ProficiencyCategories.properties) {
                                  return system.equipment.categoryProperties.some(
                                    (bridge) =>
                                      bridge.categoryId === proficiency.properties.category &&
                                      bridge.propertyId === property.id
                                  )
                                }
                                return true
                              })}
                              onChange={updateFormData}
                              required={category.id === ProficiencyCategories.equipment ? false : true}
                            />
                          </Grid.Item>
                          {category.id === ProficiencyCategories.equipment && (
                            <>
                              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                                <Dropdown
                                  name={`proficiencies.${index}.equipment.ids`}
                                  multiSelect={true}
                                  label='Equipment'
                                  value={proficiency?.equipment?.ids}
                                  options={equipment
                                    .filter((sEquipment) => {
                                      if (proficiency?.equipment?.category != null) {
                                        return sEquipment.category === proficiency?.equipment?.category
                                      }
                                      return true
                                    })
                                    .filter((sEquipment) => {
                                      if (proficiency?.equipment?.properties?.length) {
                                        return sEquipment.properties?.some((property) =>
                                          proficiency?.equipment?.properties?.includes(property)
                                        )
                                      }
                                      return true
                                    })}
                                  onChange={updateFormData}
                                  required={true}
                                />
                              </Grid.Item>
                            </>
                          )}
                        </>
                      )}
                      {proficiency.attributes?.some((attribute) => attribute === Attributes.subtypeSpecific) && (
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                          <Dropdown
                            name={`proficiencies.${index}.subtype`}
                            label='Subtype'
                            value={proficiency?.subtype}
                            options={formData.subtypes}
                            required={true}
                            onChange={updateFormData}
                          />
                        </Grid.Item>
                      )}
                      {category.id === ProficiencyCategories.skills && (
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                          <Dropdown
                            name={`proficiencies.${index}.skills`}
                            multiSelect={true}
                            label={`${category.label} Type`}
                            value={proficiency.skills}
                            options={system.skills}
                            required={true}
                            onChange={updateFormData}
                          />
                        </Grid.Item>
                      )}
                      {multipleOptions && (
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 'auto' }}>
                          <Input
                            validation='num'
                            name={`proficiencies.${index}.selectionCount`}
                            label='# of Selections'
                            autoComplete='off'
                            value={proficiency.selectionCount}
                            errorMsg='Must contain only numbers'
                            required={true}
                            onChange={updateFormData}
                          />
                        </Grid.Item>
                      )}
                    </Grid>
                  </Accordion.Content>
                </Accordion.Wrapper>
              )
            })}
          </Accordion>
        </Grid.Item>
      )}
    </Grid>
  )
}

export default Proficiencies
