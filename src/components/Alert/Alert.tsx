import Modal from '../Modal/Modal'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FormContext } from '../Form/FormContext'
import { use } from 'react'
import { FeatureContext } from '../Form/Features/FeatureContext'

const Alert = () => {
  const { alertType } = useParams() as { alertType: 'step' | 'forward' | 'back' }
  const { isFirstStep, isLastStep, setStepIndex, stepIndex, resetForm } = use(FormContext)

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
  const index = location.state?.index

  const reset = () => {
    if (sectionStep != null) {
      resetSection()
      setSectionStep(null)
    } else if (featureStep === 'subfeature') {
      resetSubfeature()
    } else if (featureStep === 'option') {
      resetOption()
    } else if (featureStep === 'ancestry') {
      resetFeature()
    } else if (featureStep === 'ancestryOption') {
      resetAncestry()
    } else {
      resetFeature()
    }
    setFeatureStep(null)
  }

  const handleConfirmBack = () => {
    if (!isFirstStep) {
      if (featureStep == null) {
        reset()
      }
      navigate(-1)
      return setStepIndex(stepIndex - 1)
    } else {
      resetForm()
      return navigate('../..')
    }
  }

  const handleConfirmForward = () => {
    if (!isLastStep) {
      if (featureStep != null) {
        reset()
      }
      setStepIndex(stepIndex + 1)
      return navigate(-1)
    }
    return navigate(-1)
  }

  const handleConfirmStep = () => {
    if (featureStep != null) {
      reset()
    }
    setStepIndex(index)
    return navigate(-1)
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
              Cancel
            </Button>
            <Button
              color='danger'
              onClick={() =>
                alertType === 'step'
                  ? handleConfirmStep()
                  : alertType === 'forward'
                  ? handleConfirmForward()
                  : handleConfirmBack()
              }
            >
              Continue
            </Button>
          </Group>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default Alert
