import { use } from 'react'
import { FormContext } from '../../FormContext'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { useListFeatsQuery } from '../../../../features/feats/featsApi'
import { FeatureContext } from '../FeatureContext'
import { Categories } from '../../../../types/enums'
import { Class, FeatureFeat, SectionEnum } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'
import { useEnumChecks } from '../../../../hooks/useEnumChecks'
import Prerequisites from '../../Subforms/Requirements'
import Grid from '../../../Grid/Grid'

const Feats = () => {
  const { formData } = use(FormContext)

  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureFeat
    updateSectionData: (arg: UpdateState<FeatureFeat>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: feats } = useListFeatsQuery()

  const { subtypeSpecific, providesOptions, hasPrerequisites } = useEnumChecks({
    data: sectionData,
  })

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
          label={`${startCase('feat')} Attributes`}
          value={sectionData?.attributes}
          onChange={updateSectionData}
        />
      </Grid.Item>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Dropdown
          name='feats'
          multiSelect={true}
          label='Feat'
          value={sectionData?.feats}
          options={feats}
          required={true}
          onChange={updateSectionData}
        />
      </Grid.Item>
      {subtypeSpecific && formData.__typename === 'Class' && formData.category === Categories.subclass && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Input
            validation='num'
            name='selectionCount'
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

export default Feats
