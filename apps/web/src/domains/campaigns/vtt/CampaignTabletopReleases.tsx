import { Button, Text, Title } from '@mantine/core'
import { useId } from 'react'
import type { EncounterHeldRelationshipDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  ReleaseRelationshipInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { CampaignTabletopCommandOutcome } from './CampaignTabletopCommandOutcome'
import { useWarnedCommand } from './useWarnedCommand'
import * as styles from './CampaignTabletopActionList.css'

type ReleasesProps = {
  releases: Omit<EncounterHeldRelationshipDto, 'drag'>[]
  encounterId: string
  encounterVersion: number
  disabled: boolean
  onRelease: (command: ReleaseRelationshipInputDto) => Promise<EncounterCommandResultDto>
}

/**
 * The creatures held through a relationship their source applied (D152): one row per hold, which
 * its source releases for no action. The outcome belongs to the holds on offer, so a different set
 * of holds starts afresh.
 */
export function CampaignTabletopReleases(props: ReleasesProps) {
  const holdsKey = props.releases
    .map(({ sourceActorId, activeEffectId }) => `${sourceActorId}:${activeEffectId}`)
    .join()
  return <ReleaseList key={holdsKey} {...props} />
}

function ReleaseList({
  releases,
  encounterId,
  encounterVersion,
  disabled,
  onRelease
}: ReleasesProps) {
  const titleId = useId()
  const { submittingId, feedback, error, run, cancelConfirmation } = useWarnedCommand(encounterId)

  function release(choice: EncounterHeldRelationshipDto) {
    return run(
      choice.activeEffectId,
      () =>
        onRelease({
          type: 'RELEASE_RELATIONSHIP',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: encounterVersion,
          actorId: choice.sourceActorId,
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
