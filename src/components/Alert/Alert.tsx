import Modal from '../Modal/Modal'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { useLocation, useNavigate } from 'react-router-dom'

const Alert = () => {
  console.log('alert')
  const navigate = useNavigate()
  const location = useLocation()

  const alertType: 'back' | 'forward' | 'step' | 'invalidForm' = location.state?.alertType
  const message = location.state?.message
  const index = location.state?.index

  console.log({ location })

  const handleConfirmBack = () => {
    navigate(`${location.state?.background.state.background.pathname}`, {
      state: {
        confirmBack: true,
      },
    })
  }

  const handleConfirmForward = () => {
    navigate(`${location.state?.background.pathname}`, {
      state: {
        confirmForward: true,
      },
    })
  }

  const handleConfirmStep = () => {
    navigate(`${location.state?.background.pathname}`, {
      state: {
        confirmStep: true,
        stepIndex: index,
      },
    })
  }

  const handleCancel = () => {
    navigate(-1)
  }

  return (
    <>
      <Modal.Header title='Alert' />
      <Modal.Body>
        <span>{message}</span>
      </Modal.Body>
      <Modal.Footer>
        <Group directionVariant='row' justifyContentVariant='spaceBetween'>
          <Button variant='default' onClick={handleCancel}>
            {alertType === 'invalidForm' ? 'Ok' : 'Cancel'}
          </Button>
          {alertType !== 'invalidForm' && (
            <Button
              variant='danger'
              onClick={() =>
                alertType === 'forward'
                  ? handleConfirmForward()
                  : alertType === 'step'
                  ? handleConfirmStep()
                  : handleConfirmBack()
              }
            >
              Continue
            </Button>
          )}
        </Group>
      </Modal.Footer>
    </>
  )
}

export default Alert
