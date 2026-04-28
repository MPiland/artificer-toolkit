import { type ReactNode } from 'react'
import { Modal as MantineModal } from '@mantine/core'
import { fullscreenBody, fullscreenContent } from './FullscreenModal.css.ts'

export interface FullscreenModalProps {
  children: ReactNode
  opened: boolean
  onClose: () => void
  labelledBy?: string
}

export function FullscreenModal({ children, opened, onClose, labelledBy }: FullscreenModalProps) {
  return (
    <MantineModal
      fullScreen
      opened={opened}
      onClose={onClose}
      aria-labelledby={labelledBy}
      withCloseButton={false}
      padding={0}
      classNames={{
        content: fullscreenContent,
        body: fullscreenBody
      }}
    >
      {children}
    </MantineModal>
  )
}
