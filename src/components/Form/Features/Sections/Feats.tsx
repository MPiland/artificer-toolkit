import { useForm } from '../../../../hooks/UseForm'
import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { DropdownOptionType } from '../../../../utils/types'
import { useFeature } from '../../../../hooks/UseFeature'
import { useGetSystemsQuery } from '../../../../features/systems/systemsApi'
import { useGetFeatsQuery } from '../../../../features/feats/featsApi'

const Feats = () => {
  const { formState } = useForm()
  const { sectionState, setSectionState } = useFeature()

  const { data: builders } = useGetSystemsQuery()
  const { data: feats } = useGetFeatsQuery() as { data: any[] }

  const providesOptions = sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'providesOptions')

  return (
    <>
      <Row>
        <Dropdown
          multiSelect={true}
          name={`attribute`}
          options={[].concat(
            builders.section.attribute,
            formState.category?.name === 'subclass' && builders.section.subclass.attribute
          )}
          label={`${startCase('feat')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        <Dropdown
          name={`type`}
          multiSelect={true}
          label='Feat'
          value={sectionState.type}
          options={feats as DropdownOptionType[]}
          required={true}
          onChange={setSectionState}
        />
        {sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypeSpecific') && (
          <Dropdown
            name={`subtype`}
            label='Subtype'
            value={sectionState.subtype}
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
    </>
  )
}

export default Feats
