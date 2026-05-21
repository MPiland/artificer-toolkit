import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react'
import { ActionIcon, Button, Tooltip } from '@mantine/core'
import ITrash from '#assets/icons/ITrash'
import IX from '#assets/icons/IX'
import { FullscreenModal } from '#ui/overlays/Modal/FullscreenModal'
import { useAuthoringForm } from '../components/AuthoringFormContext'
import { AuthoringActionBar } from '../layout/AuthoringActionBar'
import { AuthoringEditorHeaderProvider, type AuthoringEditorFooterState } from './AuthoringEditorHeaderContext'
import * as styles from './AuthoringEditorModal.css'

const AuthoringEditorModalDepthContext = createContext(0)
const BASE_EDITOR_MODAL_Z_INDEX = 200
const EDITOR_MODAL_Z_INDEX_STEP = 20

export function AuthoringEditorModal({
  breadcrumbs,
  children,
  removeAction,
  opened,
  readOnly,
  onBack,
  onClose
}: {
  breadcrumbs: readonly string[]
  children: ReactNode
  removeAction?: {
    label: string
    onClick: () => void
  }
  opened: boolean
  readOnly?: boolean
  onBack: () => void
  onClose: () => void
}) {
  const authoring = useAuthoringForm()
  const parentDepth = useContext(AuthoringEditorModalDepthContext)
  const depth = parentDepth + 1
  const labelledBy = useId()
  const [stepNav, setStepNav] = useState<ReactNode | null>(null)
  const [footerState, setFooterState] = useState<AuthoringEditorFooterState | null>(null)
  const title = useMemo(() => breadcrumbs.filter(Boolean).join(' / '), [breadcrumbs])
  const zIndex = BASE_EDITOR_MODAL_Z_INDEX + (depth - 1) * EDITOR_MODAL_Z_INDEX_STEP

  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy={labelledBy} zIndex={zIndex}>
      {opened
        ? (
            <AuthoringEditorModalDepthContext value={depth}>
              <div className={styles.shell}>
                <header className={styles.header}>
                  <div className={styles.headerMain}>
                    <h2 id={labelledBy} className={styles.visuallyHidden}>{title}</h2>
                    <div className={styles.breadcrumbs}>
                      <nav className={styles.breadcrumbList} aria-label='Editor location'>
                        {breadcrumbs.map((crumb, index) => (
                          <span key={`${crumb}-${index}`} className={styles.breadcrumbItem}>
                            {crumb}
                          </span>
                        ))}
                      </nav>
                      {stepNav ? <span className={styles.breadcrumbJoiner} aria-hidden='true'>/</span> : null}
                      {stepNav}
                    </div>
                  </div>
                  <div className={styles.headerActions}>
                    {!readOnly && removeAction
                      ? (
                          <Tooltip label={removeAction.label} withArrow>
                            <ActionIcon
                              aria-label={removeAction.label}
                              className={styles.removeAction}
                              variant='outline'
                              onClick={removeAction.onClick}
                            >
                              <ITrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )
                      : null}
                    <ActionIcon aria-label='Close editor' variant='subtle' onClick={onClose}>
                      <IX />
                    </ActionIcon>
                  </div>
                </header>
                <main className={styles.content}>
                  <AuthoringEditorHeaderProvider setFooterState={setFooterState} setStepNav={setStepNav}>
                    {children}
                  </AuthoringEditorHeaderProvider>
                </main>
                <AuthoringActionBar
                  padding='padded'
                  surface='header'
                  start={(
                    <Button
                      type='button'
                      variant='default'
                      onClick={footerState?.canGoBack ? footerState.onPrevious : onBack}
                    >
                      Back
                    </Button>
                  )}
                  center={(
                    <>
                      {!readOnly && footerState
                        ? (
                            <Button
                              type='button'
                              variant='default'
                              disabled={!authoring.hasChanges}
                              onClick={footerState.onResetStep}
                            >
                              {authoring.resetStepLabel}
                            </Button>
                          )
                        : null}
                      {!readOnly && authoring.canSaveDraft
                        ? (
                            <Button
                              disabled={!authoring.hasChanges}
                              type='button'
                              variant={authoring.hasChanges ? 'filled' : 'default'}
                              onClick={() => void authoring.saveDraft()}
                            >
                              {authoring.saveDraftLabel}
                            </Button>
                          )
                        : null}
                    </>
                  )}
                  end={footerState?.canGoNext
                    ? (
                        <Button type='button' onClick={footerState.onNext}>
                          Next
                        </Button>
                      )
                    : (
                        <Button type='button' onClick={onClose}>
                          Done
                        </Button>
                      )}
                />
              </div>
            </AuthoringEditorModalDepthContext>
          )
        : null}
    </FullscreenModal>
  )
}
