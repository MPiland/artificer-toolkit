import { Button, Select, Stack, Text, Title, Tooltip } from '@mantine/core'
import { useEffect, useState } from 'react'
import type {
  EncounterActionChoiceDto,
  EncounterBasicActionChoiceDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto,
  UseEncounterBasicActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { ACTIVATION_REGISTRY } from '@artificer-toolkit/shared/core'
import { CampaignTabletopCommandOutcome } from './CampaignTabletopCommandOutcome'
import { useWarnedCommand } from './useWarnedCommand'
import * as styles from './CampaignTabletopActionList.css'

/**
 * The System's basic actions (Q11), listed apart from the actor's own features. Each row names the
 * action and its cost; its rules text is one hover or focus away. An action that helps an ally asks
 * for the ally first.
 */
export function CampaignTabletopBasicActions({
  basicActions,
  authoredActions,
  allies,
  actorId,
  encounterId,
  encounterVersion,
  disabled,
  onUse,
  onResolve
}: {
  basicActions: EncounterBasicActionChoiceDto[]
  /** The authored basic actions; each resolves on the actor itself through `RESOLVE_ACTION`. */
  authoredActions: EncounterActionChoiceDto[]
  /** The actors the current actor may help: every other actor the viewer can see. */
  allies: { id: string; label: string }[]
  actorId: string
  encounterId: string
  encounterVersion: number
  disabled: boolean
  onUse: (command: UseEncounterBasicActionInputDto) => Promise<EncounterCommandResultDto>
  onResolve: (command: ResolveEncounterActionInputDto) => Promise<EncounterCommandResultDto>
}) {
  const [targetByAction, setTargetByAction] = useState<Record<string, string>>({})
  const { submittingId, confirming, feedback, error, run, cancelConfirmation } =
    useWarnedCommand(actorId)

  useEffect(() => {
    setTargetByAction({})
  }, [actorId])

  function use(
    choice: EncounterBasicActionChoiceDto,
    acknowledgedWarnings: UseEncounterBasicActionInputDto['acknowledgedWarnings']
  ) {
    return run(
      choice.definitionId,
      () =>
        onUse({
          type: 'USE_BASIC_ACTION',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: encounterVersion,
          actorId,
          definitionId: choice.definitionId,
          targetActorId: choice.target ? (targetByAction[choice.definitionId] ?? null) : null,
          acknowledgedWarnings
        }),
      { done: `${choice.label} used.`, failed: 'The action could not be used.' }
    )
  }

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
          target: { kind: 'ACTOR', actorId },
          sceneContext: null,
          acceptedWieldConflict: null,
          acknowledgedWarnings,
          optionalCombatIntent: null
        }),
      { done: `${choice.label} used.`, failed: 'The action could not be used.' }
    )
  }

  const confirmingChoice = basicActions.find((choice) => choice.definitionId === confirming?.id)
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
                </Text>
              </Tooltip>
              {choice.warnings.length ? (
                <Text c='dimmed' size='xs'>
                  {choice.warnings.map((warning) => warning.message).join(' ')}
                </Text>
              ) : null}
            </Stack>
            <Button
              aria-label={`Use ${choice.label}`}
              disabled={disabled || submittingId !== null}
              loading={submittingId === choice.id}
              size='xs'
              variant='default'
              onClick={() => void resolve(choice, [])}
            >
              Use
            </Button>
          </li>
        ))}
        {basicActions.map((choice) => {
          const chosen = targetByAction[choice.definitionId] ?? null
          return (
            <li className={styles.row} key={choice.definitionId}>
              <Stack gap={4}>
                <Tooltip label={choice.rulesText} multiline w={280} withinPortal={false}>
                  <Text fw={600} size='sm' tabIndex={0}>
                    {choice.label}{' '}
                    <Text c='dimmed' component='span' fw={400} size='xs'>
                      · {ACTIVATION_REGISTRY[choice.actionCost].label}
                    </Text>
                  </Text>
                </Tooltip>
                {choice.warnings.length ? (
                  <Text c='dimmed' size='xs'>
                    {choice.warnings.map((warning) => warning.message).join(' ')}
                  </Text>
                ) : null}
                {choice.target ? (
                  <Select
                    aria-label={`${choice.target === 'ALLY' ? 'Ally to' : 'Target of'} ${choice.label.toLowerCase()}`}
                    comboboxProps={{ withinPortal: false }}
                    data={allies.map((entry) => ({ label: entry.label, value: entry.id }))}
                    disabled={disabled}
                    placeholder={
                      choice.target === 'ALLY' ? 'Choose an ally' : 'Choose a dying Character'
                    }
                    searchable
                    size='xs'
                    value={chosen}
                    onChange={(value) =>
                      setTargetByAction((current) =>
                        value === null
                          ? Object.fromEntries(
                              Object.entries(current).filter(([id]) => id !== choice.definitionId)
                            )
                          : { ...current, [choice.definitionId]: value }
                      )
                    }
                  />
                ) : null}
              </Stack>
              <Button
                aria-label={`Use ${choice.label}`}
                disabled={disabled || submittingId !== null || (choice.target !== null && !chosen)}
                loading={submittingId === choice.definitionId}
                size='xs'
                variant='default'
                onClick={() => void use(choice, [])}
              >
                Use
              </Button>
            </li>
          )
        })}
      </ul>
      <CampaignTabletopCommandOutcome
        disabled={disabled || submittingId !== null}
        error={error}
        feedback={feedback}
        warnings={confirmingChoice || confirmingAuthored ? (confirming?.warnings ?? null) : null}
        onCancel={cancelConfirmation}
        onConfirm={(warnings) => {
          const codes = warnings.map((warning) => warning.code)
          if (confirmingChoice) void use(confirmingChoice, codes)
          else if (confirmingAuthored) void resolve(confirmingAuthored, codes)
        }}
      />
    </section>
  )
}
