import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { DropdownOption } from '../../../../types/components'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { useListEquipmentQuery } from '../../../../features/equipment/equipmentApi'
import { Categories, ProficiencyCategories } from '../../../../types/enums'
import { Class, ClassesEnum, FeatureProficiency, SectionEnum } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Prerequisites from '../../Generic/Requirements'

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

  return (
    <>
      <Row>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={system.attributes.filter(
            (attribute) =>
              attribute.sections.includes(SectionEnum.all) &&
              formData.__typename === 'Class' &&
              formData.category === Categories.subclass &&
              attribute.classes.includes(ClassesEnum.subclass)
          )}
          label={`${startCase('proficiency')} Attributes`}
          value={sectionData?.attributes}
          onChange={updateSectionData}
        />
        <Dropdown
          name={`category`}
          label='Proficiency Category'
          value={sectionData?.category}
          options={system.proficiencies.categories}
          required={true}
          onChange={updateSectionData}
        />
        {sectionCategory.id !== null &&
          (sectionCategory.id !== ProficiencyCategories.properties &&
          sectionCategory.id !== ProficiencyCategories.equipment &&
          sectionCategory.id !== ProficiencyCategories.initiative ? (
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
          ) : (
            <>
              {(sectionData?.category === ProficiencyCategories.properties ||
                sectionData?.category !== ProficiencyCategories.equipment) && (
                <>
                  <Dropdown
                    name={`${categoryName as 'properties' | 'equipment'}.category`}
                    label='Item Category'
                    value={sectionData[categoryName as 'properties' | 'equipment']?.category}
                    options={system.equipment.categories}
                    required={true}
                    onChange={updateSectionData}
                  />
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
                  {categoryName === 'equipment' && (
                    <>
                      <Dropdown
                        name={`${categoryName}`}
                        multiSelect={true}
                        label='Equipment'
                        value={sectionData[categoryName].ids}
                        options={items as DropdownOption[]}
                        onChange={updateSectionData}
                        required={true}
                      />
                    </>
                  )}
                </>
              )}
            </>
          ))}
        {subtypeSpecific && formData.__typename === 'Class' && formData.category === Categories.subclass && (
          <Dropdown
            name='subtype'
            label='Subclass Subtypes'
            value={sectionData?.subtype}
            options={(formData as Class)?.subtypes}
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
      </Row>
      {hasPrerequisites && <Prerequisites formData={sectionData} updateFormData={updateSectionData} />}
    </>
  )
}

export default Expertise
