import type { ReactNode } from 'react'
import { ActionIcon, Button } from '@mantine/core'
import IX from '#assets/icons/IX'
import { FullscreenModal } from '#ui/overlays/Modal/FullscreenModal'
import * as styles from './AuthoringEditorModal.css'

export function AuthoringEditorModal({
  children,
  opened,
  readOnly,
  title,
  onClose
}: {
  children: ReactNode
  opened: boolean
  readOnly?: boolean
  title: string
  onClose: () => void
}) {
  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy='authoring-editor-title'>
      {opened
        ? (
            <form
              className={styles.shell}
              onSubmit={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onClose()
              }}
            >
              <header className={styles.header}>
                <h2 id='authoring-editor-title' className={styles.title}>{title}</h2>
                <ActionIcon aria-label='Close editor' variant='subtle' onClick={onClose}>
                  <IX />
                </ActionIcon>
              </header>
              <main className={styles.content}>
                {children}
              </main>
              <footer className={styles.footer}>
                <Button type='button' variant='default' onClick={onClose}>Back</Button>
                {!readOnly ? <Button type='submit'>Save</Button> : null}
              </footer>
            </form>
          )
        : null}
    </FullscreenModal>
  )
}
