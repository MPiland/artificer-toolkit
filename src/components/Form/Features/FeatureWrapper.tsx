import { use } from 'react'
import FeaturesList from './FeaturesList'
import { sprinkles } from '@/css/sprinkles.css'
import { FeatureContext } from './FeatureContext'
import { Grid } from '@mantine/core'

const FeatureWrapper = () => {
  const { featureStore, optionStore, sectionStore, sectionStepComponent, featureSteps } = use(FeatureContext)

  const featureTitle =
    featureStore.data.label != null &&
    featureStore.data.label !== '' &&
    `(${featureStore.step === 'option' ? (optionStore.data?.label ?? '') : ((featureStore.step === 'feature' && featureStore.data?.label) ?? '')})`

  return (
    <Grid>
      {featureStore.step == null ?
        <FeaturesList />
      : <>
          <Grid.Col>
            <h2 className={sprinkles({ mb: 'space-2' })}>{featureTitle}</h2>
          </Grid.Col>
          {sectionStore.step != null ? sectionStepComponent[sectionStore.step] : featureSteps[featureStore.step]}
        </>
      }
    </Grid>
  )
}

export default FeatureWrapper
