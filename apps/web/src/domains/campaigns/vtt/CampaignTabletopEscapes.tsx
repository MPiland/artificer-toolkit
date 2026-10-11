import { Button, Select, Stack, Text, Title } from '@mantine/core'
import { useId, useState } from 'react'
import type { EncounterEscapeChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  EscapeRelationshipInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { ACTIVATION_REGISTRY } from '@artificer-toolkit/shared/core'
import { CampaignTabletopCommandOutcome } from './CampaignTabletopCommandOutcome'
import { useWarnedCommand } from './useWarnedCommand'
import * as styles from './CampaignTabletopActionList.css'

type EscapesProps = {
  escapes: EncounterEscapeChoiceDto[]
  actorId: string
  encounterId: string
  encounterVersion: number
  disabled: boolean
  onEscape: (command: EscapeRelationshipInputDto) => Promise<EncounterCommandResultDto>
}

/**
 * The holds the current actor can try to break (D105): one row per relationship effect that allows an
 * escape, with its DC, cost and the check to roll. A check is chosen only where the effect allows more
 * than one; the first allowed check is the default. The chosen checks and the outcome belong to the
 * holds on offer, so a different actor or set of effects starts afresh.
 */
export function CampaignTabletopEscapes(props: EscapesProps) {
  const holdsKey = `${props.actorId}:${props.escapes.map(({ activeEffectId }) => activeEffectId).join()}`
  return <EscapeList key={holdsKey} {...props} />
}

function EscapeList({
  escapes,
  actorId,
  encounterId,
  encounterVersion,
  disabled,
  onEscape
}: EscapesProps) {
  const titleId = useId()
  const [checkByEffect, setCheckByEffect] = useState<Record<string, string>>({})
  const { submittingId, confirming, feedback, error, run, cancelConfirmation } =
    useWarnedCommand(actorId)

  const chosenCheck = (choice: EncounterEscapeChoiceDto) =>
    checkByEffect[choice.activeEffectId] ?? choice.checks[0]?.checkDefinitionId

  function escape(
    choice: EncounterEscapeChoiceDto,
    acknowledgedWarnings: EscapeRelationshipInputDto['acknowledgedWarnings']
  ) {
    const checkDefinitionId = chosenCheck(choice)
    if (!checkDefinitionId) return
    return run(
      choice.activeEffectId,
      () =>
        onEscape({
          type: 'ESCAPE_RELATIONSHIP',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: encounterVersion,
          actorId,
          activeEffectId: choice.activeEffectId,
          checkDefinitionId,
          acknowledgedWarnings
        }),
      {
        done: (result) =>
          result.occurrence?.status === 'PENDING'
            ? 'Escape started. Roll the d20 to see if it works.'
            : 'Escape attempted.',
        failed: 'The escape could not be attempted.'
      }
    )
  }

  const confirmingChoice = escapes.find((choice) => choice.activeEffectId === confirming?.id)
  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <Title id={titleId} order={3} size='h5'>
        Escape
      </Title>
      <ul className={styles.list}>
        {escapes.map((choice) => {
          const chosen = chosenCheck(choice)
          if (!chosen) return null
          return (
            <li className={styles.row} key={choice.activeEffectId}>
              <Stack gap={4}>
                <Text fw={600} size='sm'>
                  {choice.label}{' '}
                  <Text c='dimmed' component='span' fw={400} size='xs'>
                    · DC {choice.dc} · {ACTIVATION_REGISTRY[choice.actionCost].label}
                  </Text>
                </Text>
                {choice.warnings.length ? (
                  <Text c='dimmed' size='xs'>
                    {choice.warnings.map((warning) => warning.message).join(' ')}
                  </Text>
                ) : null}
                {choice.checks.length > 1 ? (
                  <Select
                    allowDeselect={false}
                    aria-label={`Check for ${choice.label.toLowerCase()}`}
                    comboboxProps={{ withinPortal: false }}
                    data={choice.checks.map((check) => ({
                      label: check.label,
                      value: check.checkDefinitionId
                    }))}
                    disabled={disabled}
                    size='xs'
                    value={chosen}
                    onChange={(value) =>
                      value &&
                      setCheckByEffect((current) => ({
                        ...current,
                        [choice.activeEffectId]: value
                      }))
                    }
                  />
                ) : null}
              </Stack>
              <Button
                aria-label={choice.label}
                disabled={disabled || submittingId !== null}
                loading={submittingId === choice.activeEffectId}
                size='xs'
                variant='default'
                onClick={() => void escape(choice, [])}
              >
                Escape
              </Button>
            </li>
          )
        })}
      </ul>
      <CampaignTabletopCommandOutcome
        disabled={disabled || submittingId !== null}
        error={error}
        feedback={feedback}
        warnings={confirmingChoice ? (confirming?.warnings ?? null) : null}
        onCancel={cancelConfirmation}
        onConfirm={(warnings) =>
          confirmingChoice &&
          void escape(
            confirmingChoice,
            warnings.map((warning) => warning.code)
          )
        }
      />
    </section>
  )
}
