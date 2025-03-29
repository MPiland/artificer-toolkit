import { ReactElement, ReactNode, useState } from 'react'
import { ModalContext } from './ModalContext'
import Alert from '../Alert/Alert'
import Delete from '../Delete/Delete'
import Copy from '../Copy/Copy'
import Modal from './Modal'
import { FormDataType } from '../../types/form'
import { Class, Equipment, Feature, Race } from '../../../amplify/gql/types'

type ModalType = 'alert' | 'delete' | 'copy'

interface AlertModalProps {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
}

interface DeleteModalProps {
  item: FormDataType
  onDelete?: () => void
}

interface CopyModalProps {
  form: string
  data: Pick<FormDataType, 'id' | 'label' | 'value'>[] | Feature[] | undefined
  onCopy?: (() => void) | ((arg: any) => void)
  filters?: {
    races?: Race[]
    classes?: Class[]
    equipment?: Equipment[]
  }
}

type ModalConfig =
  | { type: 'alert'; props: AlertModalProps }
  | { type: 'delete'; props: DeleteModalProps }
  | { type: 'copy'; props: CopyModalProps }

const useModalOptions = () => {
  const [modalType, setModalType] = useState<ModalType | null>(null)
  const [modalProps, setModalProps] = useState<any>(null)

  const showModal = <T extends ModalConfig['type']>({
    type,
    props,
  }: {
    type: T
    props?: Extract<ModalConfig, { type: T }>['props']
  }) => {
    setModalType(type)
    setModalProps(props)
  }

  const hideModal = () => {
    setModalType(null)
    setModalProps(null)
  }

  const modalTypes: Record<ModalType, ReactElement> = {
    alert: <Alert />,
    delete: <Delete />,
    copy: <Copy />,
  }

  return {
    showModal,
    hideModal,
    modalType,
    modalProps,
    modalTypes,
  }
}

const ModalProvider = ({ children }: { children: ReactNode }) => {
  const { showModal, hideModal, modalType, modalProps, modalTypes } = useModalOptions()
  return (
    <ModalContext value={{ showModal, hideModal, modalType, modalProps, modalTypes }}>
      {children}
      {modalType !== null && <Modal>{modalTypes[modalType]}</Modal>}
    </ModalContext>
  )
}

export default ModalProvider

export type ModalOptionsType = ReturnType<typeof useModalOptions>
