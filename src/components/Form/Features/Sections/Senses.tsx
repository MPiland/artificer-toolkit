import Row from '../../../Row/Row'
import Dropdown from '../../../Dropdown/Dropdown'
import Input from '../../../Input/Input'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { FeatureContext } from '../FeatureContext'
import { Class, FeatureSense, SectionEnum } from '../../../../../amplify/API'
import { UpdateState } from '../../../../types/form'
import { Attributes, Categories } from '../../../../types/enums'

const Senses = () => {
  const { formData } = use(FormContext)
  const { sectionData, updateSectionData } = use(FeatureContext) as {
    sectionData: FeatureSense
    updateSectionData: (arg: UpdateState<FeatureSense>) => void
  }

  const { data: system } = useGetSystemQuery()

  const providesOptions = sectionData.attributes?.some((attribute) => attribute === Attributes.providesOptions)

  return (
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
        label='Sense Attributes'
        value={sectionData.attributes}
        onChange={updateSectionData}
      />
      <Dropdown
        name='senses'
        multiSelect={true}
        label='Sense'
        value={sectionData.senses}
        options={system.senses}
        required={true}
        onChange={updateSectionData}
      />
      {sectionData.attributes?.some((attribute) => attribute === Attributes.providesOptions) &&
        formData.__typename === 'Class' && (
          <Dropdown
            name={`subtype`}
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
  )
}

export default Senses
