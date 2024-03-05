import Modal from '../Modal/Modal'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { useDispatch } from 'react-redux'
import { confirmBack, confirmForward } from '../../app/modalSlice'
import { useLocation, useNavigate } from 'react-router-dom'

const Alert = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const location = useLocation()

  const context = location.state.context
  const index = location.state.index

  const handleConfirmBack = () => {
    dispatch(confirmBack({ status: true, index: index }))
    navigate(-1)
  }

  const handleConfirmForward = () => {
    dispatch(confirmForward({ status: true, index: index }))
    navigate(-1)
  }

  const handleCancel = () => {
    navigate(-1)
  }

  return (
    <>
      <Modal.Header title='Alert' />
      <Modal.Body>
        <span>There are unsaved changes</span>
      </Modal.Body>
      <Modal.Footer>
        <Group directionVariant='row' justifyContentVariant='spaceBetween'>
          <Button variant='default' onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant='danger'
            onClick={() =>
              context === 'foward'
                ? handleConfirmForward()
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
