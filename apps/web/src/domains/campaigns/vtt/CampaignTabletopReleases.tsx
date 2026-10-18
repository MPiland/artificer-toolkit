import { Button, Text, Title } from '@mantine/core'
import { useId } from 'react'
import type { EncounterReleaseChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  ReleaseRelationshipInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { CampaignTabletopCommandOutcome } from './CampaignTabletopCommandOutcome'
import { useWarnedCommand } from './useWarnedCommand'
import * as styles from './CampaignTabletopActionList.css'

type ReleasesProps = {
  releases: EncounterReleaseChoiceDto[]
  actorId: string
  encounterId: string
  encounterVersion: number
  disabled: boolean
  onRelease: (command: ReleaseRelationshipInputDto) => Promise<EncounterCommandResultDto>
}

/**
 * The creatures the current actor holds through a relationship it applied (D152): one row per
 * hold, released for no action. The outcome belongs to the holds on offer, so a different actor or
 * set of holds starts afresh.
 */
export function CampaignTabletopReleases(props: ReleasesProps) {
  const holdsKey = `${props.actorId}:${props.releases.map(({ activeEffectId }) => activeEffectId).join()}`
  return <ReleaseList key={holdsKey} {...props} />
}

function ReleaseList({
  releases,
  actorId,
  encounterId,
  encounterVersion,
  disabled,
  onRelease
}: ReleasesProps) {
  const titleId = useId()
  const { submittingId, feedback, error, run, cancelConfirmation } = useWarnedCommand(actorId)

  function release(choice: EncounterReleaseChoiceDto) {
    return run(
      choice.activeEffectId,
      () =>
        onRelease({
          type: 'RELEASE_RELATIONSHIP',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: encounterVersion,
          actorId,
          heldActorId: choice.heldActorId,
          activeEffectId: choice.activeEffectId
        }),
      { done: 'Released.', failed: 'The creature could not be released.' }
    )
  }

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <Title id={titleId} order={3} size='h5'>
        Holding
      </Title>
      <ul className={styles.list}>
        {releases.map((choice) => (
          <li className={styles.row} key={choice.activeEffectId}>
            <Text fw={600} size='sm'>
              {choice.label}{' '}
              <Text c='dimmed' component='span' fw={400} size='xs'>
                · No action
              </Text>
            </Text>
            <Button
              aria-label={choice.label}
              disabled={disabled || submittingId !== null}
              loading={submittingId === choice.activeEffectId}
              size='xs'
              variant='default'
              onClick={() => void release(choice)}
            >
              Release
            </Button>
          </li>
        ))}
      </ul>
      <CampaignTabletopCommandOutcome
        disabled={disabled || submittingId !== null}
        error={error}
        feedback={feedback}
        warnings={null}
        onCancel={cancelConfirmation}
        onConfirm={() => undefined}
      />
    </section>
  )
}
