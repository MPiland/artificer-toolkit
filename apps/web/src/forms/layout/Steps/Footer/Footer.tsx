import { useMemo } from 'react'
import { useAuthoringLayout } from '../../AuthoringLayoutContext'
import { useAuthoringForm } from '../../AuthoringFormContext'
import { Rail } from '#ui'
import { StatusSummary } from '../StatusSummary/StatusSummary'
import { toAuthoringRailSummaries } from '../Steps.utils'
import * as styles from './Footer.css'

export function Footer() {
  const { visitedStepIds } = useAuthoringLayout()
  const { mode, hasChanges, progressSummary, stepStatuses } = useAuthoringForm()

  const summaries = useMemo(
    () =>
      toAuthoringRailSummaries({
        hasChanges,
        mode,
        stepStatuses,
        summary: progressSummary,
        visitedStepIds
      }),
    [hasChanges, mode, stepStatuses, progressSummary, visitedStepIds]
  )

  return summaries?.length ? (
    <Rail.Footer aria-label='Authoring status' className={styles.footer}>
      {summaries.map((summary) => (
        <StatusSummary key={summary.label} summary={summary} />
      ))}
    </Rail.Footer>
  ) : null
}
