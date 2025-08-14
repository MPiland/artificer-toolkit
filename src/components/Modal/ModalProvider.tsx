import { ReactElement, ReactNode, useState } from 'react'
import { ModalContext } from './ModalContext'
import Alert from '~/components/Alert'
import Delete from '~/components/Delete'
import Copy from '~/components/Copy'
import type {
  ListItemType,
  BackgroundListItem,
  ClassListItem,
  EquipmentListItem,
  FeatListItem,
  RaceListItem,
} from '~/types'
import { AddSection, SECTION_STEPS } from '~/components/Form'
import Loading from '../Loading'
import Hitpoints from '../Hitpoints/Hitpoints'
import { Modal } from '@mantine/core'

type ModalType = 'alert' | 'delete' | 'copy' | 'addSection' | 'loading' | 'hitpoints'

export interface AlertModalProps {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export interface DeleteModalProps {
  label: ListItemType['label']
  onDelete: () => void
}

export interface CopyModalProps {
  form: string
  data:
    | {
        id: string
        label: string
        raceIds?: string[]
        classIds?: string[]
        equipmentIds?: string[]
        backgroundIds?: string[]
        featIds?: string[]
      }[]
    | undefined
  onCopy: (arg: unknown) => void
  filters?: {
    races: RaceListItem[]
    classes: ClassListItem[]
    equipment: EquipmentListItem[]
    backgrounds: BackgroundListItem[]
    feats: FeatListItem[]
  }
}

export interface AddSectionModalProps {
  onAddSection: (arg: (typeof SECTION_STEPS)[number] | 'options') => void
}

export interface LoadingModalProps {
  isLoading: boolean
}

export interface HitpointModalProps {
  setFieldValue: (name: string, value: string | number | string[] | undefined | null) => void
  onCancel?: () => void
}

export type ModalConfig =
  | { type: 'alert'; props: AlertModalProps }
  | { type: 'delete'; props: DeleteModalProps }
  | { type: 'copy'; props: CopyModalProps }
  | { type: 'addSection'; props: AddSectionModalProps }
  | { type: 'loading'; props: LoadingModalProps }
  | { type: 'hitpoints'; props: HitpointModalProps }

export type ShowModal<T> = {
  type: T
  props?: Extract<ModalConfig, { type: T }>['props']
}

export type ModalPropsByType = {
  alert: AlertModalProps
  delete: DeleteModalProps
  copy: CopyModalProps
  addSection: AddSectionModalProps
  loading: LoadingModalProps
  hitpoints: HitpointModalProps
}

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
    hitpoints: <Hitpoints />,
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
    setWithCloseButton,
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

export type ModalOptionsType = ReturnType<typeof useModalOptions>
