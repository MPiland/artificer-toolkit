import { Text } from '@mantine/core'
import { CircleCheck } from 'lucide-react'
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

export function Header() {
  const { hasChanges, authoredSession, subjectKindLabel, subjectLabel } = useAuthoringForm()
  const { status } = useAuthoringLayout()

  const title = subjectLabel ?? subjectKindLabel
  const provenanceLabel =
    authoredSession?.provenanceKind === 'MASTER'
      ? 'SRD'
      : authoredSession?.provenanceKind === 'OWNED'
        ? 'Homebrew'
        : undefined

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
            <StepsNavigationAction />
            <PreviewToggleAction />
          </div>
        </div>
        <div className={styles.formActions}>
          <span
            aria-label={hasChanges ? 'Unsaved changes' : 'All changes saved'}
            className={styles.saveState}
            data-dirty={hasChanges ? 'true' : 'false'}
            aria-live='polite'
          >
            {!hasChanges ? <CircleCheck size={15} aria-hidden='true' /> : null}
            {hasChanges ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <div className={styles.utilityActions}>
            <ResetActionMenu />
            <OverflowActionMenu />
          </div>
          <div className={styles.lifecycleActions}>
            <SaveDraftAction />
            <ActivateAction />
          </div>
        </div>
      </div>
    </header>
  )
}
