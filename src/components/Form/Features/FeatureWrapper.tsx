import { use } from 'react'
import FeaturesList from './FeaturesList'
import { sprinkles } from '../../../css/sprinkles.css'
import { FeatureContext } from './FeatureContext'
import Grid from '../../Grid/Grid'

const FeatureWrapper = () => {
  const { featureData, featureStep, optionData, sectionStep, sectionStepComponent, featureSteps } = use(FeatureContext)

  const featureTitle =
    featureData.label != null &&
    featureData.label !== '' &&
    `(${featureStep === 'option' ? optionData?.label ?? '' : (featureStep === 'feature' && featureData?.label) ?? ''})`

  return (
    <Grid>
      {featureStep == null ? (
        <FeaturesList />
      ) : (
        <>
          <Grid.Item>
            <h2 className={sprinkles({ mb: 'space-2' })}>{featureTitle}</h2>
          </Grid.Item>
          {sectionStep != null ? sectionStepComponent[sectionStep] : featureSteps[featureStep]}
        </>
      )}
    </Grid>
  )
}

export default FeatureWrapper
