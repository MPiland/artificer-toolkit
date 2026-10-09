import { Alert, Button, List, Select, Stack, Text, Title, Tooltip } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { EncounterBasicActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  UseEncounterBasicActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { ACTIVATION_REGISTRY } from '@artificer-toolkit/shared/core'
import { CampaignTabletopActionConfirmation } from './CampaignTabletopActionConfirmation'
import { LiveSessionCommandRejectedError } from './liveSessionClient'
import * as styles from './CampaignTabletopBasicActions.css'

/**
 * The System's basic actions (Q11), listed apart from the actor's own features. Each row names the
 * action and its cost; its rules text is one hover or focus away. An action that helps an ally asks
 * for the ally first.
 */
export function CampaignTabletopBasicActions({
  basicActions,
  allies,
  actorId,
  encounterId,
  encounterVersion,
  disabled,
  onUse
}: {
  basicActions: EncounterBasicActionChoiceDto[]
  /** The actors the current actor may help: every other actor the viewer can see. */
  allies: { id: string; label: string }[]
  actorId: string
  encounterId: string
  encounterVersion: number
  disabled: boolean
  onUse: (command: UseEncounterBasicActionInputDto) => Promise<EncounterCommandResultDto>
}) {
  const [targetByAction, setTargetByAction] = useState<Record<string, string>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{
    definitionId: string
    warnings: EncounterRuleWarningDto[]
  } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTargetByAction({})
    setConfirming(null)
    setFeedback(null)
    setError(null)
  }, [actorId])

  async function use(
    choice: EncounterBasicActionChoiceDto,
    acknowledgedWarnings: UseEncounterBasicActionInputDto['acknowledgedWarnings']
  ) {
    setConfirming(null)
    setFeedback(null)
    setError(null)
    setSubmittingId(choice.definitionId)
    try {
      await onUse({
        type: 'USE_BASIC_ACTION',
        encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: encounterVersion,
        actorId,
        definitionId: choice.definitionId,
        targetActorId: choice.target ? (targetByAction[choice.definitionId] ?? null) : null,
        acknowledgedWarnings
      })
      setFeedback(`${choice.label} used.`)
    } catch (nextError) {
      if (nextError instanceof LiveSessionCommandRejectedError && nextError.rejection.warnings)
        setConfirming({
          definitionId: choice.definitionId,
          warnings: nextError.rejection.warnings
        })
      else
        setError(nextError instanceof Error ? nextError.message : 'The action could not be used.')
    } finally {
      setSubmittingId(null)
    }
  }

  const confirmingChoice = basicActions.find(
    (choice) => choice.definitionId === confirming?.definitionId
  )
  return (
    <section aria-labelledby='basic-actions-title' className={styles.section}>
      <Title id='basic-actions-title' order={3} size='h5'>
        Basic actions
      </Title>
      <ul className={styles.list}>
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
      {confirming && confirmingChoice ? (
        <CampaignTabletopActionConfirmation
          confirmIsPrimary={false}
          confirmLabel='Do it anyway'
          disabled={disabled || submittingId !== null}
          title='This breaks a rule'
          onCancel={() => setConfirming(null)}
          onConfirm={() =>
            void use(
              confirmingChoice,
              confirming.warnings.map((warning) => warning.code)
            )
          }
        >
          <List size='sm'>
            {confirming.warnings.map((warning) => (
              <List.Item key={warning.code}>{warning.message}</List.Item>
            ))}
          </List>
          <Text c='dimmed' size='xs'>
            The GM sees every override in the Encounter history.
          </Text>
        </CampaignTabletopActionConfirmation>
      ) : null}
      {feedback ? (
        <Alert aria-live='polite' color='green'>
          {feedback}
        </Alert>
      ) : null}
      {error ? (
        <Alert aria-live='assertive' color='red'>
          {error}
        </Alert>
      ) : null}
    </section>
  )
}
