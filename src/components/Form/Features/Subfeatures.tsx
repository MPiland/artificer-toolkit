import { useFeature } from '../../../hooks/UseFeature'
import Base from './Base'
import { useForm } from '../../../hooks/UseForm'

const Subfeature = () => {
  const { steps, stepIndex } = useForm()
  const { subfeatureState, setSubfeatureState, sectionNames } = useFeature()

  const filteredSectionNames = sectionNames.filter(
    (sectionName) => sectionName !== 'options' && sectionName !== 'features'
  )

  return (
    <Base
      state={subfeatureState}
      setState={setSubfeatureState}
      valueLabel={steps[stepIndex].id === 'ancestry' ? 'Ancestry Sub-Feature' : 'Sub-Feature'}
      filteredSectionNames={filteredSectionNames}
    />
  )
}

export default Subfeature
