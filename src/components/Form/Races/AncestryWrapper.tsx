import AncestryList from './AncestryList'
import { sprinkles } from '../../../css/sprinkles.css'
import { FeatureContext } from '../Features/FeatureContext'
import { use } from 'react'

const AncestryWrapper = () => {
  const { featureStep, featureData, sectionStepComponent, sectionStep, featureSteps } = use(FeatureContext)

  return (
    <>
      {featureStep == null ? (
        <AncestryList />
      ) : (
        <>
          <h2 className={sprinkles({ mb: 'space-2', px: 'space-4' })}>{`Ancestry Option ${
            featureData.value ? `(${featureData.value})` : ''
          }`}</h2>
          {sectionStep != null ? sectionStepComponent[sectionStep] : featureSteps[featureStep]}
        </>
      )}
    </>
  )
}

export default AncestryWrapper
