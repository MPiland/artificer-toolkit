import Modal, { ModalContext, type AlertModalProps } from '@/components/Modal'
import { Button } from '@mantine/core'
import { use } from 'react'
import { Group } from '@mantine/core'

const Alert = () => {
  const { modalProps, hideModal } = use(ModalContext)

  const { title, message, confirmLabel, cancelLabel, onConfirm, onCancel } = modalProps as AlertModalProps

  return (
    <Modal.Dialogue>
      <Modal.Header title={title || 'Alert'} onClose={hideModal} />
      <Modal.Content>
        <span>{message}</span>
      </Modal.Content>
      <Modal.Footer>
        <Group justify='space-between'>
          <Button onClick={onCancel || hideModal}>{cancelLabel || 'Cancel'}</Button>
          <Button onClick={onConfirm}>{confirmLabel || 'Confirm'}</Button>
        </Group>
      </Modal.Footer>
    </Modal.Dialogue>
  )
}

export default Alert
