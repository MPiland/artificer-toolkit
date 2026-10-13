import { Button, Select, Stack, Text, Title, Tooltip } from '@mantine/core'
import { useEffect, useState } from 'react'
import { ACTIVATION_REGISTRY } from '@artificer-toolkit/shared/core'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { CampaignTabletopCommandOutcome } from './CampaignTabletopCommandOutcome'
import { useWarnedCommand } from './useWarnedCommand'
import * as styles from './CampaignTabletopActionList.css'

/**
 * The System's basic actions (Q11), listed apart from the actor's own features. Each row names the
 * action; its rules text is one hover or focus away. An action resolves on the actor unless another
 * creature is chosen first (Help, First Aid).
 */
export function CampaignTabletopBasicActions({
  authoredActions,
  allies,
  actorId,
  encounterId,
  encounterVersion,
  disabled,
  onResolve
}: {
  /** The authored basic actions, each resolved through `RESOLVE_ACTION`. */
  authoredActions: EncounterActionChoiceDto[]
  /** The actors the current actor may aim an action at: every other actor the viewer can see. */
  allies: { id: string; label: string }[]
  actorId: string
  encounterId: string
  encounterVersion: number
  disabled: boolean
  onResolve: (command: ResolveEncounterActionInputDto) => Promise<EncounterCommandResultDto>
}) {
  const [targetByAction, setTargetByAction] = useState<Record<string, string>>({})
  const { submittingId, confirming, feedback, error, run, cancelConfirmation } =
    useWarnedCommand(actorId)

  useEffect(() => {
    setTargetByAction({})
  }, [actorId])

  function resolve(
    choice: EncounterActionChoiceDto,
    acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings']
  ) {
    return run(
      choice.id,
      () =>
        onResolve({
          type: 'RESOLVE_ACTION',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: encounterVersion,
          actorId,
          actionId: choice.id,
          target: { kind: 'ACTOR', actorId: targetByAction[choice.id] ?? actorId },
          sceneContext: null,
          acceptedWieldConflict: null,
          acknowledgedWarnings,
          optionalCombatIntent: null
        }),
      { done: `${choice.label} used.`, failed: 'The action could not be used.' }
    )
  }

  const confirmingAuthored = authoredActions.find((choice) => choice.id === confirming?.id)
  return (
    <section aria-labelledby='basic-actions-title' className={styles.section}>
      <Title id='basic-actions-title' order={3} size='h5'>
        Basic actions
      </Title>
      <ul className={styles.list}>
        {authoredActions.map((choice) => (
          <li className={styles.row} key={choice.id}>
            <Stack gap={4}>
              <Tooltip label={choice.rulesText} multiline w={280} withinPortal={false}>
                <Text fw={600} size='sm' tabIndex={0}>
                  {choice.label}
                  {choice.actionCost ? (
                    <Text c='dimmed' component='span' fw={400} size='xs'>
                      {' '}
                      · {ACTIVATION_REGISTRY[choice.actionCost].label}
                    </Text>
                  ) : null}
                </Text>
              </Tooltip>
              {choice.warnings.length ? (
                <Text c='dimmed' size='xs'>
                  {choice.warnings.map((warning) => warning.message).join(' ')}
                </Text>
              ) : null}
              {choice.target.kind === 'ACTOR' && choice.target.requiresOtherCreature ? (
                <Select
                  aria-label={`Target of ${choice.label.toLowerCase()}`}
                  comboboxProps={{ withinPortal: false }}
                  data={allies.map((entry) => ({ label: entry.label, value: entry.id }))}
                  disabled={disabled}
                  placeholder='Choose a creature'
                  searchable
                  size='xs'
                  value={targetByAction[choice.id] ?? null}
                  onChange={(value) =>
                    setTargetByAction((current) =>
                      value === null
                        ? Object.fromEntries(
                            Object.entries(current).filter(([id]) => id !== choice.id)
                          )
                        : { ...current, [choice.id]: value }
                    )
                  }
                />
              ) : null}
            </Stack>
            <Button
              aria-label={`Use ${choice.label}`}
              disabled={
                disabled ||
                submittingId !== null ||
                (choice.target.kind === 'ACTOR' &&
                  choice.target.requiresOtherCreature &&
                  !targetByAction[choice.id])
              }
              loading={submittingId === choice.id}
              size='xs'
              variant='default'
              onClick={() => void resolve(choice, [])}
            >
              Use
            </Button>
          </li>
        ))}
      </ul>
      <CampaignTabletopCommandOutcome
        disabled={disabled || submittingId !== null}
        error={error}
        feedback={feedback}
        warnings={confirmingAuthored ? (confirming?.warnings ?? null) : null}
        onCancel={cancelConfirmation}
        onConfirm={(warnings) => {
          if (confirmingAuthored)
            void resolve(
              confirmingAuthored,
              warnings.map((warning) => warning.code)
            )
        }}
      />
    </section>
  )
}
