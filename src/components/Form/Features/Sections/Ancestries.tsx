import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { useListRacesQuery } from '../../../../features/races/racesApi'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { FeatureContext } from '../FeatureContext'
import { Attributes, Categories } from '../../../../types/enums'
import { FeatureAncestry, SectionEnum } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import Grid from '../../../Grid/Grid'

const Ancestries = () => {
  const { formData } = use(FormContext)
  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureAncestry
    updateSectionData: (arg: UpdateState<FeatureAncestry>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: races } = useListRacesQuery()

  const race = races?.find((race) => race.id === sectionData?.origin)
  const ancestryOptions = race.ancestry.options

  const providesOptions = sectionData?.attributes?.some((attribute) => attribute === Attributes.providesOptions)

  return (
    <Grid>
      <Grid.Item colSpan={{sm: 6, md: 4, lg: 2}}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={system.attributes.filter(
            (attribute) => attribute?.sections?.length > 0 && attribute?.sections?.includes(SectionEnum.all)
          )}
          label={`${startCase('Ancestry')} Attributes`}
          value={sectionData?.attributes}
          onChange={updateSectionData}
        />
      </Grid.Item>
      <Grid.Item colSpan={{sm: 6, md: 4, lg: 2}}>
        <Dropdown
          name='origin'
          label='Ancestry Origin'
          value={sectionData?.origin}
          options={races.filter((race) => race.ancestry != null)}
          required={true}
          onChange={updateSectionData}
        />
      </Grid.Item>
      {ancestryOptions?.length > 0 && (
        <Grid.Item colSpan={{sm: 6, md: 4, lg: 2}}>
          <Dropdown
            name='options'
            label='Ancestry Option'
            multiSelect={true}
            value={sectionData?.options}
            options={ancestryOptions}
            required={true}
            onChange={updateSectionData}
          />
        </Grid.Item>
      )}
      {sectionData?.attributes?.some((attribute) => attribute === Attributes.subtypeSpecific) &&
        formData.__typename === 'Class' &&
        formData.category === Categories.subclass && (
          <Grid.Item colSpan={{sm: 6, md: 4, lg: 2}}>
            <Dropdown
              name='subtype'
              label='Subtype'
              value={sectionData?.subtype}
              options={formData?.subtypes}
              required={true}
              onChange={updateSectionData}
            />
          </Grid.Item>
        )}
      {providesOptions && (
        <Grid.Item colSpan={{sm: 6, md: 4, lg: 2}}>
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
    </Grid>
  )
}

export default Ancestries
