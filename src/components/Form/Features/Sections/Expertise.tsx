import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { use, useEffect } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { DropdownOption } from '../../../../types/components'
import { useGetSystemQuery } from '../../../../apis/systemsApi'
import { useListEquipmentQuery } from '../../../../apis/equipmentApi'
import { Categories, ProficiencyCategories } from '../../../../types/enums'
import { ClassesEnum, FeatureProficiency, SectionEnum } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Prerequisites from '../../Subforms/Requirements'
import Grid from '../../../Grid/Grid'

type CategoryType = 'skills' | 'equipment' | 'abilities' | 'saveAbilities' | 'properties' | 'languages'

const Expertise = () => {
  const { formData } = use(FormContext)
  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureProficiency
    updateSectionData: (arg: UpdateState<FeatureProficiency>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: items } = useListEquipmentQuery()

  const { subtypeSpecific, providesOptions, hasPrerequisites } = useEnumChecks({
    data: sectionData,
  })

  const sectionCategory = system.proficiencies.categories.find((category) => category.id === sectionData?.category)

  const categoryName = sectionCategory?.value as CategoryType

  useEffect(() => {
    if (sectionData.__typename == null) {
      updateSectionData({
        type: 'update',
        path: '__typename',
        value: 'FeatureExpertise',
      })
    }
  }, [updateSectionData, sectionData.__typename])

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={system.attributes.filter(
            (attribute) =>
              (attribute.sections?.length && attribute.sections.includes(SectionEnum.all)) ||
              (formData.__typename === 'Class' &&
                formData.category === Categories.subclass &&
                attribute.classes?.length &&
                attribute.classes.includes(ClassesEnum.subclass))
          )}
          label={`${startCase('proficiency')} Attributes`}
          value={sectionData?.attributes}
          onChange={updateSectionData}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          name={`category`}
          label='Proficiency Category'
          value={sectionData?.category}
          options={system.proficiencies.categories}
          required={true}
          onChange={updateSectionData}
        />
      </Grid.Item>
      {sectionCategory?.id &&
        ((
          sectionCategory.id !== ProficiencyCategories.properties &&
          sectionCategory.id !== ProficiencyCategories.equipment &&
          sectionCategory.id !== ProficiencyCategories.initiative
        ) ?
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={`${categoryName as 'skills' | 'saveAbilities' | 'languages'}`}
              multiSelect={true}
              label={`${startCase(categoryName)} Type`}
              value={sectionData[categoryName as 'skills' | 'saveAbilities' | 'languages']}
              options={
                categoryName === 'saveAbilities' ? system.abilities : system[categoryName as 'skills' | 'languages']
              }
              required={true}
              onChange={updateSectionData}
            />
          </Grid.Item>
        : <>
            {(sectionData?.category === ProficiencyCategories.properties ||
              sectionData?.category !== ProficiencyCategories.equipment) && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name={`${categoryName as 'properties' | 'equipment'}.category`}
                    label='Item Category'
                    value={sectionData[categoryName as 'properties' | 'equipment']?.category}
                    options={system.equipment.categories}
                    required={true}
                    onChange={updateSectionData}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name={`${categoryName as 'properties' | 'equipment'}.${
                      categoryName === 'equipment' ? 'properties' : 'ids'
                    }`}
                    multiSelect={true}
                    label='Item Property'
                    value={sectionData[categoryName as 'properties' | 'equipment']?.properties}
                    options={items as DropdownOption[]}
                    onChange={updateSectionData}
                    required={categoryName === 'equipment' ? false : true}
                  />
                </Grid.Item>
                {categoryName === 'equipment' && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`${categoryName}`}
                        multiSelect={true}
                        label='Equipment'
                        value={sectionData?.[categoryName]?.ids}
                        options={items as DropdownOption[]}
                        onChange={updateSectionData}
                        required={true}
                      />
                    </Grid.Item>
                  </>
                )}
              </>
            )}
          </>)}
      {subtypeSpecific &&
        formData.__typename === 'Class' &&
        formData.category === Categories.subclass &&
        formData?.subtypes?.length && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='subtype'
              label='Subclass Subtypes'
              value={sectionData?.subtype}
              options={formData?.subtypes}
              required={true}
              onChange={updateSectionData}
            />
          </Grid.Item>
        )}
      {providesOptions && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
        </Grid.Item>
      )}
      {hasPrerequisites && (
        <Grid.Item>
          <Prerequisites formData={sectionData} updateFormData={updateSectionData} />
        </Grid.Item>
      )}
    </Grid>
  )
}

export default Expertise
