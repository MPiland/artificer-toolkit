import { use } from 'react'
import FeaturesList from './FeaturesList'
import { sprinkles } from '../../../css/sprinkles.css'
import { FeatureContext } from './FeatureContext'
import { startCase } from 'lodash'

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
    featureData.label != null &&
    featureData.label !== '' &&
    `${featureStep === 'subfeature' ? 'Subfeature' : startCase(featureStep)} (${
      featureStep === 'option' ? optionData?.label ?? '' : (featureStep === 'feature' && featureData?.label) ?? ''
    }${
      featureStep === 'subfeature'
        ? subfeatureData.label
          ? ` - ${subfeatureData.label}`
          : ` - Sub-feature ${subfeatureIndex + 1}`
        : ''
    })`

  return (
    <>
      {featureStep == null ? (
        <FeaturesList />
      ) : (
        <>
          <h2 className={sprinkles({ mb: 'space-2' })}>{featureTitle}</h2>
          {sectionStep != null ? sectionStepComponent[sectionStep] : featureSteps[featureStep]}
        </>
      )}
    </>
  )
}

export default FeatureWrapper
