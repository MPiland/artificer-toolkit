import Modal from '../Modal/Modal'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from '../../hooks/UseForm'
import { useFeature } from '../../hooks/UseFeature'

const Alert = () => {
  const { alertType } = useParams()
  const { isFirstStep, isLastStep, setStepIndex, stepIndex, oldFormState } = useForm()

  const {
    subContext,
    setSubContext,
    featureStateReset,
    optionStateReset,
    subfeatureStateReset,
    sectionStateReset,
    sectionName,
    setSectionName,
  } = useFeature()

  const navigate = useNavigate()
  const location = useLocation()

  const message = location.state?.message

  const handleConfirmBack = () => {
    if (!isFirstStep) {
      if (subContext === '') {
        setStepIndex(stepIndex - 1)
      } else if (sectionName !== '') {
        sectionStateReset()
        setSectionName('')
      } else if (subContext === 'subfeature') {
        subfeatureStateReset()
        setSubContext('option')
      } else if (subContext === 'option') {
        optionStateReset()
        setSubContext('feature')
      } else {
        featureStateReset()
        setSubContext('')
      }
      return navigate(-1)
    } else {
      const previousState = location.state.previous.state.previous
      const previousPathname = previousState.pathname
      navigate(`${previousPathname}`, {
        state: {
          item: oldFormState,
          background: previousState.state.background,
          size: 'lg',
        },
      })
    }
  }

  const handleConfirmForward = () => {
    if (!isLastStep) {
      if (subContext === '') {
        setStepIndex(stepIndex - 1)
      } else if (sectionName !== '') {
        sectionStateReset()
        setSectionName('')
      } else if (subContext === 'subfeature') {
        subfeatureStateReset()
        setSubContext('option')
      } else if (subContext === 'option') {
        optionStateReset()
        setSubContext('feature')
      } else {
        featureStateReset()
        setSubContext('')
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
            <Button color='default' onClick={handleCancel}>
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
