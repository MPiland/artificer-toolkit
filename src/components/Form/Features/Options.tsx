import Base from './Base'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { FeatureContext } from './FeatureContext'

const Options = () => {
  const { steps, stepIndex } = use(FormContext)
  const { optionStore } = use(FeatureContext)

  return (
    <Base featureStore={optionStore} valueLabel={steps[stepIndex].id === 'ancestry' ? 'Ancestry Feature' : 'Option'} />
  )
}

export default Options
