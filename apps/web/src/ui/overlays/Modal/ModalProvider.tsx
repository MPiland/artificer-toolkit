import { ReactElement, ReactNode, useState } from 'react'
import { ModalContext } from './ModalContext'
import type {
  ModalPropsByType,
  ShowModal
} from './Modal.types'
import Alert from '#components/Alert'
import Delete from '#components/Delete'
import Copy from '#components/Copy'
import { AddSection } from '#components/Form'
import Loading from '#components/Loading'
import Hitpoints from '../../../legacy/domains/characters/Hitpoints/Hitpoints'
import { Modal } from '@mantine/core'

type ModalType = 'alert' | 'delete' | 'copy' | 'addSection' | 'loading' | 'hitpoints'

const useModalOptions = () => {
  const [size, setSize] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto'>('auto')
  const [title, setTitle] = useState<string | null>(null)
  const [modalType, setModalType] = useState<ModalType | null>(null)
  const [modalProps, setModalProps] = useState<ModalPropsByType[ModalType] | null>(null)
  const [withCloseButton, setWithCloseButton] = useState<boolean>(true)

  const showModal = <T extends ModalType>({ type, props }: ShowModal<T>) => {
    setModalType(type)
    setModalProps(props as ModalPropsByType[T])
  }

  const hideModal = () => {
    setModalType(null)
    setModalProps(null)
  }

  const modalTypes: Record<ModalType, ReactElement> = {
    alert: <Alert />,
    delete: <Delete />,
    copy: <Copy />,
    addSection: <AddSection />,
    loading: <Loading />,
    hitpoints: <Hitpoints />
  }

  return {
    showModal,
    hideModal,
    modalType,
    modalProps,
    setModalProps,
    modalTypes,
    size,
    setSize,
    title,
    setTitle,
    withCloseButton,
    setWithCloseButton
  }
}

const ModalProvider = ({ children }: { children: ReactNode }) => {
  const modalOptions = useModalOptions()
  const { hideModal, modalType, modalProps, modalTypes, size, title, withCloseButton } = modalOptions

  const handleClose = () => {
    if (modalProps && 'onClose' in modalProps && modalProps.onClose && typeof modalProps.onClose === 'function') {
      modalProps.onClose()
    }
    hideModal()
  }

  return (
    <ModalContext value={modalOptions}>
      {children}
      <Modal
        opened={modalType !== null}
        onClose={handleClose}
        title={title}
        size={size}
        withCloseButton={withCloseButton}
        centered
      >
        {modalTypes[modalType!]}
      </Modal>
    </ModalContext>
  )
}

export default ModalProvider
