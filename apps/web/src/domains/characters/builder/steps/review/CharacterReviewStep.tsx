import { Button, Text } from '@mantine/core'
import { useLocation } from '@tanstack/react-router'
import { withForm } from '#forms/app-form/AppForm'
import { useAuthoringForm } from '#forms/layout/AuthoringFormContext'
import { characterBuilderSteps, type CharacterBuilderStepId } from '../../core/stepNavigation'
import { EMPTY_CHARACTER_FORM_VALUES } from '../../shared/formNormalization'
import * as sharedStyles from '../../shared/builderShared.css'
import * as styles from './characterReview.css'
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'
import { getAuthoringStepHref } from '#forms/layout/authoringSearch'

type ReviewMessage = {
  message: string
  severity: 'blocking' | 'warning'
}

export const CharacterReviewStep = withForm({
  defaultValues: EMPTY_CHARACTER_FORM_VALUES,
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterReview({ payload }) {
    const authoring = useAuthoringForm()
    const currentHref = useLocation({ select: (location) => location.href })
    const summary = payload.resolution.summary
    const groupedMessages = buildReviewGroups(payload)

    return (
      <div className={sharedStyles.section}>
        <header className={styles.reviewReadinessHeader}>
          <div>
            <h3 className={styles.reviewReadinessTitle}>
              {payload.view.review.ready ? 'Ready to activate' : 'Needs attention'}
            </h3>
            <Text className={sharedStyles.mutedText}>
              {payload.view.review.ready
                ? 'Your character is ready to play.'
                : 'Resolve the items below before activating this character.'}
            </Text>
          </div>
          <Text fw={750}>{`Level ${summary.totalLevel}`}</Text>
        </header>
        <dl className={styles.reviewSummary}>
          <ReviewFact
            label='Race'
            value={
              summary.selectedRace?.subraceLabel ??
              summary.selectedRace?.raceLabel ??
              'Not selected'
            }
          />
          <ReviewFact
            label='Background'
            value={summary.selectedBackground?.label ?? 'Not selected'}
          />
          <ReviewFact
            label='Classes'
            value={
              summary.classes.length
                ? summary.classes
                    .map((classRecord) => `${classRecord.classLabel} ${classRecord.classLevel}`)
                    .join(', ')
                : 'Not selected'
            }
          />
          <ReviewFact
            label='Abilities'
            value={`${Object.keys(summary.abilities).length} of 6 assigned`}
          />
        </dl>
        {groupedMessages.length ? (
          <div className={styles.reviewBlockers}>
            {groupedMessages.map(([stepId, messages]) => (
              <section key={stepId} className={styles.reviewBlockerGroup}>
                <div className={styles.reviewBlockerHeader}>
                  <Text fw={700}>{getStepLabel(stepId)}</Text>
                  <Button
                    component='a'
                    href={getAuthoringStepHref(currentHref, stepId)}
                    size='compact-sm'
                    variant='subtle'
                    onClick={(event) => {
                      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      authoring.goToStep(stepId)
                    }}
                  >
                    Review step
                  </Button>
                </div>
                <ul className={styles.reviewMessageList}>
                  {messages.map((entry) => (
                    <li
                      key={`${entry.severity}:${entry.message}`}
                      className={
                        entry.severity === 'warning'
                          ? styles.reviewMessageWarning
                          : styles.reviewMessageBlocking
                      }
                    >
                      {entry.message}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    )
  }
})

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.reviewFact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function buildReviewGroups(
  payload: CharacterBuilderStepProps['payload']
): Array<[CharacterBuilderStepId, ReviewMessage[]]> {
  const groups = new Map<CharacterBuilderStepId, ReviewMessage[]>()
  const seen = new Set<string>()
  const add = (stepId: CharacterBuilderStepId, entry: ReviewMessage) => {
    if (seen.has(entry.message)) return
    seen.add(entry.message)
    groups.set(stepId, [...(groups.get(stepId) ?? []), entry])
  }

  for (const issue of payload.resolution.outstandingChoices) {
    add(issue.sectionId, { message: issue.message, severity: 'blocking' })
  }
  for (const validation of payload.resolution.validations) {
    add(validation.sectionId, {
      message: validation.message,
      severity: validation.severity === 'warning' ? 'warning' : 'blocking'
    })
  }
  for (const message of payload.view.review.blockers) {
    add('REVIEW', { message, severity: 'blocking' })
  }
  for (const message of payload.view.review.warnings) {
    add('REVIEW', { message, severity: 'warning' })
  }

  return characterBuilderSteps.flatMap((step) => {
    const messages = groups.get(step.id)
    return messages?.length ? [[step.id, messages]] : []
  })
}

function getStepLabel(stepId: CharacterBuilderStepId): string {
  return characterBuilderSteps.find((step) => step.id === stepId)?.label ?? 'Review'
}
