import Base from '../Features/Base'
import { use } from 'react'
import { FeatureContext } from '../Features/FeatureContext'

const AncestryFeatures = () => {
  const { featureData, updateFeatureData } = use(FeatureContext)

  return <Base featureData={featureData} updateFeatureData={updateFeatureData} valueLabel={'Feature'} />
}

export default AncestryFeatures
