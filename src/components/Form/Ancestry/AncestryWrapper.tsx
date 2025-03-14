import AncestryList from './AncestryList'
import { sprinkles } from '../../../css/sprinkles.css'
import { FeatureContext } from '../Features/FeatureContext'
import { use } from 'react'
import Grid from '../../Grid/Grid'

const AncestryWrapper = () => {
  const { featureStep, featureData, sectionStepComponent, sectionStep, featureSteps } = use(FeatureContext)

  return (
    <Grid>
      {featureStep == null ? (
        <AncestryList />
      ) : (
        <>
          <Grid.Item>
            <h2 className={sprinkles({ mb: 'space-2' })}>{`${
              featureStep === 'ancestryOption' ? 'Ancestry Option' : 'Ancestry Option Feature'
            } ${featureData.label && featureStep === 'ancestry' ? `(${featureData.label})` : ''}`}</h2>
          </Grid.Item>
          {sectionStep != null ? sectionStepComponent[sectionStep] : featureSteps[featureStep]}
        </>
      )}
    </Grid>
  )
}

export default AncestryWrapper
