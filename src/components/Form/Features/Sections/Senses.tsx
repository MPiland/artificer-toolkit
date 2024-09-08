import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { useForm } from '../../../../hooks/UseForm'
import { useFeature } from '../../../../hooks/UseFeature'
import { useGetBuildersQuery } from '../../../../features/builders/buildersApi'

const Senses = () => {
  const { formState } = useForm()
  const { sectionState, setSectionState } = useFeature()

  const { data: builders } = useGetBuildersQuery()

  const providesOptions = sectionState.attribute?.some((attributeItem: any) => attributeItem.name === 'providesOptions')

  return (
    <Row>
      <Dropdown
        multiSelect={true}
        name={`attribute`}
        options={[].concat(
          builders.section.attribute,
          formState.category?.name === 'subclass' && builders.section.subclass.attribute
        )}
        label={`${startCase('sense')} Attributes`}
        value={sectionState.attribute}
        onChange={setSectionState}
      />
      <Dropdown
        name={`type`}
        multiSelect={true}
        label='Sense'
        value={sectionState.type}
        options={builders.sense.type}
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
  )
}

export default Senses
