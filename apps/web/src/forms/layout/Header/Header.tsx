import { Text } from '@mantine/core'
import { CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import * as styles from './Header.css'
import {
  ActivateAction,
  OverflowActionMenu,
  PreviewToggleAction,
  SaveDraftAction,
  ResetActionMenu,
  StepsNavigationAction
} from '../Actions/Actions'
import { useAuthoringForm } from '../AuthoringFormContext'
import { useAuthoringLayout } from '../AuthoringLayoutContext'

export function Header({
  showActivate = true,
  showStepsNavigation = true,
  title: titleOverride
}: {
  showActivate?: boolean
  showStepsNavigation?: boolean
  title?: ReactNode
}) {
  const { hasChanges, authoredSession, draftSaveStatus, subjectKindLabel, subjectLabel } =
    useAuthoringForm()
  const { status } = useAuthoringLayout()

  const title = titleOverride ?? subjectLabel ?? subjectKindLabel
  const provenanceLabel =
    authoredSession?.provenanceKind === 'MASTER'
      ? 'SRD'
      : authoredSession?.provenanceKind === 'OWNED'
        ? 'Homebrew'
        : undefined
  // An autosaving form reports its save; others report unsaved edits.
  const saveStateLabel =
    draftSaveStatus === 'saving'
      ? 'Saving…'
      : draftSaveStatus === 'retrying'
        ? 'Couldn’t save, retrying'
        : hasChanges
          ? 'Unsaved changes'
          : draftSaveStatus === 'saved'
            ? 'Saved'
            : 'All changes saved'
  const isUnsaved = draftSaveStatus === 'retrying' || (draftSaveStatus !== 'saving' && hasChanges)
  const isSaved = draftSaveStatus !== 'saving' && !isUnsaved
  return (
    <header className={styles.header}>
      <div className={styles.contextBar}>
        <span>
          {`${subjectKindLabel} · ${status.label}${provenanceLabel ? ` · ${provenanceLabel}` : ''}`}
        </span>
      </div>
      <div className={styles.headerMain}>
        <div className={styles.titleRow}>
          <span className={styles.statusBadge}>{status.label}</span>
          <div className={styles.titleStack}>
            <Text component='h1' className={styles.title}>
              {title}
            </Text>
          </div>
          {provenanceLabel ? (
            <span className={styles.provenanceBadge}>{provenanceLabel}</span>
          ) : null}
          <div className={styles.viewActions}>
            {showStepsNavigation ? <StepsNavigationAction /> : null}
            <PreviewToggleAction />
          </div>
        </div>
        <div className={styles.formActions}>
          <span
            aria-label={saveStateLabel}
            className={styles.saveState}
            data-dirty={isUnsaved ? 'true' : 'false'}
            data-saving={draftSaveStatus === 'saving' ? 'true' : undefined}
            aria-live='polite'
          >
            {isSaved ? <CircleCheck size={15} aria-hidden='true' /> : null}
            {saveStateLabel}
          </span>
          <div className={styles.utilityActions}>
            <ResetActionMenu />
            <OverflowActionMenu />
          </div>
          <div className={styles.lifecycleActions}>
            <SaveDraftAction />
            {showActivate ? <ActivateAction /> : null}
          </div>
        </div>
      </div>
    </header>
  )
}
