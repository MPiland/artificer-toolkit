import { useGetSystemQuery } from '../../../apis/systemsApi'
import { sprinkles } from '../../../css/sprinkles.css'
import Dropdown from '../../Dropdown/Dropdown'
import Divider from '../../Divider/Divider'
import Input from '../../Input/Input'
import { DropdownOption } from '../../../types/components'
import { useListSpellsQuery } from '../../../apis/spellsApi'
import { useListEquipmentQuery } from '../../../apis/equipmentApi'
import Group from '../../Group/Group'
import Button from '../../Button/Button'
import { row_button } from '../Form.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { use, useEffect, useMemo } from 'react'
import Collapse from '../../Collapse/Collapse'
import { Character, Feat, FeatureEnum, Spell } from '../../../../amplify/gql/types'
import { FeatureDataType, FormDataType, SectionDataType, UpdateState } from '../../../types/form'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import Grid from '../../Grid/Grid'
import { FormContext } from '../FormContext'

const Prerequisites = ({
  formData,
  updateFormData,
}: {
  formData: FeatureDataType | Feat | SectionDataType
  updateFormData: (state: UpdateState<FeatureDataType | Feat | SectionDataType>) => void
}) => {
  const { data: system } = useGetSystemQuery()
  const { data: spells } = useListSpellsQuery()
  const { data: equipment } = useListEquipmentQuery()

  const { formData: data } = use(FormContext) as { formData: Exclude<FormDataType, Spell | Character> }

  const {
    hasPrerequisites,
    equipmentProficiency,
    equipped,
    notEquipped,
    spellsObtained,
    featuresObtained,
    optionsObtained,
    skillProficiency,
    abilityScore,
  } = useEnumChecks({ data: formData })

  // Add/Remove prerequisites array
  useEffect(() => {
    if (hasPrerequisites) {
      if (equipmentProficiency && !formData.prerequisites?.equipmentProficiencies?.length) {
        updateFormData({
          type: 'add',
          path: 'prerequisites.equipmentProficiencies',
        })
      }

      if (equipped && !formData.prerequisites?.equipped?.length) {
        updateFormData({
          type: 'add',
          path: 'prerequisites.equipped',
        })
      }

      if (notEquipped && !formData.prerequisites?.notEquipped?.length) {
        updateFormData({
          type: 'add',
          path: 'prerequisites.notEquipped',
        })
      }
    }
  }, [updateFormData, hasPrerequisites, equipmentProficiency, equipped, notEquipped, formData.prerequisites])

  const featuresObtainedOptions = useMemo(() => {
    const features = formData.__typename !== 'Feat' ? data?.features : formData?.features

    const mappedFeatures = features?.map((feature) => {
      if (feature.label != null && feature.value != null) {
        return {
          ...feature,
          label: feature.label,
          value: feature.value,
          id: feature.id,
        }
      }
      return null
    })

    return mappedFeatures?.filter((feature) => feature != null) || []
  }, [data, formData])

  const optionsObtainedOptions = useMemo(() => {
    const mappedOptions = formData?.prerequisites?.featuresObtained?.flatMap((feature) =>
      featuresObtainedOptions
        ?.find((sFeature) => sFeature.id === feature)
        ?.options?.map((option) => {
          if (option.label != null && option.value != null) {
            return {
              ...option,
              label: option.label,
              value: option.value,
              id: option.id,
            }
          }
          return null
        })
    )

    return mappedOptions?.filter((option) => option != null) || []
  }, [featuresObtainedOptions, formData?.prerequisites?.featuresObtained])

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title='Prerequisites' />
        <Collapse.Body>
          <Grid>
            <Grid.Item>
              <Grid>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    multiSelect={true}
                    name='prerequisites.options'
                    label='Prerequisites'
                    options={system.prerequisites.filter(
                      (prerequisite) =>
                        prerequisite?.features?.length &&
                        (prerequisite?.features?.includes(FeatureEnum.all) ||
                          (formData.__typename === 'FeatureOption' &&
                            prerequisite?.features.includes(FeatureEnum.options)))
                    )}
                    value={formData?.prerequisites?.options}
                    required={true}
                    onChange={updateFormData}
                  />
                </Grid.Item>
                {spellsObtained && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      multiSelect={true}
                      name='prerequisites.spellsObtained'
                      value={formData?.prerequisites?.spellsObtained}
                      label='Spell'
                      options={spells as DropdownOption[]}
                      onChange={updateFormData}
                    />
                  </Grid.Item>
                )}
                {featuresObtained && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      multiSelect={true}
                      name='prerequisites.featuresObtained'
                      value={formData?.prerequisites?.featuresObtained}
                      label='Feature'
                      options={featuresObtainedOptions}
                      onChange={updateFormData}
                    />
                  </Grid.Item>
                )}
                {optionsObtained &&
                  formData?.prerequisites?.optionsObtained?.some(
                    (feature) => featuresObtainedOptions?.find((sFeature) => sFeature.id === feature)?.options?.length
                  ) && (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name='prerequisites.optionsObtained'
                        value={formData?.prerequisites?.optionsObtained}
                        label='Feature Option'
                        options={optionsObtainedOptions}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                  )}
                {skillProficiency && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      multiSelect={true}
                      name='prerequisites.skillProficiencies'
                      label='Skill Proficiency'
                      value={formData?.prerequisites?.skillProficiencies}
                      options={system.skills}
                      onChange={updateFormData}
                    />
                  </Grid.Item>
                )}
                {abilityScore && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name='prerequisites.abilityScore.abilities'
                        value={formData?.prerequisites?.abilityScore?.abilities}
                        label='Ability'
                        options={system.abilities}
                        required={true}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name='prerequisites.abilityScore.score'
                        value={formData?.prerequisites?.abilityScore?.score}
                        label='Score'
                        required={true}
                        validation='num'
                        errorMsg='Must contain only numbers'
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                  </>
                )}
              </Grid>
            </Grid.Item>
            {equipmentProficiency && (
              <Grid.Item>
                <Divider label='Equipment Proficiency' />
                {formData?.prerequisites?.equipmentProficiencies?.map((equipmentProficieny, index) => (
                  <Grid key={index}>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`prerequisites.equipmentProficiencies.${index}.category`}
                        value={equipmentProficieny.category}
                        label='Equipment Category'
                        options={system.equipment.categories.filter((sCategory) => {
                          if (equipmentProficieny?.properties?.length) {
                            return system.equipment.categoryProperties.some(
                              (bridge) =>
                                bridge.categoryId === sCategory.id &&
                                equipmentProficieny?.properties?.includes(bridge.propertyId)
                            )
                          }
                          return true
                        })}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.equipmentProficiencies.${index}.properties`}
                        value={equipmentProficieny.properties}
                        label='Equipment Property'
                        options={system.equipment.properties.filter((property) => {
                          if (equipmentProficieny?.category != null) {
                            return system.equipment.categoryProperties.some(
                              (bridge) =>
                                bridge.categoryId === equipmentProficieny.category && bridge.propertyId === property.id
                            )
                          }
                          return true
                        })}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.equipmentProficiencies.${index}.equipment`}
                        label='Equipment'
                        value={equipmentProficieny?.equipment}
                        options={equipment
                          .filter((sEquipment) => {
                            if (equipmentProficieny?.category != null) {
                              return sEquipment.category === equipmentProficieny?.category
                            }
                            return true
                          })
                          .filter((sEquipment) => {
                            if (equipmentProficieny?.properties?.length) {
                              return sEquipment.properties?.some((property) =>
                                equipmentProficieny?.properties?.includes(property)
                              )
                            }
                            return true
                          })}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }} className={sprinkles({ alignContent: 'center' })}>
                      <Group
                        className={sprinkles({ height: 'size-full' })}
                        alignItemsVariant='center'
                        justifyContentVariant='start'
                      >
                        <Button
                          style='unstyled'
                          className={row_button}
                          onClick={() =>
                            updateFormData({
                              type: 'add',
                              path: `prerequisites.equipmentProficiencies`,
                            })
                          }
                        >
                          <TbPlus />
                        </Button>
                        {index !== 0 && (
                          <Button
                            style='unstyled'
                            className={row_button}
                            onClick={() => {
                              updateFormData({
                                type: 'remove',
                                path: `prerequisites.equipmentProficiencies.${index}`,
                              })
                            }}
                          >
                            <TbX />
                          </Button>
                        )}
                      </Group>
                    </Grid.Item>
                  </Grid>
                ))}
              </Grid.Item>
            )}
            {equipped && (
              <Grid.Item>
                <Divider label='Equipped' />
                {formData?.prerequisites?.equipped?.map((equipPrerequisite, index) => (
                  <Grid key={index}>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`prerequisites.equipped.${index}.category`}
                        value={equipPrerequisite.category}
                        label='Equipment Category'
                        options={system.equipment.categories.filter((sCategory) => {
                          if (equipPrerequisite?.properties?.length) {
                            return system.equipment.categoryProperties.some(
                              (bridge) =>
                                bridge.categoryId === sCategory.id &&
                                equipPrerequisite?.properties?.includes(bridge.propertyId)
                            )
                          }
                          return true
                        })}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.equipped.${index}.properties`}
                        value={equipPrerequisite.properties}
                        label='Equipment Property'
                        options={system.equipment.properties.filter((property) => {
                          if (equipPrerequisite?.category != null) {
                            return system.equipment.categoryProperties.some(
                              (bridge) =>
                                bridge.categoryId === equipPrerequisite.category && bridge.propertyId === property.id
                            )
                          }
                          return true
                        })}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.equipped.${index}.equipment`}
                        label='Equipment'
                        value={equipPrerequisite.equipment}
                        options={equipment
                          .filter((sEquipment) => {
                            if (equipPrerequisite?.category != null) {
                              return sEquipment.category === equipPrerequisite?.category
                            }
                            return true
                          })
                          .filter((sEquipment) => {
                            if (equipPrerequisite?.properties?.length) {
                              return sEquipment.properties?.some((property) =>
                                equipPrerequisite?.properties?.includes(property)
                              )
                            }
                            return true
                          })}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name={`prerequisites.equipped.${index}.numberEquipped`}
                        label='Number Equipped'
                        value={equipPrerequisite.numberEquipped}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }} className={sprinkles({ alignContent: 'center' })}>
                      <Group
                        className={sprinkles({ height: 'size-full' })}
                        alignItemsVariant='center'
                        justifyContentVariant='start'
                      >
                        <Button
                          style='unstyled'
                          className={row_button}
                          onClick={() =>
                            updateFormData({
                              type: 'add',
                              path: `prerequisites.equipped`,
                            })
                          }
                        >
                          <TbPlus />
                        </Button>
                        {index !== 0 && (
                          <Button
                            style='unstyled'
                            className={row_button}
                            onClick={() => {
                              updateFormData({
                                type: 'remove',
                                path: `prerequisites.equipped.${index}`,
                              })
                            }}
                          >
                            <TbX />
                          </Button>
                        )}
                      </Group>
                    </Grid.Item>
                  </Grid>
                ))}
              </Grid.Item>
            )}
            {notEquipped && (
              <Grid.Item>
                <Divider label={'Not Equipped'} />
                {formData?.prerequisites?.notEquipped?.map((notEquipPrerequisite, index) => (
                  <Grid key={index}>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`prerequisites.notEquipped.${index}.category`}
                        value={notEquipPrerequisite.category}
                        label='Equipment Category'
                        options={system.equipment.categories.filter((sCategory) => {
                          if (notEquipPrerequisite?.properties?.length) {
                            return system.equipment.categoryProperties.some(
                              (bridge) =>
                                bridge.categoryId === sCategory.id &&
                                notEquipPrerequisite?.properties?.includes(bridge.propertyId)
                            )
                          }
                          return true
                        })}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.notEquipped.${index}.properties`}
                        value={notEquipPrerequisite.properties}
                        label='Equipment Property'
                        options={system.equipment.properties.filter((property) => {
                          if (notEquipPrerequisite?.category != null) {
                            return system.equipment.categoryProperties.some(
                              (bridge) =>
                                bridge.categoryId === notEquipPrerequisite.category && bridge.propertyId === property.id
                            )
                          }
                          return true
                        })}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.notEquipped.${index}.equipment`}
                        label='Equipment'
                        value={notEquipPrerequisite.equipment}
                        options={equipment
                          .filter((sEquipment) => {
                            if (notEquipPrerequisite?.category != null) {
                              return sEquipment.category === notEquipPrerequisite?.category
                            }
                            return true
                          })
                          .filter((sEquipment) => {
                            if (notEquipPrerequisite?.properties?.length) {
                              return sEquipment.properties?.some((property) =>
                                notEquipPrerequisite?.properties?.includes(property)
                              )
                            }
                            return true
                          })}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }} className={sprinkles({ alignContent: 'center' })}>
                      <Group
                        className={sprinkles({ height: 'size-full' })}
                        alignItemsVariant='center'
                        justifyContentVariant='start'
                      >
                        <Button
                          style='unstyled'
                          className={row_button}
                          onClick={() =>
                            updateFormData({
                              type: 'add',
                              path: `prerequisites.notEquipped`,
                            })
                          }
                        >
                          <TbPlus />
                        </Button>
                        {index !== 0 && (
                          <Button
                            style='unstyled'
                            className={row_button}
                            onClick={() => {
                              updateFormData({
                                type: 'remove',
                                path: `prerequisites.notEquipped.${index}`,
                              })
                            }}
                          >
                            <TbX />
                          </Button>
                        )}
                      </Group>
                    </Grid.Item>
                  </Grid>
                ))}
              </Grid.Item>
            )}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}

export default Prerequisites
