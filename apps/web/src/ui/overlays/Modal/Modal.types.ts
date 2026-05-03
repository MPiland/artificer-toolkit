import type { ReactElement } from 'react'

type ModalType = 'alert' | 'delete' | 'copy' | 'addSection' | 'loading' | 'hitpoints'

type ModalListItem = {
  id: string
  label: string
}

export interface AlertModalProps {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export interface DeleteModalProps {
  label: string
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
    races: ModalListItem[]
    classes: ModalListItem[]
    equipment: ModalListItem[]
    backgrounds: ModalListItem[]
    feats: ModalListItem[]
  }
}

export interface AddSectionModalProps {
  onAddSection: (section: string) => void
}

export interface LoadingModalProps {
  isLoading: boolean
}

export interface HitpointModalProps {
  setFieldValue: (name: string, value: string | number | string[] | undefined | null) => void
  onCancel?: () => void
}

export type ModalConfig
  = | { type: 'alert', props: AlertModalProps }
    | { type: 'delete', props: DeleteModalProps }
    | { type: 'copy', props: CopyModalProps }
    | { type: 'addSection', props: AddSectionModalProps }
    | { type: 'loading', props: LoadingModalProps }
    | { type: 'hitpoints', props: HitpointModalProps }

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

export interface ModalOptions {
  showModal: <T extends ModalType>(config: ShowModal<T>) => void
  hideModal: () => void
  modalType: ModalType | null
  modalProps: ModalPropsByType[ModalType] | null
  setModalProps: (props: ModalPropsByType[ModalType] | null) => void
  modalTypes: Record<ModalType, ReactElement>
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto'
  setSize: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto') => void
  title: string | null
  setTitle: (title: string | null) => void
  withCloseButton: boolean
  setWithCloseButton: (withCloseButton: boolean) => void
}
