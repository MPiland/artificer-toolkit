import Modal from '../Modal/Modal'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import FormContext from '../Form/FormContext'
import { use } from 'react'
import FeatureContext from '../Form/Features/FeatureContext'

const Alert = () => {
  const { alertType } = useParams()
  const { isFirstStep, isLastStep, setStepIndex, stepIndex, initialFormData } = use(FormContext)

  const {
    featureStep,
    setFeatureStep,
    featureDataReset,
    optionDataReset,
    subfeatureDataReset,
    sectionDataReset,
    sectionStep,
    setSectionStep,
  } = use(FeatureContext)

  const navigate = useNavigate()
  const location = useLocation()

  const message = location.state?.message

  const handleConfirmBack = () => {
    if (!isFirstStep) {
      if (featureStep == null) {
        setStepIndex(stepIndex - 1)
      } else if (sectionStep != null) {
        sectionDataReset()
        setSectionStep(null)
      } else if (featureStep === 'subfeature') {
        subfeatureDataReset()
        setFeatureStep('option')
      } else if (featureStep === 'option') {
        optionDataReset()
        setFeatureStep('feature')
      } else {
        featureDataReset()
        setFeatureStep(null)
      }
      return navigate(-1)
    } else {
      const previousState = location.state.previous.state.previous
      const previousPathname = previousState.pathname
      navigate(`${previousPathname}`, {
        state: {
          item: initialFormData,
          background: previousState.state.background,
          size: 'lg',
        },
      })
    }
  }

  const handleConfirmForward = () => {
    if (!isLastStep) {
      if (featureStep == null) {
        setStepIndex(stepIndex - 1)
      } else if (sectionStep != null) {
        sectionDataReset()
        setSectionStep(null)
      } else if (featureStep === 'subfeature') {
        subfeatureDataReset()
        setFeatureStep('option')
      } else if (featureStep === 'option') {
        optionDataReset()
        setFeatureStep('feature')
      } else {
        featureDataReset()
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
