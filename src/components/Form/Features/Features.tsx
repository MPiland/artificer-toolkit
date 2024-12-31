import Base from './Base'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { FeatureContext } from './FeatureContext'

const Features = () => {
  const { formData } = use(FormContext)
  const { featureData, updateFeatureData } = use(FeatureContext)

  return (
    <Base
      featureData={featureData}
      updateFeatureData={updateFeatureData}
      valueLabel={formData.__typename === 'Feat' ? 'Feat' : 'Feature'}
    />
  )
}

export default Features
