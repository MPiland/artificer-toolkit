import { use } from 'react'
import { FeatureContext, Base } from '../Features'

const AncestryFeatures = () => {
  const { featureStore } = use(FeatureContext)

  return <Base featureStore={featureStore} valueLabel={'Feature'} />
}

export default AncestryFeatures
