import AncestryList from './AncestryList'
import { sprinkles } from '@/css/sprinkles.css'
import { FeatureContext } from '../Features'
import { use } from 'react'
import { Grid } from '@mantine/core'

const AncestryWrapper = () => {
  const { featureStore, sectionStore, sectionStepComponent, featureSteps } = use(FeatureContext)

  return (
    <Grid>
      {featureStore.step == null ?
        <AncestryList />
      : <>
          <Grid.Col>
            <h2 className={sprinkles({ mb: 'space-2' })}>{`${
              featureStore.step === 'ancestryOption' ? 'Ancestry Option' : 'Ancestry Option Feature'
            } ${featureStore.data.label && featureStore.step === 'ancestry' ? `(${featureStore.data.label})` : ''}`}</h2>
          </Grid.Col>
          {sectionStore.step != null ? sectionStepComponent[sectionStore.step] : featureSteps[featureStore.step]}
        </>
      }
    </Grid>
  )
}

export default AncestryWrapper
