import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { DropdownOptionType } from '../../../../utils/types'
import { useForm } from '../../../../hooks/UseForm'
import { useFeature } from '../../../../hooks/UseFeature'
import { useGetSystemsQuery } from '../../../../features/systems/systemsApi'
import { useGetRacesQuery } from '../../../../features/races/racesApi'

const Ancestry = () => {
  const { formState } = useForm()
  const { sectionState, setSectionState } = useFeature()

  const { data: builders } = useGetSystemsQuery()
  const { data: races } = useGetRacesQuery() as { data: any[] }

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
          label={`${startCase('Ancestry')} Attributes`}
          value={sectionState.attribute}
          onChange={setSectionState}
        />
        <Dropdown
          name='origin'
          label='Ancestry Origin'
          value={sectionState?.origin}
          options={races as DropdownOptionType[]}
          filter={[{ value: null, type: 'notEqual', key: 'ancestry.name' }]}
          required={true}
          onChange={setSectionState}
        />
        {races?.find((raceItem: any) => raceItem.name === sectionState?.origin?.name)?.ancestry?.options?.length >
          0 && (
          <Dropdown
            name='option'
            label='Ancestry Option'
            multiSelect={providesOptions}
            value={sectionState?.options}
            options={races?.find((raceItem: any) => raceItem.name === sectionState?.origin?.name)?.ancestry?.options}
            required={true}
            onChange={setSectionState}
          />
        )}
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

export default Ancestry
