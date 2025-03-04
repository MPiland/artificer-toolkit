import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { FeatureContext } from '../FeatureContext'
import { Class, FeatureSense, SectionEnum } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import { Attributes, Categories } from '../../../../types/enums'
import Grid from '../../../Grid/Grid'

const Senses = () => {
  const { formData } = use(FormContext)
  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureSense
    updateSectionData: (arg: UpdateState<FeatureSense>) => void
  }

  const { data: system } = useGetSystemQuery()

  const providesOptions = sectionData?.attributes?.some((attribute) => attribute === Attributes.providesOptions)

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          multiSelect={true}
          name='attributes'
          options={system.attributes.filter(
            (attribute) =>
              attribute.sections.includes(SectionEnum.all) &&
              (formData as Class).category === Categories.subclass &&
              attribute.sections.includes(SectionEnum.subclasses)
          )}
          label='Sense Attributes'
          value={sectionData?.attributes}
          onChange={updateSectionData}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          name='ids'
          multiSelect={true}
          label='Sense'
          value={sectionData?.ids}
          options={system.senses}
          required={true}
          onChange={updateSectionData}
        />
      </Grid.Item>
      {sectionData?.attributes?.some((attribute) => attribute === Attributes.providesOptions) &&
        formData.__typename === 'Class' && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name={`subtype`}
              label='Subtype'
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
    </Grid>
  )
}

export default Senses
