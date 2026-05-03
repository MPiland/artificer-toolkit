import { Alert, Badge, Group, List, Stack, Text } from '@mantine/core'
import { withForm } from '#forms'
import { createFallbackCharacterFormValues } from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterReviewStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterReview({ payload }) {
    const messages = [
      ...payload.view.review.blockers,
      ...payload.view.review.warnings
    ]
    const summary = payload.resolution.summary

    return (
      <section className={styles.section} aria-labelledby='character-review-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-review-title' className={styles.sectionTitle}>Review</h3>
        </div>
        <Group>
          <Badge color={payload.view.review.ready ? 'green' : 'yellow'}>
            {payload.view.review.ready ? 'Ready to finalize' : 'Needs attention'}
          </Badge>
          <Badge variant='light'>{`Level ${summary.totalLevel}`}</Badge>
          {summary.selectedRace ? <Badge variant='light'>{summary.selectedRace.subraceLabel ?? summary.selectedRace.raceLabel}</Badge> : null}
          {summary.selectedBackground ? <Badge variant='light'>{summary.selectedBackground.label}</Badge> : null}
        </Group>
        <Stack gap='md' className={styles.inlinePanel}>
          <Text fw={700}>Build summary</Text>
          <Text c='dimmed'>
            {summary.classes.length
              ? summary.classes.map((classRecord) => `${classRecord.classLabel} ${classRecord.classLevel}`).join(', ')
              : 'No classes selected.'}
          </Text>
          <Text c='dimmed'>{`${Object.keys(summary.abilities).length} of 6 ability scores assigned.`}</Text>
        </Stack>
        {messages.length
          ? (
              <Alert color='yellow' title='Before finalizing'>
                <List spacing='xs'>
                  {messages.map((message) => <List.Item key={message}>{message}</List.Item>)}
                </List>
              </Alert>
            )
          : (
              <Alert color='green'>Everything required is complete. Finalize to write the normalized character record.</Alert>
            )}
      </section>
    )
  }
})
