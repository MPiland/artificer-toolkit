import { useMemo, type CSSProperties } from 'react'
import { useAuthoringForm } from '../../AuthoringFormContext'
import { useAuthoringLayout } from '../../AuthoringLayoutContext'
import { Rail } from '#ui'
import { StatusSummary } from '../StatusSummary/StatusSummary'
import { toAuthoringRailSummaries } from '../Steps.utils'
import * as styles from './Footer.css'

export function Footer() {
  const { mode, hasChanges, progressSummary, stepStatuses } = useAuthoringForm()
  const { visibleSteps, visitedStepIds } = useAuthoringLayout()
  const visibleStepCount = visibleSteps.length
  const completedSteps = visibleStepCount > 0
    ? visibleSteps.filter(
        (step) => stepStatuses?.[step.id] === 'complete' && visitedStepIds.has(step.id)
      ).length
    : (progressSummary?.completeCount ?? 0)
  const summary = {
    completeCount: completedSteps,
    errorCount: progressSummary?.errorCount ?? 0,
    incompleteCount: progressSummary?.incompleteCount ?? 0,
    stepCount: visibleStepCount || progressSummary?.stepCount || 0,
    warningCount: progressSummary?.warningCount ?? 0
  }

  const summaries = useMemo(
    () =>
      toAuthoringRailSummaries({
        hasChanges,
        mode,
        summary
      }),
    [hasChanges, mode, summary]
  )
  const totalSteps = summary?.stepCount ?? 0
  const completionPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  return summaries?.length ? (
    <Rail.Footer aria-label='Authoring status' className={styles.footer}>
      <div className={styles.footerContent}>
        {totalSteps > 0 ? (
          <div
            aria-label={`${completedSteps} of ${totalSteps} steps complete`}
            aria-valuemax={totalSteps}
            aria-valuemin={0}
            aria-valuenow={completedSteps}
            className={styles.progressTrack}
            role='progressbar'
          >
            <span
              className={styles.progressFill}
              style={{ '--authoring-progress': `${completionPercentage}%` } as CSSProperties}
            />
          </div>
        ) : null}
        <div className={styles.summaryRow}>
          {summaries.map((summary) => (
            <StatusSummary key={summary.label} summary={summary} />
          ))}
        </div>
      </div>
    </Rail.Footer>
  ) : null
}
