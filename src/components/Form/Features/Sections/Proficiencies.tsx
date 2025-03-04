import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { useListEquipmentQuery } from '../../../../features/equipment/equipmentApi'
import { FeatureContext } from '../FeatureContext'
import { Class, FeatureProficiency, SectionEnum } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import { Categories, ProficiencyCategories, ProficiencyLevels } from '../../../../types/enums'
import { getKeyFromId } from '../../../../utils/form'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Prerequisites from '../../Subforms/Requirements'
import Grid from '../../../Grid/Grid'

const Proficiencies = () => {
  const { formData } = use(FormContext)

  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureProficiency
    updateSectionData: (arg: UpdateState<FeatureProficiency>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: equipment } = useListEquipmentQuery()

  const { subtypeSpecific, providesOptions, hasPrerequisites } = useEnumChecks({
    data: sectionData,
  })

  const sectionCategory = system.modifiers.categories.find((category) => category.id === sectionData?.category)

  const path = getKeyFromId(sectionData?.category, ProficiencyCategories)

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={system.attributes.filter(
            (attribute) =>
              (attribute?.sections?.length > 0 && attribute?.sections?.includes(SectionEnum.all)) ||
              ((formData as Class).category === Categories.subclass &&
                attribute?.sections?.includes(SectionEnum.subclasses))
          )}
          label={`${startCase('proficiency')} Attributes`}
          value={sectionData?.attributes}
          onChange={updateSectionData}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          name='category'
          label='Proficiency Category'
          value={sectionData?.category}
          options={system.proficiencies.categories}
          required={true}
          onChange={updateSectionData}
        />
      </Grid.Item>
      {sectionCategory != null &&
        (path !== 'equipment' && path !== 'properties' && path !== 'initiative' ? (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={`${path as Exclude<typeof path, 'equipment' | 'properties' | 'initiative'>}`}
              multiSelect={true}
              label={`${sectionCategory.label} Type`}
              value={sectionData[path as Exclude<typeof path, 'equipment' | 'properties' | 'initiative'>]}
              options={
                path === 'saveAbilities'
                  ? system.abilities
                  : system[path as Exclude<typeof path, 'equipment' | 'properties' | 'initiative'>]
              }
              required={true}
              onChange={updateSectionData}
            />
          </Grid.Item>
        ) : (
          <>
            {(sectionCategory.id === ProficiencyCategories.properties ||
              sectionCategory.id === ProficiencyCategories.equipment) && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name={`${path as 'properties' | 'equipment'}.category`}
                    label='Item Category'
                    value={sectionData[path as 'properties' | 'equipment']?.category}
                    options={system.equipment.categories}
                    required={true}
                    onChange={updateSectionData}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name={`${path as 'properties' | 'equipment'}.${
                      sectionCategory.id === ProficiencyCategories.equipment ? 'properties' : 'ids'
                    }`}
                    multiSelect={true}
                    label='Item Property'
                    value={
                      sectionData[path as 'properties' | 'equipment']?.[
                        sectionCategory.id === ProficiencyCategories.equipment ? 'properties' : 'ids'
                      ]
                    }
                    options={equipment}
                    onChange={updateSectionData}
                    required={sectionCategory.id === ProficiencyCategories.equipment ? false : true}
                  />
                </Grid.Item>
                {sectionCategory.id === ProficiencyCategories.equipment && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name={`${path as 'equipment'}.ids`}
                      multiSelect={true}
                      label='Item'
                      value={sectionData?.equipment?.ids}
                      options={equipment}
                      onChange={updateSectionData}
                      required={true}
                    />
                  </Grid.Item>
                )}
              </>
            )}
          </>
        ))}
      <Dropdown
        name='level'
        label='Proficiency Level'
        value={sectionData?.level}
        options={system.proficiencies.levels}
        required={true}
        onChange={updateSectionData}
      />
      {sectionData?.level === ProficiencyLevels.halfProficiency && (
        <Dropdown
          name='rounding'
          label='Rounding Type'
          value={sectionData?.rounding}
          options={system.rules.measurements.rounding}
          required={true}
          onChange={updateSectionData}
        />
      )}
      {subtypeSpecific && formData.__typename === 'Class' && sectionCategory != null && (
        <Dropdown
          name='subtype'
          label='Subclass Subtype'
          value={sectionData?.subtype}
          options={formData?.subtypes}
          required={true}
          onChange={updateSectionData}
        />
      )}
      {providesOptions && (
        <Input
          validation='num'
          name={`selectionCount`}
          label='# of Selections'
          autoComplete='off'
          value={sectionData?.selectionCount}
          errorMsg='Must contain only numbers'
          required={true}
          onChange={updateSectionData}
        />
      )}
      {hasPrerequisites && (
        <Grid.Item>
          <Prerequisites formData={sectionData} updateFormData={updateSectionData} />
        </Grid.Item>
      )}
    </Grid>
  )
}

export default Proficiencies
