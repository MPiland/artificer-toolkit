import Base from '../Features/Base'
import { use } from 'react'
import FeatureContext from '../Features/FeatureContext'

const RacesAncestries = () => {
  const { featureData, updateFeatureData } = use(FeatureContext)

  return <Base featureData={featureData} updateFeatureData={updateFeatureData} valueLabel={'Ancestry'} />
}

export default RacesAncestries
