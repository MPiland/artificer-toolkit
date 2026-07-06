import { Text } from '@mantine/core'
import { FilePenLine } from 'lucide-react'
import * as styles from './Header.css'
import {
  DeleteRecordAction,
  PreviewToggleAction,
  SaveDraftAction,
  ResetActionMenu,
  StepsNavigationAction
} from '../Actions/Actions'
import { getAuthoringStatus } from '../AuthoringLayout.utils'
import { useAuthoringForm } from '../AuthoringFormContext'

export function Header() {
  const { mode, isDraft, hasActiveDraft, activeStepLabel, subjectKindLabel } = useAuthoringForm()

  const title = activeStepLabel ?? subjectKindLabel
  const status = getAuthoringStatus(mode, isDraft || hasActiveDraft)

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <Text component='h1' className={styles.title}>
          {title}
        </Text>
        <StepsNavigationAction />
        <PreviewToggleAction />
      </div>
      <div className={styles.formActions}>
        <ResetActionMenu />
        <SaveDraftAction />
        <DeleteRecordAction />
        {status.label ? (
          <span className={styles.statusBadge} aria-label={`Current status: ${status.label}`}>
            <FilePenLine size={14} aria-hidden='true' />
            {status.label}
          </span>
        ) : null}
      </div>
    </header>
  )
}
