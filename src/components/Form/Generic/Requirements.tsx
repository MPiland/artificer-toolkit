import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { sprinkles } from '../../../css/sprinkles.css'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Divider from '../../Divider/Divider'
import Input from '../../Input/Input'
import { DropdownOption } from '../../../types/components'
import { useListSpellsQuery } from '../../../features/spells/spellsApi'
import { useListEquipmentQuery } from '../../../features/equipment/equipmentApi'
import Group from '../../Group/Group'
import Button from '../../Button/Button'
import { form_add_button, equipment_sub_group_button, form_remove_button } from '../Form.css'
import clsx from 'clsx'
import { TbPlus, TbX } from 'react-icons/tb'
import { use, useEffect } from 'react'
import Collapse from '../../Collapse/Collapse'
import { Character, Feat, FeatureEnum, Spell } from '../../../../amplify/API'
import { Attributes, Prerequisites as PrerequisitesEnum } from '../../../types/enums'
import { FeatureDataType, FormDataType, UpdateState } from '../../../types/form'
import { FeatureContext } from '../Features/FeatureContext'

const Prerequisites = ({
  formData,
  updateFormData,
}: {
  formData: FeatureDataType | Feat
  updateFormData: (state: UpdateState<FormDataType | FeatureDataType>) => void
}) => {
  const { featureStep } = use(FeatureContext)

  const { data: system } = useGetSystemQuery()
  const { data: spells } = useListSpellsQuery()
  const { data: equipment } = useListEquipmentQuery()

  // Add/Remove prerequisites array
  useEffect(() => {
    if (formData.attributes?.some((attribute: any) => attribute === Attributes.prerequisites)) {
      if (
        formData.prerequisites?.options?.some((option) => option === PrerequisitesEnum.equipmentProficiency) &&
        !(formData.prerequisites?.equipmentProficiencies?.length > 0)
      ) {
        updateFormData({
          type: 'add',
          path: 'prerequisites.equipmentProficiencies',
        })
      }

      if (
        formData.prerequisites?.options?.some((option) => option === PrerequisitesEnum.equipped) &&
        !(formData.prerequisites?.equipped?.length > 0)
      ) {
        updateFormData({
          type: 'add',
          path: 'prerequisites.equipped',
        })
      }

      if (
        formData.prerequisites?.options?.some((option) => option === PrerequisitesEnum.notEquipped) &&
        !(formData.prerequisites?.notEquipped?.length > 0)
      ) {
        updateFormData({
          type: 'add',
          path: 'prerequisites.notEquipped',
        })
      }
    }
  }, [formData?.attributes, updateFormData, formData.prerequisites])

  return (
    formData?.attributes?.some((attribute: any) => attribute === Attributes.prerequisites) && (
      <Collapse>
        <Collapse.Header title='Prerequisites' />
        <Collapse.Body>
          <Row className={sprinkles({ mb: 'space-3' })}>
            <Dropdown<typeof formData>
              multiSelect={true}
              name='prerequisites.options'
              label='Requirement'
              options={system.prerequisites.filter(
                (prerequisite) =>
                  prerequisite?.features.includes(FeatureEnum.all) &&
                  (featureStep === 'option' ? prerequisite?.features.includes(FeatureEnum.options) : true)
              )}
              value={formData?.prerequisites?.options}
              required={true}
              onChange={updateFormData}
            />
            {formData?.prerequisites?.options?.some(
              (prerequisite) => prerequisite === PrerequisitesEnum.spellsKnown
            ) && (
              <Dropdown<typeof formData>
                multiSelect={true}
                name='prerequisites.spellsKnown'
                value={formData?.prerequisites.spellsKnown}
                label='Spell'
                options={spells as DropdownOption[]}
                onChange={updateFormData}
              />
            )}
            {formData?.prerequisites?.options?.some(
              (prerequisite) => prerequisite === PrerequisitesEnum.featuresKnown
            ) && (
              <>
                <Dropdown<typeof formData>
                  multiSelect={true}
                  name='prerequisites.featuresKnown'
                  value={formData?.prerequisites?.featuresKnown}
                  label='Feature'
                  options={(formData as Exclude<FormDataType, Spell | Character>).features.map((feature) => ({
                    label: feature.label,
                    value: feature.value,
                    id: feature.id,
                  }))}
                  onChange={updateFormData}
                />
                {formData?.prerequisites?.featuresKnown?.some(
                  (feature: any) =>
                    (formData as Exclude<FormDataType, Spell | Character>).features.find(
                      (sFeature) => sFeature.id === feature
                    ).options?.length > 0
                ) && (
                  <Dropdown<typeof formData>
                    multiSelect={true}
                    name='prerequisites.optionsKnown'
                    value={formData?.prerequisites?.optionsKnown}
                    label='Feature Option'
                    options={formData?.prerequisites?.featuresKnown?.flatMap((feature: any) =>
                      (formData as Exclude<FormDataType, Spell | Character>).features
                        .find((sFeature) => sFeature.id === feature)
                        .options.map((option) => ({
                          label: option.label,
                          value: option.value,
                          id: option.id,
                        }))
                    )}
                    onChange={updateFormData}
                  />
                )}
              </>
            )}
            {formData?.prerequisites?.options?.some((option) => option === PrerequisitesEnum.skillProficiency) && (
              <Dropdown<typeof formData>
                multiSelect={true}
                name='prerequisites.skillProficiencies'
                label='Skill Proficiency'
                value={formData?.prerequisites?.skillProficiencies}
                options={system.skills}
                onChange={updateFormData}
              />
            )}
            {formData?.prerequisites?.options?.some((option) => option === PrerequisitesEnum.abilityScore) && (
              <>
                <Dropdown<typeof formData>
                  multiSelect={true}
                  name='prerequisites.abilityScore.abilities'
                  value={formData?.prerequisites?.abilityScore?.abilities}
                  label='Ability'
                  options={system.abilities}
                  required={true}
                  onChange={updateFormData}
                />
                <Input<typeof formData>
                  name='prerequisites.abilityScore.score'
                  value={formData?.prerequisites?.abilityScore?.score}
                  label='Score'
                  required={true}
                  validation='num'
                  errorMsg='Must contain only numbers'
                  onChange={updateFormData}
                />
              </>
            )}
          </Row>
          {formData?.prerequisites?.options?.some((option) => option === PrerequisitesEnum.equipmentProficiency) && (
            <>
              <Divider label='Item Proficiency' />
              {formData?.prerequisites?.equipmentProficiencies?.map((equipmentProficieny, index) => (
                <Row className={sprinkles({ mb: 'space-3' })} key={index}>
                  <Dropdown<typeof formData>
                    name={`prerequisites.equipmentProficiencies.${index}.category`}
                    value={equipmentProficieny.category}
                    label='Item Category'
                    options={system.equipment.categories}
                    onChange={updateFormData}
                  />
                  <Dropdown<typeof formData>
                    multiSelect={true}
                    name={`prerequisites.equipmentProficiencies.${index}.properties`}
                    value={equipmentProficieny.properties}
                    label='Item Property'
                    options={equipment.map((equipment) => {
                      return {
                        label: equipment.label,
                        value: equipment.value,
                        id: equipment.id,
                      }
                    })}
                    filters={[
                      {
                        key: 'category',
                        dataObject: equipmentProficieny,
                        type: 'equal',
                        mapKey: 'properties',
                      },
                    ]}
                    onChange={updateFormData}
                  />
                  <Dropdown<typeof formData>
                    multiSelect={true}
                    name={`prerequisites.equipmentProficiencies.${index}.equipment`}
                    label='Item type'
                    value={equipmentProficieny?.equipment}
                    options={equipment.map((equipment) => {
                      return {
                        label: equipment.label,
                        value: equipment.value,
                        id: equipment.id,
                      }
                    })}
                    filters={[
                      {
                        key: 'category.id',
                        dataObject: equipmentProficieny,
                        type: 'equal',
                      },
                      {
                        key: 'properties',
                        dataObject: equipmentProficieny,
                        type: 'equal',
                      },
                    ]}
                    onChange={updateFormData}
                  />
                  <Group
                    className={sprinkles({ height: 'size-full' })}
                    alignItemsVariant='center'
                    justifyContentVariant='start'
                  >
                    <Button
                      style='unstyled'
                      className={clsx(form_add_button, equipment_sub_group_button)}
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
                        className={clsx(form_remove_button, equipment_sub_group_button)}
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
                </Row>
              ))}
            </>
          )}
          {formData?.prerequisites?.options?.some((option) => option === PrerequisitesEnum.equipped) && (
            <>
              <Divider label='Equipped' />
              {formData?.prerequisites?.equipped?.map((equipPrerequisite, index) => (
                <Row className={sprinkles({ mb: 'space-3' })} key={index}>
                  <Dropdown<typeof formData>
                    name={`prerequisites.equipped.${index}.category`}
                    value={equipPrerequisite.category}
                    label='Item Category'
                    options={system.equipment.categories}
                    onChange={updateFormData}
                  />
                  <Dropdown<typeof formData>
                    multiSelect={true}
                    name={`prerequisites.equipped.${index}.properties`}
                    value={equipPrerequisite.properties}
                    label='Item Property'
                    options={equipment.map((equipment) => {
                      return {
                        label: equipment.label,
                        value: equipment.value,
                        id: equipment.id,
                      }
                    })}
                    filters={[
                      {
                        key: 'category',
                        dataObject: equipPrerequisite,
                        type: 'equal',
                        mapKey: 'properties',
                      },
                    ]}
                    onChange={updateFormData}
                  />
                  <Dropdown<typeof formData>
                    multiSelect={true}
                    name={`prerequisites.equipped.${index}.equipment`}
                    label='Item type'
                    value={equipPrerequisite.equipment}
                    options={equipment.map((equipment) => {
                      return {
                        label: equipment.label,
                        value: equipment.value,
                        id: equipment.id,
                      }
                    })}
                    filters={[
                      {
                        key: 'category',
                        dataObject: equipPrerequisite,
                        type: 'equal',
                      },
                      {
                        key: 'property',
                        dataObject: equipPrerequisite,
                        type: 'equal',
                      },
                    ]}
                    onChange={updateFormData}
                  />
                  <Input<typeof formData>
                    name={`prerequisites.equipped.${index}.numberEquipped`}
                    label='Number Equipped'
                    value={equipPrerequisite.numberEquipped}
                    onChange={updateFormData}
                  />
                  <Group
                    className={sprinkles({ height: 'size-full' })}
                    alignItemsVariant='center'
                    justifyContentVariant='start'
                  >
                    <Button
                      style='unstyled'
                      className={clsx(form_add_button, equipment_sub_group_button)}
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
                        className={clsx(form_remove_button, equipment_sub_group_button)}
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
                </Row>
              ))}
            </>
          )}
          {formData?.prerequisites?.options?.some((option) => option === PrerequisitesEnum.notEquipped) && (
            <>
              <Divider label={'Not Equipped'} />
              {formData?.prerequisites?.notEquipped?.map((equipPrerequisite, index) => (
                <Row className={sprinkles({ mb: 'space-3' })} key={index}>
                  <Dropdown<typeof formData>
                    name={`prerequisites.notEquipped.${index}.category`}
                    value={equipPrerequisite.category}
                    label='Item Category'
                    options={system.equipment.categories}
                    onChange={updateFormData}
                  />
                  <Dropdown<typeof formData>
                    multiSelect={true}
                    name={`prerequisites.notEquipped.${index}.properties`}
                    value={equipPrerequisite.properties}
                    label='Item Property'
                    options={equipment.map((equipment) => {
                      return {
                        label: equipment.label,
                        value: equipment.value,
                        id: equipment.id,
                      }
                    })}
                    filters={[
                      {
                        key: 'category',
                        dataObject: equipPrerequisite,
                        type: 'equal',
                        mapKey: 'properties',
                      },
                    ]}
                    onChange={updateFormData}
                  />
                  <Dropdown<typeof formData>
                    multiSelect={true}
                    name={`prerequisites.notEquipped.${index}.equipment`}
                    label='Item type'
                    value={equipPrerequisite.equipment}
                    options={equipment.map((equipment) => {
                      return {
                        label: equipment.label,
                        value: equipment.value,
                        id: equipment.id,
                      }
                    })}
                    filters={[
                      {
                        key: 'category.id',
                        dataObject: equipPrerequisite,
                        type: 'equal',
                      },
                      {
                        key: 'properties',
                        dataObject: equipPrerequisite,
                        type: 'equal',
                      },
                    ]}
                    onChange={updateFormData}
                  />
                  <Group
                    className={sprinkles({ height: 'size-full' })}
                    alignItemsVariant='center'
                    justifyContentVariant='start'
                  >
                    <Button
                      style='unstyled'
                      className={clsx(form_add_button, equipment_sub_group_button)}
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
                        className={clsx(form_remove_button, equipment_sub_group_button)}
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
                </Row>
              ))}
            </>
          )}
        </Collapse.Body>
      </Collapse>
    )
  )
}

export default Prerequisites
