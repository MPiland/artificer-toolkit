import AncestryList from './AncestryList'
import { sprinkles } from '../../../css/sprinkles.css'
import { useFeature } from '../../../hooks/UseFeature'

const AncestryWrapper = () => {
  const { subContext, featureState, sectionSteps, sectionName, featureSteps } = useFeature()

  return (
    <>
      {subContext === '' ? (
        <AncestryList />
      ) : (
        <>
          <h2 className={sprinkles({ mb: 'space-2', px: 'space-4' })}>{`Ancestry Option ${
            featureState.value ? `(${featureState.value})` : ''
          }`}</h2>
          {sectionName !== '' ? sectionSteps[sectionName] : featureSteps[subContext]}
        </>
      )}
    </>
  )
}

export default AncestryWrapper
