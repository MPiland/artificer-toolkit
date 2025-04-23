import { sprinkles } from '../../../css/sprinkles.css'
import Dropdown from '../../Dropdown/Dropdown'
import Divider from '../../Divider/Divider'
import Input from '../../Input/Input'
import { DropdownOption } from '../../../types/components'
import Group from '../../Group/Group'
import Button from '../../Button/Button'
import { row_button } from '../Form.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { use, useEffect, useMemo } from 'react'
import Collapse from '../../Collapse/Collapse'
import { type Character, type Feat, FeatureEnum, type Spell } from '../../../../amplify/gql/types'
import type { FormDataType, FeatureDataType, SectionDataType, OnChange } from '../../../types/types'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import Grid from '../../Grid/Grid'
import { FormContext } from '../FormContext'
import useSystemData from '../../../hooks/useSystemData'
import useSpellData from '../../../hooks/useSpellData'
import useEquipmentData from '../../../hooks/useEquipmentData'
import type { FormStore } from '../../../store/formStore'

const Prerequisites = ({
  formStore: { data, updateField, addField, removeField },
}: {
  formStore: {
    data: Feat | FeatureDataType | SectionDataType
    updateField: OnChange<Feat | FeatureDataType | SectionDataType>['updateField']
    addField: OnChange<Feat | FeatureDataType | SectionDataType>['addField']
    removeField: OnChange<Feat | FeatureDataType | SectionDataType>['removeField']
  }
}) => {
  const {
    abilities,
    prerequisites,
    skills,
    equipment: { categories: equipmentCategories, properties: equipmentProperties },
  } = useSystemData()
  const { spells } = useSpellData()
  const { equipment } = useEquipmentData()

  const {
    formStore: { data: stateData },
  } = use(FormContext) as { formStore: FormStore<Exclude<FormDataType, Spell | Character>> }

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
  } = useEnumChecks({ data })

  // Add/Remove prerequisites array
  useEffect(() => {
    if (hasPrerequisites) {
      if (equipmentProficiency && !data.prerequisites?.equipmentProficiencies?.length) {
        addField({
          path: 'prerequisites.equipmentProficiencies',
        })
      }

      if (equipped && !data.prerequisites?.equipped?.length) {
        addField({
          path: 'prerequisites.equipped',
        })
      }

      if (notEquipped && !data.prerequisites?.notEquipped?.length) {
        addField({
          path: 'prerequisites.notEquipped',
        })
      }
    }
  }, [addField, hasPrerequisites, equipmentProficiency, equipped, notEquipped, data.prerequisites])

  const featuresObtainedOptions = useMemo(() => {
    const features = data.__typename !== 'Feat' ? stateData?.features : data?.features

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
  }, [stateData, data])

  const optionsObtainedOptions = useMemo(() => {
    const mappedOptions = data?.prerequisites?.featuresObtained?.flatMap((feature) =>
      featuresObtainedOptions
        .filter(Boolean)
        ?.find((sFeature) => sFeature?.id === feature)
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
  }, [featuresObtainedOptions, data?.prerequisites?.featuresObtained])

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
                    options={prerequisites.filter(
                      (prerequisite) =>
                        prerequisite?.features?.length &&
                        (prerequisite?.features?.includes(FeatureEnum.all) ||
                          (data.__typename === 'FeatureOption' && prerequisite?.features.includes(FeatureEnum.options)))
                    )}
                    value={data?.prerequisites?.options}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
                {spellsObtained && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      multiSelect={true}
                      name='prerequisites.spellsObtained'
                      value={data?.prerequisites?.spellsObtained}
                      label='Spell'
                      options={spells as DropdownOption[]}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                )}
                {featuresObtained && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      multiSelect={true}
                      name='prerequisites.featuresObtained'
                      value={data?.prerequisites?.featuresObtained}
                      label='Feature'
                      options={featuresObtainedOptions}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                )}
                {optionsObtained &&
                  data?.prerequisites?.optionsObtained?.some(
                    (feature) =>
                      featuresObtainedOptions.filter(Boolean)?.find((sFeature) => sFeature?.id === feature)?.options
                        ?.length
                  ) && (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name='prerequisites.optionsObtained'
                        value={data?.prerequisites?.optionsObtained}
                        label='Feature Option'
                        options={optionsObtainedOptions.filter(Boolean)}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                  )}
                {skillProficiency && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      multiSelect={true}
                      name='prerequisites.skillProficiencies'
                      label='Skill Proficiency'
                      value={data?.prerequisites?.skillProficiencies}
                      options={skills}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                )}
                {abilityScore && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name='prerequisites.abilityScore.abilities'
                        value={data?.prerequisites?.abilityScore?.abilities}
                        label='Ability'
                        options={abilities}
                        required={true}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name='prerequisites.abilityScore.score'
                        value={data?.prerequisites?.abilityScore?.score}
                        label='Score'
                        required={true}
                        validation='num'
                        errorMsg='Must contain only numbers'
                        onChange={{ updateField }}
                      />
                    </Grid.Item>
                  </>
                )}
              </Grid>
            </Grid.Item>
            {equipmentProficiency && (
              <Grid.Item>
                <Divider label='Equipment Proficiency' />
                {data?.prerequisites?.equipmentProficiencies?.map((equipmentProficieny, index) => (
                  <Grid key={index}>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`prerequisites.equipmentProficiencies.${index}.category`}
                        value={equipmentProficieny.category}
                        label='Equipment Category'
                        options={equipmentCategories.filterByProperties(equipmentProficieny?.properties)}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.equipmentProficiencies.${index}.properties`}
                        value={equipmentProficieny.properties}
                        label='Equipment Property'
                        options={equipmentProperties.filterByCategory(equipmentProficieny?.category)}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.equipmentProficiencies.${index}.equipment`}
                        label='Equipment'
                        value={equipmentProficieny?.equipment}
                        options={equipment
                          .filterByCategory(equipmentProficieny?.category)
                          .filterByProperties(equipmentProficieny?.properties)}
                        onChange={{ updateField, removeField }}
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
                            addField({
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
                              removeField({
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
                {data?.prerequisites?.equipped?.map((equipPrerequisite, index) => (
                  <Grid key={index}>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`prerequisites.equipped.${index}.category`}
                        value={equipPrerequisite.category}
                        label='Equipment Category'
                        options={equipmentCategories.filterByProperties(equipPrerequisite?.properties)}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.equipped.${index}.properties`}
                        value={equipPrerequisite.properties}
                        label='Equipment Property'
                        options={equipmentProperties.filterByCategory(equipPrerequisite?.category)}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.equipped.${index}.equipment`}
                        label='Equipment'
                        value={equipPrerequisite.equipment}
                        options={equipment
                          .filterByCategory(equipPrerequisite?.category)
                          .filterByProperties(equipPrerequisite?.properties)}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name={`prerequisites.equipped.${index}.numberEquipped`}
                        label='Number Equipped'
                        value={equipPrerequisite.numberEquipped}
                        onChange={{ updateField }}
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
                            addField({
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
                              removeField({
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
                {data?.prerequisites?.notEquipped?.map((notEquipPrerequisite, index) => (
                  <Grid key={index}>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`prerequisites.notEquipped.${index}.category`}
                        value={notEquipPrerequisite.category}
                        label='Equipment Category'
                        options={equipmentCategories.filterByProperties(notEquipPrerequisite?.properties)}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.notEquipped.${index}.properties`}
                        value={notEquipPrerequisite.properties}
                        label='Equipment Property'
                        options={equipmentProperties.filterByCategory(notEquipPrerequisite?.category)}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        multiSelect={true}
                        name={`prerequisites.notEquipped.${index}.equipment`}
                        label='Equipment'
                        value={notEquipPrerequisite.equipment}
                        options={equipment
                          .filterByCategory(notEquipPrerequisite?.category)
                          .filterByProperties(notEquipPrerequisite?.properties)}
                        onChange={{ updateField, removeField }}
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
                            addField({
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
                              removeField({
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
