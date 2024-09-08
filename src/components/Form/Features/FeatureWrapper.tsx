import FeaturesList from './FeaturesList'
import { sprinkles } from '../../../css/sprinkles.css'
import { useFeature } from '../../../hooks/UseFeature'

const FeatureWrapper = () => {
  const {
    featureState,
    subContext,
    optionState,
    subfeatureState,
    subfeatureIndex,
    sectionName,
    sectionSteps,
    featureSteps,
  } = useFeature()

  const featureTitle =
    featureState.value != null &&
    featureState.value !== '' &&
    `${subContext === 'subfeature' ? 'Sub-feature' : subContext} (${
      subContext === 'option' ? (optionState?.value ?? '') : ((subContext === 'feature' && featureState?.value) ?? '')
    }${
      subContext === 'subfeature'
        ? subfeatureState.value
          ? ` - ${subfeatureState.value}`
          : ` - Sub-feature ${subfeatureIndex + 1}`
        : ''
    })`

  return (
    <>
      {subContext === '' ? (
        <FeaturesList />
      ) : (
        <>
          <h2 className={sprinkles({ mb: 'space-2', px: 'space-4' })}>{featureTitle}</h2>
          {sectionName !== '' ? sectionSteps[sectionName] : featureSteps[subContext]}
        </>
      )}
    </>
  )
}

export default FeatureWrapper
