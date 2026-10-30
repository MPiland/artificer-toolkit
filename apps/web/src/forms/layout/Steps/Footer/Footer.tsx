import { useMemo, type CSSProperties, type MouseEvent } from 'react'
import { Button } from '@mantine/core'
import { X } from 'lucide-react'
import {
  useAuthoringActions,
  useAuthoringNavigation,
  useAuthoringSession,
  useAuthoringStagedEditor
} from '../../AuthoringFormContext'
import { useAuthoringFormStatus } from '../../useAuthoringFormStatus'
import { useAuthoringLayout } from '../../AuthoringLayoutContext'
import { Rail } from '#ui'
import { StatusSummary } from '../StatusSummary/StatusSummary'
import { toAuthoringNavigationRailItems, toAuthoringRailSummaries } from '../Steps.utils'
import * as styles from './Footer.css'

export function Footer() {
  const { cancelHref, cancelLabel, mode } = useAuthoringSession()
  const { cancel } = useAuthoringActions()
  const { navigationTree, progressSummary, stepStatuses, visitedStepIds } = useAuthoringNavigation()
  const { hasChanges } = useAuthoringFormStatus()
  const stagedEditorOpen = Boolean(useAuthoringStagedEditor().groupEditor)
  const { isWideDesktop, stepsNavigationOpen, toggleStepsNavigation, visibleSteps } =
    useAuthoringLayout()
  const navigationProgressItems = navigationTree?.length
    ? toAuthoringNavigationRailItems({
        mode,
        navigationTree,
        onTargetSelect: () => undefined,
        visitedStepIds
      })
    : undefined
  const visibleStepCount = navigationProgressItems?.length ?? visibleSteps.length
  const completedSteps =
    navigationProgressItems != null
      ? navigationProgressItems.filter((item) => item.status === 'complete').length
      : visibleStepCount > 0
        ? visibleSteps.filter((step) => stepStatuses?.[step.id] === 'complete').length
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
  const hasStatus = Boolean(summaries?.length)

  const handleCancel = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return
    }

    event.preventDefault()
    if (!isWideDesktop && stepsNavigationOpen) toggleStepsNavigation()
    void cancel()
  }

  if (!cancelHref && !hasStatus) return null

  return (
    <Rail.Footer className={styles.footer}>
      {hasStatus ? (
        <div aria-label='Authoring status' className={styles.statusContent}>
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
      ) : null}
      {cancelHref ? (
        <div className={styles.cancelRow}>
          {stagedEditorOpen ? (
            <Button
              className={styles.cancelAction}
              disabled
              fullWidth
              leftSection={<X aria-hidden='true' size={16} />}
              type='button'
              variant='subtle'
            >
              {cancelLabel}
            </Button>
          ) : (
            <Button
              className={styles.cancelAction}
              component='a'
              fullWidth
              href={cancelHref}
              leftSection={<X aria-hidden='true' size={16} />}
              onClick={handleCancel}
              variant='subtle'
            >
              {cancelLabel}
            </Button>
          )}
        </div>
      ) : null}
    </Rail.Footer>
  )
}
