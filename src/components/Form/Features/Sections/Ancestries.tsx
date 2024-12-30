import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { useListRacesQuery } from '../../../../features/races/racesApi'
import { use } from 'react'
import FormContext from '../../FormContext'
import FeatureContext from '../FeatureContext'
import { Attributes, Categories } from '../../../../types/enums'
import { FeatureAncestry, SectionEnum } from '../../../../../amplify/API'
import { UpdateState } from '../../../../types/form'

const Ancestries = () => {
  const { formData } = use(FormContext)
  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureAncestry
    updateSectionData: (arg: UpdateState<FeatureAncestry>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: races } = useListRacesQuery()

  const race = races?.find((race) => race.id === sectionData.origin)

  const providesOptions = sectionData.attributes?.some((attribute) => attribute === Attributes.providesOptions)
  
  return (
    <>
      <Row>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={system.attributes.filter((attribute) => attribute.sections.includes(SectionEnum.all))}
          label={`${startCase('Ancestry')} Attributes`}
          value={sectionData.attributes}
          onChange={updateSectionData}
        />
        <Dropdown
          name='origin'
          label='Ancestry Origin'
          value={sectionData?.origin}
          options={races}
          filters={[{ type: 'notEqual', key: 'ancestry.id' }]}
          required={true}
          onChange={updateSectionData}
        />
        {race?.ancestry?.options?.length > 0 && (
          <Dropdown
            name='options'
            label='Ancestry Option'
            multiSelect={true}
            value={sectionData?.options}
            options={race?.ancestry?.options}
            required={true}
            onChange={updateSectionData}
          />
        )}
        {sectionData.attributes?.some((attribute) => attribute === Attributes.subtypeSpecific) && formData.__typename === 'Class' && formData.category === Categories.subclass && (
          <Dropdown
            name='subtype'
            label='Subtype'
            value={sectionData.subtype}
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
            value={sectionData.selectionCount}
            errorMsg='Must contain only numbers'
            required={true}
            onChange={updateSectionData}
          />
        )}
      </Row>
    </>
  )
}

export default Ancestries
