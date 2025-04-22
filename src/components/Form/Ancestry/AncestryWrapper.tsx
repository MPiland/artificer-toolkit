import AncestryList from './AncestryList'
import { sprinkles } from '../../../css/sprinkles.css'
import { FeatureContext } from '../Features/FeatureContext'
import { use } from 'react'
import Grid from '../../Grid/Grid'

const AncestryWrapper = () => {
  const { featureStore, sectionStore, sectionStepComponent, featureSteps } = use(FeatureContext)

  return (
    <Grid>
      {featureStore.step == null ?
        <AncestryList />
      : <>
          <Grid.Item>
            <h2 className={sprinkles({ mb: 'space-2' })}>{`${
              featureStore.step === 'ancestryOption' ? 'Ancestry Option' : 'Ancestry Option Feature'
            } ${featureStore.data.label && featureStore.step === 'ancestry' ? `(${featureStore.data.label})` : ''}`}</h2>
          </Grid.Item>
          {sectionStore.step != null ? sectionStepComponent[sectionStore.step] : featureSteps[featureStore.step]}
        </>
      }
    </Grid>
  )
}

export default AncestryWrapper
