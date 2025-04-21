import Base from '../Features/Base'
import { use } from 'react'
import { FeatureContext } from '../Features/FeatureContext'

const AncestryFeatures = () => {
  const { featureStore } = use(FeatureContext)

  return <Base featureStore={featureStore} valueLabel={'Feature'} />
}

export default AncestryFeatures
