import { useFeature } from '../../../hooks/UseFeature'
import Base from './Base'
import { useForm } from '../../../hooks/UseForm'

const Features = () => {
  const { context, steps, stepIndex } = useForm()
  const { featureState, setFeatureState, sectionNames } = useFeature()

  const filteredSectionNames = sectionNames.filter(
    (sectionName) =>
      sectionName !== 'features' &&
      (context.title !== 'classes' ? sectionName !== 'ancestry' : sectionName) &&
      (steps[stepIndex].id === 'ancestry' ? sectionName !== 'options' : sectionName)
  )
  return (
    <Base
      state={featureState}
      setState={setFeatureState}
      valueLabel={steps[stepIndex].id === 'ancestry' ? 'Ancestry' : context.title === 'feats' ? 'Feat' : 'Feature'}
      filteredSectionNames={filteredSectionNames}
    />
  )
}

export default Features
