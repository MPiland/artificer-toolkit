import { use } from 'react'
import { FormContext } from '../../FormContext'
import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { startCase } from 'lodash'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { useListFeatsQuery } from '../../../../features/feats/featsApi'
import { FeatureContext } from '../FeatureContext'
import { Attributes, Categories } from '../../../../types/enums'
import { Class, FeatureFeat, SectionEnum } from '../../../../../amplify/gql/types'
import { UpdateState } from '../../../../types/form'

const Feats = () => {
  const { formData } = use(FormContext)
  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureFeat
    updateSectionData: (arg: UpdateState<FeatureFeat>) => void
  }

  const { data: system } = useGetSystemQuery()
  const { data: feats } = useListFeatsQuery()

  const providesOptions = sectionData?.attributes?.some((attribute) => attribute === Attributes.providesOptions)

  return (
    <>
      <Row>
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
        <Dropdown
          name='feats'
          multiSelect={true}
          label='Feat'
          value={sectionData?.feats}
          options={feats}
          required={true}
          onChange={updateSectionData}
        />
        {sectionData?.attributes?.some((attribute) => attribute === Attributes.subtypeSpecific) &&
          formData.__typename === 'Class' &&
          formData.category === Categories.subclass && (
            <Dropdown
              name='subtype'
              label='Subtype'
              value={sectionData?.subtype}
              options={formData?.subtypes}
              required={true}
              onChange={updateSectionData}
            />
          )}
        {providesOptions && (
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
        )}
      </Row>
    </>
  )
}

export default Feats
