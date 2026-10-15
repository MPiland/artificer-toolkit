import { Button, Stack, Text, Title } from '@mantine/core'
import { useId } from 'react'
import type { EncounterHeldGrantEndChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  EndHeldGrantInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { ACTIVATION_REGISTRY } from '@artificer-toolkit/shared/core'
import { CampaignTabletopCommandOutcome } from './CampaignTabletopCommandOutcome'
import { useWarnedCommand } from './useWarnedCommand'
import * as styles from './CampaignTabletopActionList.css'

type HeldGrantEndsProps = {
  heldGrantEnds: EncounterHeldGrantEndChoiceDto[]
  actorId: string
  encounterId: string
  encounterVersion: number
  disabled: boolean
  onEnd: (command: EndHeldGrantInputDto) => Promise<EncounterCommandResultDto>
}

/**
 * The effects the current actor holds and may end itself (D113): one row per grant that lets its
 * holder end it, with the cost ending it spends. The outcome belongs to the effects on offer, so a
 * different actor or set of effects starts afresh.
 */
export function CampaignTabletopHeldGrantEnds(props: HeldGrantEndsProps) {
  const effectsKey = `${props.actorId}:${props.heldGrantEnds.map(({ activeEffectId }) => activeEffectId).join()}`
  return <HeldGrantEndList key={effectsKey} {...props} />
}

function HeldGrantEndList({
  heldGrantEnds,
  actorId,
  encounterId,
  encounterVersion,
  disabled,
  onEnd
}: HeldGrantEndsProps) {
  const titleId = useId()
  const { submittingId, confirming, feedback, error, run, cancelConfirmation } =
    useWarnedCommand(actorId)

  function end(
    choice: EncounterHeldGrantEndChoiceDto,
    acknowledgedWarnings: EndHeldGrantInputDto['acknowledgedWarnings']
  ) {
    return run(
      choice.activeEffectId,
      () =>
        onEnd({
          type: 'END_HELD_GRANT',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: encounterVersion,
          actorId,
          activeEffectId: choice.activeEffectId,
          acknowledgedWarnings
        }),
      { done: () => 'Effect ended.', failed: 'The effect could not be ended.' }
    )
  }

  const confirmingChoice = heldGrantEnds.find((choice) => choice.activeEffectId === confirming?.id)
  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <Title id={titleId} order={3} size='h5'>
        Active effects
      </Title>
      <ul className={styles.list}>
        {heldGrantEnds.map((choice) => (
          <li className={styles.row} key={choice.activeEffectId}>
            <Stack gap={4}>
              <Text fw={600} size='sm'>
                {choice.label}{' '}
                <Text c='dimmed' component='span' fw={400} size='xs'>
                  · {ACTIVATION_REGISTRY[choice.actionCost].label}
                </Text>
              </Text>
              {choice.warnings.length ? (
                <Text c='dimmed' size='xs'>
                  {choice.warnings.map((warning) => warning.message).join(' ')}
                </Text>
              ) : null}
            </Stack>
            <Button
              aria-label={`End ${choice.label}`}
              disabled={disabled || submittingId !== null}
              loading={submittingId === choice.activeEffectId}
              size='xs'
              variant='default'
              onClick={() => void end(choice, [])}
            >
              End
            </Button>
          </li>
        ))}
      </ul>
      <CampaignTabletopCommandOutcome
        disabled={disabled || submittingId !== null}
        error={error}
        feedback={feedback}
        warnings={confirmingChoice ? (confirming?.warnings ?? null) : null}
        onCancel={cancelConfirmation}
        onConfirm={(warnings) =>
          confirmingChoice &&
          void end(
            confirmingChoice,
            warnings.map((warning) => warning.code)
          )
        }
      />
    </section>
  )
}
