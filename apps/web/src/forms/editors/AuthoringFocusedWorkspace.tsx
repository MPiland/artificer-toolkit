import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { ActionIcon, Button, Drawer, Tooltip } from '@mantine/core'
import { ListTree } from 'lucide-react'
import IX from '#assets/icons/IX'
import ITrash from '#assets/icons/ITrash'
import { useAuthoringForm } from '../components/AuthoringFormContext'
import { AuthoringActionBar } from '../layout/AuthoringActionBar'
import { AuthoringEditorHeaderProvider, type AuthoringEditorFooterState } from './AuthoringEditorHeaderContext'
import * as styles from './AuthoringFocusedWorkspace.css'

const AuthoringFocusedWorkspaceDepthContext = createContext(0)
const BASE_EDITOR_WORKSPACE_Z_INDEX = 200
const EDITOR_WORKSPACE_Z_INDEX_STEP = 20

export function AuthoringFocusedWorkspace({
  breadcrumbs,
  children,
  removeAction,
  opened,
  readOnly,
  onBack,
  onClose,
  preview,
  previewLabel = 'Preview'
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
  preview?: ReactNode
  previewLabel?: string
}) {
  const authoring = useAuthoringForm()
  const hasPreview = true
  const parentDepth = useContext(AuthoringFocusedWorkspaceDepthContext)
  const depth = parentDepth + 1
  const labelledBy = useId()
  const [stepNav, setStepNav] = useState<ReactNode | null>(null)
  const [footerState, setFooterState] = useState<AuthoringEditorFooterState | null>(null)
  const [structureOpened, setStructureOpened] = useState(false)
  const [previewOpened, setPreviewOpened] = useState(false)
  const title = useMemo(() => breadcrumbs.filter(Boolean).join(' / '), [breadcrumbs])
  const visibleTitle = breadcrumbs[breadcrumbs.length - 1] ?? 'Editor'
  const contextLabel = breadcrumbs.slice(Math.max(0, breadcrumbs.length - 3), -1).join(' / ')
  const insightPanel = preview ?? (
    <FocusedWorkspaceInsight
      contextLabel={contextLabel}
      hasChanges={authoring.hasChanges}
      hasStepChanges={Boolean(footerState?.hasStepChanges)}
      title={visibleTitle}
    />
  )
  const zIndex = BASE_EDITOR_WORKSPACE_Z_INDEX + (depth - 1) * EDITOR_WORKSPACE_Z_INDEX_STEP

  useEffect(() => {
    if (!opened) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, opened])

  if (!opened) return null

  return (
    <AuthoringFocusedWorkspaceDepthContext value={depth}>
      <section
        aria-labelledby={labelledBy}
        className={styles.shell}
        role='region'
        style={{ zIndex }}
      >
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <h2 id={labelledBy} className={styles.visuallyHidden}>{title}</h2>
            <div className={styles.titleStack}>
              {contextLabel ? <p className={styles.contextLine}>{contextLabel}</p> : null}
              <p className={styles.titleLine}>{visibleTitle}</p>
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
        {stepNav
          ? (
              <Drawer
                opened={structureOpened}
                onClose={() => setStructureOpened(false)}
                position='left'
                size='min(320px, 86vw)'
                title='Editor structure'
                zIndex={zIndex + 1}
              >
                <div className={styles.drawerNav}>{stepNav}</div>
              </Drawer>
            )
          : null}
        {hasPreview
          ? (
              <Drawer
                opened={previewOpened}
                onClose={() => setPreviewOpened(false)}
                position='right'
                size='min(360px, 90vw)'
              title={preview == null ? 'Context' : previewLabel}
              zIndex={zIndex + 1}
            >
                <div className={styles.drawerNav}>{insightPanel}</div>
              </Drawer>
            )
          : null}
        <main
          className={
            stepNav
              ? (hasPreview ? styles.workspaceWithRailPreview : styles.workspaceWithRail)
              : (hasPreview ? styles.workspaceWithPreview : styles.workspace)
          }
        >
          {stepNav
            ? (
                <aside className={styles.structureRail} aria-label='Editor structure'>
                  <div className={styles.structureRailHeader}>
                    <span className={styles.structureRailEyebrow}>Structure</span>
                    <span className={styles.structureRailCurrent}>{visibleTitle}</span>
                  </div>
                  {stepNav}
                </aside>
              )
            : null}
          {stepNav || hasPreview
            ? (
                <div className={styles.mobileStructureBar}>
                  {stepNav
                    ? (
                        <Button
                          leftSection={<ListTree size={16} />}
                          type='button'
                          variant='default'
                          onClick={() => setStructureOpened(true)}
                        >
                          Structure
                        </Button>
                      )
                    : null}
                  <span className={styles.mobileStructureCurrent}>{visibleTitle}</span>
                  {hasPreview
                    ? (
                        <Button
                          type='button'
                          variant='default'
                          onClick={() => setPreviewOpened(true)}
                        >
                          {preview == null ? 'Context' : previewLabel}
                        </Button>
                      )
                    : null}
                </div>
              )
            : null}
          <div className={styles.content}>
            <AuthoringEditorHeaderProvider setFooterState={setFooterState} setStepNav={setStepNav}>
              {children}
            </AuthoringEditorHeaderProvider>
          </div>
          {hasPreview
            ? (
                <aside className={styles.previewRail} aria-label={preview == null ? 'Context' : previewLabel}>
                  <div className={styles.previewRailHeader}>{preview == null ? 'Context' : previewLabel}</div>
                  {insightPanel}
                </aside>
              )
            : null}
        </main>
        <AuthoringActionBar
          className={styles.actionBarSlot}
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
                      disabled={!footerState.hasStepChanges}
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
      </section>
    </AuthoringFocusedWorkspaceDepthContext>
  )
}

function FocusedWorkspaceInsight({
  contextLabel,
  hasChanges,
  hasStepChanges,
  title
}: {
  contextLabel: string
  hasChanges: boolean
  hasStepChanges: boolean
  title: string
}) {
  return (
    <div className={styles.insightStack}>
      <section className={styles.insightSection} aria-label='Outcome context'>
        <div className={styles.insightSectionHeader}>Outcome Context</div>
        <dl className={styles.insightMetaList}>
          <div className={styles.insightMetaRow}>
            <dt className={styles.insightMetaTerm}>Object</dt>
            <dd className={styles.insightMetaValue}>{title}</dd>
          </div>
          {contextLabel
            ? (
                <div className={styles.insightMetaRow}>
                  <dt className={styles.insightMetaTerm}>Path</dt>
                  <dd className={styles.insightMetaValue}>{contextLabel}</dd>
                </div>
              )
            : null}
        </dl>
      </section>
      <section className={styles.insightSection} aria-label='Rule preview'>
        <div className={styles.insightSectionHeader}>Rule Preview</div>
        <p className={styles.insightPreviewText}>
          <strong>{title}</strong>
          {' '}
          is the focused object currently being edited.
        </p>
        <div className={styles.insightSignalList}>
          <span className={hasStepChanges ? styles.insightSignalActive : styles.insightSignal}>
            {hasStepChanges ? 'This editor step has unsaved changes.' : 'No unsaved changes on this editor step.'}
          </span>
          <span className={hasChanges ? styles.insightSignalActive : styles.insightSignal}>
            {hasChanges ? 'Draft changes are ready to save.' : 'The draft matches the saved version.'}
          </span>
        </div>
      </section>
    </div>
  )
}
