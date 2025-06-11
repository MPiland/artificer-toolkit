import { ReactElement, ReactNode, useState } from 'react'
import { ModalContext } from './ModalContext'
import Alert from '@/components/Alert'
import Delete from '@/components/Delete'
import Copy from '@/components/Copy'
import Modal from './Modal'
import type {
  ListItemType,
  Feature,
  BackgroundListItem,
  ClassListItem,
  EquipmentListItem,
  FeatListItem,
  RaceListItem,
  AncestryFeature,
  FeatureOption,
} from '@/types'
import { AddSection } from '@/components/Form/Features/Sections'
import Loading from '../Loading'

type ModalType = 'alert' | 'delete' | 'copy' | 'addSection' | 'loading'

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
        value: string
        raceIds?: string[]
        classIds?: string[]
        equipmentIds?: string[]
        featIds?: string[]
        backgroundIds?: string[]
      }[]
    | undefined
  onCopy: (() => void) | ((arg: any) => void)
  filters?: {
    races: RaceListItem[]
    classes: ClassListItem[]
    equipment: EquipmentListItem[]
    backgrounds: BackgroundListItem[]
    feats: FeatListItem[]
  }
}

export interface AddSectionModalProps {
  featureData: Feature | AncestryFeature | FeatureOption
  onAddSection: (sectionName: string) => void
}

export interface LoadingModalProps {
  isLoading: boolean
}

export type ModalConfig =
  | { type: 'alert'; props: AlertModalProps }
  | { type: 'delete'; props: DeleteModalProps }
  | { type: 'copy'; props: CopyModalProps }
  | { type: 'addSection'; props: AddSectionModalProps }
  | { type: 'loading'; props: LoadingModalProps }

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
}

const useModalOptions = () => {
  const [modalType, setModalType] = useState<ModalType | null>(null)
  const [modalProps, setModalProps] = useState<ModalPropsByType[ModalType] | null>(null)

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
