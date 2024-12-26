import Base from './Base'
import { use } from 'react'
import FormContext from '../FormContext'
import FeatureContext from './FeatureContext'

const Subfeature = () => {
  const { steps, stepIndex } = use(FormContext)
  const { subfeatureData, updateSubfeatureData } = use(FeatureContext)

  return (
    <Base
      featureData={subfeatureData}
      updateFeatureData={updateSubfeatureData}
      valueLabel={steps[stepIndex].id === 'ancestry' ? 'Ancestry Sub-Feature' : 'Sub-Feature'}
    />
  )
}

export default Subfeature
