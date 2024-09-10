import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { useForm } from '../../../../hooks/UseForm'
import { DropdownOptionType } from '../../../../utils/types'
import { useFeature } from '../../../../hooks/UseFeature'
import { useGetSystemsQuery } from '../../../../features/systems/systemsApi'
import { useGetEquipmentQuery } from '../../../../features/equipment/equipmentApi'

const Proficiencies = () => {
  const { formState } = useForm()
  const { sectionState, setSectionState } = useFeature()

  const { data: builders } = useGetSystemsQuery()
  const { data: items } = useGetEquipmentQuery() as { data: any[] }

  const providesOptions = sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'providesOptions')

  const categoryName: 'skill' | 'saveAbility' | 'properties' | 'item' | 'language' | 'initiative' =
    sectionState?.category?.name

  return (
    <Row>
      <Dropdown
        multiSelect={true}
        name={'attribute'}
        options={[].concat(
          builders.section.attribute,
          formState.category?.name === 'subclass' && builders.section.subclass.attribute
        )}
        label={`${startCase('proficiency')} Attributes`}
        value={sectionState.attribute}
        onChange={setSectionState}
      />
      <Dropdown
        name={`category`}
        label='Proficiency Category'
        value={sectionState.category}
        options={builders.proficiencies.category}
        required={true}
        onChange={setSectionState}
      />
      {categoryName != null &&
        (categoryName !== 'properties' && categoryName !== 'item' && categoryName !== 'initiative' ? (
          <Dropdown
            name={`${categoryName}.type`}
            multiSelect={true}
            label={`${startCase(sectionState.category.value)} Type`}
            value={sectionState[categoryName]?.type}
            options={categoryName === 'saveAbility' ? builders.abilities.type : builders[categoryName]?.type}
            required={true}
            onChange={setSectionState}
          />
        ) : (
          <>
            {(categoryName === 'properties' || categoryName === 'item') && (
              <>
                <Dropdown
                  name={`${categoryName}.category`}
                  label='Item Category'
                  value={sectionState[categoryName]?.category}
                  options={builders.items.category}
                  required={true}
                  onChange={setSectionState}
                />
                <Dropdown
                  name={`${categoryName}.${categoryName === 'item' ? 'properties.type' : 'type'}`}
                  multiSelect={true}
                  label='Item Property'
                  value={sectionState[categoryName]?.[categoryName === 'item' ? 'properties.type' : 'type']}
                  options={items as DropdownOptionType[]}
                  filter={[
                    {
                      key: 'category._id',
                      object: sectionState[categoryName],
                      mapKey: 'properties.type',
                      type: 'equal',
                    },
                  ]}
                  onChange={setSectionState}
                  required={categoryName === 'item' ? false : true}
                />
                {categoryName === 'item' && (
                  <>
                    <Dropdown
                      name={`${categoryName}.type`}
                      multiSelect={true}
                      label='Item'
                      value={sectionState[categoryName]?.type}
                      options={items as DropdownOptionType[]}
                      filter={[
                        {
                          key: 'category._id',
                          object: sectionState[categoryName],
                          type: 'equal',
                        },
                        {
                          key: 'properties.type',
                          object: sectionState[categoryName],
                          type: 'equal',
                        },
                      ]}
                      onChange={setSectionState}
                      required={true}
                    />
                  </>
                )}
              </>
            )}
          </>
        ))}
      <Dropdown
        name={`${categoryName}.level`}
        label='Proficiency Level'
        value={sectionState[categoryName]?.level}
        options={builders.proficiencies.level}
        required={true}
        onChange={setSectionState}
      />
      {sectionState[categoryName]?.level?.name === 'half' && (
        <Dropdown
          name={`${categoryName}.rounding`}
          label='Rounding Type'
          value={sectionState[categoryName]?.rounding}
          options={builders.system.rules.rounding}
          required={true}
          onChange={setSectionState}
        />
      )}
      {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypeSpecific') &&
        categoryName != null && (
          <Dropdown
            name={`${categoryName}.subtype`}
            multiSelect={true}
            label='Subclass Subtype'
            value={sectionState[categoryName]?.subtype}
            options={formState?.subtype}
            required={true}
            onChange={setSectionState}
          />
        )}
      {providesOptions && (
        <Input
          validation='num'
          name={`selectionCount`}
          label='# of Selections'
          autoComplete='off'
          value={sectionState.selectionCount}
          errorMsg='Must contain only numbers'
          required={true}
          onChange={setSectionState}
        />
      )}
    </Row>
  )
}

export default Proficiencies
