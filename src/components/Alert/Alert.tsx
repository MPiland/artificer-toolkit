import Modal, { ModalContext } from '@/components/Modal'
import Group from '@/components/Group'
import Button from '@/components/Button'
import { use } from 'react'

const Alert = () => {
  const { modalProps, hideModal } = use(ModalContext)

  const { title, message, confirmLabel, cancelLabel, onConfirm, onCancel } = modalProps

  return (
    <Modal.Dialogue>
      <Modal.Header title={title || 'Alert'} onClose={hideModal} />
      <Modal.Content>
        <span>{message}</span>
      </Modal.Content>
      <Modal.Footer>
        <Group directionVariant='row' justifyContentVariant='spaceBetween'>
          <Button color='main' onClick={onCancel || hideModal}>
            {cancelLabel || 'Cancel'}
          </Button>
          <Button color='danger' onClick={onConfirm}>
            {confirmLabel || 'Confirm'}
          </Button>
        </Group>
      </Modal.Footer>
    </Modal.Dialogue>
  )
}

export default Alert
