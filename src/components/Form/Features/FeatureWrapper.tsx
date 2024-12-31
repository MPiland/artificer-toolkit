import { use } from 'react'
import FeaturesList from './FeaturesList'
import { sprinkles } from '../../../css/sprinkles.css'
import { FeatureContext } from './FeatureContext'

const FeatureWrapper = () => {
  const {
    featureData,
    featureStep,
    optionData,
    subfeatureData,
    subfeatureIndex,
    sectionStep,
    sectionStepComponent,
    featureSteps,
  } = use(FeatureContext)

  const featureTitle =
    featureData.value != null &&
    featureData.value !== '' &&
    `${featureStep === 'subfeature' ? 'Subfeature' : featureStep} (${
      featureStep === 'option' ? optionData?.value ?? '' : (featureStep === 'feature' && featureData?.value) ?? ''
    }${
      featureStep === 'subfeature'
        ? subfeatureData.value
          ? ` - ${subfeatureData.value}`
          : ` - Sub-feature ${subfeatureIndex + 1}`
        : ''
    })`

  return (
    <>
      {featureStep == null ? (
        <FeaturesList />
      ) : (
        <>
          <h2 className={sprinkles({ mb: 'space-2', px: 'space-4' })}>{featureTitle}</h2>
          {sectionStep != null ? sectionStepComponent[sectionStep] : featureSteps[featureStep]}
        </>
      )}
    </>
  )
}

export default FeatureWrapper
