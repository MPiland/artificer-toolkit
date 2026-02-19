import Modal, { ModalContext, type AlertModalProps } from '@components/Modal'
import { Button } from '@mantine/core'
import { use, useEffect } from 'react'
import { Group } from '@mantine/core'

const Alert = () => {
  const { modalProps, hideModal, setTitle } = use(ModalContext)

  const { title, message, confirmLabel, cancelLabel, onConfirm, onCancel } = modalProps as AlertModalProps

  useEffect(() => {
    setTitle(title || 'Alert')
  }, [title, setTitle])

  return (
    <Modal
      props={{
        footer: {
          children: (
            <Group justify='space-between'>
              {cancelLabel && <Button onClick={onCancel || hideModal}>{cancelLabel || 'Cancel'}</Button>}
              {confirmLabel && <Button onClick={onConfirm}>{confirmLabel || 'Confirm'}</Button>}
            </Group>
          ),
        },
      }}
    >
      <span>{message}</span>
    </Modal>
  )
}

export default Alert
