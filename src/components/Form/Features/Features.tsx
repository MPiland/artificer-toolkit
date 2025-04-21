import Base from './Base'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { FeatureContext } from './FeatureContext'

const Features = () => {
  const { formStore } = use(FormContext)
  const { featureStore } = use(FeatureContext)

  return (
    <Base
      featureStore={featureStore}
      valueLabel={formStore.data.__typename === 'Feat' ? 'Feat' : 'Feature'}
    />
  )
}

export default Features
