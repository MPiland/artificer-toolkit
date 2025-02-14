import Modal from '../Modal/Modal'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FormContext } from '../Form/FormContext'
import { use } from 'react'
import { FeatureContext } from '../Form/Features/FeatureContext'

const Alert = () => {
  const { alertType } = useParams()
  const { isFirstStep, isLastStep, setStepIndex, stepIndex, resetForm, steps } = use(FormContext)

  const {
    featureStep,
    setFeatureStep,
    resetFeature,
    resetOption,
    resetSubfeature,
    resetSection,
    sectionStep,
    setSectionStep,
    resetAncestry,
  } = use(FeatureContext)

  const navigate = useNavigate()
  const location = useLocation()

  const message = location.state?.message

  const handleConfirmBack = () => {
    if (!isFirstStep) {
      if (featureStep == null) {
        setStepIndex(stepIndex - 1)
      } else if (sectionStep != null) {
        resetSection()
        setSectionStep(null)
      } else if (featureStep === 'subfeature') {
        resetSubfeature()
        setFeatureStep('option')
      } else if (featureStep === 'option') {
        resetOption()
        if (steps[stepIndex].id === 'ancestry') {
          setFeatureStep('ancestry')
        } else {
          setFeatureStep('feature')
        }
      } else if (featureStep === 'ancestry') {
        resetFeature()
        setFeatureStep('ancestryOption')
      } else if (featureStep === 'ancestryOption') {
        resetAncestry()
        setFeatureStep(null)
      } else {
        resetFeature()
        setFeatureStep(null)
      }
      return navigate(-1)
    } else {
      resetForm()
      navigate('../..')
    }
  }

  const handleConfirmForward = () => {
    if (!isLastStep) {
      if (featureStep == null) {
        setStepIndex(stepIndex - 1)
      } else if (sectionStep != null) {
        resetSection()
        setSectionStep(null)
      } else if (featureStep === 'subfeature') {
        resetSubfeature()
        setFeatureStep('option')
      } else if (featureStep === 'option') {
        resetOption()
        if (steps[stepIndex].id === 'ancestry') {
          setFeatureStep('ancestry')
        } else {
          setFeatureStep('feature')
        }
      } else if (featureStep === 'ancestry') {
        resetFeature()
        setFeatureStep('ancestryOption')
      } else if (featureStep === 'ancestryOption') {
        resetAncestry()
        setFeatureStep(null)
      } else {
        resetFeature()
        setFeatureStep(null)
      }
      setStepIndex(stepIndex + 1)
    }
    navigate(-1)
  }

  const handleCancel = () => {
    navigate(-1)
  }

  return (
    <Modal>
      <Modal.Dialogue>
        <Modal.Header title='Alert' />
        <Modal.Content>
          <span>{message}</span>
        </Modal.Content>
        <Modal.Footer>
          <Group directionVariant='row' justifyContentVariant='spaceBetween'>
            <Button color='main' onClick={handleCancel}>
              {alertType === 'invalidForm' ? 'Ok' : 'Cancel'}
            </Button>
            {alertType !== 'invalidForm' && (
              <Button
                color='danger'
                onClick={() => (alertType === 'forward' ? handleConfirmForward() : handleConfirmBack())}
              >
                Continue
              </Button>
            )}
          </Group>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default Alert
