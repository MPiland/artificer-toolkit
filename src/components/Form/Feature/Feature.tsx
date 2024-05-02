import FeatureList from './FeatureList'
import { sprinkles } from '../../../css/sprinkles.css'
import FeatureContent from './FeatureContent'
import SectionContent from './SectionContent'
import { useContext, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FormStepsContext } from '../FormStepsContext'

const Feature = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const {
    stepName,
    isFirstStep,
    isLastStep,
    setStepIndex,
    featureStepName,
    featureState,
    featureContext,
    optionState,
    subFeatureState,
    subFeatureIndex,
    setFeatureStepName,
    setFeatureContext,
  } = useContext(FormStepsContext)

  const confirmBack = location.state?.confirmBack
  const confirmForward = location.state?.confirmForward
  const confirmStep = location.state?.confirmStep

  // Confirm Alert back
  useEffect(() => {
    if (confirmBack === true) {
      if (featureStepName !== '') {
        if (featureStepName === 'SectionContent') {
          setFeatureStepName('FeatureContent')
        } else if (featureStepName === 'FeatureContent') {
          if (featureContext === 'OptionFeatureContent') {
            setFeatureContext('OptionContent')
          } else if (featureContext === 'OptionContent') {
            setFeatureContext('')
          } else {
            setFeatureStepName('')
          }
        }
      }
    }
  }, [
    confirmBack,
    featureContext,
    featureStepName,
    isLastStep,
    isFirstStep,
    navigate,
    setFeatureContext,
    setFeatureStepName,
    setStepIndex,
  ])

  // Confirm Alert forward
  useEffect(() => {
    if (confirmForward === true) {
      if (featureStepName !== '') {
        if (featureStepName === 'SectionContent') {
          setFeatureStepName('FeatureContent')
        } else if (featureStepName === 'FeatureContent') {
          if (featureContext === 'OptionFeatureContent') {
            setFeatureContext('OptionContent')
          } else if (featureContext === 'OptionContent') {
            setFeatureContext('')
          } else {
            setFeatureStepName('')
          }
        }
      }
    }
  }, [confirmForward, featureContext, featureStepName, isLastStep, setFeatureStepName, setStepIndex, setFeatureContext])

  // Confirm Alert step
  useEffect(() => {
    if (confirmStep === true) {
      if (featureStepName !== '') {
        setFeatureContext('')
        setFeatureStepName('')
      }
    }
  }, [confirmStep, featureStepName, setFeatureContext, setFeatureStepName])

  return (
    <>
      {featureStepName === '' ? (
        <FeatureList />
      ) : (
        <>
          <h2 className={sprinkles({ mb: 'size-2', px: 'size-4' })}>
            {featureState.value != null &&
              featureState.value !== '' &&
              `${
                stepName === 'Ancestry'
                  ? 'Ancestry'
                  : featureContext === 'OptionContent'
                  ? 'Option'
                  : featureContext === 'OptionFeatureContent'
                  ? 'Sub-Feature'
                  : 'Feature'
              } (${featureContext !== '' ? optionState.value : featureState.value}${
                featureContext === 'OptionFeatureContent'
                  ? subFeatureState.value
                    ? ` - ${subFeatureState.value}`
                    : ` - Sub-Feature ${subFeatureIndex + 1}`
                  : ''
              })`}
          </h2>
          {featureStepName === 'FeatureContent' ? <FeatureContent /> : <SectionContent />}
        </>
      )}
    </>
  )
}

export default Feature
