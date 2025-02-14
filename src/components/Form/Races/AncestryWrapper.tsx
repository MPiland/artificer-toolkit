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
          <h2 className={sprinkles({ mb: 'space-2' })}>{`${
            featureStep === 'ancestryOption' ? 'Ancestry Option' : 'Ancestry Option Feature'
          } ${featureData.label && featureStep === 'ancestry' ? `(${featureData.label})` : ''}`}</h2>
          {sectionStep != null ? sectionStepComponent[sectionStep] : featureSteps[featureStep]}
        </>
      )}
    </>
  )
}

export default AncestryWrapper
