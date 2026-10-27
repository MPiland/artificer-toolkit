import { Button, Select, Stack, Text, Title, Tooltip } from '@mantine/core'
import { useState } from 'react'
import { ACTIVATION_REGISTRY } from '@artificer-toolkit/shared/core'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { CampaignTabletopActionConfirmation } from './CampaignTabletopActionConfirmation'
import { CampaignTabletopCommandOutcome } from './CampaignTabletopCommandOutcome'
import { useWarnedCommand } from './useWarnedCommand'
import * as styles from './CampaignTabletopActionList.css'

/** The held-weapon stow a choice needs, which the submitter accepts by confirming it (D152). */
function heldWeaponStow(
  choice: EncounterActionChoiceDto
): ResolveEncounterActionInputDto['acceptedWieldConflict'] {
  return choice.wieldConflict?.kind === 'STOW_HELD_WEAPON'
    ? { kind: 'STOW_HELD_WEAPON', itemInstanceId: choice.wieldConflict.itemInstanceId }
    : null
}

/**
 * The System's basic actions (Q11), listed apart from the actor's own features. Each row names the
 * action; its rules text is one hover or focus away. A `SELF` action resolves on the actor; an
 * `ACTOR` action asks for a creature first, listing the actor unless its targeting refuses it
 * (Help, First Aid), and then for one of its options when it offers several (Shove), the first
 * preselected as in the action drawer (D148). An action that needs a free hand the actor can free
 * by stowing a held weapon asks to stow it first.
 */
export function CampaignTabletopBasicActions({
  authoredActions,
  creatures,
  actorId,
  encounterId,
  encounterVersion,
  disabled,
  onResolve
}: {
  /** The authored basic actions, each resolved through `RESOLVE_ACTION`. */
  authoredActions: EncounterActionChoiceDto[]
  /** The actors the viewer can see, the current actor included. */
  creatures: { id: string; label: string }[]
  actorId: string
  encounterId: string
  encounterVersion: number
  disabled: boolean
  onResolve: (command: ResolveEncounterActionInputDto) => Promise<EncounterCommandResultDto>
}) {
  const [targetByAction, setTargetByAction] = useState<Record<string, string>>({})
  const [optionByAction, setOptionByAction] = useState<Record<string, string>>({})
  const [stowingId, setStowingId] = useState<string | null>(null)
  const { submittingId, confirming, feedback, error, run, cancelConfirmation } =
    useWarnedCommand(actorId)

  const [trackedActorId, setTrackedActorId] = useState(actorId)
  if (trackedActorId !== actorId) {
    setTrackedActorId(actorId)
    setTargetByAction({})
    setOptionByAction({})
    setStowingId(null)
  }

  const choiceOptionsOf = ({ target }: EncounterActionChoiceDto) =>
    target.kind === 'ACTOR' ? target.choiceOptions : undefined
  const chosenOptionId = (choice: EncounterActionChoiceDto) =>
    optionByAction[choice.id] ?? choiceOptionsOf(choice)?.[0]?.id

  function resolve(
    choice: EncounterActionChoiceDto,
    acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings']
  ) {
    const choiceOptionId = chosenOptionId(choice)
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
          target: {
            kind: 'ACTOR',
            actorId: targetByAction[choice.id] ?? actorId,
            ...(choiceOptionId && { choiceOptionId })
          },
          sceneContext: null,
          acceptedWieldConflict: heldWeaponStow(choice),
          acknowledgedWarnings,
          optionalCombatIntent: null
        }),
      { done: `${choice.label} used.`, failed: 'The action could not be used.' }
    )
  }

  const confirmingAuthored = authoredActions.find((choice) => choice.id === confirming?.id)
  const stowing = authoredActions.find((choice) => choice.id === stowingId)
  return (
    <section aria-labelledby='basic-actions-title' className={styles.section}>
      <Title id='basic-actions-title' order={3} size='h5'>
        Basic actions
      </Title>
      <ul className={styles.list}>
        {authoredActions.map((choice) => {
          const { target } = choice
          const needsTarget = target.kind === 'ACTOR'
          const choiceOptions = choiceOptionsOf(choice)
          const options = creatures.filter(
            (entry) =>
              !(target.kind === 'ACTOR' && target.self === 'REFUSED' && entry.id === actorId)
          )
          return (
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
                {needsTarget ? (
                  <Select
                    aria-label={`Target of ${choice.label.toLowerCase()}`}
                    comboboxProps={{ withinPortal: false }}
                    data={options.map((entry) => ({ label: entry.label, value: entry.id }))}
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
                {choiceOptions ? (
                  <Select
                    allowDeselect={false}
                    aria-label={`Option of ${choice.label.toLowerCase()}`}
                    comboboxProps={{ withinPortal: false }}
                    data={choiceOptions.map((option) => ({
                      label: option.label,
                      value: option.id
                    }))}
                    disabled={disabled}
                    size='xs'
                    value={chosenOptionId(choice) ?? null}
                    onChange={(value) => {
                      if (value !== null)
                        setOptionByAction((current) => ({ ...current, [choice.id]: value }))
                    }}
                  />
                ) : null}
              </Stack>
              <Button
                aria-label={`Use ${choice.label}`}
                disabled={
                  disabled || submittingId !== null || (needsTarget && !targetByAction[choice.id])
                }
                loading={submittingId === choice.id}
                size='xs'
                variant='default'
                onClick={() =>
                  heldWeaponStow(choice) ? setStowingId(choice.id) : void resolve(choice, [])
                }
              >
                Use
              </Button>
            </li>
          )
        })}
      </ul>
      {stowing ? (
        <CampaignTabletopActionConfirmation
          confirmIsPrimary
          confirmLabel={`Stow weapon and ${stowing.label.toLowerCase()}`}
          disabled={disabled || submittingId !== null}
          title='Stow a held weapon?'
          onCancel={() => setStowingId(null)}
          onConfirm={() => {
            setStowingId(null)
            void resolve(stowing, [])
          }}
        >
          <Text size='sm'>
            {stowing.label} needs a free hand, so it stows a weapon you hold. Stowing it is free.
          </Text>
        </CampaignTabletopActionConfirmation>
      ) : null}
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
