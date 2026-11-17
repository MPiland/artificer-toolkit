import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { useId } from 'react'
import type { EncounterZoneMoveChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  MoveZoneInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { ACTIVATION_REGISTRY, formatLengthMeasurement } from '@artificer-toolkit/shared/core'
import { CampaignTabletopCommandOutcome } from './CampaignTabletopCommandOutcome'
import { useWarnedCommand } from './useWarnedCommand'
import * as styles from './CampaignTabletopActionList.css'

type ZoneMovesProps = {
  zoneMoves: EncounterZoneMoveChoiceDto[]
  actorId: string
  encounterId: string
  encounterVersion: number
  disabled: boolean
  /** The zone being moved, by its spatial effect id; null when none is chosen. */
  chosenZoneId: string | null
  /** Where the caster picked on the map for the chosen zone's new center; null until one is. */
  destination: MoveZoneInputDto['destination'] | null
  onChooseZone: (spatialEffectId: string | null) => void
  onPickOnMap: () => void
  onMove: (command: MoveZoneInputDto) => Promise<EncounterCommandResultDto>
}

/**
 * The zones the current actor placed and may move (QUALITY-15.T3y8): one row per zone, with the cost
 * moving it spends and how far its center may travel. Choosing a zone opens a pick of the point it
 * will be centered on. The outcome belongs to the zones on offer, so a different actor or set of zones
 * starts afresh.
 */
export function CampaignTabletopZoneMoves(props: ZoneMovesProps) {
  const zonesKey = `${props.actorId}:${props.zoneMoves.map(({ spatialEffectId }) => spatialEffectId).join()}`
  return <ZoneMoveList key={zonesKey} {...props} />
}

function ZoneMoveList({
  zoneMoves,
  actorId,
  encounterId,
  encounterVersion,
  disabled,
  chosenZoneId,
  destination,
  onChooseZone,
  onPickOnMap,
  onMove
}: ZoneMovesProps) {
  const titleId = useId()
  const { submittingId, confirming, feedback, error, run, cancelConfirmation } =
    useWarnedCommand(actorId)
  const busy = disabled || submittingId !== null

  function move(
    choice: EncounterZoneMoveChoiceDto,
    to: NonNullable<ZoneMovesProps['destination']>,
    acknowledgedWarnings: MoveZoneInputDto['acknowledgedWarnings']
  ) {
    return run(
      choice.spatialEffectId,
      async () => {
        const result = await onMove({
          type: 'MOVE_ZONE',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: encounterVersion,
          actorId,
          spatialEffectId: choice.spatialEffectId,
          destination: to,
          acknowledgedWarnings
        })
        onChooseZone(null)
        return result
      },
      { done: () => 'Zone moved.', failed: 'The zone could not be moved.' }
    )
  }

  const confirmingChoice = zoneMoves.find(
    ({ spatialEffectId }) => spatialEffectId === confirming?.id
  )
  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <Title id={titleId} order={3} size='h5'>
        Zone choices
      </Title>
      <ul className={styles.list}>
        {zoneMoves.map((choice) => {
          const chosen = choice.spatialEffectId === chosenZoneId
          return (
            <li className={styles.row} key={choice.spatialEffectId}>
              <Stack gap={4} style={{ flex: 1 }}>
                <Text fw={600} size='sm'>
                  {`Move ${choice.label}`}{' '}
                  <Text c='dimmed' component='span' fw={400} size='xs'>
                    · {ACTIVATION_REGISTRY[choice.activation].label} · up to{' '}
                    {formatLengthMeasurement(choice.maxDistance)}
                  </Text>
                </Text>
                {choice.warnings.length ? (
                  <Text c='dimmed' size='xs'>
                    {choice.warnings.map((warning) => warning.message).join(' ')}
                  </Text>
                ) : null}
                {chosen ? (
                  <Group align='center' wrap='nowrap'>
                    <Button disabled={busy} variant='default' onClick={onPickOnMap}>
                      Pick on map
                    </Button>
                    <Text c='dimmed' size='xs'>
                      {destination ? 'New center picked.' : 'Pick the zone’s new center.'}
                    </Text>
                  </Group>
                ) : null}
              </Stack>
              {chosen ? (
                <Button
                  disabled={busy || destination === null}
                  loading={submittingId === choice.spatialEffectId}
                  size='xs'
                  onClick={() => destination && void move(choice, destination, [])}
                >
                  Move
                </Button>
              ) : (
                <Button
                  aria-label={`Move ${choice.label}`}
                  disabled={busy}
                  size='xs'
                  variant='default'
                  onClick={() => onChooseZone(choice.spatialEffectId)}
                >
                  Choose destination
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <CampaignTabletopCommandOutcome
        disabled={busy}
        error={error}
        feedback={feedback}
        warnings={confirmingChoice ? (confirming?.warnings ?? null) : null}
        onCancel={cancelConfirmation}
        onConfirm={(warnings) =>
          confirmingChoice &&
          destination &&
          void move(
            confirmingChoice,
            destination,
            warnings.map((warning) => warning.code)
          )
        }
      />
    </section>
  )
}
