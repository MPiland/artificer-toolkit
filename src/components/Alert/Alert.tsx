import Modal from '../Modal/Modal'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { useDispatch } from 'react-redux'
import { confirmBack, confirmForward, confirmStep } from '../../app/modalSlice'
import { useLocation, useNavigate } from 'react-router-dom'

const Alert = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const location = useLocation()

  const context: 'back' | 'forward' | 'step' = location.state.context
  const message = location.state.message
  const index = location.state.index

  console.log({ alertIndex: index, alertContext: context })

  const handleConfirmBack = () => {
    navigate(-1)
    dispatch(confirmBack({ status: true }))
  }

  const handleConfirmForward = () => {
    navigate(-1)
    dispatch(confirmForward({ status: true }))
  }

  const handleConfirmStep = () => {
    navigate(-1)
    dispatch(confirmStep({ status: true, index: index }))
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
            Cancel
          </Button>
          <Button
            variant='danger'
            onClick={() =>
              context === 'forward'
                ? handleConfirmForward()
                : context === 'step'
                ? handleConfirmStep()
                : handleConfirmBack()
            }
          >
            Continue
          </Button>
        </Group>
      </Modal.Footer>
    </>
  )
}

export default Alert
